// « Annonce » ciblée de Zara : choix de l'article, raison vraie, genre, ville, fermeture. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/ad-targeting.test.ts
import { adClosed, adHeadline, adWhy, audienceAllows, audienceOf, deliveryLine, pickTargetedAd, promoEndsAt, realPromoPct, type AdCategory, type AdProduct } from '../../src/lib/adTargeting.ts';
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

const NOW = Date.parse('2026-11-03T09:00:00Z');
const DAY = 24 * 3600 * 1000;
const iso = (t: number) => new Date(t).toISOString();

const cats: AdCategory[] = [
  { id: 'c-watch', slug: 'montres', name: 'Montres' },
  { id: 'c-perfume', slug: 'parfum', name: 'Parfum' },
  { id: 'c-women', slug: 'vetements-pour-femmes', name: 'Vêtements pour femmes' },
  { id: 'c-men', slug: 'vitalite-energie-homme', name: 'Vitalité & Énergie Homme' },
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
const viewed = pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW });
check('un article regardé 3 fois : c\'est lui, avec la raison « viewed »', viewed?.product.id === 'wa' && viewed.reason.kind === 'viewed', viewed);
check('la raison dit le vrai nom de l\'article regardé', viewed?.reason.kind === 'viewed' && viewed.reason.productName === 'Article wa' && adWhy(viewed.reason).includes('« Article wa »') && adWhy(viewed.reason).startsWith('Pourquoi cette annonce ?'));
check('« Vous avez regardé cet article. Il vous attend toujours. »', adHeadline({ kind: 'viewed', productName: 'x' }) === 'Vous avez regardé cet article. Il vous attend toujours.');

// déjà commandé : on ne le rappelle plus
let bought = applyCartEvent(viewMany(emptyProfile('v2', NOW - 5 * DAY), watchA, 3, NOW - 2 * DAY), meta(watchA), 'purchase', NOW - DAY);
check('un article déjà commandé n\'est jamais rappelé', pickTargetedAd({ products: all, categories: cats, browsing: bought, now: NOW })?.product.id !== 'wa');
// regardé il y a plus de 30 jours : on ne le rappelle plus
const old = viewMany(emptyProfile('v3', NOW - 60 * DAY), watchA, 3, NOW - 45 * DAY);
check('un article regardé il y a plus de 30 jours n\'est plus rappelé', pickTargetedAd({ products: all, categories: cats, browsing: old, now: NOW }) === null);
// un seul coup d'œil léger : pas d'annonce « regardé de près »
const light = applyProductView(emptyProfile('v4', NOW - DAY), meta(watchA), NOW - 3600_000).profile;
check('un seul coup d\'œil (intérêt léger) : aucune annonce', pickTargetedAd({ products: all, categories: cats, browsing: light, now: NOW }) === null);
// article épuisé / retiré / sans photo : pas d'annonce dessus
const soldOut = all.map((p) => (p.id === 'wa' ? { ...p, stock: 0 } : p));
check('l\'article regardé est épuisé : on ne le montre pas', pickTargetedAd({ products: soldOut, categories: cats, browsing: prof, now: NOW })?.product.id !== 'wa');
const noPhoto = all.map((p) => (p.id === 'wa' ? { ...p, images: [] } : p));
check('sans photo : pas d\'annonce dessus', pickTargetedAd({ products: noPhoto, categories: cats, browsing: prof, now: NOW })?.product.id !== 'wa');
const hidden = all.map((p) => (p.id === 'wa' ? { ...p, is_active: false } : p));
check('retiré de la vente : pas d\'annonce dessus', pickTargetedAd({ products: hidden, categories: cats, browsing: prof, now: NOW })?.product.id !== 'wa');

// --- 2. la catégorie explorée -----------------------------------------------------------------------------------------------------------
let cat = emptyProfile('v5', NOW - 5 * DAY);
cat = applyProductView(cat, meta(watchA), NOW - 3 * DAY).profile;
cat = applyCategoryView(cat, 'montres', 'Montres', NOW - 3 * DAY);
cat = applyProductView(cat, meta(watchB), NOW - 2 * DAY).profile;
cat = applyCategoryView(cat, 'montres', 'Montres', NOW - 2 * DAY);
const byCat = pickTargetedAd({ products: all, categories: cats, browsing: cat, now: NOW });
check('2 montres regardées : une 3e montre qu\'il n\'a pas vue (watchC), raison « category » Montres', byCat?.product.id === 'wc' && byCat.reason.kind === 'category' && byCat.reason.categoryName === 'Montres', byCat);
check('« Vous aimez « Montres » ? Voici un article à découvrir. »', byCat?.reason.kind === 'category' && adHeadline(byCat.reason) === 'Vous aimez « Montres » ? Voici un article à découvrir.');
check('la raison : « Vous avez regardé plusieurs articles de « Montres » »', byCat?.reason.kind === 'category' && adWhy(byCat.reason) === 'Pourquoi cette annonce ? Vous avez regardé plusieurs articles de « Montres ».');
check('l\'annonce ne montre jamais un article déjà regardé dans cette catégorie', ['wa', 'wb'].every((id) => byCat?.product.id !== id));
// une vraie promotion dans la catégorie passe d'abord
const promoWatch = { ...watchC, price: 16000, compare_at_price: 20000, promo_ends_at: iso(NOW + 3 * DAY) };
const withPromo = pickTargetedAd({ products: [watchA, watchB, promoWatch, mk('wd', 'c-watch'), perfume], categories: cats, browsing: cat, now: NOW });
check('dans la catégorie explorée, l\'article en vraie promotion passe en premier', withPromo?.product.id === 'wc' && withPromo.reason.kind === 'category', withPromo);
// catégorie avec un seul article regardé : pas assez
let weak = applyCategoryView(applyProductView(emptyProfile('v6', NOW - DAY), meta(perfume), NOW - 3600_000).profile, 'parfum', 'Parfum', NOW - 3600_000);
check('un seul article regardé dans une catégorie : ce n\'est pas encore un goût, aucune annonce', pickTargetedAd({ products: all, categories: cats, browsing: weak, now: NOW }) === null);

