// « Zara a étudié ce client » (fiche de l'administrateur, 10 novembre 2026) : ce que Zara a compris et ce qu'elle propose. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/client-study.test.ts
import { LEVEL_BADGE, studyClient, type StudyInterestRow } from '../../src/lib/clientStudy.ts';
import type { AdCategory, AdProduct } from '../../src/lib/adTargeting.ts';

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
const H = 3600_000;
const cats: AdCategory[] = [{ id: 'c1', slug: 'survetements', name: 'Survêtements' }, { id: 'c2', slug: 'chaussures', name: 'Chaussures' }];
const mk = (id: string, name: string, extra: Partial<AdProduct> = {}): AdProduct => ({ id, slug: id, name, price: 12500, compare_at_price: null, stock: 6, images: [`https://img/${id}.jpg`], category_id: 'c1', is_active: true, is_flash_sale: false, flash_sale_ends_at: null, created_at: '2026-01-01T00:00:00Z', ...extra } as AdProduct);
const real = mk('rm', 'Survêtement Real Madrid ');
const arsenal = mk('ar', 'Survêtement Arsenal');
const tagia = mk('tg', 'TAGIA ROYALE – velour', { price: 22500 });
const barca = mk('bc', 'Survêtement Barcelona  enfant ');
const p511 = mk('p5', '511  original', { price: 5000, category_id: 'c2', stock: 58 });
const urban = mk('ub', 'URBANSOLE', { slug: 'urbansole', price: 15000, category_id: 'c2' });
const products = [real, arsenal, tagia, barca, p511];
// les lignes du suivi de la base pour le client AS-000883 (relevées le 10 novembre 2026)
const rows883: StudyInterestRow[] = [
  { productId: 'bc', level: 'leger', views: 1, lastViewedAt: NOW - 11.3 * H, cartStatus: 'none' },
  { productId: 'tg', level: 'moyen', views: 2, lastViewedAt: NOW - 11.4 * H, cartStatus: 'none' },
  { productId: 'rm', level: 'moyen', views: 2, lastViewedAt: NOW - 11.5 * H, cartStatus: 'none' },
  { productId: 'ar', level: 'leger', views: 1, lastViewedAt: NOW - 11.5 * H, cartStatus: 'none' },
  { productId: 'p5', level: 'leger', views: 1, lastViewedAt: NOW - 11.6 * H, cartStatus: 'none' },
];
const c883 = { gender: null, profession: null, region: null };

const s = studyClient({ customer: c883, interest: rows883, likedIds: ['rm', 'ar'], orderedProductIds: [], products, categories: cats, now: NOW });
check('AS-000883 : « 💙 Intérêt élevé » (3 articles repérés)', s.level === 'eleve' && /Intérêt élevé/.test(s.summary) && /3 articles/.test(s.summary), s.summary);
check('ses articles préférés, du meilleur au moins bon : Real Madrid (aimé + regardé 2×), Arsenal (aimé), TAGIA ROYALE (regardé 2×)', s.loved.map((l) => l.name).join('|') === 'Survêtement Real Madrid|Survêtement Arsenal|TAGIA ROYALE – velour', s.loved.map((l) => l.name));
check('la raison de chaque article est vraie : « ❤️ aimé · intérêt moyen · regardé 2× »', s.loved[0].why === '❤️ aimé · intérêt moyen · regardé 2×' && s.loved[1].why === '❤️ aimé · regardé 1×' && s.loved[2].why === 'intérêt moyen · regardé 2×', s.loved.map((l) => l.why));
check('Barcelona enfant et le 511 (un seul regard, pas aimés) : « regardés sans plus », pas sur l\'affiche', s.weak.map((l) => l.name).sort().join('|') === '511 original|Survêtement Barcelona enfant' && s.weak.every((l) => l.why === 'regardé 1×'), s.weak);
check('les noms sont nettoyés (espaces en trop retirés)', s.loved[0].name === 'Survêtement Real Madrid' && s.weak.some((l) => l.name === 'Survêtement Barcelona enfant'));
check('ce que Zara lui propose : l\'affiche « Vos articles préférés » avec Real Madrid en grand, puis Arsenal et TAGIA ROYALE', s.ad?.reason.kind === 'interest' && s.adNames.join('|') === 'Survêtement Real Madrid|Survêtement Arsenal|TAGIA ROYALE – velour' && s.adHeadline === 'Vos articles préférés vous attendent.', s.adNames);
check('« Pourquoi cette annonce ? » dit les vrais noms', /Vous avez regardé de près ou aimé ces articles : « Survêtement Real Madrid », « Survêtement Arsenal » et « TAGIA ROYALE – velour »/.test(s.adWhy ?? ''), s.adWhy);
check('aucun public reconnu (ni métier ni genre) ; les notes disent ce que Zara ne sait pas : pas de métier, pas de genre', s.audiences.length === 0 && s.notes.some((n) => /Aucun métier écrit/.test(n)) && s.notes.some((n) => /Aucun genre/.test(n)), s.notes);
check('pas de note « aucun article aimé » ni « aucun regard » (il en a)', !s.notes.some((n) => /Aucun article aimé|Aucun regard/.test(n)));

