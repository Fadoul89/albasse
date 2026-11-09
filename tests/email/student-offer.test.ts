// Offre « élèves et étudiants » (demande du patron, 9 novembre 2026) : URBANSOLE à 12 500 FCFA, réservée, code EE26 automatique. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/student-offer.test.ts
import {
  STUDENT_OFFER, asksStudentOffer, dealFromPrice, isStudentCustomer, mentionsOfferCode, offerTexts, settleStudentPrice, studentDeal, studentLevel, withStudentPrice, withoutStudentPrice,
} from '../../src/lib/studentOffer.ts';
import { pickTargetedAd, previewAudiences, adHeadline, adWhy, type AdCategory, type AdProduct } from '../../src/lib/adTargeting.ts';
import { applyProductView, emptyProfile, type ProductMeta } from '../../src/lib/browsingInsights.ts';

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

// --- les constantes décidées avec le patron
check('l\'offre : l\'article « urbansole », 12 500 FCFA, le code « EE26 »', STUDENT_OFFER.slug === 'urbansole' && STUDENT_OFFER.price === 12500 && STUDENT_OFFER.code === 'EE26', STUDENT_OFFER);

// --- qui est élève ou étudiant : SEULEMENT le métier écrit dans le compte
const students = ['étudiant', 'Étudiante', 'Etudiant en droit', 'student', 'élève', 'Eleve', 'lycéen', 'collégienne', 'écolier', 'طالب', 'تلميذ', 'طالبة'];
check('étudiant, élève, lycéen, collégien, écolier, student, طالب, تلميذ : élève ou étudiant', students.every((m) => isStudentCustomer({ profession: m })), students.filter((m) => !isStudentCustomer({ profession: m })));
const others = ['Commerçant', 'militaire', 'directeur général', 'Administrateur', 'vendeur', '', null, undefined, '   ', 'chauffeur'];
check('commerçant, militaire, administrateur, métier vide ou absent : PAS élève ni étudiant (rien n\'est deviné)', others.every((m) => !isStudentCustomer({ profession: m as string | null })) && !isStudentCustomer(null) && !isStudentCustomer(undefined), others.filter((m) => isStudentCustomer({ profession: m as string | null })));
check('le niveau : élève ou étudiant', studentLevel({ profession: 'élève' }) === 'eleve' && studentLevel({ profession: 'étudiant' }) === 'etudiant' && studentLevel({ profession: 'avocat' }) === null);
check('le genre, l\'âge ou le prénom ne donnent JAMAIS l\'offre (seul le métier compte)', !isStudentCustomer({ profession: null, ...({ gender: 'femme', birth_date: '2008-01-01', full_name: 'Étudiante' } as object) }));

// --- le prix : le vrai prix normal, jamais une hausse, jamais une fausse économie
const d = dealFromPrice(15000)!;
check('15 000 FCFA → offre à 12 500 : économie 2 500 FCFA, vraie remise 17 %, code EE26', d.price === 12500 && d.listPrice === 15000 && d.saving === 2500 && d.pct === 17 && d.code === 'EE26', d);
check('le prix de la base peut arriver en texte (« 15000.00 ») : même offre', dealFromPrice('15000.00')?.listPrice === 15000);
check('prix de l\'article déjà à 12 500 ou moins : AUCUNE offre (jamais une hausse, jamais une fausse économie)', dealFromPrice(12500) === null && dealFromPrice(12000) === null && dealFromPrice(0) === null);
check('prix absent ou illisible : aucune offre', dealFromPrice(null) === null && dealFromPrice(undefined) === null && dealFromPrice('abc') === null && dealFromPrice(NaN) === null);
const urban = { slug: 'urbansole', price: 15000 };
check('élève/étudiant + URBANSOLE : l\'offre', studentDeal(urban, { profession: 'étudiant' })?.price === 12500 && studentDeal(urban, { profession: 'élève' })?.price === 12500);
check('client qui n\'est pas élève/étudiant : AUCUNE offre', studentDeal(urban, { profession: 'Commerçant' }) === null && studentDeal(urban, null) === null && studentDeal(urban, { profession: null }) === null);
check('un autre article : AUCUNE offre, même pour un étudiant', studentDeal({ slug: 'rolex', price: 90000 }, { profession: 'étudiant' }) === null && studentDeal(null, { profession: 'étudiant' }) === null);

