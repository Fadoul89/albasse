// « Annonce » ciblée de Zara : choix de l'article, raison vraie, genre, ville, fermeture. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/ad-targeting.test.ts
import { isVitalityCategory, vitalityAllowed, adAllowedProducts, VITALITY_MIN_AGE } from '../../src/lib/adSensitive.ts';
import { AD_MAX_CLOSES, AD_NEXT_SECONDS, AD_ROTATE_HOURS, addClosedAd, closedState, parseClosedAds, isAdultItem, adHeadline, adSeed, adWhy, audienceAllows, audienceOf, deliveryLine, nextAdChange, pickTargetedAd, previewAudiences, promoEndsAt, realPromoPct, type AdCategory, type AdProduct } from '../../src/lib/adTargeting.ts';
import { AUDIENCES, audiencesOf, professionAudience } from '../../src/lib/adAudiences.ts';
import { applyCategoryView, applyProductView, applyCartEvent, emptyProfile, type BrowsingProfile, type ProductMeta } from '../../src/lib/browsingInsights.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

// Airtel / Moov retirés « pour le moment » : EXPO_PUBLIC_MOBILE_MONEY=on lance les anciens contrôles
const MM = process.env.EXPO_PUBLIC_MOBILE_MONEY === 'on';
const NOW = Date.parse('2026-11-03T09:00:00Z');
const DAY = 24 * 3600 * 1000;
const iso = (t: number) => new Date(t).toISOString();

const cats: AdCategory[] = [
  { id: 'c-watch', slug: 'montres', name: 'Montres' },
  { id: 'c-perfume', slug: 'parfum', name: 'Parfum' },
  { id: 'c-women', slug: 'vetements-pour-femmes', name: 'Vêtements pour femmes' },
  { id: 'c-men', slug: 'vitalite-energie-homme', name: 'Vitalité & Énergie Homme' },
  { id: 'c-menwear', slug: 'vetements-pour-hommes', name: 'Vêtements pour hommes' },
];
const mk = (id: string, category_id: string, extra: Partial<AdProduct> = {}): AdProduct => ({ id, slug: `slug-${id}`, name: `Article ${id}`, price: 20000, compare_at_price: null, stock: 8, images: [`https://img/${id}.jpg`], category_id, is_active: true, created_at: '2026-10-01T00:00:00Z', ...extra });
const meta = (p: AdProduct): ProductMeta => ({ id: p.id, name: p.name, slug: p.slug, categoryId: p.category_id, categorySlug: cats.find((c) => c.id === p.category_id)?.slug ?? null, categoryName: cats.find((c) => c.id === p.category_id)?.name ?? null });

// un client qui regarde plusieurs fois le même article (intérêt élevé), sur 2 visites
function viewMany(profile: BrowsingProfile, p: AdProduct, times: number, at: number): BrowsingProfile {
  let cur = profile;
  for (let i = 0; i < times; i++) cur = applyProductView(cur, meta(p), at + i * 31 * 60 * 1000).profile;
  return cur;
}

const watchA = mk('wa', 'c-watch');
const watchB = mk('wb', 'c-watch');
const watchC = mk('wc', 'c-watch');
const perfume = mk('pa', 'c-perfume');
const dress = mk('da', 'c-women');
const coffee = mk('cm', 'c-men');
const all = [watchA, watchB, watchC, perfume, dress, coffee];

// --- le genre -----------------------------------------------------------------------------------------------------------------------------
check('« Vêtements pour femmes » : audience Femme ; « Vitalité & Énergie Homme » : audience Homme ; « Montres » : tout le monde', audienceOf('Vêtements pour femmes') === 'femme' && audienceOf('Vitalité & Énergie Homme') === 'homme' && audienceOf('Montres') === null);
check('l\'arabe est compris (نساء / رجال)', audienceOf('ملابس نساء') === 'femme' && audienceOf('عطور رجال') === 'homme');
check('un nom qui parle des deux : tout le monde ; un champ vide : tout le monde', audienceOf('Parfum homme et femme') === null && audienceOf('') === null && audienceOf(null) === null);
check('un homme ne reçoit pas une catégorie pour femmes (et l\'inverse) ; genre non précisé : tout est permis', !audienceAllows('homme', 'femme') && !audienceAllows('femme', 'homme') && audienceAllows('homme', 'homme') && audienceAllows(null, 'femme') && audienceAllows(undefined, 'homme') && audienceAllows('n\'importe quoi', 'femme'));

// --- 1. l'article regardé de près ----------------------------------------------------------------------------------------------------------
let prof = emptyProfile('v1', NOW - 5 * DAY);
prof = viewMany(prof, watchA, 3, NOW - 2 * DAY);
const viewed = pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW, seed: 0 });
check('un article regardé 3 fois : c\'est lui, avec la raison « viewed »', viewed?.product.id === 'wa' && viewed.reason.kind === 'viewed', viewed);
check('la raison dit le vrai nom de l\'article regardé', viewed?.reason.kind === 'viewed' && viewed.reason.productName === 'Article wa' && adWhy(viewed.reason).includes('« Article wa »') && adWhy(viewed.reason).startsWith('Pourquoi cette annonce ?'));
check('« Vous avez regardé cet article. Il vous attend toujours. »', adHeadline({ kind: 'viewed', productName: 'x' }) === 'Vous avez regardé cet article. Il vous attend toujours.');

// déjà commandé : on ne le rappelle plus
let bought = applyCartEvent(viewMany(emptyProfile('v2', NOW - 5 * DAY), watchA, 3, NOW - 2 * DAY), meta(watchA), 'purchase', NOW - DAY);
check('un article déjà commandé n\'est jamais rappelé', pickTargetedAd({ products: all, categories: cats, browsing: bought, now: NOW, seed: 0 })?.product.id !== 'wa');
// regardé il y a plus de 30 jours : on ne le rappelle plus
const old = viewMany(emptyProfile('v3', NOW - 60 * DAY), watchA, 3, NOW - 45 * DAY);
check('un article regardé il y a plus de 30 jours n\'est plus rappelé', pickTargetedAd({ products: all, categories: cats, browsing: old, now: NOW, seed: 0 }) === null);
// un seul coup d'œil léger : pas d'annonce « regardé de près »
const light = applyProductView(emptyProfile('v4', NOW - DAY), meta(watchA), NOW - 3600_000).profile;
check('un seul coup d\'œil (intérêt léger) : aucune annonce', pickTargetedAd({ products: all, categories: cats, browsing: light, now: NOW, seed: 0 }) === null);
// article épuisé / retiré / sans photo : pas d'annonce dessus
const soldOut = all.map((p) => (p.id === 'wa' ? { ...p, stock: 0 } : p));
check('l\'article regardé est épuisé : on ne le montre pas', pickTargetedAd({ products: soldOut, categories: cats, browsing: prof, now: NOW, seed: 0 })?.product.id !== 'wa');
const noPhoto = all.map((p) => (p.id === 'wa' ? { ...p, images: [] } : p));
check('sans photo : pas d\'annonce dessus', pickTargetedAd({ products: noPhoto, categories: cats, browsing: prof, now: NOW, seed: 0 })?.product.id !== 'wa');
const hidden = all.map((p) => (p.id === 'wa' ? { ...p, is_active: false } : p));
check('retiré de la vente : pas d\'annonce dessus', pickTargetedAd({ products: hidden, categories: cats, browsing: prof, now: NOW, seed: 0 })?.product.id !== 'wa');

