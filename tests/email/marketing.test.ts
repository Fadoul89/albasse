// Zara Marketing Intelligence : le moteur (supabase/functions/brevo-email/marketing.ts), sans réseau ni base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing.test.ts
import {
  DEFAULT_SETTINGS,
  baseExclusion,
  campaignTag,
  clampSettings,
  frequencyExclusion,
  hasConsent,
  langOf,
  liveGate,
  planDay,
  pickVariant,
  prepareSend,
  renderEmail,
  verifyCatalog,
  verifyProduct,
  type CatalogProduct,
  type Client,
  type ClientOrder,
  type EmailInput,
  type GateState,
  type SentRecord,
  type Snapshot,
  type VerifiedProduct,
} from '../../supabase/functions/brevo-email/marketing.ts';
import { editDistance } from '../../src/lib/spellSuggest.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400));
    process.exitCode = 1;
  }
};
void editDistance;

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0); // 25 octobre 2026, 13 h à N'Djamena
const ago = (days: number) => NOW - days * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

// ---------- articles ----------
const prod = (id: string, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id,
  name: `Article ${id}`,
  slug: `article-${id}`,
  price: 20000,
  compare_at_price: null,
  images: [`https://img.example.com/${id}.jpg`],
  is_flash_sale: false,
  flash_sale_ends_at: null,
  created_at: iso(ago(60)),
  category_id: 'cat-montres',
  stock: 10,
  is_active: true,
  ...over,
});

// ---------- 1. vérification d'un article ----------
{
  const v = verifyProduct(prod('a'), NOW);
  check('article normal : valide, sans remise ni urgence', v.ok && v.product!.discountPct === 0 && v.product!.compareAt === null && v.product!.flashEndsAt === null && v.product!.lowStock === null, v);
  const bad = (over: Partial<CatalogProduct>, reason: string) => {
    const r = verifyProduct(prod('b', over), NOW);
    check(`article écarté (${reason})`, !r.ok && r.reasons.includes(reason), r);
  };
  bad({ is_active: false }, 'inactif');
  bad({ stock: 0 }, 'stock');
  bad({ stock: null }, 'stock');
  bad({ price: 0 }, 'prix');
  bad({ price: 'abc' }, 'prix');
  bad({ name: '   ' }, 'nom');
  bad({ slug: '' }, 'lien');
  bad({ slug: 'avec espace' }, 'lien');
  bad({ slug: 'a/b' }, 'lien');
  bad({ images: [] }, 'photo');
  bad({ images: ['http://pas-https.example.com/a.jpg'] }, 'photo');
  check('prix donné en texte (« 15000 ») accepté comme nombre', verifyProduct(prod('c', { price: '15000' }), NOW).product?.price === 15000);

  const promo = verifyProduct(prod('d', { price: 17500, compare_at_price: 25000 }), NOW).product!;
  check('vraie remise 30 % : annoncée avec l’ancien prix', promo.discountPct === 30 && promo.compareAt === 25000, promo);
  const typo = verifyProduct(prod('e', { price: 17500, compare_at_price: 175000 }), NOW);
  check('ancien prix 10 fois trop haut (−90 %) : remise NON annoncée, signalée « remise_suspecte »', typo.ok && typo.product!.discountPct === 0 && typo.product!.compareAt === null && typo.warnings.includes('remise_suspecte'), typo);
  check('remise de 61 % : suspecte ; de 60 % : annoncée', verifyProduct(prod('f', { price: 3900, compare_at_price: 10000 }), NOW).warnings.includes('remise_suspecte') && verifyProduct(prod('f', { price: 4000, compare_at_price: 10000 }), NOW).product!.discountPct === 60);
  check('remise de 3 % : pas une promotion (rien d’annoncé, pas d’alerte)', verifyProduct(prod('g', { price: 19400, compare_at_price: 20000 }), NOW).product!.discountPct === 0);
  const same = verifyProduct(prod('h', { price: 20000, compare_at_price: 20000 }), NOW);
  check('ancien prix égal ou inférieur au prix : ignoré', same.product!.compareAt === null && same.warnings.includes('ancien_prix_inutile'));

  const flash = verifyProduct(prod('i', { is_flash_sale: true, flash_sale_ends_at: iso(NOW + 3600_000) }), NOW).product!;
  check('vente flash en cours : fin gardée', flash.flashEndsAt === iso(NOW + 3600_000));
  const old = verifyProduct(prod('j', { is_flash_sale: true, flash_sale_ends_at: iso(NOW - 3600_000) }), NOW);
  check('vente flash terminée mais case restée cochée : AUCUNE urgence, signalée « flash_expiree »', old.product!.flashEndsAt === null && old.warnings.includes('flash_expiree'), old);
  const noEnd = verifyProduct(prod('k', { is_flash_sale: true, flash_sale_ends_at: null }), NOW);
  check('vente flash sans date de fin : aucune urgence', noEnd.product!.flashEndsAt === null);
  check('stock de 3 : « plus que 3 » ; stock de 4 : rien', verifyProduct(prod('l', { stock: 3 }), NOW).product!.lowStock === 3 && verifyProduct(prod('l', { stock: 4 }), NOW).product!.lowStock === null);

  const cat = verifyCatalog([prod('a'), prod('b', { stock: 0 }), prod('c', { is_active: false }), prod('e', { price: 17500, compare_at_price: 175000, name: 'RUSH' })], NOW);
  check('catalogue : 4 articles, 2 valides ; raisons et alertes comptées', cat.report.total === 4 && cat.report.verified === 2 && cat.report.rejected.stock === 1 && cat.report.rejected.inactif === 1 && cat.report.warnings.remise_suspecte === 1 && cat.report.flagged[0].name === 'RUSH', cat.report);
}