// --- l'article de la commande
type P = { slug: string; price: number; compare_at_price: number | null; student_offer?: { code: string; list_price: number } };
const item: P = { slug: 'urbansole', price: 15000, compare_at_price: null };
const priced = withStudentPrice(item, { profession: 'étudiant' });
check('le prix de l\'offre est appliqué à l\'article d\'un étudiant : 12 500, avec le code et le prix normal notés', priced.price === 12500 && priced.student_offer?.code === 'EE26' && priced.student_offer?.list_price === 15000, priced);
check('l\'article d\'origine n\'est jamais modifié (copie)', item.price === 15000 && item.student_offer === undefined);
check('appliquer deux fois ne change rien (toujours 12 500, jamais 10 000)', withStudentPrice(priced, { profession: 'étudiant' }).price === 12500);
check('un client sans droit garde le prix normal (même objet)', withStudentPrice(item, { profession: 'Commerçant' }) === item);
const back = withoutStudentPrice(priced);
check('retirer l\'offre : le prix normal revient, la marque disparaît', back.price === 15000 && back.student_offer === undefined, back);
check('« settle » : un étudiant garde 12 500 ; un client sans droit retrouve 15 000 (panier gardé avec l\'offre sur un autre compte) ; un article sans offre ne bouge pas',
  settleStudentPrice(priced, { profession: 'étudiant' }).price === 12500 && settleStudentPrice(priced, { profession: 'Commerçant' }).price === 15000 && settleStudentPrice(priced, null).price === 15000 && settleStudentPrice({ slug: 'rolex', price: 90000, compare_at_price: null }, { profession: 'étudiant' }).price === 90000);
check('« settle » : un article du panier au prix normal devient 12 500 quand le compte connecté est étudiant (compte connecté après le choix)', settleStudentPrice(item, { profession: 'élève' }).price === 12500);
check('article passé à 12 000 par le patron pendant que le panier est à 12 500 : le prix du panier suit la base, jamais d\'offre à 12 500 par-dessus', settleStudentPrice({ ...priced, price: 12000, student_offer: { code: 'EE26', list_price: 12000 } }, { profession: 'étudiant' }).price === 12000);

// --- le code « EE26 » et la demande d'offre, écrits dans le chat de Zara
const asks = ['EE26', 'ee26', 'EE 26', 'code EE26', 'j\'ai le code ee26', 'offre étudiant', 'offre élèves et étudiants', 'réduction pour les étudiants', 'prix étudiant', 'promo élève', 'code promo étudiant', 'عرض التلاميذ والطلاب', 'تخفيض الطلاب'];
check('« EE26 », « code EE26 », « offre étudiant », « réduction pour les étudiants »… (français et arabe) : Zara reconnaît la demande', asks.every((t) => asksStudentOffer(t)), asks.filter((t) => !asksStudentOffer(t)));
const notAsks = ['bonjour', 'je cherche une montre', 'je suis étudiant', 'étudiant', 'comment commander', 'quelles sont vos promotions', 'une réduction svp', 'je veux des chaussures', 'je suis élève et je cherche un sac', 'ee27'];
check('une demande normale, « je suis étudiant » seul, « une réduction svp » : PAS la demande d\'offre', notAsks.every((t) => !asksStudentOffer(t)), notAsks.filter((t) => asksStudentOffer(t)));
check('une longue phrase n\'est pas lue comme une demande d\'offre', !asksStudentOffer('je voudrais savoir si vous avez beaucoup de choses pour les filles de ma famille et aussi des chaussures offre étudiant merci beaucoup'));
check('le code écrit : majuscules, espaces et mots autour sont tolérés', mentionsOfferCode('Ee 26') && mentionsOfferCode('mon code : EE26 !') && !mentionsOfferCode('ee2'));

