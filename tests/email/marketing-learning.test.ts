// Zara Marketing Intelligence : l'apprentissage commercial (supabase/functions/brevo-email/marketingLearning.ts) et son effet sur le plan du jour.
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing-learning.test.ts
import {
  DEFAULT_SETTINGS,
  FIXED_FIRST,
  NO_LEARNING,
  SEGMENT_PRIORITY,
  pickVariant,
  planDay,
  type CatalogProduct,
  type Client,
  type Learning,
  type SegmentKey,
  type SentRecord,
  type Snapshot,
  type Variant,
} from '../../supabase/functions/brevo-email/marketing.ts';
import { HEALTH, MIN_SEGMENT_SAMPLE, MIN_VARIANT_SAMPLE, computeLearning, segmentValue } from '../../supabase/functions/brevo-email/marketingLearning.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600));
    process.exitCode = 1;
  }
};

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const ago = (days: number) => NOW - days * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

const client = (id: string, over: Partial<Client> = {}): Client => ({
  id,
  email: `${id}@gmail.com`,
  fullName: `Client ${id}`,
  createdAt: ago(100),
  lastActiveAt: ago(10),
  notifyPromotions: true,
  notifyNewProducts: true,
  notifyFlash: true,
  banned: false,
  isAdmin: false,
  unsubscribedAt: null,
  suppressedAt: null,
  token: '00000000-0000-4000-8000-000000000001',
  lang: null,
  ...over,
});
interface RecOver extends Partial<SentRecord> {
  daysAgo?: number;
}
// un e-mail de campagne envoyé ; par défaut : mesuré, livré, sans clic
let seq = 0;
const rec = (segment: SegmentKey, over: RecOver = {}): SentRecord => {
  const { daysAgo = 5, ...rest } = over;
  return { userId: `u${++seq}`, kind: 'marketing', status: 'sent', createdAt: ago(daysAgo), sentAt: ago(daysAgo), segment, variant: 'A', productIds: [], measured: true, delivered: true, clicked: false, hardBounced: false, complaint: false, ...rest };
};
const many = (n: number, segment: SegmentKey, over: RecOver | ((i: number) => RecOver) = {}) => Array.from({ length: n }, (_, i) => rec(segment, typeof over === 'function' ? over(i) : over));
const snapOf = (sent: SentRecord[], clients: Client[] = []): Snapshot => ({ now: NOW, products: [], clients, orders: [], favorites: [], sent });

// ---------- 1. rien à apprendre ----------
{
  const l = computeLearning(snapOf([]));
  check('aucun envoi : rien n’est conclu, ordre normal, aucune pause, message « pas encore assez de résultats »', l.segmentOrder === null && Object.keys(l.pausedSegments).length === 0 && l.globalAlert === null && Object.keys(l.bestVariant).length === 0 && /Pas encore assez/.test(l.notes.join(' ')), l);
  const unmeasured = computeLearning(snapOf(many(200, 'inactive', { measured: false, delivered: false })));
  check('200 e-mails dont Brevo n’a PAS encore donné les résultats : comptés comme envoyés, jamais comme « 0 clic » ni livrés (aucune conclusion)', unmeasured.stats.inactive?.sent === 200 && unmeasured.stats.inactive?.measured === 0 && unmeasured.stats.inactive?.delivered === 0 && unmeasured.segmentOrder === null && Object.keys(unmeasured.pausedSegments).length === 0, unmeasured.stats);
  const other = computeLearning(snapOf([rec('inactive', { kind: 'promo_inactive' }), rec('inactive', { status: 'failed' }), rec('inconnu' as SegmentKey), rec('inactive', { daysAgo: 45 })]));
  check('l’ancienne publicité « absents », les envois échoués, les segments inconnus et ceux de plus de 30 jours ne comptent pas dans la santé', (other.stats.inactive?.sent ?? 0) === 1 || other.stats.inactive === undefined, other.stats);
}