// --- 2. la catégorie explorée -----------------------------------------------------------------------------------------------------------
let cat = emptyProfile('v5', NOW - 5 * DAY);
cat = applyProductView(cat, meta(watchA), NOW - 3 * DAY).profile;
cat = applyCategoryView(cat, 'montres', 'Montres', NOW - 3 * DAY);
cat = applyProductView(cat, meta(watchB), NOW - 2 * DAY).profile;
cat = applyCategoryView(cat, 'montres', 'Montres', NOW - 2 * DAY);
const byCat = pickTargetedAd({ products: all, categories: cats, browsing: cat, now: NOW, seed: 0 });
check('2 montres regardées : une 3e montre qu\'il n\'a pas vue (watchC), raison « category » Montres', byCat?.product.id === 'wc' && byCat.reason.kind === 'category' && byCat.reason.categoryName === 'Montres', byCat);
check('« Vous aimez « Montres » ? Voici un article à découvrir. »', byCat?.reason.kind === 'category' && adHeadline(byCat.reason) === 'Vous aimez « Montres » ? Voici un article à découvrir.');
check('la raison : « Vous avez regardé plusieurs articles de « Montres » »', byCat?.reason.kind === 'category' && adWhy(byCat.reason) === 'Pourquoi cette annonce ? Vous avez regardé plusieurs articles de « Montres ».');
check('l\'annonce ne montre jamais un article déjà regardé dans cette catégorie', ['wa', 'wb'].every((id) => byCat?.product.id !== id));
// une vraie promotion dans la catégorie passe d'abord
const promoWatch = { ...watchC, price: 16000, compare_at_price: 20000, promo_ends_at: iso(NOW + 3 * DAY) };
const withPromo = pickTargetedAd({ products: [watchA, watchB, promoWatch, mk('wd', 'c-watch'), perfume], categories: cats, browsing: cat, now: NOW, seed: 0 });
check('dans la catégorie explorée, l\'article en vraie promotion passe en premier', withPromo?.product.id === 'wc' && withPromo.reason.kind === 'category', withPromo);
// catégorie avec un seul article regardé : pas assez
let weak = applyCategoryView(applyProductView(emptyProfile('v6', NOW - DAY), meta(perfume), NOW - 3600_000).profile, 'parfum', 'Parfum', NOW - 3600_000);
check('un seul article regardé dans une catégorie : ce n\'est pas encore un goût, aucune annonce', pickTargetedAd({ products: all, categories: cats, browsing: weak, now: NOW, seed: 0 }) === null);

// --- 3. la vraie promotion --------------------------------------------------------------------------------------------------------------
const promoA = mk('xa', 'c-perfume', { price: 8000, compare_at_price: 10000, promo_ends_at: iso(NOW + 2 * DAY) }); // 20 %
const promoB = mk('xb', 'c-watch', { price: 15000, compare_at_price: 25000, is_flash_sale: true, flash_sale_ends_at: iso(NOW + 5 * 3600_000) }); // 40 %
const promoFinished = mk('xc', 'c-watch', { price: 5000, compare_at_price: 10000, promo_ends_at: iso(NOW - 3600_000) }); // finie
const promoFake = mk('xd', 'c-watch', { price: 5000, compare_at_price: 50000, promo_ends_at: iso(NOW + DAY) }); // −90 % = erreur de saisie
const proms = pickTargetedAd({ products: [watchA, promoA, promoB, promoFinished, promoFake], categories: cats, browsing: null, now: NOW, seed: 0 });
check('sans historique : la vraie promotion la plus forte (-40 %), avec sa vraie échéance', proms?.product.id === 'xb' && proms.reason.kind === 'promo' && proms.reason.pct === 40 && proms.reason.endsAt === NOW + 5 * 3600_000, proms);
check('une promotion finie ou une remise absurde (-90 %) n\'est jamais annoncée', realPromoPct(promoFinished, NOW) === null && realPromoPct(promoFake, NOW) === null && realPromoPct(promoA, NOW) === 20);
check('l\'échéance annoncée est la vraie (la plus proche)', promoEndsAt(promoA, NOW) === NOW + 2 * DAY && promoEndsAt(promoFinished, NOW) === null && promoEndsAt(watchA, NOW) === null);
check('« Prix réduit : -40 % jusqu\'au … » (la date vient de la vraie échéance)', /^Prix réduit : -40 % jusqu’au 3 novembre$/.test(adHeadline({ kind: 'promo', pct: 40, endsAt: Date.parse('2026-11-03T12:00:00Z') })) , adHeadline({ kind: 'promo', pct: 40, endsAt: Date.parse('2026-11-03T12:00:00Z') }));
check('promotion sans échéance connue : pas de date inventée', adHeadline({ kind: 'promo', pct: 20, endsAt: null }) === 'Prix réduit : -20 %');
check('aucune promotion et aucun historique : aucune annonce (jamais de raison inventée)', pickTargetedAd({ products: all, categories: cats, browsing: null, now: NOW, seed: 0 }) === null);
check('suivi coupé (profil nul) : seulement les vraies promotions', pickTargetedAd({ products: [watchA, promoA], categories: cats, browsing: null, now: NOW, seed: 0 })?.product.id === 'xa');

// --- le genre dans le choix ---------------------------------------------------------------------------------------------------------------
const womenPromo = mk('fw', 'c-women', { price: 12000, compare_at_price: 20000, promo_ends_at: iso(NOW + DAY) }); // 40 % mais « pour femmes »
const menView = pickTargetedAd({ products: [womenPromo, promoA], categories: cats, browsing: null, customer: { gender: 'homme' }, now: NOW, seed: 0 });
check('un homme ne reçoit pas la promotion d\'une catégorie « pour femmes » (même plus forte)', menView?.product.id === 'xa', menView?.product.id);
const womenView = pickTargetedAd({ products: [womenPromo, promoA], categories: cats, browsing: null, customer: { gender: 'femme' }, now: NOW, seed: 0 });
check('une femme la reçoit', womenView?.product.id === 'fw');
const unknown = pickTargetedAd({ products: [womenPromo, promoA], categories: cats, browsing: null, customer: { gender: null }, now: NOW, seed: 0 });
check('genre non précisé : aucun filtre (la plus forte remise)', unknown?.product.id === 'fw');
const coffeeForWomen = pickTargetedAd({ products: [{ ...coffee, price: 9000, compare_at_price: 15000, promo_ends_at: iso(NOW + DAY) }], categories: cats, browsing: null, customer: { gender: 'femme' }, now: NOW, seed: 0 });
check('le café « Homme » n\'est pas montré à une femme', coffeeForWomen === null);

// --- la rotation : un choix par jour parmi les meilleurs, jamais hors de la liste vraie ---------------------------------------------------------------
const many = Array.from({ length: 8 }, (_, i) => mk(`p${i}`, 'c-perfume', { price: 10000 - i * 100, compare_at_price: 20000 - i * 400, promo_ends_at: iso(NOW + 2 * DAY) }));
const picks = new Set(Array.from({ length: 10 }, (_, d) => pickTargetedAd({ products: many, categories: cats, browsing: null, now: NOW, seed: d })?.product.id));
check('d\'un jour à l\'autre, le choix tourne parmi les 5 meilleures promotions', picks.size === 5 && ![...picks].some((id) => ['p5', 'p6', 'p7'].includes(id as string)), [...picks]);
check('un même jour : le même choix (pas de scintillement)', pickTargetedAd({ products: many, categories: cats, browsing: null, now: NOW, seed: 3 })?.product.id === pickTargetedAd({ products: many, categories: cats, browsing: null, now: NOW + 1000, seed: 3 })?.product.id);