// --- 3. la vraie promotion --------------------------------------------------------------------------------------------------------------
const promoA = mk('xa', 'c-perfume', { price: 8000, compare_at_price: 10000, promo_ends_at: iso(NOW + 2 * DAY) }); // 20 %
const promoB = mk('xb', 'c-watch', { price: 15000, compare_at_price: 25000, is_flash_sale: true, flash_sale_ends_at: iso(NOW + 5 * 3600_000) }); // 40 %
const promoFinished = mk('xc', 'c-watch', { price: 5000, compare_at_price: 10000, promo_ends_at: iso(NOW - 3600_000) }); // finie
const promoFake = mk('xd', 'c-watch', { price: 5000, compare_at_price: 50000, promo_ends_at: iso(NOW + DAY) }); // −90 % = erreur de saisie
const proms = pickTargetedAd({ products: [watchA, promoA, promoB, promoFinished, promoFake], categories: cats, browsing: null, now: NOW });
check('sans historique : la vraie promotion la plus forte (-40 %), avec sa vraie échéance', proms?.product.id === 'xb' && proms.reason.kind === 'promo' && proms.reason.pct === 40 && proms.reason.endsAt === NOW + 5 * 3600_000, proms);
check('une promotion finie ou une remise absurde (-90 %) n\'est jamais annoncée', realPromoPct(promoFinished, NOW) === null && realPromoPct(promoFake, NOW) === null && realPromoPct(promoA, NOW) === 20);
check('l\'échéance annoncée est la vraie (la plus proche)', promoEndsAt(promoA, NOW) === NOW + 2 * DAY && promoEndsAt(promoFinished, NOW) === null && promoEndsAt(watchA, NOW) === null);
check('« Prix réduit : -40 % jusqu\'au … » (la date vient de la vraie échéance)', /^Prix réduit : -40 % jusqu’au 3 novembre$/.test(adHeadline({ kind: 'promo', pct: 40, endsAt: Date.parse('2026-11-03T12:00:00Z') })) , adHeadline({ kind: 'promo', pct: 40, endsAt: Date.parse('2026-11-03T12:00:00Z') }));
check('promotion sans échéance connue : pas de date inventée', adHeadline({ kind: 'promo', pct: 20, endsAt: null }) === 'Prix réduit : -20 %');
check('aucune promotion et aucun historique : aucune annonce (jamais de raison inventée)', pickTargetedAd({ products: all, categories: cats, browsing: null, now: NOW }) === null);
check('suivi coupé (profil nul) : seulement les vraies promotions', pickTargetedAd({ products: [watchA, promoA], categories: cats, browsing: null, now: NOW })?.product.id === 'xa');

// --- le genre dans le choix ---------------------------------------------------------------------------------------------------------------
const womenPromo = mk('fw', 'c-women', { price: 12000, compare_at_price: 20000, promo_ends_at: iso(NOW + DAY) }); // 40 % mais « pour femmes »
const menView = pickTargetedAd({ products: [womenPromo, promoA], categories: cats, browsing: null, customer: { gender: 'homme' }, now: NOW });
check('un homme ne reçoit pas la promotion d\'une catégorie « pour femmes » (même plus forte)', menView?.product.id === 'xa', menView?.product.id);
const womenView = pickTargetedAd({ products: [womenPromo, promoA], categories: cats, browsing: null, customer: { gender: 'femme' }, now: NOW });
check('une femme la reçoit', womenView?.product.id === 'fw');
const unknown = pickTargetedAd({ products: [womenPromo, promoA], categories: cats, browsing: null, customer: { gender: null }, now: NOW });
check('genre non précisé : aucun filtre (la plus forte remise)', unknown?.product.id === 'fw');
const coffeeForWomen = pickTargetedAd({ products: [{ ...coffee, price: 9000, compare_at_price: 15000, promo_ends_at: iso(NOW + DAY) }], categories: cats, browsing: null, customer: { gender: 'femme' }, now: NOW });
check('le café « Homme » n\'est pas montré à une femme', coffeeForWomen === null);

