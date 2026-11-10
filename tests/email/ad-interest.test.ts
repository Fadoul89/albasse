// Affiche « Vos articles préférés » (demande du patron, 10 novembre 2026) : Zara analyse l'intérêt de CE client (articles regardés de près ou aimés ❤️) et montre
// les articles d'intérêt élevé sur l'affiche (jusqu'à 3). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/ad-interest.test.ts
import { INTEREST_MAX, addClosedAd, addClosedAds, adHeadline, adWhy, closedState, parseClosedAds, pickTargetedAd, rankInterest, type AdCategory, type AdProduct } from '../../src/lib/adTargeting.ts';
import { applyCartEvent, applyProductView, emptyProfile, type BrowsingProfile, type ProductMeta } from '../../src/lib/browsingInsights.ts';

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

const NOW = Date.parse('2026-11-10T09:00:00Z');
const DAY = 24 * 3600 * 1000;
const cats: AdCategory[] = [{ id: 'c1', slug: 'survetements', name: 'Survêtements' }, { id: 'c2', slug: 'chaussures', name: 'Chaussures' }];
const mk = (id: string, name: string, extra: Partial<AdProduct> = {}): AdProduct => ({ id, slug: `slug-${id}`, name, price: 12500, compare_at_price: null, stock: 6, images: [`https://img/${id}.jpg`], category_id: 'c1', is_active: true, is_flash_sale: false, flash_sale_ends_at: null, created_at: '2026-01-01T00:00:00Z', ...extra } as AdProduct);
const real = mk('rm', 'Survêtement Real Madrid');
const arsenal = mk('ar', 'Survêtement Arsenal');
const tagia = mk('tg', 'TAGIA ROYALE – velour', { price: 22500 });
const barca = mk('bc', 'Survêtement Barcelona enfant');
const p511 = mk('p5', '511 original', { price: 5000, category_id: 'c2' });
const extra = mk('x1', 'Autre article', { price: 9000, category_id: 'c2' });
const pool = [real, arsenal, tagia, barca, p511, extra];
const meta = (p: AdProduct): ProductMeta => ({ id: p.id, name: p.name, slug: p.slug, categoryId: p.category_id, categorySlug: cats.find((c) => c.id === p.category_id)?.slug ?? null, categoryName: cats.find((c) => c.id === p.category_id)?.name ?? null });
// le client regarde `times` fois un article (consultations séparées de 31 minutes : des visites différentes)
const view = (prof: BrowsingProfile, p: AdProduct, times: number, at: number) => {
  let cur = prof;
  for (let i = 0; i < times; i++) cur = applyProductView(cur, meta(p), at + i * 31 * 60 * 1000).profile;
  return cur;
};
const ids = (a: { product: AdProduct; more?: AdProduct[] } | null) => (a ? [a.product.id, ...(a.more ?? []).map((m) => m.id)] : []);

// --- le classement (règles pures)
const rec = (id: string, level: 'eleve' | 'moyen' | 'leger', views: number, lastViewedAt = NOW - DAY, purchased = false) => ({ id, level, views, lastViewedAt, purchased });
const allow = () => true;
check('rien d\'aimé et rien de fort : personne (un article « léger » ne compte pas)', rankInterest([rec('a', 'leger', 1), rec('b', 'leger', 3)], [], allow).length === 0);
check('un article « Intérêt élevé » compte ; « moyen » seulement s\'il a été regardé 2 fois ou plus', rankInterest([rec('a', 'eleve', 1)], [], allow).map((c) => c.id).join() === 'a' && rankInterest([rec('b', 'moyen', 2)], [], allow).map((c) => c.id).join() === 'b' && rankInterest([rec('c', 'moyen', 1)], [], allow).length === 0);
check('un favori compte toujours, même sans consultation ni suivi', rankInterest([], ['z'], allow).map((c) => c.id).join() === 'z');
check('un article aimé ET regardé plusieurs fois passe devant un article seulement regardé', rankInterest([rec('a', 'moyen', 2), rec('b', 'moyen', 2)], ['b'], allow)[0].id === 'b');
check('un article « Intérêt élevé » aimé passe devant un article seulement aimé', rankInterest([rec('a', 'eleve', 3)], ['a', 'z'], allow)[0].id === 'a');
check('à égalité : le plus récemment regardé d\'abord', rankInterest([rec('a', 'moyen', 2, NOW - 3 * DAY), rec('b', 'moyen', 2, NOW - DAY)], [], allow).map((c) => c.id).join() === 'b,a');
check('un article DÉJÀ commandé n\'est jamais proposé (même aimé)', rankInterest([rec('a', 'eleve', 3, NOW - DAY, true)], ['a'], allow).length === 0);
check('un article non autorisé (épuisé, retiré, fermé par « ✕ ») n\'est jamais proposé', rankInterest([rec('a', 'eleve', 3)], ['a', 'z'], (id) => id !== 'a' && id !== 'z').length === 0);

