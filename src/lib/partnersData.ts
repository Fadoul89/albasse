// Lecture et écriture des partenaires (administrateur seulement : règles de la base add-partners.sql).
// Tant que le script SQL n'est pas lancé, tout répond « pas disponible » (null) et les écrans cachent simplement la partie partenaires.
import { supabase } from './supabase';
import { checkLinkNote, checkPartnerInput, isMissingPartnersTable, type Partner, type ProductPartnerLink } from './partners';

export interface PartnerData {
  partners: Partner[];
  links: ProductPartnerLink[];
}

const PAGE = 1000;

// null : pas disponible (script pas lancé, pas administrateur, réseau) → l'écran n'affiche rien de plus qu'avant
export async function fetchPartnerData(): Promise<PartnerData | null> {
  try {
    const p = await supabase.from('partners').select('id,name,phone,note,created_at').order('name', { ascending: true }).limit(500);
    if (p.error || !p.data) return null;
    const links: ProductPartnerLink[] = [];
    for (let page = 0; page < 10; page++) {
      const l = await supabase.from('product_partners').select('product_id,partner_id,note').order('product_id').range(page * PAGE, page * PAGE + PAGE - 1);
      if (l.error || !l.data) return null;
      links.push(...(l.data as ProductPartnerLink[]));
      if (l.data.length < PAGE) break;
    }
    return { partners: p.data as Partner[], links };
  } catch {
    return null;
  }
}

export type SaveResult = { ok: true } | { ok: false; message: string };

const explain = (error: { code?: string; message?: string }): string =>
  isMissingPartnersTable(error) ? 'Le script add-partners.sql n’est pas encore lancé dans Supabase.' : (error.message ?? 'Enregistrement impossible.');

export async function addPartner(input: { name: string; phone?: string; note?: string }): Promise<SaveResult & { partner?: Partner }> {
  const check = checkPartnerInput(input);
  if (!check.ok) return { ok: false, message: check.message };
  const { data, error } = await supabase.from('partners').insert(check.value).select('id,name,phone,note,created_at').single();
  if (error || !data) return { ok: false, message: explain(error ?? {}) };
  return { ok: true, partner: data as Partner };
}

export async function updatePartner(id: string, input: { name: string; phone?: string; note?: string }): Promise<SaveResult> {
  const check = checkPartnerInput(input);
  if (!check.ok) return { ok: false, message: check.message };
  const { error } = await supabase.from('partners').update(check.value).eq('id', id);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

// Supprime le partenaire : les liens de ses articles disparaissent avec lui (les articles ne sont jamais touchés)
export async function deletePartner(id: string): Promise<SaveResult> {
  const { error } = await supabase.from('partners').delete().eq('id', id);
  return error ? { ok: false, message: explain(error) } : { ok: true };
}

// Associe un article à un partenaire (partnerId null = « cet article est à moi » : le lien disparaît)
export async function setProductPartner(productId: string, partnerId: string | null, note: string): Promise<SaveResult> {
  if (!partnerId) {
    const { error } = await supabase.from('product_partners').delete().eq('product_id', productId);
    return error ? { ok: false, message: explain(error) } : { ok: true };
  }
  const n = checkLinkNote(note);
  if (!n.ok) return { ok: false, message: n.message };
  const { error } = await supabase.from('product_partners').upsert({ product_id: productId, partner_id: partnerId, note: n.value }, { onConflict: 'product_id' });
  return error ? { ok: false, message: explain(error) } : { ok: true };
}