// --- les textes : vrais, sans pression, avec les vrais chiffres
const fr = [offerTexts.badge('fr'), offerTexts.only('fr'), offerTexts.instead(d, 'fr'), offerTexts.auto(d, 'fr'), offerTexts.cta(d, 'fr'), offerTexts.line(d, 'fr'), offerTexts.zaraYes(d, 'fr'), offerTexts.zaraNoMember('fr'), offerTexts.zaraNoGuest('fr'), offerTexts.zaraNone('fr')];
const ar = [offerTexts.badge('ar'), offerTexts.only('ar'), offerTexts.instead(d, 'ar'), offerTexts.auto(d, 'ar'), offerTexts.cta(d, 'ar'), offerTexts.line(d, 'ar'), offerTexts.zaraYes(d, 'ar'), offerTexts.zaraNoMember('ar'), offerTexts.zaraNoGuest('ar'), offerTexts.zaraNone('ar')];
check('« OFFRE RÉSERVÉE AUX ÉLÈVES ET ÉTUDIANTS », « Offre uniquement pour les élèves et étudiants »', offerTexts.badge('fr') === '🎓 OFFRE RÉSERVÉE AUX ÉLÈVES ET ÉTUDIANTS' && offerTexts.only('fr') === 'Offre uniquement pour les élèves et étudiants');
check('les prix viennent du calcul : « 12 500 FCFA », « au lieu de 15 000 FCFA », « -17 % », « Code EE26 appliqué automatiquement »', offerTexts.price(d) === '12 500 FCFA' && offerTexts.instead(d, 'fr') === 'au lieu de 15 000 FCFA' && offerTexts.pct(d, 'fr') === '-17 %' && offerTexts.auto(d, 'fr') === 'Code EE26 appliqué automatiquement' && offerTexts.cta(d, 'fr') === 'Commander avec le code EE26', fr);
check('si le prix normal change (17 500), le texte suit : « au lieu de 17 500 FCFA », « -29 % », jamais « 15 000 » écrit en dur', (() => { const d2 = dealFromPrice(17500)!; return offerTexts.instead(d2, 'fr') === 'au lieu de 17 500 FCFA' && offerTexts.pct(d2, 'fr') === '-29 %' && !/15 000/.test(offerTexts.line(d2, 'fr')); })());
check('aucune pression, aucune fausse urgence, aucune fausse rareté (pas de « dernière chance », « plus que », « vite », « stock limité »)', ![...fr, ...ar].some((t) => /dernière chance|plus que|vite|stock limité|dépêchez|ne ratez|آخر فرصة|أسرع|لا تفوت|كمية محدودة/i.test(t)), fr);
check('aucune promesse de réussite ni de gratuité (« gratuit », « garanti »)', ![...fr].some((t) => /gratuit|garanti|à vie/i.test(t.replace('Créez votre compte gratuit', ''))), fr);
check('Zara explique comment y avoir droit : écrire « élève » ou « étudiant » dans « Métier »', /« élève » ou « étudiant »/.test(offerTexts.zaraNoMember('fr')) && /Métier/.test(offerTexts.zaraNoMember('fr')) && /Créez votre compte gratuit/.test(offerTexts.zaraNoGuest('fr')));
check('en arabe : le code, le prix et la réserve aux tلاميذ et aux طلاب', ar.some((t) => t.includes('EE26')) && ar.some((t) => /12 500/.test(t)) && /تلميذ|طالب/.test(offerTexts.zaraNoMember('ar')));

