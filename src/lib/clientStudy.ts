// « Zara a étudié ce client » (demande du patron, 10 novembre 2026 : « Zara doit étudier chaque client ») : la fiche de l'administrateur, sur la page de chaque client.
// Elle montre CE QUE ZARA A COMPRIS (public, articles préférés, regardés sans plus, commandés) et CE QU'ELLE LUI PROPOSE (la même affiche que sur son accueil),
// d'après ce que le site a VRAIMENT enregistré pour ce client : ses regards (suivi de la base), ses favoris, ses commandes, ce qu'il a écrit dans son compte.
// Rien n'est deviné. Des fonctions pures, sans réseau : testées dans tests/email/client-study.test.ts. Voir docs/zara-etude-client.md.
import { adHeadline, adWhy, pickTargetedAd, rankInterest, type AdCategory, type AdProduct, type InterestRecordInput, type TargetedAd } from './adTargeting';
import { AUDIENCE_LABEL, audiencesOf, type Audience } from './adAudiences';

export interface StudyCustomer {
  gender?: unknown;
  profession?: string | null;
  region?: string | null;
  birth_date?: unknown;
  marital_status?: unknown;
}
// Une ligne du suivi de la base (visitor_product_interest) pour ce client
export interface StudyInterestRow {
  productId: string;
  level: 'eleve' | 'moyen' | 'leger';
  views: number;
  lastViewedAt: number;
  cartStatus: string;
}
export interface StudyInput {
  customer: StudyCustomer;
  interest: readonly StudyInterestRow[];
  likedIds: readonly string[];
  orderedProductIds: readonly string[];
  products: readonly AdProduct[]; // les articles en vente (le choix de l'affiche se fait dedans)
  categories: readonly AdCategory[];
  names?: Readonly<Record<string, string>>; // les noms d'articles qui ne sont plus en vente (pour les écrire quand même)
  now?: number;
}

export type StudyLevel = 'eleve' | 'moyen' | 'leger' | 'aucun';
export interface StudyLine {
  id: string;
  name: string;
  why: string; // « ❤️ aimé · intérêt élevé · regardé 2× »
  available: boolean; // en vente (sinon Zara ne le propose pas)
}
export interface ClientStudy {
  level: StudyLevel;
  summary: string;
  audiences: Audience[];
  audienceLabels: string[];
  loved: StudyLine[]; // les articles d'intérêt élevé (regardés de près ou aimés), du meilleur au moins bon
  weak: StudyLine[]; // regardés sans plus (pas assez pour l'affiche)
  ordered: StudyLine[]; // déjà commandés : jamais reproposés
  ad: TargetedAd | null;
  adHeadline: string | null;
  adWhy: string | null;
  adNames: string[]; // les articles de l'affiche, du premier (en grand) au dernier
  notes: string[]; // ce que Zara ne sait pas encore, dit honnêtement
}

const eligible = (p: AdProduct | undefined): boolean => !!p && p.is_active !== false && Number(p.stock ?? 0) > 0 && Number(p.price) > 0 && !!p.images?.[0];

