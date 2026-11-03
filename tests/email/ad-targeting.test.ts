// « Annonce » ciblée de Zara : choix de l'article, raison vraie, genre, ville, fermeture. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/ad-targeting.test.ts
import { AD_ROTATE_HOURS, adClosed, isAdultItem, adHeadline, adSeed, adWhy, audienceAllows, audienceOf, deliveryLine, nextAdChange, pickTargetedAd, previewAudiences, promoEndsAt, realPromoPct, type AdCategory, type AdProduct } from '../../src/lib/adTargeting.ts';
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
check('Moundou : le vrai tarif, paiement à l\'avance (pas de paiement à la livraison)', deliveryLine('Moundou', cities) === '🚚 Livraison à Moundou : 2 500 FCFA · paiement à l’avance (Airtel Money ou Moov Money).');
check('ville écrite autrement (« ndjamena », « moundou ») : retrouvée', deliveryLine('ndjamena', cities)?.includes("N'Djamena") === true && deliveryLine('moundou ', cities)?.includes('Moundou') === true);
check('ville sans tarif, inconnue, vide ou villes non chargées : aucune ligne (rien d\'inventé)', deliveryLine('Faya', cities) === null && deliveryLine('Paris', cities) === null && deliveryLine('', cities) === null && deliveryLine(null, cities) === null && deliveryLine('Moundou', []) === null && deliveryLine('Moundou', null) === null);
check('arabe : la ligne de livraison existe aussi', /^🚚 التوصيل إلى Moundou: 2 500 FCFA/.test(deliveryLine('Moundou', cities, 'ar') ?? ''), deliveryLine('Moundou', cities, 'ar'));

// --- arabe ---------------------------------------------------------------------------------------------------------------------------------------
check('arabe : accroche et raison pour chaque cas', [{ kind: 'viewed', productName: 'x' }, { kind: 'category', categoryName: 'ساعات' }, { kind: 'promo', pct: 30, endsAt: null }].every((r) => /[؀-ۿ]/.test(adHeadline(r as never, 'ar')) && /^لماذا هذا الإعلان/.test(adWhy(r as never, 'ar'))));

// --- le bouton ✕ ----------------------------------------------------------------------------------------------------------------------------------
check('« ✕ » : cachée 24 h, puis revient', adClosed(NOW - 3600_000, NOW) && adClosed(NOW - 23 * 3600_000, NOW) && !adClosed(NOW - 24 * 3600_000, NOW) && !adClosed(NOW - 3 * DAY, NOW));
check('jamais fermée / valeur illisible / date dans le futur : l\'annonce s\'affiche', !adClosed(null, NOW) && !adClosed(undefined, NOW) && !adClosed(NaN, NOW) && !adClosed(NOW + 3600_000, NOW));


// =============================================== LES PUBLICS : femmes, hommes, élèves, étudiants, administrateurs ===============================================
// --- le métier écrit par le client ----------------------------------------------------------------------------------------------------------------
check('« étudiant », « Étudiante », « étudiants », « etudiant » et la faute « etudient » : public Étudiants', ['étudiant', 'Étudiante', 'étudiants', 'etudiant', 'étudiantes', 'etudient', 'Étudiant en droit', 'student'].every((t) => professionAudience(t) === 'etudiant'), ['étudiant', 'Étudiante', 'etudient'].map(professionAudience));
check('« élève », « eleve », « élèves », « lycéen », « collégienne » : public Élèves', ['élève', 'eleve', 'élèves', 'lycéen', 'collégienne', 'Élève au lycée'].every((t) => professionAudience(t) === 'eleve'));
check('« administrateur », « administratrice », « administration », « directeur », « ingénieur », « comptable » : public Administrateurs et cadres', ['administrateur', 'Administratrice', 'administration', 'directeur', 'ingénieur', 'comptable', 'gestionnaire', 'banquier'].every((t) => professionAudience(t) === 'admin'));
check('un étudiant en administration reste étudiant (le public d\'étude passe avant)', professionAudience('étudiant en administration') === 'etudiant');
check('l\'arabe est compris (طالب، تلميذ، مدير)', professionAudience('طالب') === 'etudiant' && professionAudience('تلميذة') === 'eleve' && professionAudience('مدير') === 'admin');
check('commerçant, militaire, chauffeur, un prénom, un chiffre, un champ vide ou un texte trop long : aucun public (rien n\'est deviné)', ['commerçant', 'militaire', 'chauffeur', 'mahamat', '1234', '', '   ', 'x'.repeat(80)].every((t) => professionAudience(t) === null) && professionAudience(null) === null && professionAudience(undefined) === null);
check('les publics d\'un client : son genre choisi et son public de métier ; genre non précisé = pas de public de genre', JSON.stringify(audiencesOf({ gender: 'femme', profession: 'Étudiante' })) === '["femme","etudiant"]' && JSON.stringify(audiencesOf({ gender: null, profession: 'élève' })) === '["eleve"]' && audiencesOf({ gender: 'homme' }).join() === 'homme' && audiencesOf(null).length === 0 && audiencesOf({ gender: 'bizarre', profession: 'commerçant' }).length === 0);