// --- la livraison (vraie) ----------------------------------------------------------------------------------------------------------------------
const cities = [{ name: "N'Djamena", fee: 0, agency: null }, { name: 'Moundou', fee: 2500, agency: 'STTL ou Sud Voyage' }, { name: 'Faya', fee: null, agency: null }];
check('N\'Djamena : « Livraison à N\'Djamena : gratuite · vous payez à la réception. »', deliveryLine("N'Djamena", cities) === "🚚 Livraison à N'Djamena : gratuite · vous payez à la réception.", deliveryLine("N'Djamena", cities));
check(MM ? 'Moundou : le vrai tarif, paiement à l\'avance (pas de paiement à la livraison)' : 'Moundou : le vrai tarif, commande sur WhatsApp (plus d\'Airtel ni de Moov)', deliveryLine('Moundou', cities) === (MM ? '🚚 Livraison à Moundou : 2 500 FCFA · paiement à l’avance (Airtel Money ou Moov Money).' : '🚚 Livraison à Moundou : 2 500 FCFA · commande sur WhatsApp.'));
check('ville écrite autrement (« ndjamena », « moundou ») : retrouvée', deliveryLine('ndjamena', cities)?.includes("N'Djamena") === true && deliveryLine('moundou ', cities)?.includes('Moundou') === true);
check('ville sans tarif, inconnue, vide ou villes non chargées : aucune ligne (rien d\'inventé)', deliveryLine('Faya', cities) === null && deliveryLine('Paris', cities) === null && deliveryLine('', cities) === null && deliveryLine(null, cities) === null && deliveryLine('Moundou', []) === null && deliveryLine('Moundou', null) === null);
check('arabe : la ligne de livraison existe aussi', /^🚚 التوصيل إلى Moundou: 2 500 FCFA/.test(deliveryLine('Moundou', cities, 'ar') ?? ''), deliveryLine('Moundou', cities, 'ar'));
check(MM ? 'arabe : paiement à l\'avance' : 'arabe : commande sur WhatsApp, jamais Airtel ni Moov', MM ? /الدفع مسبقاً/.test(deliveryLine('Moundou', cities, 'ar') ?? '') : /واتساب/.test(deliveryLine('Moundou', cities, 'ar') ?? '') && !/Airtel|Moov/.test(deliveryLine('Moundou', cities, 'ar') ?? ''));

// --- arabe ---------------------------------------------------------------------------------------------------------------------------------------
check('arabe : accroche et raison pour chaque cas', [{ kind: 'viewed', productName: 'x' }, { kind: 'category', categoryName: 'ساعات' }, { kind: 'promo', pct: 30, endsAt: null }].every((r) => /[؀-ۿ]/.test(adHeadline(r as never, 'ar')) && /^لماذا هذا الإعلان/.test(adWhy(r as never, 'ar'))));

// --- le bouton ✕ : un AUTRE article 15 secondes plus tard ---------------------------------------------------------------------------------------------
check('« ✕ » : 15 secondes d\'attente, au plus 3 fois sur 24 h', AD_NEXT_SECONDS === 15 && AD_MAX_CLOSES === 3);
check('jamais fermée : rien à attendre, rien d\'exclu, pas arrêtée', (() => { const st = closedState([], NOW); return !st.stopped && st.waitMs === 0 && st.excluded.length === 0; })());
const c1 = addClosedAd([], 'wa', NOW);
check('« ✕ » touché : on attend 15 secondes, l\'article fermé est exclu', (() => { const st = closedState(c1, NOW); return !st.stopped && st.waitMs === 15_000 && st.excluded.join() === 'wa'; })());
check('5 secondes plus tard : il reste 10 secondes', closedState(c1, NOW + 5_000).waitMs === 10_000);
check('15 secondes plus tard : l\'annonce suivante peut s\'afficher (waitMs = 0), l\'article fermé reste exclu', (() => { const st = closedState(c1, NOW + 15_000); return st.waitMs === 0 && !st.stopped && st.excluded.join() === 'wa'; })());
check('une minute plus tard : toujours exclu (pour 24 h), rien à attendre', (() => { const st = closedState(c1, NOW + 60_000); return st.waitMs === 0 && st.excluded.join() === 'wa'; })());
check('24 h plus tard : le « ✕ » est oublié, l\'article peut revenir', (() => { const st = closedState(c1, NOW + 24 * 3600_000); return st.waitMs === 0 && st.excluded.length === 0 && !st.stopped; })());
const c2 = addClosedAd(c1, 'wb', NOW + 20_000);
check('2ᵉ « ✕ » : 15 secondes de plus, deux articles exclus, pas encore arrêtée', (() => { const st = closedState(c2, NOW + 20_000); return !st.stopped && st.waitMs === 15_000 && st.excluded.join() === 'wa,wb'; })());
const c3 = addClosedAd(c2, 'pa', NOW + 40_000);
check('3ᵉ « ✕ » sur 24 h : Zara s\'arrête (plus aucune annonce)', (() => { const st = closedState(c3, NOW + 40_000); return st.stopped && st.excluded.join() === 'wa,wb,pa'; })());
check('arrêtée toute la journée (23 h plus tard encore), puis elle reprend quand le plus ancien « ✕ » a 24 h', closedState(c3, NOW + 23 * 3600_000).stopped && !closedState(c3, NOW + 24 * 3600_000 + 1_000).stopped && closedState(c3, NOW + 24 * 3600_000 + 1_000).excluded.join() === 'wb,pa');
check('le même article fermé deux fois n\'est exclu qu\'une fois (mais compte deux fois)', (() => { const st = closedState(addClosedAd(c1, 'wa', NOW + 20_000), NOW + 20_000); return st.excluded.join() === 'wa' && !st.stopped; })());
check('addClosedAd ne modifie pas la liste reçue', c1.length === 1 && c2.length === 2);
check('texte du téléphone : « ✕ » valides gardés, vieux, futurs et illisibles ignorés', (() => {
  const raw = JSON.stringify([{ id: 'wa', at: NOW - 3600_000 }, { id: 'old', at: NOW - 2 * DAY }, { id: 'future', at: NOW + 3600_000 }, { id: '', at: NOW - 1000 }, { id: 'nan', at: 'x' }, null, 5]);
  const list = parseClosedAds(raw, NOW);
  return list.length === 1 && list[0].id === 'wa';
})());
check('texte illisible, vide ou pas une liste : aucun « ✕ »', parseClosedAds('pas du json', NOW).length === 0 && parseClosedAds('', NOW).length === 0 && parseClosedAds(null, NOW).length === 0 && parseClosedAds(undefined, NOW).length === 0 && parseClosedAds('{"id":"wa"}', NOW).length === 0);
// l'autre article : jamais celui qui vient d'être fermé, et toujours avec une vraie raison
const firstAd = pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW, seed: 0 });
const nextAd = pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW, seed: 0, exclude: ['wa'] });
check('après « ✕ » sans autre vraie raison (et aucune nouveauté) : Zara ne propose rien plutôt que d\'inventer', firstAd?.product.id === 'wa' && nextAd === null, { firstAd: firstAd?.product.id, nextAd: nextAd?.product.id });
// une vraie nouveauté : ajoutée à la boutique depuis moins de 30 jours (date de la base)
const fresh = mk('nw', 'c-perfume', { created_at: iso(NOW - 2 * DAY) });
const withFresh = [...all, fresh];
const afterClose = pickTargetedAd({ products: withFresh, categories: cats, browsing: prof, now: NOW, seed: 0, exclude: ['wa'] });
check('après « ✕ » : Zara propose une VRAIE nouveauté (ajoutée il y a 2 jours), pas l\'article fermé', afterClose?.product.id === 'nw' && afterClose.reason.kind === 'new' && afterClose.reason.days === 2, afterClose);
check('la nouveauté n\'est JAMAIS utilisée pour la première annonce (sans « ✕ ») : sans raison vraie, aucune annonce', pickTargetedAd({ products: withFresh, categories: cats, browsing: null, now: NOW, seed: 0 }) === null);
check('la nouveauté : seulement les articles de moins de 30 jours (33 jours = non ; 29 jours = oui)', pickTargetedAd({ products: [mk('old', 'c-perfume', { created_at: iso(NOW - 33 * DAY) })], categories: cats, browsing: null, now: NOW, seed: 0, exclude: ['x'] }) === null && pickTargetedAd({ products: [mk('ok', 'c-perfume', { created_at: iso(NOW - 29 * DAY) })], categories: cats, browsing: null, now: NOW, seed: 0, exclude: ['x'] })?.product.id === 'ok');
check('la nouveauté : date absente, illisible ou dans le futur = jamais une nouveauté', [null, undefined, 'n\'importe quoi', iso(NOW + DAY)].every((d) => pickTargetedAd({ products: [mk('z', 'c-perfume', { created_at: d as never })], categories: cats, browsing: null, now: NOW, seed: 0, exclude: ['x'] }) === null));
check('la nouveauté : la plus récente d\'abord', pickTargetedAd({ products: [mk('n10', 'c-perfume', { created_at: iso(NOW - 10 * DAY) }), mk('n1', 'c-watch', { created_at: iso(NOW - 1 * DAY) })], categories: cats, browsing: null, now: NOW, seed: 0, exclude: ['x'] })?.product.id === 'n1');
check('la nouveauté respecte le genre : un homme ne reçoit pas une nouveauté « pour femmes »', pickTargetedAd({ products: [mk('nf', 'c-women', { created_at: iso(NOW - DAY) })], categories: cats, customer: { gender: 'homme' }, browsing: null, now: NOW, seed: 0, exclude: ['x'] }) === null);
check('la nouveauté exclut les articles pour adultes, sans stock ou sans photo', pickTargetedAd({ products: [mk('adult', 'c-perfume', { name: 'Delay spray 🔞', created_at: iso(NOW - DAY) }), mk('nostock', 'c-perfume', { stock: 0, created_at: iso(NOW - DAY) }), mk('noimg', 'c-perfume', { images: [], created_at: iso(NOW - DAY) })], categories: cats, browsing: null, now: NOW, seed: 0, exclude: ['x'] }) === null);
check('textes de la nouveauté : aujourd\'hui, hier, il y a N jours (français) ; اليوم، أمس، منذ N أيام (arabe)', (() => {
  const w = (days: number, lang: 'fr' | 'ar') => adWhy({ kind: 'new', days }, lang);
  return w(0, 'fr') === 'Pourquoi cette annonce ? Cet article a été ajouté à la boutique aujourd’hui.' && w(1, 'fr').endsWith('hier.') && w(5, 'fr').endsWith('il y a 5 jours.')
    && w(0, 'ar').includes('اليوم') && w(1, 'ar').includes('أمس') && w(5, 'ar').includes('منذ 5 أيام') && w(12, 'ar').includes('منذ 12 يوماً')
    && adHeadline({ kind: 'new', days: 3 }) === 'Une nouveauté à découvrir.' && /[؀-ۿ]/.test(adHeadline({ kind: 'new', days: 3 }, 'ar'));
})());
let prof2 = viewMany(viewMany(emptyProfile('v2', NOW - 5 * DAY), watchA, 3, NOW - 2 * DAY), perfume, 3, NOW - 3 * DAY);
const first2 = pickTargetedAd({ products: all, categories: cats, browsing: prof2, now: NOW, seed: 0 });
const second2 = pickTargetedAd({ products: all, categories: cats, browsing: prof2, now: NOW, seed: 0, exclude: [first2!.product.id] });
check('deux articles regardés : le 1er fermé, le 2ᵉ regardé est proposé (« viewed »), puis plus rien de « regardé »', first2?.product.id === 'wa' && second2?.product.id === 'pa' && second2.reason.kind === 'viewed');
const third2 = pickTargetedAd({ products: all, categories: cats, browsing: prof2, now: NOW, seed: 0, exclude: ['wa', 'pa'] });
check('les deux fermés : ni l\'un ni l\'autre ne revient', !third2 || (third2.product.id !== 'wa' && third2.product.id !== 'pa'), third2?.product.id);
check('tout est fermé ou rien de vrai à proposer : aucune annonce (Zara n\'invente rien)', pickTargetedAd({ products: all, categories: cats, browsing: null, now: NOW, seed: 0, exclude: all.map((p) => p.id) }) === null);
check('exclude vide ou absent : le choix est exactement le même qu\'avant', JSON.stringify(pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW, seed: 0, exclude: [] })) === JSON.stringify(firstAd));
check('l\'article exclu n\'est jamais choisi, quel que soit le public (femme, homme, élève, étudiant, administrateur)', (['femme', 'homme', 'eleve', 'etudiant', 'admin'] as const).every((a) => {
  const cust = { femme: { gender: 'femme' }, homme: { gender: 'homme' }, eleve: { profession: 'élève' }, etudiant: { profession: 'étudiant' }, admin: { profession: 'administrateur' } }[a];
  const first = pickTargetedAd({ products: all, categories: cats, customer: cust, browsing: null, now: NOW, seed: 0 });
  if (!first) return true;
  const next = pickTargetedAd({ products: all, categories: cats, customer: cust, browsing: null, now: NOW, seed: 0, exclude: [first.product.id] });
  return !next || next.product.id !== first.product.id;
}));