// --- la rotation : un choix par jour parmi les meilleurs, jamais hors de la liste vraie ---------------------------------------------------------------
const many = Array.from({ length: 8 }, (_, i) => mk(`p${i}`, 'c-perfume', { price: 10000 - i * 100, compare_at_price: 20000 - i * 400, promo_ends_at: iso(NOW + 2 * DAY) }));
const picks = new Set(Array.from({ length: 10 }, (_, d) => pickTargetedAd({ products: many, categories: cats, browsing: null, now: NOW, seed: d })?.product.id));
check('d\'un jour à l\'autre, le choix tourne parmi les 5 meilleures promotions', picks.size === 5 && ![...picks].some((id) => ['p5', 'p6', 'p7'].includes(id as string)), [...picks]);
check('un même jour : le même choix (pas de scintillement)', pickTargetedAd({ products: many, categories: cats, browsing: null, now: NOW, seed: 3 })?.product.id === pickTargetedAd({ products: many, categories: cats, browsing: null, now: NOW + 1000, seed: 3 })?.product.id);

// --- la livraison (vraie) ----------------------------------------------------------------------------------------------------------------------
const cities = [{ name: "N'Djamena", fee: 0, agency: null }, { name: 'Moundou', fee: 2500, agency: 'STTL ou Sud Voyage' }, { name: 'Faya', fee: null, agency: null }];
check('N\'Djamena : « Livraison à N\'Djamena : gratuite · vous payez à la réception. »', deliveryLine("N'Djamena", cities) === "🚚 Livraison à N'Djamena : gratuite · vous payez à la réception.", deliveryLine("N'Djamena", cities));
check('Moundou : le vrai tarif, paiement à l\'avance (pas de paiement à la livraison)', deliveryLine('Moundou', cities) === '🚚 Livraison à Moundou : 2 500 FCFA · paiement à l’avance (Airtel Money ou Moov Money).');
check('ville écrite autrement (« ndjamena », « moundou ») : retrouvée', deliveryLine('ndjamena', cities)?.includes("N'Djamena") === true && deliveryLine('moundou ', cities)?.includes('Moundou') === true);
check('ville sans tarif, inconnue, vide ou villes non chargées : aucune ligne (rien d\'inventé)', deliveryLine('Faya', cities) === null && deliveryLine('Paris', cities) === null && deliveryLine('', cities) === null && deliveryLine(null, cities) === null && deliveryLine('Moundou', []) === null && deliveryLine('Moundou', null) === null);
check('arabe : la ligne de livraison existe aussi', /^🚚 التوصيل إلى Moundou: 2 500 FCFA/.test(deliveryLine('Moundou', cities, 'ar') ?? ''), deliveryLine('Moundou', cities, 'ar'));

// --- arabe ---------------------------------------------------------------------------------------------------------------------------------------
check('arabe : accroche et raison pour chaque cas', [{ kind: 'viewed', productName: 'x' }, { kind: 'category', categoryName: 'ساعات' }, { kind: 'promo', pct: 30, endsAt: null }].every((r) => /[؀-ۿ]/.test(adHeadline(r as never, 'ar')) && /^لماذا هذا الإعلان/.test(adWhy(r as never, 'ar'))));

// --- le bouton ✕ ----------------------------------------------------------------------------------------------------------------------------------
check('« ✕ » : cachée 24 h, puis revient', adClosed(NOW - 3600_000, NOW) && adClosed(NOW - 23 * 3600_000, NOW) && !adClosed(NOW - 24 * 3600_000, NOW) && !adClosed(NOW - 3 * DAY, NOW));
check('jamais fermée / valeur illisible / date dans le futur : l\'annonce s\'affiche', !adClosed(null, NOW) && !adClosed(undefined, NOW) && !adClosed(NaN, NOW) && !adClosed(NOW + 3600_000, NOW));

// --- garde-fous honnêteté -----------------------------------------------------------------------------------------------------------------------
const texts = [adHeadline({ kind: 'viewed', productName: 'x' }), adHeadline({ kind: 'category', categoryName: 'Montres' }), adHeadline({ kind: 'promo', pct: 20, endsAt: NOW + DAY }), adWhy({ kind: 'viewed', productName: 'x' }), adWhy({ kind: 'category', categoryName: 'Montres' }), adWhy({ kind: 'promo', pct: 20, endsAt: null })].join(' ');
check('aucune fausse rareté, fausse urgence ni pression dans les textes', !/dernier|plus que|stock limité|dépêch|ne ratez|offre limitée|exclusi|rare|seulement pour vous|vite/i.test(texts), texts);
const before = JSON.stringify(all);
pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW });
check('la liste des articles n\'est pas modifiée', JSON.stringify(all) === before);

console.log(`\n${ok} contrôles réussis`);
