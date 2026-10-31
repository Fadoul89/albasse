// Lecture, pour l'administrateur, de TOUS les articles regardés de près (« Intérêt élevé ») par des clients connectés, de leurs commandes
// et des articles eux-mêmes (prix et stock du jour). La base ne laisse lire visitor_product_interest qu'aux administrateurs (règle RLS).
//
// Pourquoi ne pas réutiliser le tableau de suivi (browsing_overview) : il ne renvoie que les 300 regards les plus récents sur près de
// 3 000 par mois ; il ne reconnaissait donc que 1 compte « Intérêt élevé » sur 30. Ici on lit seulement les lignes « Intérêt élevé ».
import { supabase } from './supabase';
import { isUuid, orderedByUser, type InterestRow, type OrderLite, type RelanceProduct } from './relanceMessage';

const DAY_MS = 86_400_000;
export const RELANCE_DAYS = 30;
const ROW_LIMIT = 1000;

export interface RelanceData {
  rows: InterestRow[];
  ordered: Map<string, Set<string>>;
  products: Map<string, RelanceProduct>;
}

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const CART = ['none', 'in_cart', 'removed', 'purchased'] as const;

// null : lecture impossible (réseau, droits) ; l'écran garde alors le message général
export async function fetchRelanceData(now: number = Date.now()): Promise<RelanceData | null> {
  try {
    const since = new Date(now - RELANCE_DAYS * DAY_MS).toISOString();
    const { data: raw, error } = await supabase
      .from('visitor_product_interest')
      .select('user_id,product_id,cart_status,last_viewed_at,active_seconds')
      .eq('interest', 'eleve')
      .not('user_id', 'is', null)
      .gte('last_viewed_at', since)
      .order('last_viewed_at', { ascending: false })
      .limit(ROW_LIMIT);
    if (error || !raw) return null;

    const rows: InterestRow[] = (raw as Record<string, unknown>[])
      .filter((r) => typeof r.user_id === 'string' && typeof r.product_id === 'string')
      .map((r) => ({
        userId: r.user_id as string,
        productId: r.product_id as string,
        cartStatus: (CART as readonly string[]).includes(r.cart_status as string) ? (r.cart_status as InterestRow['cartStatus']) : 'none',
        lastViewedAt: typeof r.last_viewed_at === 'string' ? r.last_viewed_at : null,
        activeSeconds: num(r.active_seconds),
      }));
    if (rows.length === 0) return { rows, ordered: new Map(), products: new Map() };

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const productIds = [...new Set(rows.map((r) => r.productId))].filter(isUuid);
    const [orders, prods] = await Promise.all([
      Promise.resolve(supabase.from('orders').select('user_id,status,items').in('user_id', userIds)),
      productIds.length ? Promise.resolve(supabase.from('products').select('id,name,slug,price,compare_at_price,stock,is_active').in('id', productIds)) : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const products = new Map<string, RelanceProduct>();
    for (const p of (prods.data ?? []) as Record<string, unknown>[]) {
      if (typeof p.id !== 'string') continue;
      products.set(p.id, {
        id: p.id,
        name: String(p.name ?? ''),
        slug: typeof p.slug === 'string' && p.slug ? p.slug : null,
        price: num(p.price),
        compare_at_price: p.compare_at_price == null ? null : num(p.compare_at_price),
        stock: num(p.stock),
        is_active: p.is_active === true,
      });
    }
    // sans les commandes on ne saurait pas si le client a déjà acheté l'article : mieux vaut ne rien proposer que se tromper
    if ('error' in orders && orders.error) return null;
    return { rows, ordered: orderedByUser(((orders as { data?: unknown[] }).data ?? []) as OrderLite[]), products };
  } catch {
    return null;
  }
}