// ---------- 2. clients : exclusion, accord, fréquence, langue ----------
const client = (id: string, over: Partial<Client> = {}): Client => ({
  id,
  email: `${id}@gmail.com`,
  fullName: `Client ${id}`,
  createdAt: ago(100),
  lastActiveAt: ago(10),
  notifyPromotions: true,
  notifyNewProducts: false,
  notifyFlash: false,
  banned: false,
  isAdmin: false,
  unsubscribedAt: null,
  suppressedAt: null,
  token: `00000000-0000-4000-8000-0000000000${id.length < 2 ? '0' + id : id.slice(-2)}`,
  lang: null,
  ...over,
});
{
  check('client normal : rien ne s’oppose', baseExclusion(client('1')) === null);
  check('fausse adresse (compte par téléphone) : exclu', baseExclusion(client('1', { email: '23566123456@tel.albasseshopping.com' })) === 'sans_adresse_reelle');
  check('sans adresse, ou adresse invalide : exclu', baseExclusion(client('1', { email: null })) === 'sans_adresse_reelle' && baseExclusion(client('1', { email: 'pas-une-adresse' })) === 'sans_adresse_reelle');
  check('compte bloqué : exclu', baseExclusion(client('1', { banned: true })) === 'compte_bloque');
  check('administrateur : exclu', baseExclusion(client('1', { isAdmin: true })) === 'administrateur');
  check('DÉSINSCRIT : exclu tout de suite', baseExclusion(client('1', { unsubscribedAt: NOW - 1000 })) === 'desinscrit');
  check('adresse EN SUPPRESSION (rebond dur, plainte) : exclue tout de suite', baseExclusion(client('1', { suppressedAt: NOW - 1000 })) === 'adresse_en_suppression');
  check('accords : promotions / nouveaux articles / ventes flash, chacun séparé', hasConsent(client('1'), 'promotions') && !hasConsent(client('1'), 'new_products') && !hasConsent(client('1'), 'flash_sale') && hasConsent(client('1', { notifyFlash: true }), 'flash_sale') && hasConsent(client('1', { notifyNewProducts: true }), 'new_products'));
  check('langue : arabe si le nom est en arabe, sinon français, sinon celle du profil e-mail', langOf(client('1', { fullName: 'محمد علي' })) === 'ar' && langOf(client('1')) === 'fr' && langOf(client('1', { lang: 'ar' })) === 'ar' && langOf(client('1', { fullName: 'محمد', lang: 'fr' })) === 'fr');

  const S = DEFAULT_SETTINGS;
  const sent = (daysAgo: number, over: Partial<SentRecord> = {}): SentRecord => ({ userId: '1', kind: 'marketing', status: 'sent', createdAt: ago(daysAgo), ...over });
  const none: ClientOrder[] = [];
  check('aucun envoi avant : permis', frequencyExclusion([], none, NOW, S, 'inactive') === null);
  check('dernier e-mail il y a 3 jours (minimum 7) : refusé', frequencyExclusion([sent(3)], none, NOW, S, 'inactive') === 'frequence_minimale');
  check('dernier e-mail il y a 8 jours : permis', frequencyExclusion([sent(8)], none, NOW, S, 'inactive') === null);
  check('une vente flash peut suivre après 3 jours (minimum 2), pas après 1 jour', frequencyExclusion([sent(3)], none, NOW, S, 'flash') === null && frequencyExclusion([sent(1)], none, NOW, S, 'flash') === 'frequence_minimale');
  check('la publicité automatique « absents » compte comme un e-mail publicitaire', frequencyExclusion([sent(3, { kind: 'promo_inactive' })], none, NOW, S, 'inactive') === 'frequence_minimale');
  check('en attente ou en cours comptent ; échoué ou ignoré ne comptent pas', frequencyExclusion([sent(1, { status: 'pending' })], none, NOW, S, 'inactive') === 'frequence_minimale' && frequencyExclusion([sent(1, { status: 'failed' }), sent(1, { status: 'skipped' })], none, NOW, S, 'inactive') === null);
  check('les e-mails de commande et de bienvenue ne comptent pas', frequencyExclusion([sent(1, { kind: 'order_received' }), sent(1, { kind: 'welcome' })], none, NOW, S, 'inactive') === null);
  const three = [sent(9), sent(18), sent(27)];
  check('3 e-mails en 30 jours (plafond 3) : refusé ; plafond relevé à 4 : permis', frequencyExclusion(three, none, NOW, S, 'inactive') === 'plafond_30_jours' && frequencyExclusion(three, none, NOW, { ...S, maxPer30Days: 4 }, 'inactive') === null);
  const o = (daysAgo: number, over: Partial<ClientOrder> = {}): ClientOrder => ({ userId: '1', status: 'pending', createdAt: ago(daysAgo), isFake: false, loyaltyDiscount: 0, productIds: [], ...over });
  check('commande d’il y a 1 jour : pas de publicité', frequencyExclusion([], [o(1)], NOW, S, 'inactive') === 'commande_recente');
  check('commande annulée ou fausse, ou de plus de 3 jours : sans effet', frequencyExclusion([], [o(1, { status: 'cancelled' }), o(1, { isFake: true }), o(5)], NOW, S, 'inactive') === null);
}