// ---------- 2. les statistiques par segment ----------
{
  const sent = [...many(20, 'inactive', (i) => ({ clicked: i < 5 })), ...many(10, 'inactive', { measured: false, delivered: false }), rec('inactive', { hardBounced: true, delivered: false })];
  const l = computeLearning(snapOf(sent));
  const s = l.stats.inactive!;
  check('statistiques : 31 envoyés, 21 mesurés, 20 livrés, 5 clics, 1 rebond définitif', s.sent === 31 && s.measured === 21 && s.delivered === 20 && s.clicked === 5 && s.hardBounced === 1, s);
  const withOrders = computeLearning(snapOf(sent), { inactive: { orders: 3, revenue: 60000 }, nurture: { orders: 1, revenue: 5000 }, pirate: { orders: 9, revenue: 1 } });
  check('commandes attribuées et revenu repris du rapport (segments inconnus ignorés)', withOrders.stats.inactive!.orders === 3 && withOrders.stats.inactive!.revenue === 60000 && withOrders.stats.nurture?.orders === 1 && !('pirate' in withOrders.stats));
  check('valeur d’un segment : clics + 10 × commandes − 10 × désinscriptions − 20 × plaintes, par e-mail livré', segmentValue({ sent: 100, measured: 100, delivered: 100, clicked: 10, unsubscribed: 1, complaints: 0, hardBounced: 0, orders: 2, revenue: 0 }) === (10 + 20 - 10) / 100 && segmentValue({ sent: 0, measured: 0, delivered: 0, clicked: 0, unsubscribed: 0, complaints: 0, hardBounced: 0, orders: 5, revenue: 0 }) === 0);
}