export function studyClient(input: StudyInput): ClientStudy {
  const now = input.now ?? Date.now();
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const nameOf = (id: string) => (byId.get(id)?.name ?? input.names?.[id] ?? 'Article retiré de la vente').replace(/\s+/g, ' ').trim();
  const availableOf = (id: string) => eligible(byId.get(id));
  const ordered = new Set(input.orderedProductIds);
  const liked = new Set(input.likedIds);
  const records: InterestRecordInput[] = input.interest.map((r) => ({ id: r.productId, level: r.level, views: r.views, lastViewedAt: r.lastViewedAt, purchased: r.cartStatus === 'purchased' || ordered.has(r.productId) }));
  const recOf = new Map(records.map((r) => [r.id, r]));

  // les articles d'intérêt élevé : TOUS (même indisponibles : le fiche les montre, avec « pas proposé »), du meilleur au moins bon
  const ranked = rankInterest(records, input.likedIds, (id) => !ordered.has(id));
  const loved: StudyLine[] = ranked.map((c) => {
    const r = recOf.get(c.id);
    const parts = [
      liked.has(c.id) ? '❤️ aimé' : null,
      r?.level === 'eleve' ? 'intérêt élevé' : r && r.level === 'moyen' && r.views >= 2 ? 'intérêt moyen' : null,
      r && r.views > 0 ? `regardé ${r.views}×` : null,
      r?.purchased ? null : null,
      availableOf(c.id) ? null : 'plus en vente : Zara ne le propose pas',
    ].filter(Boolean) as string[];
    return { id: c.id, name: nameOf(c.id), why: parts.join(' · '), available: availableOf(c.id) };
  });
  const lovedIds = new Set(loved.map((l) => l.id));
  const weak: StudyLine[] = records
    .filter((r) => !lovedIds.has(r.id) && !ordered.has(r.id) && !r.purchased && r.views > 0)
    .sort((a, b) => b.views - a.views || b.lastViewedAt - a.lastViewedAt)
    .map((r) => ({ id: r.id, name: nameOf(r.id), why: `regardé ${r.views}×`, available: availableOf(r.id) }));
  const orderedLines: StudyLine[] = [...ordered].map((id) => ({ id, name: nameOf(id), why: 'déjà commandé', available: availableOf(id) }));

  // ce que Zara lui propose : la même affiche que sur son accueil, avec ce que la base sait de lui
  const ad = pickTargetedAd({
    products: [...input.products],
    categories: [...input.categories],
    customer: input.customer,
    browsing: null,
    interest: records,
    favorites: input.likedIds,
    orderedProductIds: input.orderedProductIds,
    now,
  });
  const adNames = ad ? [ad.product.name, ...(ad.more ?? []).map((m) => m.name)].map((n) => n.replace(/\s+/g, ' ').trim()) : [];

  const audiences = audiencesOf(input.customer);
  const audienceLabels = audiences.map((a) => AUDIENCE_LABEL[a].fr);

  const anyViews = records.some((r) => r.views > 0);
  const level: StudyLevel = loved.length > 0 ? 'eleve' : records.some((r) => r.level === 'moyen') ? 'moyen' : anyViews ? 'leger' : 'aucun';
  const lovedAvailable = loved.filter((l) => l.available).length;
  const summary =
    level === 'eleve'
      ? `💙 Intérêt élevé : Zara a repéré ${loved.length} article${loved.length > 1 ? 's' : ''} que ce client regarde de près ou aime${lovedAvailable < loved.length ? ` (${lovedAvailable} en vente)` : ''}.`
      : level === 'moyen'
        ? '🟡 Intérêt moyen : le client regarde des articles, mais aucun assez pour l’affiche « Vos articles préférés ».'
        : level === 'leger'
          ? '⚪ Intérêt léger : quelques regards isolés, rien de fort.'
          : '⚪ Zara n’a encore rien enregistré sur ce que ce client regarde ou aime.';

  const notes: string[] = [];
  if (!input.customer.profession || !input.customer.profession.trim()) notes.push('Aucun métier écrit dans le compte : Zara ne peut pas lui proposer d’offre selon son métier.');
  else if (audiences.every((a) => a === 'femme' || a === 'homme')) notes.push(`Le métier écrit (« ${input.customer.profession.trim()} ») ne correspond à aucun public de Zara (élève, étudiant, administrateur, militaire…).`);
  if (!input.customer.gender) notes.push('Aucun genre choisi dans le compte.');
  if (input.likedIds.length === 0) notes.push('Aucun article aimé (cœur ❤️).');
  if (!anyViews) notes.push('Aucun regard enregistré dans le suivi du site pour ce client.');
  if (!ad) notes.push('Zara ne lui propose rien pour le moment : aucune raison vraie (elle n’invente jamais une annonce).');

  return {
    level,
    summary,
    audiences,
    audienceLabels,
    loved,
    weak,
    ordered: orderedLines,
    ad,
    adHeadline: ad ? adHeadline(ad.reason, 'fr') : null,
    adWhy: ad ? adWhy(ad.reason, 'fr') : null,
    adNames,
    notes,
  };
}

export const LEVEL_BADGE: Record<StudyLevel, string> = {
  eleve: '💙 Intérêt élevé',
  moyen: '🟡 Intérêt moyen',
  leger: '⚪ Intérêt léger',
  aucun: '⚪ Rien d’enregistré',
};
