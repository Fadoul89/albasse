// Vente flash 24 h, ancien prix seulement en vraie promotion, et choix des articles par Zara (src/lib/promotions.ts et src/lib/zaraPromoPicker.ts) : fonctions pures.
// Lancer : node --import ./tests/zara/register.mjs tests/email/zara-promotions.test.ts
import {
  activeFlash, activePromotions, applyPromotionRules, flashActive, nextPromoChange, promoActive, realDiscountPct, shownOldPrice,
  type PromoFields,
} from '../../src/lib/promotions.ts';
import {
  FLASH_COOLDOWN_DAYS, FLASH_COUNT, MAX_PER_CATEGORY_FLASH, MAX_PER_CATEGORY_PROMO, MIN_STOCK_FLASH, PROMO_COUNT, interestOf, pickPromotions, reasonsFor,
  type PromoStatRow,
} from '../../src/lib/zaraPromoPicker.ts';

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

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3600_000;
const P = (extra: Partial<PromoFields> = {}): PromoFields => ({ price: 10000, compare_at_price: 12500, is_flash_sale: false, flash_sale_ends_at: null, promo_ends_at: null, ...extra });

// --- une vraie remise : 5 % à 60 %
check('remise de 20 % : vraie, 20', realDiscountPct(10000, 12500) === 20);
check('remise de 5 % exactement : vraie', realDiscountPct(950, 1000) === 5);
check('remise de 4,9 % : pas vraie', realDiscountPct(951, 1000) === null);
check('remise de 60 % exactement : vraie', realDiscountPct(400, 1000) === 60);
check('remise de 61 % : erreur de saisie, pas vraie', realDiscountPct(390, 1000) === null);
check('ancien prix plus petit, égal, vide ou texte : pas de remise', realDiscountPct(1000, 900) === null && realDiscountPct(1000, 1000) === null && realDiscountPct(1000, null) === null && realDiscountPct(1000, undefined) === null && realDiscountPct(1000, Number('x')) === null);
check('prix à 0 : pas de remise', realDiscountPct(0, 1000) === null);

// --- la Vente flash dure 24 h
check('vente flash en cours : active', flashActive(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW + 5 * H) }), NOW));
check('vente flash terminée : plus active (même marquée « flash »)', !flashActive(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW - 1000) }), NOW));
check('vente flash sans date de fin : pas une vraie vente flash', !flashActive(P({ is_flash_sale: true, flash_sale_ends_at: null }), NOW));
check('date de fin illisible : pas active', !flashActive(P({ is_flash_sale: true, flash_sale_ends_at: 'bientôt' }), NOW));
check('fin pile à l\'instant : plus active', !flashActive(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW) }), NOW));
check('pas marquée flash mais avec une date : pas active', !flashActive(P({ is_flash_sale: false, flash_sale_ends_at: iso(NOW + H) }), NOW));
check('promotion de Zara en cours / terminée / absente', promoActive(P({ promo_ends_at: iso(NOW + H) }), NOW) && !promoActive(P({ promo_ends_at: iso(NOW - H) }), NOW) && !promoActive(P(), NOW) && !promoActive({ price: 1, compare_at_price: null }, NOW));

// --- l'ancien prix seulement en vraie promotion
check('aucune promotion : AUCUN ancien prix montré (même s\'il est enregistré)', shownOldPrice(P(), NOW) === null);
check('vente flash en cours + remise vraie : ancien prix montré', shownOldPrice(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW + H) }), NOW) === 12500);
check('promotion de Zara en cours + remise vraie : ancien prix montré', shownOldPrice(P({ promo_ends_at: iso(NOW + H) }), NOW) === 12500);
check('vente flash terminée : l\'ancien prix disparaît', shownOldPrice(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW - H) }), NOW) === null);
check('promotion terminée : l\'ancien prix disparaît', shownOldPrice(P({ promo_ends_at: iso(NOW - H) }), NOW) === null);
check('promotion en cours mais remise de 75 % (erreur de saisie) : pas montré', shownOldPrice(P({ price: 2500, compare_at_price: 10000, promo_ends_at: iso(NOW + H) }), NOW) === null);
check('promotion en cours mais remise de 2 % : pas montré', shownOldPrice(P({ price: 9800, compare_at_price: 10000, promo_ends_at: iso(NOW + H) }), NOW) === null);
check('promotion en cours sans ancien prix : rien', shownOldPrice(P({ compare_at_price: null, promo_ends_at: iso(NOW + H) }), NOW) === null);