// --- sans aucune donnée : « rien d'enregistré », aucune annonce inventée
const empty = studyClient({ customer: { gender: null, profession: null }, interest: [], likedIds: [], orderedProductIds: [], products, categories: cats, now: NOW });
check('client sans regards ni favoris ni métier : niveau « aucun », rien proposé, Zara n\'invente rien', empty.level === 'aucun' && empty.loved.length === 0 && empty.ad === null && empty.adNames.length === 0 && empty.notes.some((n) => /n’invente jamais/.test(n)), empty);
check('les notes disent « Aucun article aimé » et « Aucun regard enregistré »', empty.notes.some((n) => /Aucun article aimé/.test(n)) && empty.notes.some((n) => /Aucun regard enregistré/.test(n)));
check('les badges : élevé, moyen, léger, rien d\'enregistré', LEVEL_BADGE.eleve === '💙 Intérêt élevé' && LEVEL_BADGE.moyen === '🟡 Intérêt moyen' && LEVEL_BADGE.leger === '⚪ Intérêt léger' && LEVEL_BADGE.aucun === '⚪ Rien d’enregistré');
const moyen = studyClient({ customer: {}, interest: [{ productId: 'rm', level: 'moyen', views: 1, lastViewedAt: NOW - H, cartStatus: 'none' }], likedIds: [], orderedProductIds: [], products, categories: cats, now: NOW });
check('un seul regard « moyen » (pas assez pour l\'affiche) : niveau « moyen », aucun article préféré', moyen.level === 'moyen' && moyen.loved.length === 0 && /Intérêt moyen/.test(moyen.summary), moyen.summary);
const leger = studyClient({ customer: {}, interest: [{ productId: 'rm', level: 'leger', views: 1, lastViewedAt: NOW - H, cartStatus: 'none' }], likedIds: [], orderedProductIds: [], products, categories: cats, now: NOW });
check('un seul regard « léger » : niveau « léger »', leger.level === 'leger' && leger.weak.length === 1 && leger.loved.length === 0);

// --- les commandes, les articles qui ne sont plus en vente
const bought = studyClient({ customer: c883, interest: rows883, likedIds: ['rm', 'ar'], orderedProductIds: ['rm'], products, categories: cats, now: NOW });
check('Real Madrid déjà commandé : il passe dans « déjà commandés », n\'est plus un article préféré, et n\'est jamais reproposé', bought.ordered.map((l) => l.name).join() === 'Survêtement Real Madrid' && !bought.loved.some((l) => l.id === 'rm') && !bought.adNames.includes('Survêtement Real Madrid') && bought.adNames.includes('Survêtement Arsenal'), { ordered: bought.ordered, ad: bought.adNames });
const gone = studyClient({ customer: c883, interest: rows883, likedIds: ['rm', 'ar'], orderedProductIds: [], products: products.filter((p) => p.id !== 'ar'), names: { ar: 'Survêtement Arsenal' }, categories: cats, now: NOW });
check('Arsenal retiré de la vente : il reste dans la fiche, barré « plus en vente : Zara ne le propose pas », et n\'est pas sur l\'affiche', gone.loved.some((l) => l.id === 'ar' && !l.available && /plus en vente/.test(l.why) && l.name === 'Survêtement Arsenal') && !gone.adNames.includes('Survêtement Arsenal'), gone.loved);
const noName = studyClient({ customer: c883, interest: rows883, likedIds: ['zz'], orderedProductIds: [], products, categories: cats, now: NOW });
check('un favori dont l\'article a disparu de la base : « Article retiré de la vente », sans planter', noName.loved.some((l) => l.id === 'zz' && l.name === 'Article retiré de la vente' && !l.available));
const purchasedRow = studyClient({ customer: c883, interest: [{ productId: 'rm', level: 'eleve', views: 5, lastViewedAt: NOW - H, cartStatus: 'purchased' }], likedIds: ['rm'], orderedProductIds: [], products, categories: cats, now: NOW });
check('le suivi dit « purchased » : l\'article n\'est pas proposé (même aimé, même « élevé »)', !purchasedRow.loved.some((l) => l.id === 'rm') && !purchasedRow.adNames.includes('Survêtement Real Madrid'));

// --- le public (métier écrit) et l'offre élèves/étudiants
const stu = studyClient({ customer: { profession: 'Étudiant' }, interest: rows883, likedIds: ['rm', 'ar'], orderedProductIds: [], products: [...products, urban], categories: cats, now: NOW });
check('un étudiant : public « Étudiants », et l\'offre du patron (grande affiche URBANSOLE) passe avant « Vos articles préférés »', stu.audienceLabels.join() === 'Étudiants' && stu.ad?.reason.kind === 'studentOffer' && stu.adNames[0] === 'URBANSOLE', { aud: stu.audienceLabels, ad: stu.adNames });
check('l\'étudiant garde malgré tout son niveau d\'intérêt et ses articles préférés dans la fiche', stu.level === 'eleve' && stu.loved.length === 3);
const woman = studyClient({ customer: { gender: 'femme', profession: 'Commerçante' }, interest: [], likedIds: [], orderedProductIds: [], products, categories: cats, now: NOW });
check('une commerçante : public « Femmes » ; la note dit que « Commerçante » ne correspond à aucun public de métier', woman.audienceLabels.join() === 'Femmes' && woman.notes.some((n) => /Commerçante/.test(n) && /aucun public/.test(n)), woman.notes);
const military = studyClient({ customer: { profession: 'militaire', gender: 'homme' }, interest: [], likedIds: [], orderedProductIds: [], products, categories: cats, now: NOW });
check('un militaire : public « Hommes · Militaires et forces de l\'ordre » (les deux publics du compte)', military.audienceLabels.join(' · ') === 'Hommes · Militaires et forces de l’ordre', military.audienceLabels);

// --- une ligne du suivi illisible
const bad = studyClient({ customer: {}, interest: [{ productId: 'rm', level: 'leger', views: 0, lastViewedAt: 0, cartStatus: 'none' }], likedIds: [], orderedProductIds: [], products, categories: cats, now: NOW });
check('une ligne sans aucun regard (0) ne compte pas comme un regard', bad.level === 'aucun' && bad.weak.length === 0);

console.log(`\n${ok} contrôles réussis`);
