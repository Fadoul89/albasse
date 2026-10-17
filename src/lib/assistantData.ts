import { supabase } from './supabase';
import { buildProduct, type CatalogProduct, type City } from './assistantBrain';

// Donnees publiques lues pour Zara (catalogue, villes, categories, infos de la boutique), gardees
// 5 minutes en memoire. Lecture seule avec la cle publique : rien n'est ecrit.
const TTL_MS = 5 * 60 * 1000;
// Si la base ne repond pas, Zara ne fait pas attendre le visiteur plus de 8 s, et elle ne reessaie
// pas pendant 15 s (les reponses suivantes arrivent tout de suite avec un message d'excuse).
const TIMEOUT_MS = 8000;
const RETRY_AFTER_ERROR_MS = 15 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface AssistantProduct {
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  image: string | null;
  in_stock: boolean;
}

export interface CategoryInfo {
  name: string;
  slug: string;
}

export interface StoreInfo {
  hours: string | null;
  address: string | null;
  city: string | null;
  mapsUrl: string | null;
}

export function toCard(p: CatalogProduct): AssistantProduct {
  return { slug: p.slug, name: p.name, price: p.price, compare_at_price: p.compareAt, image: p.image, in_stock: p.stock > 0 };
}

function cached<T>(load: () => Promise<T>) {
  let entry: { at: number; value: T } | null = null;
  let failure: { at: number; error: unknown } | null = null;
  let pending: Promise<T> | null = null;
  return async (): Promise<T> => {
    const now = Date.now();
    if (entry && now - entry.at < TTL_MS) return entry.value;
    if (failure && now - failure.at < RETRY_AFTER_ERROR_MS) {
      if (entry) return entry.value; // donnees un peu anciennes : mieux que rien
      throw failure.error;
    }
    if (pending) return pending;
    pending = withTimeout(load(), TIMEOUT_MS)
      .then(
        (value) => {
          entry = { at: Date.now(), value };
          failure = null;
          return value;
        },
        (error) => {
          failure = { at: Date.now(), error };
          if (entry) return entry.value;
          throw error;
        }
      )
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

export const getCategories = cached<CategoryInfo[]>(async () => {
  const { data, error } = await supabase.from('categories').select('name,slug').order('name');
  if (error) throw error;
  return (data ?? []) as CategoryInfo[];
});

export const getCatalog = cached<CatalogProduct[]>(async () => {
  const [cats, prods] = await Promise.all([
    supabase.from('categories').select('id,name'),
    supabase
      .from('products')
      .select('id,name,slug,price,compare_at_price,stock,category_id,colors,description,images,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;
  const names = new Map<string, string>(((cats.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return ((prods.data ?? []) as Record<string, any>[]).map((p) =>
    buildProduct({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compare_at_price: p.compare_at_price,
      stock: p.stock,
      category: names.get(p.category_id) ?? '',
      colors: p.colors,
      description: p.description,
      image: Array.isArray(p.images) && p.images.length ? p.images[0] : null,
      created_at: p.created_at,
    })
  );
});

export const getCities = cached<City[]>(async () => {
  const { data, error } = await supabase
    .from('cities')
    .select('name,delivery_fee,delivery_agency')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as { name: string; delivery_fee: number | null; delivery_agency: string | null }[]).map((c) => ({
    name: c.name,
    fee: c.delivery_fee,
    agency: c.delivery_agency,
  }));
});

export const getStoreInfo = cached<StoreInfo>(async () => {
  const { data } = await supabase.from('store_settings').select('hours,address,city,google_maps_url').limit(1).maybeSingle();
  return { hours: data?.hours ?? null, address: data?.address ?? null, city: data?.city ?? null, mapsUrl: data?.google_maps_url ?? null };
});