// --- l'article tel que le client le voit
{
  const gone = applyPromotionRules(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW - H) }), NOW);
  check('article au flash terminé : plus de flash, plus de date de fin, plus d\'ancien prix', gone.is_flash_sale === false && gone.flash_sale_ends_at === null && gone.compare_at_price === null, gone);
  const live = applyPromotionRules(P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW + H) }), NOW);
  check('article au flash en cours : flash gardé avec sa fin, ancien prix gardé', live.is_flash_sale && live.flash_sale_ends_at === iso(NOW + H) && live.compare_at_price === 12500);
  const plain = applyPromotionRules(P({ price: 7777 }), NOW);
  check('article normal : le prix de vente ne change JAMAIS', plain.price === 7777 && plain.compare_at_price === null);
  const src = P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW - H) });
  applyPromotionRules(src, NOW);
  check('l\'objet d\'origine n\'est pas modifié (l\'administrateur voit toujours les vraies données)', src.is_flash_sale === true && src.compare_at_price === 12500);
}

// --- les listes de l'accueil
{
  const a = { id: 'a', ...P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW + 5 * H) }) };
  const b = { id: 'b', ...P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW + 2 * H) }) };
  const c = { id: 'c', ...P({ is_flash_sale: true, flash_sale_ends_at: iso(NOW - H) }) };
  const d = { id: 'd', ...P({ promo_ends_at: iso(NOW + 6 * 24 * H) }) };
  const e = { id: 'e', ...P({ promo_ends_at: iso(NOW + 3 * 24 * H) }) };
  const f = { id: 'f', ...P({ promo_ends_at: iso(NOW + 24 * H), is_flash_sale: true, flash_sale_ends_at: iso(NOW + H) }) };
  const g = { id: 'g', ...P({ promo_ends_at: iso(NOW - H) }) };
  const flash = activeFlash([a, b, c, d, e, f, g], NOW);
  check('Vente flash de l\'accueil : seulement les ventes flash EN COURS (a, b, f), la fin la plus proche pour le compte à rebours', flash.items.map((x) => x.id).join() === 'a,b,f' && flash.endsAt === iso(NOW + H), flash);
  const promos = activePromotions([a, b, c, d, e, f, g], NOW);
  check('Promotions de l\'accueil : en cours et hors vente flash (d, e), fin la plus proche', promos.items.map((x) => x.id).join() === 'd,e' && promos.endsAt === iso(NOW + 3 * 24 * H), promos);
  check('personne en vente flash ni en promotion : listes vides, pas de date', activeFlash([c, g], NOW).items.length === 0 && activeFlash([c, g], NOW).endsAt === null && activePromotions([P() as typeof a, g], NOW).items.length === 0);
  check('prochain changement d\'affichage : la fin de la vente flash la plus proche (dans 1 h)', nextPromoChange([a, b, c, d, e, f, g], NOW) === NOW + H);
  check('rien à venir : pas de minuterie', nextPromoChange([c, g], NOW) === null);
}