// ---------- 3. la santé : pause automatique ----------
{
  const complaints = (n: number, delivered: number) => [...many(n, 'nurture', { complaint: true }), ...many(delivered - n, 'nurture')];
  const one = computeLearning(snapOf(complaints(1, 40)));
  check('1 plainte sur 40 e-mails : pas de pause (il en faut au moins 2)', !one.pausedSegments.nurture && one.globalAlert === null);
  const two = computeLearning(snapOf(complaints(2, 40)));
  check('2 plaintes sur 40 e-mails (5 %) : le segment « nouveaux comptes » est mis en pause, avec la raison', /2 plainte\(s\) sur 40/.test(two.pausedSegments.nurture ?? '') && two.notes.some((n) => /mis en pause/.test(n)), two);
  check('2 plaintes sur 1 000 e-mails (0,2 %, sous 0,3 %) : pas de pause', !computeLearning(snapOf(complaints(2, 1000))).pausedSegments.nurture);
  check('la pause d’un segment ne touche pas les autres', !two.pausedSegments.inactive && !two.pausedSegments.flash);

  // désinscriptions : le client est désinscrit dans les 7 jours après l'e-mail
  const unsubWorld = (nUnsub: number, laterDays = 2) => {
    const sent = many(60, 'inactive');
    const clients = sent.slice(0, nUnsub).map((h) => client(h.userId, { unsubscribedAt: (h.sentAt ?? 0) + laterDays * DAY }));
    return computeLearning(snapOf(sent, clients));
  };
  check('1 désinscription sur 60 e-mails (1,7 %) : pas de pause', !unsubWorld(1).pausedSegments.inactive && unsubWorld(1).stats.inactive!.unsubscribed === 1);
  check('2 désinscriptions sur 60 e-mails (3,3 %) : segment « clients absents » en pause', /2 désinscription\(s\) sur 60/.test(unsubWorld(2).pausedSegments.inactive ?? ''), unsubWorld(2).pausedSegments);
  check('désinscription 10 jours après l’e-mail : pas rattachée à cette campagne', unsubWorld(5, 10).stats.inactive!.unsubscribed === 0 && !unsubWorld(5, 10).pausedSegments.inactive);
  const twice = [rec('inactive', { userId: 'dup', daysAgo: 6 }), rec('inactive', { userId: 'dup', daysAgo: 3 })];
  const lt = computeLearning(snapOf(twice, [client('dup', { unsubscribedAt: ago(2) })]));
  check('un client reçu deux fois puis désinscrit : une seule désinscription, rattachée au dernier e-mail', lt.stats.inactive!.unsubscribed === 1);
  const before = computeLearning(snapOf([rec('inactive', { userId: 'early', daysAgo: 3 })], [client('early', { unsubscribedAt: ago(5) })]));
  check('désinscrit AVANT l’e-mail (cas impossible en vrai) : non compté', before.stats.inactive!.unsubscribed === 0);
  const fewDelivered = computeLearning(snapOf(many(10, 'inactive'), many(10, 'inactive').map((h) => client(h.userId, { unsubscribedAt: ago(4) }))));
  check('moins de 50 e-mails livrés : le taux de désinscription ne décide pas encore (pas de pause)', !fewDelivered.pausedSegments.inactive);

  // rebonds
  const bounce = (n: number) => computeLearning(snapOf([...many(n, 'new_arrivals', { hardBounced: true, delivered: false }), ...many(60 - n, 'new_arrivals')]));
  check('2 rebonds définitifs sur 60 : pas de pause ; 4 sur 60 (6,7 %) : pause', !bounce(2).pausedSegments.new_arrivals && /4 rebond\(s\) définitif\(s\) sur 60/.test(bounce(4).pausedSegments.new_arrivals ?? ''), bounce(4).pausedSegments);

  // alerte générale : tous les envois suspendus
  const spread = [...many(4, 'inactive', { complaint: true }), ...many(40, 'inactive'), ...many(3, 'nurture', { complaint: true }), ...many(40, 'nurture')];
  const g = computeLearning(snapOf(spread));
  check('7 plaintes sur 87 e-mails livrés en 30 jours : alerte générale (tous les envois suspendus)', /7 plainte\(s\) sur 87/.test(g.globalAlert ?? '') && /suspendus/.test(g.globalAlert ?? ''), g.globalAlert);
  const gp = planDay({ ...snapOf([]), products: [{ id: 'a', name: 'A', slug: 'a', price: 1000, images: ['https://i.example.com/a.jpg'], stock: 5, is_active: true, created_at: iso(ago(5)) }, { id: 'b', name: 'B', slug: 'b', price: 1000, images: ['https://i.example.com/b.jpg'], stock: 5, is_active: true, created_at: iso(ago(5)) }], clients: [client('x')] }, DEFAULT_SETTINGS, { alreadyQueuedToday: 0, learning: g });
  check('alerte générale : aucun destinataire, motif « envois_suspendus_plaintes », remarque BLOQUANTE (la simulation ne peut plus valider le verrou)', gp.recipients.length === 0 && gp.clients.excluded.envois_suspendus_plaintes === 1 && gp.issues.some((i) => i.code === 'plaintes_elevees' && i.level === 'blocking'), gp.issues);
  const calm = computeLearning(snapOf([...many(2, 'inactive', { complaint: true }), ...many(98, 'inactive')]));
  check('2 plaintes sur 98 : pause du segment mais PAS d’alerte générale (il en faut 3)', !!calm.pausedSegments.inactive && calm.globalAlert === null);
  check('seuils de santé affichés = ceux du code', HEALTH.segmentComplaintsMin === 2 && HEALTH.globalComplaintsMin === 3 && HEALTH.complaintRateMax === 0.003);
}