// --- l'annonce de l'accueil (lib/adTargeting)
const NOW = Date.parse('2026-11-09T09:00:00Z');
const DAY = 24 * 3600 * 1000;
const cats: AdCategory[] = [{ id: 'c-shoes', slug: 'chaussures', name: 'Chaussures' }, { id: 'c-watch', slug: 'montres', name: 'Montres' }];
const mk = (id: string, category_id: string, extra: Partial<AdProduct> = {}): AdProduct => ({ id, slug: `slug-${id}`, name: `Article ${id}`, price: 20000, compare_at_price: null, stock: 8, images: [`https://img/${id}.jpg`], category_id, is_active: true, is_flash_sale: false, flash_sale_ends_at: null, created_at: '2026-01-01T00:00:00Z', ...extra } as AdProduct);
const urbanP = mk('u1', 'c-shoes', { slug: 'urbansole', name: 'URBANSOLE', price: 15000 });
const cheap = mk('ch', 'c-watch', { price: 3000 });
const others2 = [mk('w1', 'c-watch'), mk('w2', 'c-watch'), cheap];
const pool = [urbanP, ...others2];
const stu = pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0 });
check('un étudiant : la grande affiche (reason « studentOffer »), l\'article URBANSOLE, 12 500 FCFA au lieu de 15 000', stu?.product.id === 'u1' && stu.reason.kind === 'studentOffer' && stu.reason.price === 12500 && stu.reason.listPrice === 15000 && stu.reason.code === 'EE26' && stu.reason.pct === 17, stu);
const ele = pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'Élève' }, now: NOW, seed: 3 });
check('un élève : la même grande affiche (quelle que soit la tranche de 6 heures)', [0, 1, 2, 3, 4, 5].every((seed) => pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'Élève' }, now: NOW, seed })?.reason.kind === 'studentOffer') && ele?.reason.kind === 'studentOffer');
const other = pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'Commerçant' }, now: NOW, seed: 0 });
check('un commerçant, un client sans métier : JAMAIS la grande affiche', (other === null || other.reason.kind !== 'studentOffer') && [null, { gender: 'femme' }, { profession: 'militaire' }, { profession: 'Administrateur' }].every((c) => pickTargetedAd({ products: pool, categories: cats, customer: c, now: NOW, seed: 0 })?.reason.kind !== 'studentOffer'));
const noStock = pickTargetedAd({ products: [{ ...urbanP, stock: 0 }, ...others2], categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0 });
check('URBANSOLE épuisé : pas d\'affiche, Zara revient à un article « petit prix » (rien d\'inventé)', noStock?.reason.kind === 'student', noStock);
const noImage = pickTargetedAd({ products: [{ ...urbanP, images: [] }, ...others2], categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0 });
const retired = pickTargetedAd({ products: [{ ...urbanP, is_active: false }, ...others2], categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0 });
check('URBANSOLE sans photo ou retiré de la vente : pas d\'affiche', noImage?.reason.kind !== 'studentOffer' && retired?.reason.kind !== 'studentOffer');
const lowPrice = pickTargetedAd({ products: [{ ...urbanP, price: 12500 }, ...others2], categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0 });
const lower = pickTargetedAd({ products: [{ ...urbanP, price: 11000 }, ...others2], categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0 });
check('URBANSOLE déjà à 12 500 FCFA ou moins : AUCUNE « offre » (pas d\'économie, pas d\'affiche)', lowPrice?.reason.kind !== 'studentOffer' && lower?.reason.kind !== 'studentOffer');
const closed = pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'étudiant' }, now: NOW, seed: 0, exclude: ['u1'] });
check('« ✕ » : l\'affiche fermée n\'est plus proposée (autre annonce)', closed?.reason.kind !== 'studentOffer' && closed?.product.id !== 'u1', closed);
const meta: ProductMeta = { id: 'u1', name: 'URBANSOLE', slug: 'urbansole', categoryId: 'c-shoes', categorySlug: 'chaussures', categoryName: 'Chaussures' };
let prof = emptyProfile('v-ee26', NOW - 5 * DAY);
prof = applyProductView(prof, meta, NOW - 2 * DAY).profile;
const viewedUrban = pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'étudiant' }, browsing: prof, now: NOW, seed: 0 });
check('un étudiant qui a regardé URBANSOLE : toujours la grande affiche (c\'est l\'offre qui lui est proposée)', viewedUrban?.reason.kind === 'studentOffer');
const viewedOther = applyProductView(emptyProfile('v2', NOW - 5 * DAY), { id: 'w1', name: 'Article w1', slug: 'slug-w1', categoryId: 'c-watch', categorySlug: 'montres', categoryName: 'Montres' }, NOW - DAY).profile;
check('l\'affiche passe AVANT les rappels d\'articles regardés pour un étudiant (« à tous les élèves et étudiants »)', pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'étudiant' }, browsing: viewedOther, now: NOW, seed: 0 })?.reason.kind === 'studentOffer');
const bought = { ...prof, products: { ...prof.products, u1: { ...prof.products.u1, orderedAt: NOW - DAY, cartStatus: 'purchased' as const } } };
check('un étudiant qui a DÉJÀ commandé URBANSOLE : plus d\'affiche pour cet article', pickTargetedAd({ products: pool, categories: cats, customer: { profession: 'étudiant' }, browsing: bought, now: NOW, seed: 0 })?.reason.kind !== 'studentOffer');
const prev = previewAudiences({ products: pool, categories: cats, now: NOW, seed: 0 });
check('aperçu admin : les publics élèves et étudiants montrent la grande affiche, les autres publics non', prev.eleve?.reason.kind === 'studentOffer' && prev.etudiant?.reason.kind === 'studentOffer' && prev.femme?.reason.kind !== 'studentOffer' && prev.homme?.reason.kind !== 'studentOffer' && prev.admin?.reason.kind !== 'studentOffer' && prev.forces?.reason.kind !== 'studentOffer');
if (stu) {
  check('l\'accroche : « Offre uniquement pour les élèves et étudiants : 12 500 FCFA »', adHeadline(stu.reason, 'fr') === 'Offre uniquement pour les élèves et étudiants : 12 500 FCFA', adHeadline(stu.reason, 'fr'));
  check('« Pourquoi cette annonce ? » : « étudiant » écrit dans le compte, offre réservée (code EE26), prix normal 15 000 FCFA', adWhy(stu.reason, 'fr') === 'Pourquoi cette annonce ? Vous avez indiqué « étudiant » dans votre compte : cette offre (code EE26) est réservée aux élèves et étudiants. Le prix normal est 15 000 FCFA.', adWhy(stu.reason, 'fr'));
  check('en arabe : l\'accroche et la raison disent le prix, le code et la réserve', /12 500/.test(adHeadline(stu.reason, 'ar')) && /EE26/.test(adWhy(stu.reason, 'ar')) && /15 000/.test(adWhy(stu.reason, 'ar')) && /طالب/.test(adWhy(stu.reason, 'ar')));
}

console.log(`\n${ok} contrôles réussis`);
