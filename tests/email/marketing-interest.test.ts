// Zara Marketing Intelligence : les segments par centre d'intérêt (amateurs de parfums, acheteurs de vêtements, autres catégories) et les conseils de style
// (supabase/functions/brevo-email/marketing.ts), sans réseau ni base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing-interest.test.ts
import {
  DEFAULT_SETTINGS,
  NO_LEARNING,
  SEGMENT_CONSENT,
  SEGMENT_LABELS,
  SEGMENT_PRIORITY,
  TIPS,
  familyOf,
  planDay,
  prepareSend,
  renderEmail,
  segmentOfTopic,
  tipFor,
  topicNoun,
  topicOfCategory,
  verifyProduct,
  type CatalogCategory,
  type CatalogProduct,
  type Client,
  type ClientOrder,
  type Favorite,
  type Learning,
  type SentRecord,
  type Snapshot,
  type VerifiedProduct,
} from '../../supabase/functions/brevo-email/marketing.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 500));
    process.exitCode = 1;
  }
};

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0); // 25 octobre 2026, 13 h à N'Djamena
const ago = (days: number) => NOW - days * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

const prod = (id: string, cat: string, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id,
  name: `Article ${id}`,
  slug: `article-${id}`,
  price: 20000,
  compare_at_price: null,
  images: [`https://img.example.com/${id}.jpg`],
  is_flash_sale: false,
  flash_sale_ends_at: null,
  created_at: iso(ago(60)),
  category_id: cat,
  stock: 10,
  is_active: true,
  ...over,
});
const client = (id: string, over: Partial<Client> = {}): Client => ({
  id,
  email: `${id}@gmail.com`,
  fullName: `Client ${id}`,
  createdAt: ago(100),
  lastActiveAt: ago(1),
  notifyPromotions: true,
  notifyNewProducts: false,
  notifyFlash: false,
  banned: false,
  isAdmin: false,
  unsubscribedAt: null,
  suppressedAt: null,
  token: '00000000-0000-4000-8000-000000000001',
  lang: null,
  ...over,
});
const order = (userId: string, daysAgo: number, productIds: string[], over: Partial<ClientOrder> = {}): ClientOrder => ({ userId, status: 'delivered', createdAt: ago(daysAgo), isFake: false, loyaltyDiscount: 0, productIds, ...over });
const fav = (userId: string, productId: string): Favorite => ({ userId, productId });

// ---------- 1. les rubriques ----------
{
  const fam = (n: string) => familyOf(n);
  check('rubriques : Parfum, Vêtements, Vêtements pour femmes, Chaussures, Montre, Sacs et Bagages, Lunettes', fam('Parfum') === 'parfums' && fam('Parfums & Fragrances') === 'parfums' && fam('Vêtements') === 'vetements' && fam('Vêtements pour femmes') === 'vetements' && fam('Chaussures') === 'chaussures' && fam('Montre') === 'montres' && fam('Sacs et Bagages') === 'sacs' && fam('Lunettes') === 'lunettes');
  check('rubriques : « Maison & Mobilier » et « Électrique » n’ont pas de famille connue (rubrique = leur nom)', fam('Maison & Mobilier') === null && fam('Électrique') === null && topicOfCategory('Maison  &  Mobilier') === 'cat:Maison & Mobilier');
  check('rubriques : « Vêtements » et « Vêtements pour femmes » = la même rubrique ; des catégories sans famille restent séparées', topicOfCategory('Vêtements') === topicOfCategory('Vêtements pour femmes') && topicOfCategory('Maison & Mobilier') !== topicOfCategory('Électrique'));
  check('segment d’une rubrique : parfums -> amateurs de parfums, vêtements -> acheteurs de vêtements, le reste -> catégorie', segmentOfTopic('parfums') === 'perfume_lovers' && segmentOfTopic('vetements') === 'clothing_buyers' && segmentOfTopic('chaussures') === 'category_interest' && segmentOfTopic('cat:Maison & Mobilier') === 'category_interest');
  check('les trois segments d’intérêt existent, ont un nom, une priorité, et demandent l’accord « promotions »', ['perfume_lovers', 'clothing_buyers', 'category_interest'].every((s) => SEGMENT_PRIORITY.includes(s as any) && !!SEGMENT_LABELS[s as keyof typeof SEGMENT_LABELS] && SEGMENT_CONSENT[s as keyof typeof SEGMENT_CONSENT] === 'promotions'));
  check('ils passent après les clients à reconquérir et avant les nouveautés', SEGMENT_PRIORITY.indexOf('winback') < SEGMENT_PRIORITY.indexOf('perfume_lovers') && SEGMENT_PRIORITY.indexOf('category_interest') < SEGMENT_PRIORITY.indexOf('new_arrivals'));
  check('la rubrique en mots : parfums / العطور, et le nom exact d’une catégorie sans famille', topicNoun('parfums', 'fr') === 'parfums' && topicNoun('parfums', 'ar') === 'العطور' && topicNoun('cat:Maison & Mobilier', 'fr') === '« Maison & Mobilier »' && topicNoun('vetements', 'fr') === 'vêtements');
}