// ---------- 4. la meilleure variante d'objet ----------
{
  const variants = (counts: Record<Variant, [number, number]>, seg: SegmentKey = 'inactive') => (['A', 'B', 'C'] as Variant[]).flatMap((v) => many(counts[v][0], seg, (i) => ({ variant: v, clicked: i < counts[v][1] })));
  const best = computeLearning(snapOf(variants({ A: [40, 4], B: [40, 12], C: [40, 6] })));
  check('variante B : 30 % de clics contre 15 % et 10 % -> retenue comme la meilleure', best.bestVariant.inactive === 'B' && best.notes.some((n) => /objet B donne le plus de clics \(30 % contre 15 %\)/.test(n)), best.notes);
  const few = computeLearning(snapOf(variants({ A: [MIN_VARIANT_SAMPLE - 1, 3], B: [40, 20], C: [40, 6] })));
  check(`une variante avec moins de ${MIN_VARIANT_SAMPLE} mesures : aucune conclusion`, !few.bestVariant.inactive);
  const close = computeLearning(snapOf(variants({ A: [100, 10], B: [100, 11], C: [100, 9] })));
  check('écart trop faible (10 % / 11 % / 9 %) : c’est du hasard, aucune conclusion', !close.bestVariant.inactive);
  const small = computeLearning(snapOf(variants({ A: [100, 1], B: [100, 2], C: [100, 0] })));
  check('1 % contre 2 % : écart de moins de 2 points, aucune conclusion', !small.bestVariant.inactive);
  const unmeas = computeLearning(snapOf((['A', 'B', 'C'] as Variant[]).flatMap((v) => many(60, 'inactive', { variant: v, measured: false, delivered: false, clicked: false }))));
  check('variantes non mesurées : aucune conclusion (jamais « 0 % de clics »)', !unmeas.bestVariant.inactive);
  const old = computeLearning(snapOf((['A', 'B', 'C'] as Variant[]).flatMap((v) => many(40, 'inactive', (i) => ({ variant: v, daysAgo: 70, clicked: v === 'B' && i < 20 })))));
  check('résultats vieux de plus de 60 jours : ignorés', !old.bestVariant.inactive);
  const perSeg = computeLearning(snapOf([...variants({ A: [40, 4], B: [40, 12], C: [40, 6] }, 'nurture'), ...variants({ A: [40, 12], B: [40, 4], C: [40, 6] }, 'inactive')]));
  check('chaque segment apprend sa propre meilleure variante', perSeg.bestVariant.nurture === 'B' && perSeg.bestVariant.inactive === 'A');

  // effet sur le choix : 7 clients sur 10 reçoivent la meilleure variante, jamais deux fois de suite la même
  const ids = Array.from({ length: 1000 }, (_, i) => `client-${i}`);
  const count = (best: Variant | null) => {
    const c: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (const id of ids) c[pickVariant(id, '2026-10-25', null, best)]++;
    return c;
  };
  const plain = count(null);
  const exploit = count('B');
  check('sans apprentissage : les 3 variantes à parts à peu près égales (entre 28 % et 39 % chacune)', Object.values(plain).every((n) => n > 280 && n < 390), plain);
  check('avec « B » meilleure : B reçue par 75 à 85 % des clients, les autres variantes continuent d’être essayées', exploit.B > 750 && exploit.B < 850 && exploit.A > 60 && exploit.C > 60, exploit);
  check('jamais deux fois de suite la même variante, même avec une meilleure variante', ids.every((id) => pickVariant(id, '2026-10-26', 'B', 'B') !== 'B' && pickVariant(id, '2026-10-26', 'A', null) !== 'A'));
  check('le choix est stable : même client, même jour, même résultat', ids.slice(0, 50).every((id) => pickVariant(id, '2026-10-25', 'C', 'B') === pickVariant(id, '2026-10-25', 'C', 'B')));
}

