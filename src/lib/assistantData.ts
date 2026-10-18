import { supabase } from './supabase';
import { buildProduct, type CatalogProduct, type City } from './assistantBrain';
import { currentDevice, type DeviceLabel } from './assistantAttribution';
import { buildZaraStats, classifyStatsError, periodBounds, type StatsPeriod, type StatsFailure, type ZaraStats } from './assistantStats';
import { buildBrowsingOverview, type BrowsingOverview } from './browsingOverview';
import { buildSalesMap, SALES_WINDOW_DAYS, type SalesMap } from './assistantSales';
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
export async function startChatToday(device: DeviceLabel = currentDevice()): Promise<number | null> {
  try {
    // La conversation note aussi le type d'appareil (iPhone, Android...) pour les statistiques de Zara.
    let { data, error } = await withTimeout(Promise.resolve(supabase.rpc('assistant_chat_start', { p_device: device })), 3000);
    // Ancienne version de la fonction (sans appareil) : on refait l'appel sans, une seule fois. Jamais après une simple lenteur.
    if (error && (error as { code?: string }).code === 'PGRST202') {
      ({ data, error } = await withTimeout(Promise.resolve(supabase.rpc('assistant_chat_start')), 3000));
    }
    const n = Number(data);
    return !error && Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// Les gestes de Zara autour de l'installation, pour ses statistiques (aucun texte, aucune donnée personnelle : le nom du geste
// et le type d'appareil). Silencieux : une statistique ne doit jamais gêner le client, ni afficher une erreur.
export type AssistantEvent = 'install_question' | 'install_already' | 'install_later' | 'install_ios_guide';

export function logAssistantEvent(event: AssistantEvent, device: DeviceLabel = currentDevice()): void {
  try {
    void Promise.resolve(supabase.rpc('assistant_log_event', { p_event: event, p_device: device })).then(
      () => undefined,
      () => undefined
    );
  } catch {
    // ignore
  }
}

// Les chiffres de la page « Statistiques de Zara » (administrateur seulement : la base refuse les autres).
export type AssistantStatsResult = { ok: true; stats: ZaraStats } | { ok: false; reason: StatsFailure; message: string };

export async function fetchAssistantStats(period: StatsPeriod): Promise<AssistantStatsResult> {
  try {
    const { since, until } = periodBounds(period);
    const { data, error, status } = await withTimeout(Promise.resolve(supabase.rpc('assistant_stats', { p_since: since, p_until: until })), 15000);
    if (error) return { ok: false, reason: classifyStatsError({ code: (error as { code?: string }).code, message: error.message, status }), message: error.message };
    return { ok: true, stats: buildZaraStats(data as Parameters<typeof buildZaraStats>[0]) };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

// Le tableau de suivi de navigation (administrateur seulement : la base refuse les autres).
export type BrowsingOverviewResult = { ok: true; overview: BrowsingOverview } | { ok: false; reason: StatsFailure; message: string };

export async function fetchBrowsingOverview(period: StatsPeriod): Promise<BrowsingOverviewResult> {
  try {
    const { since } = periodBounds(period);
    const { data, error, status } = await withTimeout(Promise.resolve(supabase.rpc('browsing_overview', { p_since: since, p_limit: 300 })), 15000);
    if (error) return { ok: false, reason: classifyStatsError({ code: (error as { code?: string }).code, message: error.message, status }), message: error.message };
    return { ok: true, overview: buildBrowsingOverview(data) };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
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

// Ventes réelles des derniers jours, par article (chiffres globaux, aucune donnée de client). Gardées 5 minutes.
// Sans la fonction de la base (script pas encore appliqué), ou en cas de panne : une liste vide, et Zara ne dit AUCUN chiffre.
const loadSales = cached<SalesMap>(async () => {
  const { data, error } = await supabase.rpc('assistant_product_sales', { p_days: SALES_WINDOW_DAYS });
  // script de la base pas encore appliqué : liste vide, et on ne redemande pas avant 5 minutes (aucun chiffre n'est dit)
  if (error && (error as { code?: string }).code === 'PGRST202') return new Map();
  if (error) throw error;
  return buildSalesMap(data);
});

export async function getProductSales(): Promise<SalesMap> {
  try {
    return await loadSales();
  } catch {
    return new Map();
  }
}

// « Me rappeler sur WhatsApp » : la demande part à l'équipe (fonction `assistant_request_callback`, qui vérifie le numéro).
// 'ok' : enregistrée ; 'invalid' : numéro ou prénom refusé ; 'error' : fonction absente ou panne (Zara renvoie alors vers WhatsApp).
export type CallbackSource = 'later' | 'price' | 'cart' | 'chat';
export type CallbackResult = 'ok' | 'invalid' | 'error';

export async function requestCallback(input: { name: string; phone: string; note: string; source: CallbackSource; day?: string | null }, device: DeviceLabel = currentDevice()): Promise<CallbackResult> {
  try {
    const base = { p_name: input.name, p_phone: input.phone, p_note: input.note, p_source: input.source, p_device: device };
    // le jour choisi (AAAA-MM-JJ) ; l'ancienne fonction de la base (sans jour) est refusée comme « introuvable » : on redemande sans le jour, une seule fois
    let { data, error } = await withTimeout(Promise.resolve(supabase.rpc('assistant_request_callback', input.day ? { ...base, p_day: input.day } : base)), TIMEOUT_MS);
    if (error && input.day && (error as { code?: string }).code === 'PGRST202') {
      ({ data, error } = await withTimeout(Promise.resolve(supabase.rpc('assistant_request_callback', base)), TIMEOUT_MS));
    }
    if (error) return 'error';
    return data === true ? 'ok' : 'invalid';
  } catch {
    return 'error';
  }
}

// La liste « Rappels WhatsApp » de l'admin (la base refuse tout autre que l'administrateur).
export interface CallbackRow {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  note: string;
  source: CallbackSource;
  device: string;
  status: 'new' | 'done';
  wanted_day: string | null; // AAAA-MM-JJ : le jour que le client a choisi (vide : pas de jour)
}

export type CallbackListResult = { ok: true; rows: CallbackRow[] } | { ok: false; reason: 'missing' | 'forbidden' | 'error'; message: string };

export async function fetchCallbacks(): Promise<CallbackListResult> {
  try {
    const { data, error, status } = await withTimeout(
      Promise.resolve(supabase.from('assistant_callbacks').select('*').order('created_at', { ascending: false }).limit(300)),
      15000
    );
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PGRST205' || code === '42P01') return { ok: false, reason: 'missing', message: error.message };
      if (status === 401 || status === 403 || code === '42501') return { ok: false, reason: 'forbidden', message: error.message };
      return { ok: false, reason: 'error', message: error.message };
    }
    return { ok: true, rows: ((data ?? []) as CallbackRow[]).map((r) => ({ ...r, note: r.note ?? '', wanted_day: r.wanted_day ?? null })) };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export async function setCallbackDone(id: string, done: boolean): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(supabase.from('assistant_callbacks').update({ status: done ? 'done' : 'new', done_at: done ? new Date().toISOString() : null }).eq('id', id)),
      TIMEOUT_MS
    );
    return !error;
  } catch {
    return false;
  }
}