// ---------- 3. réglages ----------
{
  check('réglages hors limites ramenés dans les limites', JSON.stringify(clampSettings({ runHour: 99, dailyLimit: 5000, minDaysBetween: 0, maxPer30Days: -3 })) === JSON.stringify({ runHour: 23, dailyLimit: 200, minDaysBetween: 1, maxPer30Days: 1 }));
  check('réglages absents ou illisibles : valeurs par défaut', JSON.stringify(clampSettings({})) === JSON.stringify(DEFAULT_SETTINGS) && clampSettings({ dailyLimit: 'abc' }).dailyLimit === 50);
  check('réglages valides gardés', clampSettings({ runHour: 8, dailyLimit: 30, minDaysBetween: 10, maxPer30Days: 2 }).dailyLimit === 30);
}

// ---------- 4. variante ----------
{
  check('variante : toujours la même pour le même client et le même jour', pickVariant('u1', '2026-10-25') === pickVariant('u1', '2026-10-25'));
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pickVariant(`u${i}`, '2026-10-25')));
  check('variantes A, B et C toutes utilisées sur 60 clients', seen.size === 3);
  check('jamais deux fois de suite le même objet au même client', (['A', 'B', 'C'] as const).every((last) => pickVariant('u1', '2026-10-25', last) !== last));
}

