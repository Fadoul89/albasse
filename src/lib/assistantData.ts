import { supabase } from './supabase';
import { buildProduct, type CatalogProduct, type City } from './assistantBrain';
import type { Product } from '../types';

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
  stock: number;
}

export interface CategoryInfo {
  name: string;
  slug: string;
}

export interface StoreInfo {
  hours: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  mapsUrl: string | null;
}

export function toCard(p: CatalogProduct): AssistantProduct {
  return { slug: p.slug, name: p.name, price: p.price, compare_at_price: p.compareAt, image: p.image, in_stock: p.stock > 0, stock: p.stock };
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
    supabase.from('categories').select('id,name,slug'),
    supabase
      .from('products')
      .select('id,name,slug,price,compare_at_price,stock,category_id,colors,sizes,description,images,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;
  const categories = new Map<string, { name: string; slug: string }>(
    ((cats.data ?? []) as { id: string; name: string; slug: string }[]).map((c) => [c.id, { name: c.name, slug: c.slug }])
  );
  return ((prods.data ?? []) as Record<string, any>[]).map((p) =>
    buildProduct({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compare_at_price: p.compare_at_price,
      stock: p.stock,
      category: categories.get(p.category_id)?.name ?? '',
      category_slug: categories.get(p.category_id)?.slug ?? '',
      colors: p.colors,
      sizes: p.sizes,
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
  const { data } = await supabase.from('store_settings').select('hours,address,city,phone,google_maps_url').limit(1).maybeSingle();
  return {
    hours: data?.hours ?? null,
    address: data?.address ?? null,
    city: data?.city ?? null,
    phone: data?.phone ?? null,
    mapsUrl: data?.google_maps_url ?? null,
  };
});

// ---------------------------------------------------------------------------------------------
// Panier : le prix, le stock et les variantes viennent de la base AU MOMENT de l'ajout (jamais du cache de Zara).
// Lecture seule avec la cle publique ; la commande, elle, passe par le parcours officiel du site.
// ---------------------------------------------------------------------------------------------

export async function fetchProductForCart(slug: string): Promise<Product | null> {
  const { data, error } = await withTimeout(
    Promise.resolve(supabase.from('products').select('*').eq('slug', slug).eq('is_active', true).maybeSingle()),
    TIMEOUT_MS
  );
  if (error) throw error;
  if (!data) return null;
  const p = data as Product;
  return { ...p, images: p.images ?? [], colors: p.colors ?? [], sizes: p.sizes ?? [], price: Number(p.price), stock: Number(p.stock ?? 0) };
}

// « Vous êtes mon Nᵉ client aujourd'hui » : la fonction `assistant_chat_start` (add-assistant-client-counter.sql) note une
// nouvelle conversation et renvoie son rang du jour. Tant qu'elle n'est pas installée, ou en cas de panne : null, et Zara
// ne dit AUCUN nombre (jamais de nombre inventé).
export async function startChatToday(): Promise<number | null> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(supabase.rpc('assistant_chat_start')), 3000);
    const n = Number(data);
    return !error && Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// Points de fidélité du client connecté, relus dans son compte au moment de la question (jamais une valeur gardée en mémoire).
// null : on n'a pas pu les lire.
export async function fetchLoyaltyPoints(userId: string): Promise<number | null> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(supabase.from('profiles').select('loyalty_points').eq('id', userId).maybeSingle()), TIMEOUT_MS);
    if (error || !data) return null;
    const n = Number((data as { loyalty_points?: number | null }).loyalty_points ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

// Numéros et liens de paiement Mobile Money réglés par la boutique (les mêmes que sur la page de commande).
export interface PaymentNumbers {
  airtelNumber: string | null;
  airtelUrl: string | null;
  moovNumber: string | null;
  moovUrl: string | null;
}

export async function fetchPaymentNumbers(): Promise<PaymentNumbers | null> {
  const { data, error } = await withTimeout(Promise.resolve(supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle()), TIMEOUT_MS);
  if (error || !data) return null;
  const row = data as { airtel_number?: string | null; airtel_payment_url?: string | null; moov_number?: string | null; moov_payment_url?: string | null };
  return { airtelNumber: row.airtel_number ?? null, airtelUrl: row.airtel_payment_url ?? null, moovNumber: row.moov_number ?? null, moovUrl: row.moov_payment_url ?? null };
}

export interface CartProductStatus {
  id: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
}

// Prix, ancien prix et stock actuels des produits du panier.
export async function fetchCartStatus(ids: string[]): Promise<CartProductStatus[]> {
  const { data, error } = await withTimeout(
    Promise.resolve(supabase.from('products').select('id,price,compare_at_price,stock,is_active').in('id', ids)),
    TIMEOUT_MS
  );
  if (error) throw error;
  return ((data ?? []) as CartProductStatus[]).map((r) => ({
    id: r.id,
    price: Number(r.price),
    compare_at_price: r.compare_at_price == null ? null : Number(r.compare_at_price),
    stock: Number(r.stock ?? 0),
    is_active: !!r.is_active,
  }));
}