// --- Zara choisit : les statistiques
let seq = 0;
const R = (extra: Partial<PromoStatRow> = {}): PromoStatRow => {
  seq++;
  return { id: `id${seq}`, name: `Article ${String(seq).padStart(2, '0')}`, slug: `a${seq}`, image: null, price: 10000, old_price: 12500, stock: 20, category_id: 'c1', likes: 0, views: 0, carts: 0, sold: 0, flash_active: false, promo_active: false, ...extra };
};
check('intérêt = vues + 5 × paniers + j\'aime (20 au plus)', interestOf({ views: 10, carts: 2, likes: 3 }) === 23 && interestOf({ views: 0, carts: 0, likes: 500 }) === 20);
{
  const empty = pickPromotions([]);
  check('aucune donnée : rien proposé, avec une explication honnête', empty.flash.length === 0 && empty.promo.length === 0 && empty.notes.length === 2 && /jamais au hasard/.test(empty.notes[0]), empty);
  seq = 0;
  const quiet = pickPromotions(Array.from({ length: 30 }, () => R({ views: 1 })));
  check('articles presque jamais vus : rien n\'est choisi au hasard', quiet.flash.length === 0 && quiet.promo.length === 0, quiet.eligible);
}
{
  seq = 0;
  const rows: PromoStatRow[] = [
    R({ name: 'Star', views: 80, carts: 6, likes: 30, category_id: 'c1' }), // très demandée
    R({ name: 'Montre', views: 60, carts: 4, likes: 10, category_id: 'c2' }),
    R({ name: 'Sac', views: 40, carts: 2, category_id: 'c3' }),
    R({ name: 'Parfum', views: 35, carts: 1, category_id: 'c4' }),
    R({ name: 'Lunettes', views: 33, carts: 1, category_id: 'c5' }),
    R({ name: 'Faux ancien prix', views: 500, carts: 50, price: 2500, old_price: 10000 }), // remise 75 % : erreur de saisie
    R({ name: 'Sans ancien prix', views: 500, carts: 50, old_price: null }),
    R({ name: 'Presque épuisée', views: 500, carts: 50, stock: 2 }),
    R({ name: 'Déjà en flash', views: 500, carts: 50, flash_active: true }),
    R({ name: 'Déjà en promo', views: 500, carts: 50, promo_active: true }),
    R({ name: 'Petite remise', views: 500, carts: 50, price: 9800, old_price: 10000 }),
  ];
  const plan = pickPromotions(rows);
  const names = (l: { name: string }[]) => l.map((x) => x.name).join(', ');
  check('les articles écartés ne sont JAMAIS proposés (remise fausse ou nulle, rupture, déjà en promotion)', !plan.flash.concat(plan.promo).some((x) => /Faux|Sans|épuisée|Déjà|Petite/.test(x.name)), names(plan.flash.concat(plan.promo)));
  check('articles examinés : 11, éligibles : 5 (vraie remise, stock, pas déjà en promotion)', plan.considered === 11 && plan.eligible === 5, [plan.considered, plan.eligible]);
  check('Vente flash : les plus demandés d\'abord (Star, Montre, Sac, Parfum), 4 au plus', names(plan.flash) === 'Star, Montre, Sac, Parfum' && plan.flash.length === FLASH_COUNT, names(plan.flash));
  check('Promotions : le reste des articles demandés (Lunettes), jamais un article déjà en vente flash', names(plan.promo) === 'Lunettes', names(plan.promo));
  const star = plan.flash[0];
  check('chaque choix : ancien prix, vraie remise (−20 %), stock', star.oldPrice === 12500 && star.discountPct === 20 && star.stock === 20 && star.kind === 'flash');
  check('chaque choix dit pourquoi avec les VRAIS chiffres (80 vues, 6 paniers, 30 j\'aime, pas encore acheté, 20 en stock, −20 %)', star.reasons.join(' | ') === '👁 80 vues cette semaine | 🛒 6 ajouts au panier | ♥ 30 j’aime | 📦 pas encore acheté ce mois | 20 en stock | vraie remise −20 %', star.reasons);
  check('aucun prix inventé : prix de vente repris tel quel', plan.flash.every((x) => x.price === 10000));
}
{
  // limites : pas toute la vente flash dans la même rubrique, stock minimum, au plus 12 promotions
  seq = 0;
  const hot = Array.from({ length: 6 }, (_, i) => R({ name: `Chaud ${i}`, views: 100 - i, carts: 5, category_id: 'cA' }));
  const other = Array.from({ length: 4 }, (_, i) => R({ name: `Autre ${i}`, views: 40 - i, carts: 1, category_id: `c${i}` }));
  const plan = pickPromotions([...hot, ...other]);
  const catCount = (l: { name: string }[], prefix: string) => l.filter((x) => x.name.startsWith(prefix)).length;
  check(`Vente flash : au plus ${MAX_PER_CATEGORY_FLASH} articles de la même rubrique`, catCount(plan.flash, 'Chaud') === MAX_PER_CATEGORY_FLASH && plan.flash.length === FLASH_COUNT, plan.flash.map((x) => x.name));
  check(`Promotions : au plus ${MAX_PER_CATEGORY_PROMO} articles de la même rubrique`, catCount(plan.promo, 'Chaud') <= MAX_PER_CATEGORY_PROMO, plan.promo.map((x) => x.name));
  seq = 0;
  const lots = Array.from({ length: 40 }, (_, i) => R({ name: `L${String(i).padStart(2, '0')}`, views: 50 + i, carts: 1, category_id: `cat${i % 10}` }));
  const big = pickPromotions(lots);
  check(`40 articles demandés : ${FLASH_COUNT} en Vente flash + ${PROMO_COUNT} en Promotions, sans doublon`, big.flash.length === FLASH_COUNT && big.promo.length === PROMO_COUNT && new Set([...big.flash, ...big.promo].map((x) => x.id)).size === FLASH_COUNT + PROMO_COUNT, [big.flash.length, big.promo.length]);
  seq = 0;
  const lowStock = pickPromotions([R({ views: 90, carts: 9, stock: MIN_STOCK_FLASH - 1 }), R({ views: 20, carts: 1, stock: 20 })]);
  check('stock trop petit pour une vente flash : l\'article va en Promotion, pas en flash', lowStock.flash.map((x) => x.views).join() === '20' && lowStock.promo.map((x) => x.views).join() === '90', lowStock);
}
{
  // promotion : « regardé mais pas acheté » passe avant « déjà bien vendu »
  seq = 0;
  const plan = pickPromotions([
    R({ name: 'Vend déjà', views: 60, carts: 2, sold: 10, category_id: 'a' }),
    R({ name: 'Regardé pas acheté', views: 45, carts: 2, sold: 0, category_id: 'b' }),
    ...Array.from({ length: 4 }, (_, i) => R({ name: `Flash ${i}`, views: 300 - i, carts: 20, category_id: `f${i}` })),
  ]);
  check('Promotions : l\'article regardé mais jamais acheté passe avant celui qui se vend déjà bien', plan.promo.map((x) => x.name).join() === 'Regardé pas acheté,Vend déjà', plan.promo.map((x) => x.name));
}
{
  seq = 0;
  const same = Array.from({ length: 20 }, () => R({ views: 30, carts: 1 }));
  const a = pickPromotions(same);
  const b = pickPromotions([...same].reverse());
  check('égalité parfaite : le choix ne dépend pas de l\'ordre de lecture (même noms)', a.flash.map((x) => x.name).join() === b.flash.map((x) => x.name).join());
  check('raisons : « 1 vue », « 1 ajout au panier », « 1 vendu »', reasonsFor({ views: 1, carts: 1, likes: 0, sold: 1, stock: 4 }, 12).join(' | ') === '👁 1 vue cette semaine | 🛒 1 ajout au panier | 📦 1 vendu ce mois | 4 en stock | vraie remise −12 %');
}