// --- le client AS-000883 : Real Madrid (aimé + 2 regards), Arsenal (aimé), TAGIA ROYALE (2 regards), Barcelona et 511 (1 regard chacun)
let prof = emptyProfile('v883', NOW - 3 * DAY);
prof = view(prof, p511, 1, NOW - 4 * 3600_000);
prof = view(prof, barca, 1, NOW - 3 * 3600_000);
prof = view(prof, arsenal, 1, NOW - 2.9 * 3600_000);
prof = view(prof, real, 2, NOW - 2.8 * 3600_000);
prof = view(prof, tagia, 2, NOW - 2.7 * 3600_000);
const ad = pickTargetedAd({ products: pool, categories: cats, browsing: prof, favorites: ['rm', 'ar'], now: NOW, seed: 0 });
check('le client AS-000883 : l\'affiche « Vos articles préférés » avec ses 3 articles d\'intérêt élevé : Real Madrid (aimé + regardé), Arsenal (aimé), TAGIA ROYALE (regardé 2 fois)', ad?.reason.kind === 'interest' && ids(ad).join() === 'rm,ar,tg', ids(ad));
check('Barcelona et le 511 (un seul regard, pas aimés) ne sont PAS sur l\'affiche', !ids(ad).includes('bc') && !ids(ad).includes('p5'));
check('au plus 3 articles sur l\'affiche', INTEREST_MAX === 3 && ids(ad).length <= 3);
if (ad && ad.reason.kind === 'interest') {
  check('la raison dit les vrais noms : « Pourquoi cette annonce ? Vous avez regardé de près ou aimé ces articles : « … », « … » et « … ». »', adWhy(ad.reason, 'fr') === 'Pourquoi cette annonce ? Vous avez regardé de près ou aimé ces articles : « Survêtement Real Madrid », « Survêtement Arsenal » et « TAGIA ROYALE – velour ».', adWhy(ad.reason, 'fr'));
  check('l\'accroche : « Vos articles préférés vous attendent. » (arabe aussi)', adHeadline(ad.reason, 'fr') === 'Vos articles préférés vous attendent.' && /تنتظرك/.test(adHeadline(ad.reason, 'ar')) && /Survêtement Real Madrid/.test(adWhy(ad.reason, 'ar')), adHeadline(ad.reason, 'ar'));
  check('2 aimés sur 3 notés', ad.reason.liked === 2, ad.reason);
}
// sans le suivi de navigation de ce téléphone (autre téléphone, suivi coupé) : les FAVORIS suivent le compte
const noTrack = pickTargetedAd({ products: pool, categories: cats, browsing: null, favorites: ['rm', 'ar'], now: NOW, seed: 0 });
check('autre téléphone (aucun suivi) : les 2 favoris suivent le compte : affiche « Vos articles préférés » avec Real Madrid et Arsenal', noTrack?.reason.kind === 'interest' && ids(noTrack).sort().join() === 'ar,rm', ids(noTrack));
const one = pickTargetedAd({ products: pool, categories: cats, browsing: null, favorites: ['rm'], now: NOW, seed: 0 });
check('un seul favori, aucun autre signal : « Vous avez aimé cet article ❤️ » + « Vous avez ajouté « … » à vos favoris »', one?.reason.kind === 'liked' && one.product.id === 'rm' && adHeadline(one.reason, 'fr') === 'Vous avez aimé cet article ❤️ Il vous attend.' && adWhy(one.reason, 'fr') === 'Pourquoi cette annonce ? Vous avez ajouté « Survêtement Real Madrid » à vos favoris.', one);
let seenOne = emptyProfile('v1', NOW - 3 * DAY);
seenOne = view(seenOne, tagia, 3, NOW - 2 * 3600_000);
const viewedOnly = pickTargetedAd({ products: pool, categories: cats, browsing: seenOne, now: NOW, seed: 0 });
check('un seul article regardé de près, aucun favori : comme avant (« Vous avez regardé cet article »)', viewedOnly?.reason.kind === 'viewed' && viewedOnly.product.id === 'tg', viewedOnly);
check('aucun favori, aucun regard fort : aucune affiche « préférés » (Zara n\'invente rien)', (() => { const a = pickTargetedAd({ products: pool, categories: cats, browsing: view(emptyProfile('v2', NOW - DAY), barca, 1, NOW - 3600_000), favorites: [], now: NOW, seed: 0 }); return !a || (a.reason.kind !== 'interest' && a.reason.kind !== 'liked' && a.reason.kind !== 'viewed'); })());
// l'article commandé et les articles indisponibles
const boughtProf = applyCartEvent(prof, meta(real), 'purchased', NOW - 3600_000);
const afterBuy = pickTargetedAd({ products: pool, categories: cats, browsing: boughtProf, favorites: ['rm', 'ar'], now: NOW, seed: 0 });
check('Real Madrid commandé : il n\'est plus proposé, même aimé (restent Arsenal et TAGIA ROYALE)', ids(afterBuy).join() === 'ar,tg' || (ids(afterBuy).includes('ar') && !ids(afterBuy).includes('rm')), ids(afterBuy));
const soldOut = pickTargetedAd({ products: pool.map((p) => (p.id === 'ar' ? { ...p, stock: 0 } : p)), categories: cats, browsing: prof, favorites: ['rm', 'ar'], now: NOW, seed: 0 });
check('Arsenal épuisé : il n\'est pas proposé (jamais un article qu\'on ne peut pas acheter)', !ids(soldOut).includes('ar') && ids(soldOut).includes('rm'), ids(soldOut));
const noPhoto = pickTargetedAd({ products: pool.map((p) => (p.id === 'tg' ? { ...p, images: [] } : p)), categories: cats, browsing: prof, favorites: ['rm', 'ar'], now: NOW, seed: 0 });
check('article sans photo : pas dans l\'affiche', !ids(noPhoto).includes('tg'));
check('un favori d\'un article retiré de la vente ne fait pas d\'affiche', pickTargetedAd({ products: pool.map((p) => (p.id === 'rm' ? { ...p, is_active: false } : p)), categories: cats, browsing: null, favorites: ['rm'], now: NOW, seed: 0 })?.reason.kind !== 'liked');
// regards trop anciens (plus de 30 jours) : pas de signal de regard, mais le favori reste
let old = emptyProfile('v-old', NOW - 90 * DAY);
old = view(old, tagia, 3, NOW - 60 * DAY);
check('regards vieux de 60 jours : plus de rappel « regardé » ; un favori, lui, reste', (() => { const a = pickTargetedAd({ products: pool, categories: cats, browsing: old, now: NOW, seed: 0 }); const b = pickTargetedAd({ products: pool, categories: cats, browsing: old, favorites: ['tg'], now: NOW, seed: 0 }); return (!a || a.reason.kind !== 'viewed') && b?.product.id === 'tg' && b.reason.kind === 'liked'; })());