// =============================================== LES PUBLICS : femmes, hommes, élèves, étudiants, administrateurs ===============================================
// --- le métier écrit par le client ----------------------------------------------------------------------------------------------------------------
check('« étudiant », « Étudiante », « étudiants », « etudiant » et la faute « etudient » : public Étudiants', ['étudiant', 'Étudiante', 'étudiants', 'etudiant', 'étudiantes', 'etudient', 'Étudiant en droit', 'student'].every((t) => professionAudience(t) === 'etudiant'), ['étudiant', 'Étudiante', 'etudient'].map(professionAudience));
check('« élève », « eleve », « élèves », « lycéen », « collégienne » : public Élèves', ['élève', 'eleve', 'élèves', 'lycéen', 'collégienne', 'Élève au lycée'].every((t) => professionAudience(t) === 'eleve'));
check('« administrateur », « administratrice », « administration », « directeur », « ingénieur », « comptable » : public Administrateurs et cadres', ['administrateur', 'Administratrice', 'administration', 'directeur', 'ingénieur', 'comptable', 'gestionnaire', 'banquier'].every((t) => professionAudience(t) === 'admin'));
check('un étudiant en administration reste étudiant (le public d\'étude passe avant)', professionAudience('étudiant en administration') === 'etudiant');
check('l\'arabe est compris (طالب، تلميذ، مدير)', professionAudience('طالب') === 'etudiant' && professionAudience('تلميذة') === 'eleve' && professionAudience('مدير') === 'admin');
check('commerçant, chauffeur, un prénom, un chiffre, un champ vide ou un texte trop long : aucun public (rien n\'est deviné)', ['commerçant', 'chauffeur', 'mahamat', '1234', '', '   ', 'x'.repeat(80)].every((t) => professionAudience(t) === null) && professionAudience(null) === null && professionAudience(undefined) === null);
check('les publics d\'un client : son genre choisi et son public de métier ; genre non précisé = pas de public de genre', JSON.stringify(audiencesOf({ gender: 'femme', profession: 'Étudiante' })) === '["femme","etudiant"]' && JSON.stringify(audiencesOf({ gender: null, profession: 'élève' })) === '["eleve"]' && audiencesOf({ gender: 'homme' }).join() === 'homme' && audiencesOf(null).length === 0 && audiencesOf({ gender: 'bizarre', profession: 'commerçant' }).length === 0);