// ---------- 2. le plan avec des centres d'intérêt ----------
const categories: CatalogCategory[] = [
  { id: 'cat-parfums', name: 'Parfum' },
  { id: 'cat-vet', name: 'Vêtements' },
  { id: 'cat-vetf', name: 'Vêtements pour femmes' },
  { id: 'cat-chaus', name: 'Chaussures' },
  { id: 'cat-maison', name: 'Maison & Mobilier' },
  { id: 'cat-elec', name: 'Électrique' },
];
function world(): Omit<Snapshot, 'now'> {
  const products: CatalogProduct[] = [
    prod('pf1', 'cat-parfums'), prod('pf2', 'cat-parfums'), prod('pf3', 'cat-parfums'), prod('pf4', 'cat-parfums'), prod('pf5', 'cat-parfums'),
    prod('v1', 'cat-vet'), prod('v2', 'cat-vet'), prod('vf1', 'cat-vetf'), prod('vf2', 'cat-vetf'), prod('vf3', 'cat-vetf'),
    prod('s1', 'cat-chaus'), prod('s2', 'cat-chaus'), prod('s3', 'cat-chaus'),
    prod('h1', 'cat-maison'), prod('h2', 'cat-maison'), prod('h3', 'cat-maison'),
    prod('e1', 'cat-elec'), prod('e2', 'cat-elec'),
  ];
  const clients: Client[] = [
    client('perfbuyer'), // a acheté un parfum
    client('perffan'), // deux parfums en favoris
    client('onefav'), // un seul favori : pas assez
    client('vetbuyer'), // a acheté un vêtement + un favori « pour femmes » (même rubrique)
    client('maisonfan'), // deux favoris « Maison & Mobilier »
    client('clicker'), // a cliqué un article chaussures dans un e-mail précédent
    client('mixed'), // un parfum acheté (3) contre deux favoris vêtements (2) : le parfum gagne
    client('tie'), // égalité parfums / vêtements : l’ordre alphabétique décide, toujours le même
    client('nofamily'), // deux favoris « Électrique »
    client('noconsent', { notifyPromotions: false }),
    client('arabe', { fullName: 'محمد علي' }),
    client('lapsed'), // dernière commande livrée il y a 40 jours : « à reconquérir » passe avant l’intérêt
    client('recent'), // a commandé il y a 1 jour : pas de publicité
    client('unsub', { unsubscribedAt: ago(1) }),
  ];
  const orders: ClientOrder[] = [
    order('perfbuyer', 10, ['pf1']),
    order('vetbuyer', 10, ['v1']),
    order('mixed', 10, ['pf1']),
    order('tie', 10, ['pf1']),
    order('lapsed', 40, ['pf1']),
    order('recent', 1, ['pf1'], { status: 'pending' }),
    order('arabe', 10, ['pf1']),
    order('noconsent', 10, ['pf1']),
    order('unsub', 10, ['pf1']),
  ];
  const favorites: Favorite[] = [
    fav('perffan', 'pf2'), fav('perffan', 'pf3'),
    fav('onefav', 'pf2'),
    fav('vetbuyer', 'vf1'),
    fav('maisonfan', 'h1'), fav('maisonfan', 'h2'),
    fav('mixed', 'v2'), fav('mixed', 'vf2'),
    fav('tie', 'v2'), fav('tie', 'vf2'), fav('tie', 'v1'),
    fav('nofamily', 'e1'), fav('nofamily', 'e2'),
  ];
  const sent: SentRecord[] = [{ userId: 'clicker', kind: 'marketing', status: 'sent', createdAt: ago(10), segment: 'inactive', variant: 'A', productIds: ['pf1', 'pf2'], clickedSlugs: ['article-s1'], measured: true, delivered: true, clicked: true }];
  return { products, categories, clients, orders, favorites, sent };
}
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ now: NOW, ...world(), ...over });