// ---------- 5. l'ordre des segments ----------
{
  // 3 segments mesurés (≥ 100 e-mails livrés chacun) : le meilleur passe devant
  const sample = (seg: SegmentKey, clicked: number, over: RecOver = {}) => many(MIN_SEGMENT_SAMPLE, seg, (i) => ({ clicked: i < clicked, ...over }));
  const l = computeLearning(snapOf([...sample('inactive', 5), ...sample('nurture', 30), ...sample('new_arrivals', 12)]));
  check('ordre appris : nouveaux comptes (30 %), puis nouveautés (12 %), puis absents (5 %)', JSON.stringify(l.segmentOrder?.filter((s) => ['inactive', 'nurture', 'new_arrivals'].includes(s))) === JSON.stringify(['nurture', 'new_arrivals', 'inactive']), l.segmentOrder);
  check('l’ordre appris commence toujours par vente flash, favoris, fidélité (échéances et récompenses promises)', JSON.stringify(l.segmentOrder?.slice(0, 3)) === JSON.stringify(FIXED_FIRST) && l.segmentOrder!.length === SEGMENT_PRIORITY.length && new Set(l.segmentOrder).size === SEGMENT_PRIORITY.length, l.segmentOrder);
  check('les segments sans assez de mesures gardent leur place (« à reconquérir » et les 3 centres d’intérêt restent où ils étaient)', ['winback', 'perfume_lovers', 'clothing_buyers', 'category_interest'].every((s) => l.segmentOrder!.indexOf(s as SegmentKey) === SEGMENT_PRIORITY.indexOf(s as SegmentKey)), l.segmentOrder);
  check('l’explication est donnée en français simple', l.notes.some((n) => /Nouvel ordre : Nouveaux comptes, puis Nouveautés, puis Clients absents/.test(n)), l.notes);

  // ordre normal : « absents » avant « nouveaux comptes »
  const orders = computeLearning(snapOf([...sample('inactive', 30), ...sample('nurture', 5)]), { inactive: { orders: 0, revenue: 0 }, nurture: { orders: 4, revenue: 90000 } });
  check('4 commandes attribuées (5 clics + 4 × 10 = 45) valent plus que 30 clics seuls : « nouveaux comptes » passe devant « absents »', orders.segmentOrder!.indexOf('nurture') < orders.segmentOrder!.indexOf('inactive'), orders.segmentOrder);
  const noOrders = computeLearning(snapOf([...sample('inactive', 30), ...sample('nurture', 5)]));
  check('sans commande attribuée, les 30 clics gagnent : ordre normal (rien à changer)', noOrders.segmentOrder === null);
  const unsubPenalty = computeLearning(snapOf([...sample('inactive', 20), ...sample('nurture', 30)]));
  check('sans désinscription : le segment qui a le plus de clics (nouveaux comptes) passe devant', unsubPenalty.segmentOrder!.indexOf('nurture') < unsubPenalty.segmentOrder!.indexOf('inactive'));
  const hist = [...sample('inactive', 30), ...sample('nurture', 20)];
  const penalised = computeLearning(snapOf(hist, hist.filter((h) => h.segment === 'inactive').slice(0, 5).map((h) => client(h.userId, { unsubscribedAt: (h.sentAt ?? 0) + DAY }))));
  check('5 désinscriptions sur « absents » (−50) font reculer ce segment derrière « nouveaux comptes »', penalised.segmentOrder!.indexOf('nurture') < penalised.segmentOrder!.indexOf('inactive'), penalised.stats);

  const one = computeLearning(snapOf(sample('inactive', 30)));
  check('un seul segment mesuré : rien à comparer, ordre normal', one.segmentOrder === null);
  const same = computeLearning(snapOf([...sample('new_arrivals', 30), ...sample('inactive', 5)]));
  check('l’ordre mesuré est déjà l’ordre normal : rien à changer (null)', same.segmentOrder === null);
  const fewer = computeLearning(snapOf([...sample('inactive', 5), ...many(MIN_SEGMENT_SAMPLE - 1, 'nurture', (i) => ({ clicked: i < 80 }))]));
  check(`moins de ${MIN_SEGMENT_SAMPLE} e-mails livrés : le segment n’est pas classé`, fewer.segmentOrder === null);
}