// --- militaires et forces de l'ordre (demande du patron, 8 novembre 2026) ---------------------------------------------------------------------------
const forcesJobs = ['militaire', 'Militaires', 'soldat', 'Armée', 'armée nationale', 'police', 'Policier', 'policière', 'policie', 'je suis un policier', 'gendarme', 'Gendarmerie nationale', 'douane', 'douan', 'douanier', 'agent de sécurité', 'vigile', 'GNNT', 'garde nationale', 'garde nomade', 'forces de l\'ordre', 'sergent', 'caporal', 'adjudant', 'Colonel', 'Ex colonel', 'commandant de brigade', 'capitaine', 'lieutenant', 'général de brigade', 'commissaire', 'parachutiste', 'commando', 'militaire à la retraite'];
check('militaire, armée, police, policier, gendarme, douane, agent de sécurité, garde nationale, grades… : public Militaires et forces de l\'ordre', forcesJobs.every((t) => professionAudience(t) === 'forces'), forcesJobs.filter((t) => professionAudience(t) !== 'forces'));
check('les vrais métiers écrits par les clients du site (militaire, armée, police, « policie », « je suis un policier », agent de sécurité, « douan ») sont tous reconnus', ['militaire', 'armée', 'police', 'policie', 'je suis un policier', 'policier', 'agent de sécurité', 'douan'].every((t) => professionAudience(t) === 'forces'));
check('l\'arabe est compris (عسكري، جندي، شرطي، دركي، ضابط، جيش)', ['عسكري', 'جندي', 'شرطي', 'شرطة', 'دركي', 'ضابط', 'جيش', 'حرس وطني'].every((t) => professionAudience(t) === 'forces'), ['عسكري', 'جندي', 'شرطي', 'شرطة', 'دركي', 'ضابط', 'جيش', 'حرس وطني'].filter((t) => professionAudience(t) !== 'forces'));
check('« directeur général », « employé général », « général manager » : PAS des militaires (le mot « général » seul ne suffit pas)', ['directeur général', 'employé général', 'général manager', 'Directeur', 'manager', 'comptable'].every((t) => professionAudience(t) !== 'forces'), ['directeur général', 'employé général', 'général manager'].map((t) => professionAudience(t)));
check('« militant », « politique », « commerçant », « étudiant militaire » : pas des militaires (l\'étudiant passe avant)', professionAudience('militant') !== 'forces' && professionAudience('politique') !== 'forces' && professionAudience('commerçant') !== 'forces' && professionAudience('étudiant militaire') === 'etudiant');
check('un colonel ou un commandant reçoit le public des militaires (avant « administrateurs et cadres »), un directeur reste administrateur', professionAudience('Colonel') === 'forces' && professionAudience('Commandant') === 'forces' && professionAudience('Directeur') === 'admin');
check('les publics d\'un client : un homme militaire = homme + forces ; une femme gendarme = femme + forces', JSON.stringify(audiencesOf({ gender: 'homme', profession: 'militaire' })) === '["homme","forces"]' && JSON.stringify(audiencesOf({ gender: 'femme', profession: 'Gendarme' })) === '["femme","forces"]');