{
  const plan = planDay(snap(), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  const by = new Map(plan.recipients.map((r) => [r.userId, r]));
  const seg = (u: string) => by.get(u)?.segment ?? null;
  const topic = (u: string) => by.get(u)?.topic ?? null;

  check('acheteur d’un parfum -> « amateurs de parfums », rubrique « parfums »', seg('perfbuyer') === 'perfume_lovers' && topic('perfbuyer') === 'parfums', by.get('perfbuyer'));
  check('deux parfums en favoris -> « amateurs de parfums »', seg('perffan') === 'perfume_lovers');
  check('un seul favori : pas assez pour parler d’un centre d’intérêt (aucun segment)', !by.has('onefav'));
  check('acheteur d’un vêtement + favori « pour femmes » -> « acheteurs de vêtements » (une seule rubrique pour les deux catégories)', seg('vetbuyer') === 'clothing_buyers' && topic('vetbuyer') === 'vetements', by.get('vetbuyer'));
  check('deux favoris « Maison & Mobilier » -> « intéressés par une catégorie », rubrique au nom exact', seg('maisonfan') === 'category_interest' && topic('maisonfan') === 'cat:Maison & Mobilier', by.get('maisonfan'));
  check('catégorie sans famille (« Électrique ») : segment catégorie aussi', seg('nofamily') === 'category_interest' && topic('nofamily') === 'cat:Électrique');
  check('un clic sur un article chaussures dans un e-mail précédent -> « intéressés par une catégorie », rubrique « chaussures »', seg('clicker') === 'category_interest' && topic('clicker') === 'chaussures', by.get('clicker'));
  check('parfum acheté (3) contre deux favoris vêtements (2) : le plus fort gagne (parfums)', seg('mixed') === 'perfume_lovers');
  check('égalité entre deux rubriques : choix stable (toujours le même, ordre alphabétique)', topic('tie') === 'parfums' && planDay(snap(), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 }).recipients.find((r) => r.userId === 'tie')?.topic === 'parfums');
  check('sans accord « promotions » : pas de segment d’intérêt (autorisation_manquante)', !by.has('noconsent') && plan.clients.excluded.autorisation_manquante === 1, plan.clients.excluded);
  check('« à reconquérir » (dernière commande livrée il y a 40 jours) passe avant l’intérêt', seg('lapsed') === 'winback');
  check('commande d’il y a 1 jour : aucune publicité, même avec un centre d’intérêt', !by.has('recent') && plan.clients.excluded.commande_recente === 1);
  check('désinscrit : exclu avant tout', !by.has('unsub') && plan.clients.excluded.desinscrit === 1);
  check('client arabe : segment d’intérêt, langue arabe, objet en arabe avec « العطور »', seg('arabe') === 'perfume_lovers' && by.get('arabe')!.lang === 'ar' && /[؀-ۿ]/.test(by.get('arabe')!.subject) && /العطور/.test(by.get('arabe')!.subject), by.get('arabe'));

  // les articles : seulement la rubrique, jamais un article déjà acheté, jamais d'autre rubrique
  const ids = (u: string) => by.get(u)!.productIds;
  const familyOfId = (id: string) => (id.startsWith('pf') ? 'parfums' : id.startsWith('v') ? 'vetements' : id.startsWith('s') ? 'chaussures' : id.startsWith('h') ? 'maison' : 'elec');
  check('parfums : seulement des parfums, jamais celui déjà acheté (pf1), 4 articles au plus', ids('perfbuyer').every((i) => familyOfId(i) === 'parfums') && !ids('perfbuyer').includes('pf1') && ids('perfbuyer').length === 4, ids('perfbuyer'));
  check('vêtements : les deux catégories de vêtements mélangées, jamais l’article acheté (v1)', ids('vetbuyer').every((i) => familyOfId(i) === 'vetements') && !ids('vetbuyer').includes('v1') && ids('vetbuyer').some((i) => i.startsWith('vf')) && ids('vetbuyer').some((i) => i.startsWith('v') && !i.startsWith('vf')), ids('vetbuyer'));
  check('« Maison & Mobilier » : seulement des articles de cette catégorie', ids('maisonfan').every((i) => familyOfId(i) === 'maison') && ids('maisonfan').length === 3, ids('maisonfan'));
  check('chaussures (clic) : seulement des chaussures', ids('clicker').every((i) => familyOfId(i) === 'chaussures'), ids('clicker'));
  check('les articles déjà montrés dans les derniers e-mails ne reviennent pas (clicker avait reçu pf1 et pf2)', !ids('clicker').includes('pf1') && !ids('clicker').includes('pf2'));

  const sg = (k: string) => plan.segments.find((s) => s.key === k)!;
  check('récapitulatif : amateurs de parfums 4 (perfbuyer, perffan, mixed, tie + arabe), vêtements 1, catégorie 3', sg('perfume_lovers').planned === 5 && sg('clothing_buyers').planned === 1 && sg('category_interest').planned === 3, plan.segments.map((s) => [s.key, s.planned]));
  check('aperçus : un par segment et par langue, avec le conseil de style pour parfums / vêtements / chaussures, pas pour « Maison & Mobilier »', plan.previews.some((p) => p.segment === 'perfume_lovers' && p.lang === 'fr' && /💡 Conseil/.test(p.html)) && plan.previews.some((p) => p.segment === 'clothing_buyers' && /💡 Conseil/.test(p.html)) && plan.previews.some((p) => p.segment === 'perfume_lovers' && p.lang === 'ar' && /💡 نصيحة/.test(p.html)), plan.previews.map((p) => [p.segment, p.lang]));
  check('aucune donnée d’un vrai client dans les aperçus', plan.previews.every((p) => !/@gmail/.test(p.html) && /Prénom|الاسم/.test(p.html)));

  // sans catégories lues : les segments d'intérêt s'éteignent et le plan le dit
  const none = planDay(snap({ categories: [] }), DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('catégories illisibles : aucun segment d’intérêt, remarque « categories_absentes »', none.recipients.every((r) => !['perfume_lovers', 'clothing_buyers', 'category_interest'].includes(r.segment)) && none.issues.some((i) => i.code === 'categories_absentes'), none.recipients.map((r) => r.segment));
  check('catégories illisibles : ce n’est PAS un blocage (la simulation reste valable)', !none.issues.some((i) => i.level === 'blocking'));

  // les articles consultés (suivi automatique) ne servent JAMAIS : seulement achats, favoris, clics
  const withViews = { ...snap(), views: [{ userId: 'onefav', productId: 'pf1' }, { userId: 'onefav', productId: 'pf2' }, { userId: 'onefav', productId: 'pf3' }] } as unknown as Snapshot;
  const pv = planDay(withViews, DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('articles simplement regardés : ignorés (pas de segment pour onefav)', !pv.recipients.some((r) => r.userId === 'onefav'));
}

// ---------- 3. l'ordre de priorité ----------
{
  // vente flash : passe avant l'intérêt (échéance réelle) si le client a l'accord « ventes flash »
  const s = snap();
  s.products.push(prod('fl1', 'cat-chaus', { is_flash_sale: true, flash_sale_ends_at: iso(NOW + 10 * 3600_000), price: 15000, compare_at_price: 20000 }));
  s.clients.find((c) => c.id === 'perfbuyer')!.notifyFlash = true;
  const plan = planDay(s, DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('vente flash réellement en cours + accord « ventes flash » : la vente flash passe avant l’intérêt', plan.recipients.find((r) => r.userId === 'perfbuyer')!.segment === 'flash' && plan.recipients.find((r) => r.userId === 'perffan')!.segment === 'perfume_lovers');

  // favori en vraie promotion : le rappel passe avant l'intérêt
  const s2 = snap();
  s2.products.find((p) => p.id === 'pf2')!.price = 14000;
  s2.products.find((p) => p.id === 'pf2')!.compare_at_price = 20000; // −30 %
  const plan2 = planDay(s2, DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('favori en vraie promotion : « articles favoris » passe avant l’intérêt', plan2.recipients.find((r) => r.userId === 'perffan')!.segment === 'wishlist');

  // segment en pause (apprentissage) : le client passe au segment suivant, sinon il est écarté avec la raison
  const paused: Learning = { ...NO_LEARNING, pausedSegments: { perfume_lovers: '2 plainte(s) sur 40 e-mails livrés' } };
  const p3 = planDay(snap(), DEFAULT_SETTINGS, { alreadyQueuedToday: 0, learning: paused });
  check('segment « amateurs de parfums » en pause : plus aucun destinataire dans ce segment', p3.recipients.every((r) => r.segment !== 'perfume_lovers') && p3.segments.find((x) => x.key === 'perfume_lovers')!.paused === '2 plainte(s) sur 40 e-mails livrés');
  check('segment en pause : les clients concernés sont comptés « segment_en_pause », et la remarque est signalée (avertissement, pas blocage)', (p3.clients.excluded.segment_en_pause ?? 0) >= 3 && p3.issues.some((i) => i.code === 'segment_en_pause_perfume_lovers' && i.level === 'warning'), p3.clients.excluded);
}

// ---------- 4. les e-mails ----------
const vp = (id: string, cat: string, over: Partial<CatalogProduct> = {}): VerifiedProduct => verifyProduct(prod(id, cat, over), NOW).product!;
const base = { runDate: '2026-10-25', unsubscribeUrl: 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/brevo-email?u=jeton' };
{
  const products = [vp('pf2', 'cat-parfums'), vp('pf3', 'cat-parfums')];
  const seen = new Set<string>();
  for (const variant of ['A', 'B', 'C'] as const) {
    const e = renderEmail({ ...base, segment: 'perfume_lovers', variant, lang: 'fr', fullName: 'Awa Diallo', products, topic: 'parfums', tipSeed: 'u1' });
    seen.add(e.subject);
    check(`parfums, français, variante ${variant} : l’objet parle de parfums, ne dépasse pas 60 caractères, sans accolade ni « undefined »`, /parfums/i.test(e.subject) && e.subject.length <= 60 && !/[{}]|undefined|null/.test(e.subject + e.html), e.subject);
  }
  check('3 variantes = 3 objets différents', seen.size === 3);
  const e = renderEmail({ ...base, segment: 'perfume_lovers', variant: 'A', lang: 'fr', fullName: 'Awa Diallo', products, topic: 'parfums', tipSeed: 'u1' });
  check('e-mail parfums : prénom, deux articles, conseil de style, désinscription, accord « promotions », suivi UTM', /Bonjour Awa/.test(e.html) && /Article pf2/.test(e.html) && /Article pf3/.test(e.html) && /💡 Conseil/.test(e.html) && /Me désinscrire des e-mails publicitaires/.test(e.html) && /accepté de recevoir nos promotions/.test(e.html) && /utm_campaign=zmi-20261025-perfume_lovers/.test(e.html));
  const tip = TIPS.parfums.fr.find((t) => e.html.includes(t.replace(/’/g, '&#39;')) || e.html.includes(t));
  check('le conseil affiché est l’un des conseils parfums écrits d’avance (jamais inventé)', !!tip, e.html.slice(e.html.indexOf('Conseil') - 10, e.html.indexOf('Conseil') + 200));
  check('aucun prix, remise ni urgence inventés dans un e-mail d’intérêt sans promotion', !/−\d+ ?%|Vente flash|Plus que \d+ en stock/.test(e.html));

  const ar = renderEmail({ ...base, segment: 'perfume_lovers', variant: 'B', lang: 'ar', fullName: 'محمد', products, topic: 'parfums', tipSeed: 'u1' });
  check('arabe : de droite à gauche, « العطور » dans l’objet, conseil « 💡 نصيحة », désinscription en arabe', /dir="rtl"/.test(ar.html) && /العطور/.test(ar.subject) && /💡 نصيحة/.test(ar.html) && /إلغاء الاشتراك/.test(ar.html), ar.subject);

  // catégorie sans famille : le nom exact, aucun conseil inventé
  const home = renderEmail({ ...base, segment: 'category_interest', variant: 'A', lang: 'fr', fullName: 'Awa', products: [vp('h1', 'cat-maison'), vp('h2', 'cat-maison')], topic: 'cat:Maison & Mobilier', tipSeed: 'u1' });
  check('catégorie « Maison & Mobilier » : le nom exact dans l’objet (échappé dans le HTML), AUCUN conseil de style inventé', /« Maison & Mobilier »/.test(home.subject) && !/Conseil/.test(home.html) && /utm_campaign=zmi-20261025-category_interest/.test(home.html), home.subject);
  const weird = renderEmail({ ...base, segment: 'category_interest', variant: 'B', lang: 'fr', fullName: null, products, topic: 'cat:Promo $& <b>fous</b>', tipSeed: 'u1' });
  check('nom de catégorie piégé ($&, balises) : écrit tel quel dans l’objet, échappé dans le HTML', /Promo \$& <b>fous<\/b>/.test(weird.subject) && !/<b>fous<\/b>/.test(weird.html) && /&lt;b&gt;fous/.test(weird.html), [weird.subject]);
  const nameless = renderEmail({ ...base, segment: 'perfume_lovers', variant: 'A', lang: 'fr', fullName: null, products, topic: 'parfums', tipSeed: 'u1' });
  check('sans prénom : « Bonjour, » et un objet propre (pas de virgule seule)', /Bonjour,/.test(nameless.html) && !/^\s*,/.test(nameless.subject) && !/\{|\}/.test(nameless.subject), nameless.subject);

  // les conseils : stables pour un client et un jour, variés d'un jour à l'autre
  const t = (seed: string) => tipFor('perfume_lovers', 'parfums', 'fr', seed);
  check('conseil : le même client le même jour = toujours le même conseil', t('u1|2026-10-25') === t('u1|2026-10-25') && !!t('u1|2026-10-25'));
  check('conseil : varie d’un jour à l’autre (au moins 3 conseils différents en 14 jours)', new Set(Array.from({ length: 14 }, (_, i) => t(`u1|2026-10-${10 + i}`))).size >= 3);
  check('conseils : seulement pour les segments d’intérêt (rubrique connue) et les nouveaux comptes ; jamais pour vente flash, favoris, fidélité, nouveautés, absents, reconquête', ['flash', 'wishlist', 'loyalty', 'winback', 'new_arrivals', 'inactive'].every((s) => tipFor(s as any, 'parfums', 'fr', 'x') === null) && tipFor('nurture', null, 'fr', 'x') !== null && tipFor('category_interest', 'cat:Maison & Mobilier', 'fr', 'x') === null && tipFor('category_interest', 'chaussures', 'fr', 'x') !== null);
  const everyTip = Object.values(TIPS).flatMap((v) => [...v.fr, ...v.ar]);
  check('conseils : tous courts (180 caractères au plus), sans chiffre de prix, sans promesse (« garanti », « gratuit »), sans lien', everyTip.every((x) => x.length <= 180 && !/\d+ ?(FCFA|F\b|€|%)|garanti|gratuit|http|مضمون|مجاني/i.test(x)), everyTip.filter((x) => x.length > 180));
  check('conseils : une version arabe pour chaque version française', Object.values(TIPS).every((v) => v.fr.length === v.ar.length && v.ar.every((x) => /[؀-ۿ]/.test(x))));
}

// ---------- 5. au moment de l'envoi ----------
{
  const c = client('perfbuyer');
  const products = ['pf2', 'pf3'].map((id) => prod(id, 'cat-parfums'));
  const input = { client: c, segment: 'perfume_lovers' as const, variant: 'A' as const, productIds: ['pf2', 'pf3'], products, runDate: '2026-10-25', now: NOW, unsubscribeUrl: base.unsubscribeUrl, loyaltyDelivered: 0, loyaltyUsed: false, topic: 'parfums' };
  const r = prepareSend(input);
  check('envoi d’un e-mail d’intérêt : relu et accepté, la rubrique et le conseil sont gardés', r.ok && /parfums/i.test(r.subject) && /💡 Conseil/.test(r.html), r);
  check('envoi : accord « promotions » retiré entre-temps -> refusé', (prepareSend({ ...input, client: client('perfbuyer', { notifyPromotions: false }) }) as any).reason === 'autorisation_retiree');
  check('envoi : désinscrit entre-temps -> refusé', (prepareSend({ ...input, client: client('perfbuyer', { unsubscribedAt: NOW - 1000 }) }) as any).reason === 'desinscrit');
  check('envoi : un article épuisé et un seul restant (il en faut 2) -> refusé', (prepareSend({ ...input, products: [prod('pf2', 'cat-parfums', { stock: 0 }), prod('pf3', 'cat-parfums')] }) as any).reason === 'articles_plus_valides');
  const again = prepareSend(input);
  check('envoi : le même client le même jour reçoit le même texte (mêmes conseil et objet)', r.ok && again.ok && r.subject === again.subject && r.html === again.html);
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