{
  // repos de 3 jours : un article qui vient d'avoir une Vente flash n'y revient pas tout de suite (les choix tournent), mais peut aller en Promotion
  seq = 0;
  const day = 86_400_000;
  const rows = [
    R({ name: 'Hier en flash', views: 90, carts: 6, last_flash_at: new Date(NOW - 1 * day).toISOString(), category_id: 'a' }),
    R({ name: 'Il y a 2 jours', views: 80, carts: 6, last_flash_at: new Date(NOW - 2 * day).toISOString(), category_id: 'b' }),
    R({ name: 'Il y a 4 jours', views: 70, carts: 6, last_flash_at: new Date(NOW - 4 * day).toISOString(), category_id: 'c' }),
    R({ name: 'Jamais', views: 40, carts: 1, category_id: 'd' }),
    R({ name: 'Date illisible', views: 30, carts: 1, last_flash_at: 'bientôt', category_id: 'e' }),
  ];
  const plan = pickPromotions(rows, NOW);
  check(`repos de ${FLASH_COOLDOWN_DAYS} jours : l'article de la veille et d'il y a 2 jours ne reviennent pas en Vente flash`, plan.flash.map((x) => x.name).join() === 'Il y a 4 jours,Jamais,Date illisible', plan.flash.map((x) => x.name));
  check('repos : les articles qui se reposent peuvent aller en Promotion (ils sont demandés)', plan.promo.map((x) => x.name).join() === 'Hier en flash,Il y a 2 jours', plan.promo.map((x) => x.name));
  const none = pickPromotions(rows.map((r) => ({ ...r, last_flash_at: undefined })), NOW);
  check('sans date de dernière vente flash : aucun repos (les 4 plus demandés)', none.flash.map((x) => x.name).join() === 'Hier en flash,Il y a 2 jours,Il y a 4 jours,Jamais', none.flash.map((x) => x.name));
}

console.log(`\n${ok} vérifications réussies${process.exitCode ? ', ÉCHECS ci-dessus' : ''}`);