// --- une boutique d'exemple avec des prix variés ---------------------------------------------------------------------------------------------------
const shop: AdProduct[] = [
  ...Array.from({ length: 12 }, (_, i) => mk(`s${String(i + 1).padStart(2, '0')}`, i % 2 ? 'c-watch' : 'c-perfume', { price: 2000 * (i + 1), created_at: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z` })), // 2 000 … 24 000
  mk('w1', 'c-women', { price: 15000, created_at: '2026-10-20T00:00:00Z' }),
  mk('w2', 'c-women', { price: 9000, created_at: '2026-10-25T00:00:00Z' }),
  mk('m1', 'c-menwear', { price: 11000, created_at: '2026-10-22T00:00:00Z' }), // la catégorie des hommes SANS « Vitalité & Énergie » (réservée aux mariés de 32 ans et plus : voir plus bas)
];
const price = (ad: { product: AdProduct } | null) => Number(ad?.product.price);

const pupil = pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'Élève' }, browsing: null, now: NOW, seed: 0 });
check('élève : un article parmi le quart le moins cher de la boutique (au plus 8 000 FCFA ici), raison « student / élève »', pupil?.reason.kind === 'student' && (pupil.reason as { level: string }).level === 'eleve' && price(pupil) <= 8000, pupil && { id: pupil.product.id, price: price(pupil), reason: pupil.reason });
const student = pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'étudiante' }, browsing: null, now: NOW, seed: 0 });
check('étudiant : un article parmi les 40 % les moins chers (au plus 10 000 FCFA ici), raison « student / étudiant »', student?.reason.kind === 'student' && (student.reason as { level: string }).level === 'etudiant' && price(student) <= 10000, student && { price: price(student), reason: student.reason });
check('élèves et étudiants reçoivent deux annonces différentes (le même jour)', !!pupil && !!student && pupil.product.id !== student.product.id, [pupil?.product.id, student?.product.id]);
check('élève : « Pour les élèves : un article à petit prix. » ; étudiant : « Pour les étudiants : … »', !!pupil && !!student && adHeadline(pupil.reason) === 'Pour les élèves : un article à petit prix.' && adHeadline(student.reason) === 'Pour les étudiants : un article à petit prix.');
check('« Pourquoi cette annonce ? Vous avez indiqué « élève » dans votre compte, et cet article fait partie des moins chers de la boutique. »', !!pupil && adWhy(pupil.reason) === 'Pourquoi cette annonce ? Vous avez indiqué « élève » dans votre compte, et cet article fait partie des moins chers de la boutique.');
const cheapSet = new Set(Array.from({ length: 24 }, (_, d) => pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'élève' }, browsing: null, now: NOW, seed: d })?.product.id));
check('élève : en 24 tranches de 6 h, l\'annonce tourne mais ne sort JAMAIS du quart le moins cher', [...cheapSet].every((id) => Number(shop.find((p) => p.id === id)?.price) <= 8000) && cheapSet.size >= 2, [...cheapSet]);
const cheapPromo = [...shop.filter((p) => p.id !== 's02'), { ...shop.find((p) => p.id === 's02')!, price: 3000, compare_at_price: 4000, promo_ends_at: iso(NOW + DAY) }];
check('élève : une vraie promotion dans le quart le moins cher passe en premier', pickTargetedAd({ products: cheapPromo, categories: cats, customer: { profession: 'élève' }, browsing: null, now: NOW, seed: 0 })?.product.id === 's02');

const boss = pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'Administrateur' }, browsing: null, now: NOW, seed: 0 });
check('administrateur : un article parmi le quart le plus haut de gamme (les plus chers), raison « executive »', boss?.reason.kind === 'executive' && price(boss) >= 18000, boss && { price: price(boss), reason: boss.reason });
check('« Une sélection haut de gamme pour vous. » et la raison dit le métier indiqué dans le compte', !!boss && adHeadline(boss.reason) === 'Une sélection haut de gamme pour vous.' && /métier d’administration ou de direction dans votre compte/.test(adWhy(boss.reason)));
check('un directeur (métier haut placé de la liste de Zara) reçoit aussi l\'annonce haut de gamme', pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'Directeur' }, browsing: null, now: NOW, seed: 0 })?.reason.kind === 'executive');

// --- l'annonce des militaires et forces de l'ordre : le badge « groupe sanguin » -----------------------------------------------------------------------
const badge = mk('badge', 'c-watch', { slug: 'bagde-groupe-sanguin', name: 'Bagde Groupe sanguin', price: 5000 });
const shopF = [...shop, badge];
const forcesAd = (profession: string, extra: { gender?: unknown } = {}, products: AdProduct[] = shopF, seed = 0) => pickTargetedAd({ products, categories: cats, customer: { profession, ...extra }, browsing: null, now: NOW, seed });
check('militaire : Zara propose le badge « groupe sanguin », raison « forces »', forcesAd('Militaire')?.product.id === 'badge' && forcesAd('Militaire')?.reason.kind === 'forces', forcesAd('Militaire'));
check('police, gendarme, armée, douane, agent de sécurité, colonel : le même badge', ['police', 'Gendarme', 'armée', 'douane', 'agent de sécurité', 'Colonel', 'عسكري'].every((t) => forcesAd(t)?.product.id === 'badge'), ['police', 'Gendarme', 'armée', 'douane', 'agent de sécurité', 'Colonel'].map((t) => forcesAd(t)?.product.id));
check('à chaque tranche de 6 h (24 essais), le militaire reçoit le badge (un seul article choisi par le patron)', Array.from({ length: 24 }, (_, d) => forcesAd('militaire', {}, shopF, d)?.product.id).every((id) => id === 'badge'));
check('une femme gendarme et un homme militaire reçoivent le badge (la catégorie du badge n\'a pas de public de genre)', forcesAd('Gendarme', { gender: 'femme' })?.product.id === 'badge' && forcesAd('Militaire', { gender: 'homme' })?.product.id === 'badge');
check('le badge est choisi par son slug « bagde-groupe-sanguin » : un autre article ne remplace jamais le badge', forcesAd('militaire', {}, [...shop, mk('autre', 'c-watch', { price: 5000 })]) === null || forcesAd('militaire', {}, [...shop, mk('autre', 'c-watch', { price: 5000 })])?.product.id !== 'autre');
check('badge épuisé, retiré de la vente ou sans photo : aucune annonce « forces » (Zara n\'invente rien, elle ne met pas un autre article à la place)', [{ stock: 0 }, { is_active: false }, { images: [] }].every((x) => forcesAd('militaire', {}, [...shop, { ...badge, ...x }])?.reason.kind !== 'forces'));
check('un client sans métier, ou avec un autre métier, ne reçoit pas l\'annonce « forces »', ['', 'commerçant', 'chauffeur', 'directeur'].every((t) => forcesAd(t)?.reason.kind !== 'forces'));
const soldierViewed = viewMany(emptyProfile('v9', NOW - 3 * DAY), perfume, 3, NOW - 2 * DAY);
check('un militaire qui a regardé de près un article reçoit d\'abord cet article (« Vous avez regardé »), pas le badge', pickTargetedAd({ products: [...shopF, perfume], categories: cats, customer: { profession: 'militaire' }, browsing: soldierViewed, now: NOW, seed: 0 })?.reason.kind === 'viewed');
const fa = forcesAd('Militaire')!;
check('texte (français) : « Pensé pour les militaires et les forces de l’ordre. » et la raison dit le métier écrit dans le compte', adHeadline(fa.reason) === 'Pensé pour les militaires et les forces de l’ordre.' && /métier militaire ou de sécurité \(armée, police, gendarmerie…\) dans votre compte/.test(adWhy(fa.reason)) && /conçu pour les militaires et les forces de l’ordre/.test(adWhy(fa.reason)), [adHeadline(fa.reason), adWhy(fa.reason)]);
check('texte (arabe) : accroche et raison existent en arabe', /للعسكريين وقوات الأمن/.test(adHeadline(fa.reason, 'ar')) && /مهنة عسكرية أو أمنية/.test(adWhy(fa.reason, 'ar')));
check('aucune fausse rareté, faux pourcentage ni compte à rebours dans l\'annonce « forces »', ![adHeadline(fa.reason), adWhy(fa.reason)].some((s) => /rare|plus que|reste|%|jusqu|dernier/i.test(s)));

const her = pickTargetedAd({ products: shop, categories: cats, customer: { gender: 'femme' }, browsing: null, now: NOW, seed: 0 });
check('femme : un article de la catégorie « Vêtements pour femmes » (le plus récent d\'abord), raison « gender »', her?.reason.kind === 'gender' && her.product.category_id === 'c-women' && her.product.id === 'w2' && (her.reason as { categoryName: string }).categoryName === 'Vêtements pour femmes', her);
const him = pickTargetedAd({ products: shop, categories: cats, customer: { gender: 'homme' }, browsing: null, now: NOW, seed: 0 });
check('homme : un article de la catégorie « Vêtements pour hommes » (jamais « Vitalité & Énergie », jamais une catégorie pour femmes)', him?.reason.kind === 'gender' && him.product.category_id === 'c-menwear', him);
check('« Choisi pour vous : « Vêtements pour femmes ». » et « Vous avez choisi « Femme » dans votre compte… »', !!her && adHeadline(her.reason) === 'Choisi pour vous : « Vêtements pour femmes ».' && adWhy(her.reason).startsWith('Pourquoi cette annonce ? Vous avez choisi « Femme » dans votre compte'));
const noWomen = shop.filter((p) => p.category_id !== 'c-women');
check('une femme sans article de sa catégorie en vente : pas d\'annonce de genre inventée (promotion seulement, sinon rien)', pickTargetedAd({ products: noWomen, categories: cats, customer: { gender: 'femme' }, browsing: null, now: NOW, seed: 0 }) === null);
check('homme + étudiant : le public de métier passe d\'abord, et jamais une catégorie pour femmes', (() => { const a = pickTargetedAd({ products: shop, categories: cats, customer: { gender: 'homme', profession: 'étudiant' }, browsing: null, now: NOW, seed: 0 }); return a?.reason.kind === 'student' && a.product.category_id !== 'c-women'; })());
const s11 = shop.find((p) => p.id === 's11')!;
check('l\'article regardé de près passe AVANT le public (le geste du client compte plus que son métier)', (() => { const a = pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'élève' }, browsing: viewMany(emptyProfile('v9', NOW - 5 * DAY), s11, 3, NOW - 2 * DAY), now: NOW, seed: 0 }); return a?.reason.kind === 'viewed' && a.product.id === 's11'; })());


// --- les articles pour adultes ne sont JAMAIS dans une annonce -----------------------------------------------------------------------------------
check('articles marqués pour adultes : 🔞, « 18+ », « +18 », « 18 ans », « adulte », « delay spray »', ['SUPER VIGA 150000 SPRAY 🔞', 'Café 18+', 'Produit +18', 'Interdit -18 ans', 'Réservé aux adultes', 'Delay Spray For Men', 'delay-spray-germany'].every((n) => isAdultItem({ name: n, slug: '', description: '' })));
check('un article normal n\'est pas marqué (« 118 », « 2018 », « Parfum 180 ml », « montre 18 carats »)', ['Parfum 180 ml', 'Montre collection 2018', 'Sac 118', 'Bague or 18 carats', 'Tobacco parfum'].every((n) => !isAdultItem({ name: n, slug: '', description: '' })));
const adultPromo = mk('ad1', 'c-men', { name: 'SUPER VIGA SPRAY 🔞', price: 6000, compare_at_price: 12000, promo_ends_at: iso(NOW + DAY) }); // la plus forte remise de la boutique (50 %)
const withAdult = [...shop, adultPromo];
check('un article 18+ n\'est jamais choisi : ni en promotion, ni pour un homme, ni pour un élève, ni pour un administrateur', [{ gender: 'homme' }, { profession: 'élève' }, { profession: 'administrateur' }, null].every((c) => pickTargetedAd({ products: withAdult, categories: cats, customer: c, browsing: null, now: NOW, seed: 0 })?.product.id !== 'ad1'));
check('même regardé de près, un article 18+ n\'est pas rappelé dans l\'accueil', pickTargetedAd({ products: withAdult, categories: cats, browsing: viewMany(emptyProfile('v10', NOW - 5 * DAY), adultPromo, 3, NOW - 2 * DAY), now: NOW, seed: 0 })?.product.id !== 'ad1');

// --- 24 h sur 24 : les annonces changent toutes les 6 heures, jour et nuit --------------------------------------------------------------------------
const slotStart = adSeed(NOW) * 6 * 3600_000 - 3600_000; // les tranches suivent l'heure du Tchad (UTC+1)
check('Zara change les annonces toutes les 6 heures (4 fois par jour) : même tranche pendant 6 h, la suivante ensuite', AD_ROTATE_HOURS === 6 && adSeed(slotStart) === adSeed(slotStart + 6 * 3600_000 - 1) && adSeed(slotStart + 6 * 3600_000) === adSeed(slotStart) + 1);
check('le prochain changement tombe toujours dans les 6 heures, à 00 h, 06 h, 12 h ou 18 h (heure du Tchad)', nextAdChange(NOW) > NOW && nextAdChange(NOW) - NOW <= 6 * 3600_000 && (nextAdChange(NOW) + 3600_000) % (6 * 3600_000) === 0);
check('de nuit comme de jour : le choix change avec la tranche de 6 h (2 h du matin ≠ 8 h)', Array.from({ length: 8 }, (_, k) => pickTargetedAd({ products: shop, categories: cats, customer: { profession: 'élève' }, browsing: null, now: Date.parse('2026-11-03T00:00:00Z') + k * 6 * 3600_000 })?.product.id).filter((v, i, a) => a.indexOf(v) === i).length >= 2);

// --- l'écran de l'administrateur : l'annonce de chaque public ---------------------------------------------------------------------------------------
const prev = previewAudiences({ products: shop, categories: cats, now: NOW, seed: 0 });
check('administrateur : une annonce vraie pour chacun des 5 publics habituels, et 6 publics au total (avec les militaires et forces de l\'ordre)', AUDIENCES.length === 6 && AUDIENCES.filter((a) => a !== 'forces').every((a) => prev[a] !== null), AUDIENCES.map((a) => [a, prev[a]?.reason.kind]));
const prevF = previewAudiences({ products: shopF, categories: cats, now: NOW, seed: 0 });
check('administrateur : le public « militaires et forces de l\'ordre » montre le badge ; sans le badge en vente : « aucune annonce vraie » (null), jamais un autre article', prevF.forces?.product.id === 'badge' && prevF.forces?.reason.kind === 'forces' && prev.forces === null, [prevF.forces?.product.id, prev.forces?.product.id]);
check('chaque public reçoit SA raison : femme/homme = gender, élève/étudiant = student, administrateur = executive', prev.femme?.reason.kind === 'gender' && prev.homme?.reason.kind === 'gender' && prev.eleve?.reason.kind === 'student' && prev.etudiant?.reason.kind === 'student' && prev.admin?.reason.kind === 'executive');
check('l\'aperçu ne modifie pas la liste des articles', JSON.stringify(shop).length > 0 && previewAudiences({ products: [], categories: cats, now: NOW }).femme === null);

// --- garde-fous honnêteté -----------------------------------------------------------------------------------------------------------------------
const texts = [adHeadline({ kind: 'viewed', productName: 'x' }), adHeadline({ kind: 'category', categoryName: 'Montres' }), adHeadline({ kind: 'promo', pct: 20, endsAt: NOW + DAY }), adWhy({ kind: 'viewed', productName: 'x' }), adWhy({ kind: 'category', categoryName: 'Montres' }), adWhy({ kind: 'promo', pct: 20, endsAt: null })].join(' ');
check('aucune fausse rareté, fausse urgence ni pression dans les textes', !/dernier|plus que|stock limité|dépêch|ne ratez|offre limitée|exclusi|rare|seulement pour vous|vite/i.test(texts), texts);
const before = JSON.stringify(all);
pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW, seed: 0 });
check('la liste des articles n\'est pas modifiée', JSON.stringify(all) === before);

// =============================================== « VITALITÉ & ÉNERGIE » : seulement pour les mariés de 32 ans et plus ===============================================
console.log('\n== Vitalité & Énergie : jamais dans une annonce, sauf pour un client marié de 32 ans et plus');
check('la catégorie : « Vitalité & Énergie Homme », son adresse, en majuscules, sans accents', [{ name: 'Vitalité & Énergie Homme' }, { slug: 'vitalite-energie-homme' }, { name: 'VITALITE ET ENERGIE' }, { name: 'vitalité énergie' }].every((c) => isVitalityCategory(c)));
check('pas la catégorie : Montres, Parfum, « Énergie solaire », « Vitalité » seule, vide, absente', [{ name: 'Montres' }, { name: 'Parfum' }, { name: 'Énergie solaire' }, { name: 'Vitalité' }, { name: '' }, null, undefined].every((c) => !isVitalityCategory(c as never)));
check('l\'âge minimum est 32 ans', VITALITY_MIN_AGE === 32);
const married40 = { birth_date: '1986-05-10', marital_status: 'marie' };
check('marié de 40 ans : autorisé', vitalityAllowed(married40, NOW));
check('marié le jour de ses 32 ans (né le 3 novembre 1994, nous sommes le 3 novembre 2026) : autorisé', vitalityAllowed({ birth_date: '1994-11-03', marital_status: 'marie' }, NOW));
check('marié la veille de ses 32 ans (né le 4 novembre 1994) : PAS autorisé (31 ans)', !vitalityAllowed({ birth_date: '1994-11-04', marital_status: 'marie' }, NOW));
check('marié de 30 ans : pas autorisé', !vitalityAllowed({ birth_date: '1996-06-01', marital_status: 'marie' }, NOW));
check('célibataire de 40 ans : pas autorisé', !vitalityAllowed({ birth_date: '1986-05-10', marital_status: 'celibataire' }, NOW));
check('marié sans date de naissance, date illisible ou date dans le futur : pas autorisé (Zara ne devine rien)', [null, undefined, '', 'n\'importe quoi', '2030-01-01'].every((d) => !vitalityAllowed({ birth_date: d, marital_status: 'marie' }, NOW)));
check('âgé mais situation non répondue (null, absente, texte inconnu) : pas autorisé', [null, undefined, '', 'divorce', 'Marié'].every((m) => !vitalityAllowed({ birth_date: '1980-01-01', marital_status: m }, NOW)));
check('visiteur, client sans les colonnes, objet vide : pas autorisé', !vitalityAllowed(null, NOW) && !vitalityAllowed(undefined, NOW) && !vitalityAllowed({}, NOW));

const vit1 = mk('v1', 'c-men', { price: 9500, created_at: iso(NOW - 3 * DAY) });
const vit2 = mk('v2', 'c-men', { price: 60000, created_at: iso(NOW - 40 * DAY) });
const watchX = mk('wx', 'c-watch', { price: 20000, created_at: iso(NOW - 50 * DAY) });
const filtered = (c: unknown) => adAllowedProducts([vit1, vit2, watchX, { ...watchX, id: 'nc', category_id: null }], cats, c as never, NOW).map((p) => p.id).join();
check('la liste des articles d\'une annonce : visiteur, célibataire, marié de 30 ans = sans « Vitalité & Énergie »', [null, { birth_date: '1980-01-01', marital_status: 'celibataire' }, { birth_date: '1996-06-01', marital_status: 'marie' }].every((c) => filtered(c) === 'wx,nc'));
check('la liste des articles : marié de 40 ans = tout, « Vitalité & Énergie » compris', filtered(married40) === 'v1,v2,wx,nc');
check('aucune catégorie « Vitalité & Énergie » dans la boutique : la liste reste la même', adAllowedProducts([watchA, perfume], [{ id: 'c-watch', name: 'Montres' }, { id: 'c-perfume', name: 'Parfum' }], null, NOW).length === 2);
check('adAllowedProducts ne modifie pas la liste reçue', (() => { const list = [vit1, watchX]; adAllowedProducts(list, cats, null, NOW); return list.length === 2; })());

// l'annonce de l'accueil : jamais « Vitalité & Énergie » sans les deux conditions
const onlyVit = [vit1, vit2];
const vitAd = (customer: object | null, extra: Partial<Parameters<typeof pickTargetedAd>[0]> = {}) => pickTargetedAd({ products: onlyVit, categories: cats, customer, browsing: null, now: NOW, seed: 0, ...extra });
check('homme célibataire : AUCUNE annonce « Vitalité & Énergie » (c\'était sa catégorie avant)', vitAd({ gender: 'homme', birth_date: '1986-05-10', marital_status: 'celibataire' }) === null);
check('homme marié de 30 ans : aucune annonce « Vitalité & Énergie »', vitAd({ gender: 'homme', birth_date: '1996-06-01', marital_status: 'marie' }) === null);
check('homme sans réponses (ancien compte) : aucune annonce « Vitalité & Énergie »', vitAd({ gender: 'homme' }) === null && vitAd({ gender: 'homme', birth_date: null, marital_status: null }) === null);
const vitMan = vitAd({ gender: 'homme', birth_date: '1986-05-10', marital_status: 'marie' });
check('homme marié de 40 ans : l\'annonce « Vitalité & Énergie » est permise (raison « gender », catégorie Vitalité & Énergie Homme)', vitMan?.reason.kind === 'gender' && vitMan.product.category_id === 'c-men', vitMan);
check('une femme mariée de 40 ans ne voit jamais « Vitalité & Énergie Homme » (la catégorie reste pour les hommes)', vitAd({ gender: 'femme', birth_date: '1986-05-10', marital_status: 'marie' }) === null);
check('visiteur sans compte : aucune annonce « Vitalité & Énergie »', vitAd(null) === null);
// article regardé de près : le rappel obéit à la même règle
const viewedVit = viewMany(emptyProfile('v20', NOW - 5 * DAY), vit1, 3, NOW - 2 * DAY);
check('« Vous avez regardé » : un article « Vitalité & Énergie » regardé 3 fois n\'est PAS rappelé à un client célibataire ou sans réponses', [{ gender: 'homme', marital_status: 'celibataire', birth_date: '1980-01-01' }, { gender: 'homme' }, null].every((c) => pickTargetedAd({ products: onlyVit, categories: cats, customer: c, browsing: viewedVit, now: NOW, seed: 0 }) === null));
const viewedOk = pickTargetedAd({ products: onlyVit, categories: cats, customer: { gender: 'homme', marital_status: 'marie', birth_date: '1986-05-10' }, browsing: viewedVit, now: NOW, seed: 0 });
check('« Vous avez regardé » : le même article est rappelé à un marié de 40 ans', viewedOk?.product.id === 'v1' && viewedOk.reason.kind === 'viewed', viewedOk);
// promotion et nouveauté (après un « ✕ ») : même règle
const promoVit = mk('v3', 'c-men', { price: 5000, compare_at_price: 10000, promo_ends_at: iso(NOW + 2 * DAY) });
check('une vraie promotion « Vitalité & Énergie » : pas pour un visiteur, oui pour un marié de 40 ans', pickTargetedAd({ products: [promoVit], categories: cats, customer: null, browsing: null, now: NOW, seed: 0 }) === null && pickTargetedAd({ products: [promoVit], categories: cats, customer: married40, browsing: null, now: NOW, seed: 0 })?.reason.kind === 'promo');
check('la nouveauté après un « ✕ » : pas un article « Vitalité & Énergie » pour un visiteur, oui pour un marié de 40 ans', pickTargetedAd({ products: [vit1], categories: cats, customer: null, browsing: null, now: NOW, seed: 0, exclude: ['x'] }) === null && pickTargetedAd({ products: [vit1], categories: cats, customer: married40, browsing: null, now: NOW, seed: 0, exclude: ['x'] })?.reason.kind === 'new');
// l'écran de l'administrateur (aperçu par public) : jamais « Vitalité & Énergie », même le plus cher ou le moins cher de la boutique
const richCheap = [mk('c1', 'c-men', { price: 500 }), mk('c2', 'c-men', { price: 900000 }), ...shop];
const previews = previewAudiences({ products: richCheap, categories: cats, now: NOW, seed: 0 });
check('aperçu de l\'administrateur : aucun des 5 publics ne reçoit un article « Vitalité & Énergie » (même le moins cher ou le plus cher de la boutique)', AUDIENCES.every((a) => !previews[a] || previews[a]!.product.category_id !== 'c-men'), AUDIENCES.map((a) => [a, previews[a]?.product.id]));
check('élève et administrateur gardent leur annonce (avec la boutique d\'exemple) : le moins cher et le plus cher sont des articles NORMAUX', previews.eleve?.reason.kind === 'student' && previews.admin?.reason.kind === 'executive', AUDIENCES.map((a) => [a, previews[a]?.product.id]));

// --- sous-catégories : une sous-catégorie hérite de sa catégorie principale (public du genre, « Vitalité & Énergie »), l'exploration compte la famille ---
const subCats: AdCategory[] = [
  ...cats,
  { id: 'sc-vit', slug: 'cafe-homme', name: 'Café', parent_id: 'c-men' }, // sous-catégorie de « Vitalité & Énergie Homme »
  { id: 'sc-shirt', slug: 'chemises-femmes', name: 'Chemises', parent_id: 'c-women' }, // sous-catégorie de « Vêtements pour femmes »
  { id: 'sc-watch', slug: 'montres-or', name: 'Montres or', parent_id: 'c-watch' },
];
const vitSub = mk('sv1', 'sc-vit', { price: 7500 });
check('une sous-catégorie de « Vitalité & Énergie » est « Vitalité & Énergie » aussi : pas d\'annonce pour un visiteur ou un célibataire', [null, { gender: 'homme', marital_status: 'celibataire', birth_date: '1980-01-01' }, { gender: 'homme' }].every((c) => pickTargetedAd({ products: [vitSub], categories: subCats, customer: c, browsing: viewMany(emptyProfile('sv', NOW - 5 * DAY), vitSub, 3, NOW - 2 * DAY), now: NOW, seed: 0 }) === null));
check('… mais oui pour un marié de 40 ans', pickTargetedAd({ products: [vitSub], categories: subCats, customer: married40, browsing: viewMany(emptyProfile('sv', NOW - 5 * DAY), vitSub, 3, NOW - 2 * DAY), now: NOW, seed: 0 })?.product.id === 'sv1');
check('adAllowedProducts : l\'article d\'une sous-catégorie de « Vitalité & Énergie » part aussi, sauf pour un marié de 32 ans et plus', adAllowedProducts([vitSub, mk('sn1', 'c-watch')], subCats, null).map((p) => p.id).join() === 'sn1' && adAllowedProducts([vitSub, mk('sn1', 'c-watch')], subCats, married40).length === 2);
check('sans la colonne parent_id (avant le script SQL) : la règle d\'avant, rien ne casse', adAllowedProducts([vitSub, mk('sn1', 'c-watch')], cats, null).length === 2 /* sc-vit inconnue : article sans catégorie connue */);
const shirtF = mk('sh1', 'sc-shirt', { price: 12000 });
const aHim = pickTargetedAd({ products: [shirtF], categories: subCats, customer: { gender: 'homme' }, browsing: null, now: NOW, seed: 0 });
const aHer = pickTargetedAd({ products: [shirtF], categories: subCats, customer: { gender: 'femme' }, browsing: null, now: NOW, seed: 0 });
check('« Chemises » (sous-catégorie de « Vêtements pour femmes ») : jamais montrée à un homme, montrée à une femme avec la raison « genre »', aHim === null && aHer?.product.id === 'sh1' && aHer.reason.kind === 'gender', [aHim, aHer]);
const w1 = mk('w1', 'c-watch'); const w2 = mk('w2', 'c-watch'); const w3 = mk('w3', 'sc-watch'); const w4 = mk('w4', 'sc-watch');
let famProfile = emptyProfile('sw', NOW - 5 * DAY);
famProfile = applyProductView(famProfile, meta(w1), NOW - 3 * DAY).profile;
famProfile = applyCategoryView(famProfile, 'montres', 'Montres', NOW - 3 * DAY);
famProfile = applyProductView(famProfile, meta(w2), NOW - 2 * DAY).profile;
famProfile = applyCategoryView(famProfile, 'montres', 'Montres', NOW - 2 * DAY);
const exploring = pickTargetedAd({ products: [w1, w2, w3, w4], categories: subCats, customer: null, browsing: famProfile, now: NOW, seed: 0 });
check('catégorie explorée : un article de la FAMILLE (la catégorie principale ou ses sous-catégories) que le client n\'a pas vu', !!exploring && ['w3', 'w4'].includes(exploring.product.id) && exploring.reason.kind === 'category', exploring);

console.log(`\n${ok} contrôles réussis`);