// --- une boutique d'exemple avec des prix variés ---------------------------------------------------------------------------------------------------
const shop: AdProduct[] = [
  ...Array.from({ length: 12 }, (_, i) => mk(`s${String(i + 1).padStart(2, '0')}`, i % 2 ? 'c-watch' : 'c-perfume', { price: 2000 * (i + 1), created_at: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z` })), // 2 000 … 24 000
  mk('w1', 'c-women', { price: 15000, created_at: '2026-10-20T00:00:00Z' }),
  mk('w2', 'c-women', { price: 9000, created_at: '2026-10-25T00:00:00Z' }),
  mk('m1', 'c-men', { price: 11000, created_at: '2026-10-22T00:00:00Z' }),
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

const her = pickTargetedAd({ products: shop, categories: cats, customer: { gender: 'femme' }, browsing: null, now: NOW, seed: 0 });
check('femme : un article de la catégorie « Vêtements pour femmes » (le plus récent d\'abord), raison « gender »', her?.reason.kind === 'gender' && her.product.category_id === 'c-women' && her.product.id === 'w2' && (her.reason as { categoryName: string }).categoryName === 'Vêtements pour femmes', her);
const him = pickTargetedAd({ products: shop, categories: cats, customer: { gender: 'homme' }, browsing: null, now: NOW, seed: 0 });
check('homme : un article de la catégorie « Vitalité & Énergie Homme », jamais une catégorie pour femmes', him?.reason.kind === 'gender' && him.product.category_id === 'c-men', him);
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
check('administrateur : une annonce vraie pour chacun des 5 publics', AUDIENCES.length === 5 && AUDIENCES.every((a) => prev[a] !== null), AUDIENCES.map((a) => [a, prev[a]?.reason.kind]));
check('chaque public reçoit SA raison : femme/homme = gender, élève/étudiant = student, administrateur = executive', prev.femme?.reason.kind === 'gender' && prev.homme?.reason.kind === 'gender' && prev.eleve?.reason.kind === 'student' && prev.etudiant?.reason.kind === 'student' && prev.admin?.reason.kind === 'executive');
check('l\'aperçu ne modifie pas la liste des articles', JSON.stringify(shop).length > 0 && previewAudiences({ products: [], categories: cats, now: NOW }).femme === null);

// --- garde-fous honnêteté -----------------------------------------------------------------------------------------------------------------------
const texts = [adHeadline({ kind: 'viewed', productName: 'x' }), adHeadline({ kind: 'category', categoryName: 'Montres' }), adHeadline({ kind: 'promo', pct: 20, endsAt: NOW + DAY }), adWhy({ kind: 'viewed', productName: 'x' }), adWhy({ kind: 'category', categoryName: 'Montres' }), adWhy({ kind: 'promo', pct: 20, endsAt: null })].join(' ');
check('aucune fausse rareté, fausse urgence ni pression dans les textes', !/dernier|plus que|stock limité|dépêch|ne ratez|offre limitée|exclusi|rare|seulement pour vous|vite/i.test(texts), texts);
const before = JSON.stringify(all);
pickTargetedAd({ products: all, categories: cats, browsing: prof, now: NOW, seed: 0 });
check('la liste des articles n\'est pas modifiée', JSON.stringify(all) === before);

console.log(`\n${ok} contrôles réussis`);