// ---------- 6. effet sur le plan du jour ----------
{
  const products: CatalogProduct[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: `Article ${id}`, slug: `article-${id}`, price: 20000, images: [`https://i.example.com/${id}.jpg`], stock: 10, is_active: true, created_at: iso(ago(5)), category_id: 'cat' }));
  const newbieAndAbsent = client('both', { createdAt: ago(5), lastActiveAt: ago(8), notifyNewProducts: true }); // absent depuis 8 jours ET compte de 5 jours
  const snap: Snapshot = { now: NOW, products, clients: [newbieAndAbsent], orders: [], favorites: [], sent: [] };
  const normal = planDay(snap, DEFAULT_SETTINGS, { alreadyQueuedToday: 0 });
  check('ordre normal : un client à la fois nouveau et absent reçoit d’abord les nouveautés (3 articles récents)', normal.recipients[0].segment === 'new_arrivals', normal.recipients);
  const learned: Learning = { ...NO_LEARNING, segmentOrder: ['flash', 'wishlist', 'loyalty', 'winback', 'perfume_lovers', 'clothing_buyers', 'category_interest', 'nurture', 'inactive', 'new_arrivals'], notes: ['Nouvel ordre : …'] };
  const l2 = planDay(snap, DEFAULT_SETTINGS, { alreadyQueuedToday: 0, learning: learned });
  check('ordre appris (nouveaux comptes avant nouveautés) : le même client reçoit maintenant la campagne « nouveaux comptes »', l2.recipients[0].segment === 'nurture', l2.recipients);
  check('le plan garde la trace de ce que Zara a appris (notes, ordre, pauses, meilleures variantes)', l2.learning.notes.join() === 'Nouvel ordre : …' && l2.learning.segmentOrder?.[7] === 'nurture' && 'pausedSegments' in l2.learning && 'bestVariant' in l2.learning && 'stats' in l2.learning);
  const bestB: Learning = { ...NO_LEARNING, bestVariant: { new_arrivals: 'B' } };
  const many100 = Array.from({ length: 100 }, (_, i) => client(`c${i}`, { createdAt: ago(100), lastActiveAt: ago(1), notifyNewProducts: true }));
  const big = planDay({ ...snap, clients: many100 }, { ...DEFAULT_SETTINGS, dailyLimit: 200 }, { alreadyQueuedToday: 0, learning: bestB });
  const nB = big.recipients.filter((r) => r.variant === 'B').length;
  check('meilleure variante B pour « nouveautés » : 65 à 85 clients sur 100 la reçoivent dans le plan', nB >= 65 && nB <= 85 && big.recipients.length === 100, nB);
  const bigPlain = planDay({ ...snap, clients: many100 }, { ...DEFAULT_SETTINGS, dailyLimit: 200 }, { alreadyQueuedToday: 0 });
  const nPlain = bigPlain.recipients.filter((r) => r.variant === 'B').length;
  check('sans apprentissage : la variante B n’est pas favorisée (20 à 45 clients sur 100)', nPlain >= 20 && nPlain <= 45, nPlain);

  // limite du jour : l'ordre appris décide qui est servi en premier
  const mixed = [client('n1', { createdAt: ago(5), lastActiveAt: ago(1), notifyNewProducts: true }), client('i1', { createdAt: ago(100), lastActiveAt: ago(9), notifyNewProducts: false })];
  const lim1 = planDay({ ...snap, clients: mixed }, { ...DEFAULT_SETTINGS, dailyLimit: 1 }, { alreadyQueuedToday: 0 });
  const prefer: Learning = { ...NO_LEARNING, segmentOrder: ['flash', 'wishlist', 'loyalty', 'winback', 'perfume_lovers', 'clothing_buyers', 'category_interest', 'inactive', 'nurture', 'new_arrivals'] };
  const lim2 = planDay({ ...snap, clients: mixed }, { ...DEFAULT_SETTINGS, dailyLimit: 1 }, { alreadyQueuedToday: 0, learning: prefer });
  check('limite du jour de 1 : sans apprentissage « nouveautés » est servi d’abord ; avec l’ordre appris, « absents » est servi d’abord', lim1.recipients[0].segment === 'new_arrivals' && lim2.recipients[0].segment === 'inactive', [lim1.recipients.map((r) => r.segment), lim2.recipients.map((r) => r.segment)]);
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