// ---------- 5. rédaction ----------
const vp = (id: string, over: Partial<VerifiedProduct> = {}): VerifiedProduct => ({
  id,
  name: `Article ${id}`,
  slug: `article-${id}`,
  image: `https://img.example.com/${id}.jpg`,
  price: 20000,
  compareAt: null,
  discountPct: 0,
  flashEndsAt: null,
  lowStock: null,
  categoryId: 'cat-montres',
  createdAt: ago(60),
  stock: 10,
  ...over,
});
// les montants s'écrivent avec des espaces insécables : on les remplace par des espaces simples pour comparer
const plainSpaces = (e: { subject: string; html: string }) => ({ subject: e.subject.replace(/[\u00a0\u202f]/g, ' '), html: e.html.replace(/[\u00a0\u202f]/g, ' ') });
const email = (over: Partial<EmailInput> = {}) =>
  plainSpaces(renderEmail({ segment: 'inactive', variant: 'A', lang: 'fr', fullName: 'Ali Mahamat', products: [vp('1'), vp('2')], runDate: '2026-10-25', unsubscribeUrl: 'https://www.albasseshopping.com/desinscription?t=abc', ...over }));
{
  const a = email();
  check('e-mail : prénom dans l’objet et le texte, jamais le nom complet', /Ali/.test(a.subject) && /Bonjour Ali,/.test(a.html) && !/Mahamat/.test(a.html), a.subject);
  check('e-mail : lien de désinscription présent et fonctionnel (adresse du site avec le code)', /Me désinscrire des e-mails publicitaires/.test(a.html) && a.html.includes('href="https://www.albasseshopping.com/desinscription?t=abc"'));
  check('e-mail : mention de l’accord (« vous avez accepté de recevoir nos promotions »)', /vous avez accepté de recevoir nos promotions/.test(a.html));
  check('e-mail : liens des articles avec suivi (utm_source=zara, utm_medium=email, campagne datée par segment)', a.html.includes(`utm_campaign=${campaignTag('2026-10-25', 'inactive')}`) && a.html.includes('utm_medium=email') && a.html.includes('utm_source=zara') && a.html.includes('/produit/article-1?'), a.html.slice(0, 300));
  check('e-mail : campagne = zmi-AAAAMMJJ-segment', campaignTag('2026-10-25', 'flash') === 'zmi-20261025-flash');
  const subjects = (['A', 'B', 'C'] as const).map((v) => email({ variant: v }).subject);
  check('3 variantes : 3 objets différents', new Set(subjects).size === 3, subjects);
  const intros = (['A', 'B', 'C'] as const).map((v) => email({ variant: v }).html.match(/<p style="font-size:15px;line-height:22px;margin:0 0 12px">([^<]*)<\/p>/g)?.[1]);
  check('3 variantes : 3 textes différents', new Set(intros).size === 3, intros);
  const nameless = (['A', 'B', 'C'] as const).map((v) => email({ variant: v, fullName: null }).subject);
  check('sans prénom : objets propres (pas de « , »  ni d’accolades)', nameless.every((s) => !/[{}]/.test(s) && !/^,|,\s*$|\s{2,}/.test(s) && s.length > 5), nameless);
  check('sans prénom : « Bonjour, » seul', /Bonjour,/.test(email({ fullName: null }).html));

  // règles de rédaction : objets courts (60 caractères au plus, même avec un long prénom), aperçu caché de 140 caractères au plus, qui ne répète pas l'objet
  const SEGS = ['flash', 'wishlist', 'loyalty', 'winback', 'new_arrivals', 'inactive', 'nurture'] as const;
  const every = SEGS.flatMap((segment) => (['fr', 'ar'] as const).flatMap((lang) => (['A', 'B', 'C'] as const).map((variant) => ({ segment, lang, variant, e: email({ segment, lang, variant, fullName: lang === 'ar' ? 'عبد الكريم محمد' : 'Abdelkerim Mahamat', loyaltyDelivered: 4, products: segment === 'flash' ? [vp('1', { flashEndsAt: iso(Date.UTC(2026, 9, 26, 12)) })] : segment === 'wishlist' ? [vp('1', { lowStock: 2 })] : [vp('1'), vp('2')] }) }))));
  check('42 objets (7 segments × 2 langues × 3 variantes) : tous de 60 caractères au plus', every.length === 42 && every.every((m) => m.e.subject.length <= 60), every.filter((m) => m.e.subject.length > 60).map((m) => m.e.subject));
  const pre = (html: string) => html.match(/<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">([^<]*)<\/div>/)?.[1] ?? '';
  check('chaque e-mail a un aperçu caché (40 à 140 caractères) différent de l’objet', every.every((m) => pre(m.e.html).length >= 40 && pre(m.e.html).length <= 140 && pre(m.e.html) !== m.e.subject), every.filter((m) => pre(m.e.html).length < 40 || pre(m.e.html).length > 140).map((m) => [m.segment, m.lang, pre(m.e.html)]));
  check('aucun objet sans texte, sans accolade ni espace double', every.every((m) => m.e.subject.length > 5 && !/[{}]/.test(m.e.subject) && !/\s{2,}/.test(m.e.subject)));

  // aucun faux prix, aucune fausse réduction, aucune fausse urgence
  const plain = email({ products: [vp('1'), vp('2')] });
  check('sans vraie remise : ni prix barré, ni « −X % », ni « vente flash », ni « plus que »', !/line-through/.test(plain.html) && !/−\d+ %/.test(plain.html) && !/Vente flash/.test(plain.html) && !/Plus que/.test(plain.html));
  const real = email({ products: [vp('1', { price: 17500, compareAt: 25000, discountPct: 30 }), vp('2')] });
  check('vraie remise : ancien prix barré et −30 % exacts', /line-through[^>]*>25 000 FCFA/.test(real.html) && /−30 %/.test(real.html) && /17 500 FCFA/.test(real.html));
  const low = email({ products: [vp('1', { lowStock: 2 }), vp('2')] });
  check('stock de 2 : « Plus que 2 en stock » (vrai) seulement sur cet article', (low.html.match(/Plus que 2 en stock/g) ?? []).length === 1);
  const flash = email({ segment: 'flash', products: [vp('1', { flashEndsAt: iso(Date.UTC(2026, 9, 26, 12)), price: 17500, compareAt: 25000, discountPct: 30 }), vp('2', { flashEndsAt: iso(Date.UTC(2026, 9, 27, 12)) })] });
  check('vente flash : la date de fin la plus proche (26 octobre), le badge, la mention des ventes flash', /26 octobre/.test(flash.subject + flash.html) && /🔥 Vente flash/.test(flash.html) && /alertes de ventes flash/.test(flash.html), flash.subject);
  check('nouveautés : mention de l’accord « nouveaux articles »', /alertes de nouveaux articles/.test(email({ segment: 'new_arrivals' }).html));

  // fidélité
  const rem = email({ segment: 'loyalty', loyaltyDelivered: 4 });
  check('fidélité 4 livrées : « Plus que 2 commandes livrées avant votre −10 % »', /Plus que 2 commandes livrées avant votre −10 %/.test(rem.subject) && /Après 6 commandes livrées/.test(rem.html), rem.subject);
  check('fidélité 5 livrées : « 1 commande livrée » au singulier', /1 commande livrée/.test(email({ segment: 'loyalty', loyaltyDelivered: 5 }).subject));
  const reward = email({ segment: 'loyalty', loyaltyDelivered: 6, variant: 'A' });
  check('fidélité 6 livrées : la remise est disponible', /remise fidélité −10 %/.test(reward.subject) && /une seule fois/.test(reward.html), reward.subject);

  // favoris : le texte dit seulement ce qui est vrai
  const wFlash = email({ segment: 'wishlist', products: [vp('1', { flashEndsAt: iso(NOW + DAY) }), vp('2')] });
  const wPromo = email({ segment: 'wishlist', products: [vp('1', { price: 17500, compareAt: 25000, discountPct: 30 }), vp('2')] });
  const wLow = email({ segment: 'wishlist', products: [vp('1', { lowStock: 2 })] });
  check('favori en vente flash / en promotion / presque épuisé : un objet différent et vrai pour chacun', /vente flash/i.test(wFlash.subject) && /promotion/.test(wPromo.subject) && /Plus que 2 en stock/.test(wLow.subject), [wFlash.subject, wPromo.subject, wLow.subject]);

  // arabe : de droite à gauche
  const ar = email({ lang: 'ar', fullName: 'محمد علي', segment: 'inactive' });
  check('arabe : page de droite à gauche (lang="ar" dir="rtl"), objet et texte en arabe, désinscription en arabe', /<html lang="ar" dir="rtl">/.test(ar.html) && /[؀-ۿ]/.test(ar.subject) && /إلغاء الاشتراك/.test(ar.html) && /وافقت على استقبال عروضنا/.test(ar.html) && /text-align:right/.test(ar.html), ar.subject);
  check('arabe : prénom (محمد) seulement, sans le nom de famille', /محمد/.test(ar.html) && !/علي/.test(ar.html.replace(/علي</g, '')));
  const arNo = email({ lang: 'ar', fullName: null, variant: 'B' });
  check('arabe sans prénom : objet propre, sans « يا » orphelin', !/[{}]/.test(arNo.subject) && !/يا\s*[!.؟]/.test(arNo.subject), arNo.subject);
  check('français : page de gauche à droite (lang="fr", pas de dir)', /<html lang="fr">/.test(a.html) && !/dir="rtl"/.test(a.html));

  // sécurité de l'affichage
  const evil = email({ products: [vp('1', { name: '<script>alert(1)</script> & "Montre"' }), vp('2')], fullName: '<img src=x onerror=alert(1)> Ali' });
  check('noms d’articles et de clients : jamais de HTML exécutable', !/<script>/.test(evil.html) && !/<img src=x/.test(evil.html) && /&lt;script&gt;/.test(evil.html));
}

// ---------- 6. le plan du jour ----------
const order = (userId: string, daysAgo: number, over: Partial<ClientOrder> = {}): ClientOrder => ({ userId, status: 'delivered', createdAt: ago(daysAgo), isFake: false, loyaltyDiscount: 0, productIds: [], ...over });

function world() {
  const products: CatalogProduct[] = [
    // montres : 4, dont une vraie remise et une presque épuisée
    prod('m1', { category_id: 'cat-montres', price: 17500, compare_at_price: 25000, created_at: iso(ago(40)) }),
    prod('m2', { category_id: 'cat-montres', created_at: iso(ago(30)) }),
    prod('m3', { category_id: 'cat-montres', stock: 2, created_at: iso(ago(50)) }),
    prod('m4', { category_id: 'cat-montres', created_at: iso(ago(80)) }),
    // chaussures : 4 dont une vente flash et une remise suspecte
    prod('c1', { category_id: 'cat-chaussures', is_flash_sale: true, flash_sale_ends_at: iso(NOW + 20 * 3600_000), price: 15000, compare_at_price: 20000, created_at: iso(ago(35)) }),
    prod('c2', { category_id: 'cat-chaussures', created_at: iso(ago(45)) }),
    prod('c3', { category_id: 'cat-chaussures', price: 17500, compare_at_price: 175000, created_at: iso(ago(55)) }), // −90 % : suspecte
    prod('c4', { category_id: 'cat-chaussures', created_at: iso(ago(65)) }),
    // parfums : 3 nouveautés (moins de 14 jours)
    prod('p1', { category_id: 'cat-parfums', created_at: iso(ago(2)) }),
    prod('p2', { category_id: 'cat-parfums', created_at: iso(ago(4)) }),
    prod('p3', { category_id: 'cat-parfums', created_at: iso(ago(6)) }),
    // à écarter
    prod('x1', { stock: 0 }),
    prod('x2', { is_active: false }),
    prod('x3', { images: [] }),
    prod('x4', { is_flash_sale: true, flash_sale_ends_at: iso(NOW - DAY) }), // flash terminée
  ];
  const clients: Client[] = [
    client('inactive', { lastActiveAt: ago(10) }),
    client('unsub', { lastActiveAt: ago(10), unsubscribedAt: ago(1) }),
    client('suppressed', { lastActiveAt: ago(10), suppressedAt: ago(1) }),
    client('fake', { lastActiveAt: ago(10), email: '23566000000@tel.albasseshopping.com' }),
    client('admin', { lastActiveAt: ago(10), isAdmin: true }),
    client('banned', { lastActiveAt: ago(10), banned: true }),
    client('noconsent', { lastActiveAt: ago(10), notifyPromotions: false }),
    client('toosoon', { lastActiveAt: ago(10) }),
    client('flashfan', { lastActiveAt: ago(1), notifyFlash: true }),
    client('wisher', { lastActiveAt: ago(1) }),
    client('loyal', { lastActiveAt: ago(1) }),
    client('lapsed', { lastActiveAt: ago(1) }),
    client('newbie', { createdAt: ago(5), lastActiveAt: ago(1) }),
    client('newsfan', { lastActiveAt: ago(1), notifyPromotions: false, notifyNewProducts: true }),
    client('ordered', { lastActiveAt: ago(10) }),
    client('arabe', { lastActiveAt: ago(9), fullName: 'محمد علي' }),
  ];
  const orders: ClientOrder[] = [
    order('loyal', 50, { productIds: ['m2'] }),
    order('loyal', 40, { productIds: ['m4'] }),
    order('loyal', 30), order('loyal', 20), // 4 commandes livrées
    order('lapsed', 40, { productIds: ['m2'] }), // livrée il y a 40 jours, rien depuis
    order('ordered', 1, { status: 'pending' }),
  ];
  const favorites = [
    { userId: 'wisher', productId: 'm1' }, // en vraie promotion
    { userId: 'wisher', productId: 'm3' }, // presque épuisé
    { userId: 'wisher', productId: 'm2' }, // aucun motif : pas de rappel pour lui
    { userId: 'newbie', productId: 'm4' },
    { userId: 'inactive', productId: 'c2' },
  ];
  const sent: SentRecord[] = [
    { userId: 'toosoon', kind: 'marketing', status: 'sent', createdAt: ago(2), segment: 'inactive', variant: 'A', productIds: ['m1', 'm2'] },
    { userId: 'inactive', kind: 'marketing', status: 'sent', createdAt: ago(20), segment: 'inactive', variant: 'B', productIds: ['m2', 'c2'] },
  ];
  return { products, clients, orders, favorites, sent };
}
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ now: NOW, ...world(), ...over });