// --- le « ✕ » : l'affiche fermée ferme TOUS ses articles pour 24 h, et ne compte que pour UN « ✕ »
const closedAll = addClosedAds([], ['rm', 'ar', 'tg'], NOW);
const st = closedState(closedAll, NOW + 1000);
check('« ✕ » sur l\'affiche : les 3 articles sont exclus pendant 24 h, un seul « ✕ » compté (Zara ne s\'arrête pas)', st.excluded.sort().join() === 'ar,rm,tg' && !st.stopped && st.waitMs > 0, st);
const next = pickTargetedAd({ products: pool, categories: cats, browsing: prof, favorites: ['rm', 'ar'], now: NOW + 20_000, seed: 0, exclude: st.excluded });
check('après le « ✕ » : une autre annonce, jamais les 3 articles fermés', !!next ? !['rm', 'ar', 'tg'].includes(next.product.id) && !(next.more ?? []).some((m) => ['rm', 'ar', 'tg'].includes(m.id)) : true, ids(next));
const three = addClosedAd(addClosedAd(addClosedAd([], 'a', NOW), 'b', NOW + 1), 'c', NOW + 2);
check('3 « ✕ » à des heures différentes : Zara s\'arrête (comme avant)', closedState(three, NOW + 3).stopped === true);
check('3 articles fermés ensemble + 2 « ✕ » : 3 « ✕ » au total : Zara s\'arrête', closedState(addClosedAd(addClosedAd(closedAll, 'd', NOW + 10), 'e', NOW + 20), NOW + 30).stopped === true);
check('la liste gardée sur le téléphone relit les 3 articles fermés ensemble', parseClosedAds(JSON.stringify(closedAll), NOW + 1000).length === 3);

console.log(`\n${ok} contrôles réussis`);