{
  const plan = planDay(snap(), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  const byUser = new Map(plan.recipients.map((r) => [r.userId, r]));
  const seg = (u: string) => byUser.get(u)?.segment ?? null;

  check('catalogue : 15 articles lus, 12 vérifiés (dont celui à vente flash terminée, sans urgence), raisons d’écart comptées', plan.catalog.total === 15 && plan.catalog.verified === 12 && plan.catalog.rejected.stock === 1 && plan.catalog.rejected.inactif === 1 && plan.catalog.rejected.photo === 1, plan.catalog);
  check('exclus : désinscrit, en suppression, fausse adresse, administrateur, bloqué (jamais retenus)', ['unsub', 'suppressed', 'fake', 'admin', 'banned'].every((u) => !byUser.has(u)) && plan.clients.excluded.desinscrit === 1 && plan.clients.excluded.adresse_en_suppression === 1 && plan.clients.excluded.sans_adresse_reelle === 1 && plan.clients.excluded.administrateur === 1 && plan.clients.excluded.compte_bloque === 1, plan.clients.excluded);
  check('sans accord marketing : exclu (« autorisation_manquante »)', !byUser.has('noconsent') && plan.clients.excluded.autorisation_manquante === 1, plan.clients.excluded);
  check('déjà sollicité il y a 2 jours : exclu (« frequence_minimale »)', !byUser.has('toosoon') && plan.clients.excluded.frequence_minimale === 1, plan.clients.excluded);
  check('commande d’hier : exclu (« commande_recente »)', !byUser.has('ordered') && plan.clients.excluded.commande_recente === 1, plan.clients.excluded);
  check('absent depuis 10 jours : segment « inactive »', seg('inactive') === 'inactive');
  check('vente flash en cours + accord : segment « flash », seulement des articles en vente flash', seg('flashfan') === 'flash' && byUser.get('flashfan')!.productIds.join() === 'c1', byUser.get('flashfan'));
  check('favori en promotion ou presque épuisé : segment « wishlist », le favori en premier', seg('wisher') === 'wishlist' && byUser.get('wisher')!.productIds[0] === 'm1', byUser.get('wisher'));
  check('4 commandes livrées, remise pas utilisée : segment « loyalty »', seg('loyal') === 'loyalty');
  check('livrée il y a 40 jours, rien depuis : segment « winback »', seg('lapsed') === 'winback');
  check('compte de 5 jours sans commande : segment « nurture »', seg('newbie') === 'nurture');
  check('accord « nouveaux articles » seulement : segment « new_arrivals » (3 nouveautés), articles de moins de 14 jours', seg('newsfan') === 'new_arrivals' && byUser.get('newsfan')!.productIds.every((id) => ['p1', 'p2', 'p3'].includes(id)), byUser.get('newsfan'));
  check('nom arabe : e-mail en arabe', byUser.get('arabe')?.lang === 'ar' && /[؀-ۿ]/.test(byUser.get('arabe')!.subject), byUser.get('arabe'));

  // articles : toujours vérifiés, jamais déjà achetés ni remontrés
  const okIds = new Set(['m1', 'm2', 'm3', 'm4', 'c1', 'c2', 'c3', 'c4', 'p1', 'p2', 'p3', 'x4']);
  check('tous les articles proposés sont vérifiés (jamais épuisé, inactif, sans photo ni flash terminée)', plan.recipients.every((r) => r.productIds.every((id) => okIds.has(id))), plan.recipients.map((r) => r.productIds));
  check('au plus 4 articles, au plus 2 par catégorie', plan.recipients.every((r) => r.productIds.length <= 4 && Object.values(r.productIds.reduce<Record<string, number>>((m, id) => ({ ...m, [id[0]]: (m[id[0]] ?? 0) + 1 }), {})).every((n) => n <= 2)));
  check('« loyal » : jamais un article déjà acheté (m2, m4)', !byUser.get('loyal')!.productIds.some((id) => ['m2', 'm4'].includes(id)), byUser.get('loyal'));
  check('« lapsed » : jamais l’article déjà acheté (m2)', !byUser.get('lapsed')!.productIds.includes('m2'), byUser.get('lapsed'));
  check('« inactive » : pas les articles de ses derniers e-mails (m2 et c2 déjà montrés)', !byUser.get('inactive')!.productIds.some((id) => ['m2', 'c2'].includes(id)), byUser.get('inactive'));
  check('l’article à remise suspecte (−90 %) n’est jamais annoncé comme promotion', plan.previews.every((p) => !/175[\s\u00a0\u202f]000/.test(p.html)));
  check('variante : jamais la même que celle du dernier envoi (« inactive » avait B)', byUser.get('inactive')!.variant !== 'B');

  // confidentialité : aucun e-mail complet, aucun nom d'un client dans le plan ni dans les aperçus
  const text = JSON.stringify(plan);
  check('plan : adresses masquées seulement (jamais « inactive@gmail.com » en entier)', !/@gmail\.com/.test(text.replace(/[a-z]{2}\*\*\*@gmail\.com/g, '')) && plan.recipients.every((r) => /^.{2}\*\*\*@gmail\.com$/.test(r.emailMasked)), plan.recipients[0]);
  check('aperçus : prénom d’exemple (Prénom / الاسم), jamais celui d’un vrai client', plan.previews.every((p) => /Prénom|الاسم/.test(p.html) && !/Client (inactive|wisher|loyal)/.test(p.html) && !/محمد علي/.test(p.html)));
  check('aperçus : un par segment et par langue, avec désinscription et suivi', plan.previews.length >= 7 && plan.previews.every((p) => /desinscription\?t=exemple/.test(p.html) && /utm_campaign=zmi-20261025-/.test(p.html)), plan.previews.map((p) => p.segment + p.lang));

  // résumé par segment
  check('segments : chaque segment compte ses clients retenus', plan.segments.find((s) => s.key === 'inactive')!.planned >= 1 && plan.segments.reduce((n, s) => n + s.planned, 0) === plan.recipients.length);
  check('alertes : remise suspecte et vente flash expirée signalées, aucun blocage', plan.issues.some((i) => i.code === 'remises_suspectes') && plan.issues.some((i) => i.code === 'flash_expiree') && !plan.issues.some((i) => i.level === 'blocking'), plan.issues);

  // limite du jour
  const limited = planDay(snap(), { ...DEFAULT_SETTINGS, dailyLimit: 3 }, { alreadyQueuedToday: 0 });
  check('limite du jour de 3 : 3 retenus, les autres reportés', limited.recipients.length === 3 && limited.deferred === plan.recipients.length - 3 && limited.issues.some((i) => i.code === 'limite_du_jour'), [limited.recipients.length, limited.deferred]);
  check('limite : on garde d’abord la priorité des segments (flash et favoris avant les absents)', limited.recipients.some((r) => r.segment === 'flash') && limited.recipients.some((r) => r.segment === 'wishlist') && !limited.recipients.some((r) => r.segment === 'inactive'), limited.recipients.map((r) => r.segment));
  const used = planDay(snap(), { ...DEFAULT_SETTINGS, dailyLimit: 5 }, { alreadyQueuedToday: 5 });
  check('limite déjà atteinte aujourd’hui : plus aucun retenu', used.recipients.length === 0 && used.deferred === plan.recipients.length);

  // même données, même plan
  const again = planDay(snap(), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('plan reproductible : mêmes données = mêmes destinataires, mêmes objets', JSON.stringify(again.recipients) === JSON.stringify(plan.recipients));
}
// catalogue insuffisant
{
  const plan = planDay(snap({ products: [prod('a')] }), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('un seul article vérifié : BLOCAGE signalé, personne n’est retenu', plan.issues.some((i) => i.level === 'blocking' && i.code === 'catalogue_insuffisant') && plan.recipients.length === 0);
}
// presque tout en promotion
{
  const products = Array.from({ length: 12 }, (_, i) => prod(`z${i}`, { price: 8000, compare_at_price: 10000, category_id: `c${i % 4}` }));
  const plan = planDay(snap({ products }), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('catalogue presque entièrement « en promotion » : alerte honnête', plan.issues.some((i) => i.code === 'presque_tout_en_promotion'));
}
// pas de fidélité si la remise a déjà servi
{
  const w = world();
  w.orders.push(order('loyal', 10, { loyaltyDiscount: 1500 }));
  const plan = planDay({ now: NOW, ...w }, DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('remise fidélité déjà utilisée : le client n’est plus dans « fidélité »', plan.recipients.find((r) => r.userId === 'loyal')?.segment !== 'loyalty');
}

// ---------- 7. au moment de l'envoi ----------
{
  const base = { client: client('s1'), segment: 'inactive' as const, variant: 'A' as const, productIds: ['a', 'b'], products: [prod('a'), prod('b')], runDate: '2026-10-25', now: NOW, unsubscribeUrl: 'https://www.albasseshopping.com/desinscription?t=zzz', loyaltyDelivered: 0, loyaltyUsed: false };
  const good = prepareSend(base);
  check('envoi normal : objet, texte et articles gardés', good.ok && good.kept.join() === 'a,b' && good.lang === 'fr', good);
  const r = (over: object) => prepareSend({ ...base, ...over } as any);
  check('désinscrit entre-temps : refusé', (r({ client: client('s1', { unsubscribedAt: NOW - 1 }) }) as any).reason === 'desinscrit');
  check('adresse mise en suppression entre-temps : refusé', (r({ client: client('s1', { suppressedAt: NOW - 1 }) }) as any).reason === 'adresse_en_suppression');
  check('accord retiré entre-temps : refusé', (r({ client: client('s1', { notifyPromotions: false }) }) as any).reason === 'autorisation_retiree');
  check('compte bloqué entre-temps : refusé', (r({ client: client('s1', { banned: true }) }) as any).reason === 'compte_bloque');
  check('articles épuisés entre-temps : refusé', (r({ products: [prod('a', { stock: 0 }), prod('b', { is_active: false })] }) as any).reason === 'articles_plus_valides');
  const oneLeft = r({ products: [prod('a'), prod('b', { stock: 0 })] });
  check('un seul article encore valable sur 2 (minimum 2) : refusé', !oneLeft.ok && (oneLeft as any).reason === 'articles_plus_valides');
  const priced = plainSpaces(r({ products: [prod('a', { price: 12345 }), prod('b')] }) as any);
  check('prix changé entre-temps : l’e-mail montre le prix du moment (12 345 FCFA)', /12 345 FCFA/.test(priced.html) && !/20 000 FCFA.*12 345/.test(priced.html));
  const gone = plainSpaces(r({ products: [prod('a', { price: 17500, compare_at_price: 25000 }), prod('b')] }) as any);
  const noMore = plainSpaces(r({ products: [prod('a', { price: 17500, compare_at_price: null }), prod('b')] }) as any);
  check('remise : annoncée si elle existe encore, plus annoncée si elle a disparu', /line-through/.test(gone.html) && !/line-through/.test(noMore.html));
  const flashOver = r({ segment: 'flash', productIds: ['a'], products: [prod('a', { is_flash_sale: true, flash_sale_ends_at: iso(NOW - 1000) })] });
  check('vente flash terminée entre-temps : refusé (jamais d’urgence fausse)', !flashOver.ok);
  const flashOn = r({ segment: 'flash', client: client('s1', { notifyFlash: true }), productIds: ['a'], products: [prod('a', { is_flash_sale: true, flash_sale_ends_at: iso(NOW + 3600_000) })] });
  check('vente flash encore en cours : envoyé', flashOn.ok);
  // favoris
  const wish = { segment: 'wishlist' as const, productIds: ['a', 'b'] };
  check('favori toujours en promotion : envoyé', r({ ...wish, products: [prod('a', { price: 17500, compare_at_price: 25000 }), prod('b')] }).ok);
  const lost = r({ ...wish, products: [prod('a'), prod('b')] });
  check('favori qui n’est plus ni en promotion, ni en flash, ni presque épuisé : refusé (« favori_plus_concerne »)', !lost.ok && (lost as any).reason === 'favori_plus_concerne', lost);
  const favGone = r({ ...wish, products: [prod('a', { stock: 0 }), prod('b', { price: 17500, compare_at_price: 25000 })] });
  check('favori épuisé : le rappel n’est pas envoyé avec l’article suivant à sa place', !favGone.ok);
  // fidélité
  check('fidélité : remise utilisée entre-temps, ou moins de 4 livrées : refusé', !r({ segment: 'loyalty', loyaltyUsed: true, loyaltyDelivered: 5 }).ok && !r({ segment: 'loyalty', loyaltyDelivered: 3 }).ok && r({ segment: 'loyalty', loyaltyDelivered: 5 }).ok);
}

// ---------- 8. le verrou ----------
{
  const good: GateState = { brevoOk: true, brevoCheckedAt: NOW - 3600_000, simulationAt: NOW - 3600_000, simulationBlocking: 0, testEmailAt: NOW - 3600_000, testEmailMessageId: '<abc@smtp-relay.mailin.fr>' };
  check('verrou : tout est fait récemment -> ouvert', liveGate(good, NOW).ok && liveGate(good, NOW).missing.length === 0);
  const lock = (over: Partial<GateState>) => liveGate({ ...good, ...over }, NOW);
  check('verrou : sans contrôle Brevo réussi -> fermé', lock({ brevoOk: null }).missing.join() === 'controle_brevo' && lock({ brevoOk: false }).missing.includes('controle_brevo') && lock({ brevoCheckedAt: null }).missing.includes('controle_brevo'));
  check('verrou : contrôle Brevo de plus de 24 h -> fermé', lock({ brevoCheckedAt: NOW - 25 * 3600_000 }).missing.includes('controle_brevo'));
  check('verrou : aucune simulation, simulation trop vieille (48 h) ou avec un blocage -> fermé', lock({ simulationAt: null }).missing.includes('simulation') && lock({ simulationAt: NOW - 49 * 3600_000 }).missing.includes('simulation') && lock({ simulationBlocking: 1 }).missing.includes('simulation') && lock({ simulationBlocking: null }).missing.includes('simulation'));
  check('verrou : e-mail de test sans identifiant Brevo (pas de confirmation) ou trop vieux -> fermé', lock({ testEmailMessageId: null }).missing.includes('email_de_test_confirme') && lock({ testEmailMessageId: '' }).missing.includes('email_de_test_confirme') && lock({ testEmailAt: NOW - 31 * DAY }).missing.includes('email_de_test_confirme') && lock({ testEmailAt: null }).missing.includes('email_de_test_confirme'));
  check('verrou : tout manque -> les 3 contrôles sont listés', liveGate({ brevoOk: null, brevoCheckedAt: null, simulationAt: null, simulationBlocking: null, testEmailAt: null, testEmailMessageId: null }, NOW).missing.length === 3);
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
