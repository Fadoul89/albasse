// « Dernier e-mail Zara » (Admin › Clients) : quel e-mail compte, la ligne montrée, et jamais un faux « aucun e-mail ». Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/last-email.test.ts
import { agoLabel, lastEmailLine, lastZaraEmails, type LastEmail, type LastEmailInput, type SentEmailRow } from '../../src/lib/lastEmail.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

const NOW = new Date('2026-11-06T20:00:00Z').getTime();
const row = (user_id: string, sent_at: string, extra: Partial<SentEmailRow> = {}): SentEmailRow => ({ user_id, kind: 'promo_inactive', status: 'sent', sent_at, click_count: 0, bounce_type: null, complaint_at: null, ...extra });
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// ---- quels e-mails comptent
{
  const m = lastZaraEmails([
    row('a', '2026-10-20T08:00:00Z'),
    row('a', '2026-11-05T08:00:00Z'),
    row('a', '2026-10-28T08:00:00Z'),
    row('b', '2026-11-01T08:00:00Z', { kind: 'marketing' }),
  ]);
  check('le dernier e-mail envoyé est gardé (le plus récent, quel que soit l\'ordre reçu)', m.get('a')?.sentAt === '2026-11-05T08:00:00Z', m.get('a'));
  check('une campagne Zara Marketing compte aussi', m.get('b')?.kind === 'marketing');
}
{
  const m = lastZaraEmails([
    row('a', '2026-11-05T08:00:00Z', { kind: 'welcome' }),
    row('a', '2026-11-05T08:00:00Z', { kind: 'order_received' }),
    row('a', '2026-11-05T08:00:00Z', { kind: 'order_delivered' }),
    row('b', '2026-11-05T08:00:00Z', { status: 'pending' }),
    row('c', '2026-11-05T08:00:00Z', { status: 'cancelled' }),
    row('d', '2026-11-05T08:00:00Z', { status: 'skipped' }),
    row('e', '2026-11-05T08:00:00Z', { status: 'failed' }),
    row('f', null as unknown as string),
    row('g', 'pas une date'),
    { kind: 'promo_inactive', status: 'sent', sent_at: '2026-11-05T08:00:00Z', user_id: null },
    { kind: 'promo_inactive', status: 'sent', sent_at: '2026-11-05T08:00:00Z' },
  ]);
  check('bienvenue et commandes : ne comptent pas (pas de la publicité de Zara)', !m.has('a'));
  check('en attente, annulé, ignoré, échoué : jamais compté comme « envoyé »', !m.has('b') && !m.has('c') && !m.has('d') && !m.has('e'));
  check('sans date d\'envoi, date illisible ou sans client : ignoré', !m.has('f') && !m.has('g') && m.size === 0, [...m.keys()]);
}
{
  const m = lastZaraEmails([row('a', '2026-11-05T08:00:00Z', { click_count: 2 }), row('b', '2026-11-05T08:00:00Z', { click_count: '3' }), row('c', '2026-11-05T08:00:00Z', { click_count: -4 }), row('d', '2026-11-05T08:00:00Z', { click_count: null })]);
  check('clics : lus comme des nombres (texte accepté), jamais négatifs ni « NaN »', m.get('a')?.clicks === 2 && m.get('b')?.clicks === 3 && m.get('c')?.clicks === 0 && m.get('d')?.clicks === 0, [...m.values()]);
}
{
  const m = lastZaraEmails([row('a', '2026-11-05T08:00:00Z', { bounce_type: 'hard' }), row('b', '2026-11-05T08:00:00Z', { bounce_type: 'soft' }), row('c', '2026-11-05T08:00:00Z', { bounce_type: 'invalid' }), row('d', '2026-11-05T08:00:00Z', { complaint_at: '2026-11-05T09:00:00Z' })]);
  check('rebond définitif ou adresse invalide : signalé ; rebond temporaire : pas signalé ; plainte : signalée', m.get('a')?.hardBounce === true && m.get('b')?.hardBounce === false && m.get('c')?.hardBounce === true && m.get('d')?.complaint === true);
}
check('liste vide : aucun client', lastZaraEmails([]).size === 0);

// ---- depuis quand
check('il y a 1 j', agoLabel('2026-11-05T08:00:00Z', NOW) === 'il y a 1 j', agoLabel('2026-11-05T08:00:00Z', NOW));
check('il y a 14 j', agoLabel('2026-10-23T08:00:00Z', NOW) === 'il y a 14 j');
check('le jour même : « aujourd\'hui »', agoLabel('2026-11-06T08:00:00Z', NOW) === "aujourd'hui");
check('date illisible : rien (jamais « NaN »)', agoLabel('nope', NOW) === '');

// ---- la ligne de la fiche
const L = (extra: Partial<LastEmail> = {}): LastEmail => ({ sentAt: '2026-11-05T08:00:00Z', kind: 'promo_inactive', clicks: 0, hardBounce: false, complaint: false, ...extra });
const I = (extra: Partial<LastEmailInput> = {}): LastEmailInput => ({ email: 'zakaria@gmail.com', notifyPromotions: true, banned: false, daysAway: 8, last: null, ...extra });
const line = (i: LastEmailInput) => lastEmailLine(i, day, NOW);
{
  const l = line(I({ last: L() }));
  check('e-mail envoyé : date, « il y a 1 j » et le genre d\'e-mail', !!l && l.tone === 'sent' && l.text.startsWith('✉️ Dernier e-mail Zara : ') && l.text.includes(day('2026-11-05T08:00:00Z')) && l.text.includes('il y a 1 j') && l.text.includes('e-mail « absents »'), l);
  check('e-mail envoyé sans problème : aucun mot sur un clic, un rebond ou une plainte', !!l && !/clic|refusée|plainte|promotions refusées/.test(l.text));
}
check('une campagne : « campagne Zara Marketing »', line(I({ last: L({ kind: 'marketing' }) }))?.text.includes('campagne Zara Marketing') === true);
check('1 clic / 3 clics (pluriel)', line(I({ last: L({ clicks: 1 }) }))?.text.includes('· 1 clic') === true && !/1 clics/.test(line(I({ last: L({ clicks: 1 }) }))!.text) && line(I({ last: L({ clicks: 3 }) }))?.text.includes('3 clics') === true);
check('adresse refusée : ligne rouge', line(I({ last: L({ hardBounce: true }) }))?.tone === 'problem' && /adresse refusée/.test(line(I({ last: L({ hardBounce: true }) }))!.text));
check('plainte : ligne rouge', line(I({ last: L({ complaint: true }) }))?.tone === 'problem' && /plainte/.test(line(I({ last: L({ complaint: true }) }))!.text));
check('promotions refusées depuis : dit, ligne rouge, mais le dernier e-mail reste visible', line(I({ last: L(), notifyPromotions: false }))?.tone === 'problem' && /promotions refusées depuis/.test(line(I({ last: L(), notifyPromotions: false }))!.text) && /Dernier e-mail Zara/.test(line(I({ last: L(), notifyPromotions: false }))!.text));

// jamais envoyé : la raison, seulement quand on la connaît vraiment
check('lecture pas faite ou impossible (undefined) : aucune ligne, jamais un faux « aucun e-mail »', line(I({ last: undefined })) === null);
check('compte créé avec le téléphone seulement (pas d\'adresse) : « Pas d\'adresse e-mail », WhatsApp seulement', /Pas d'adresse e-mail.*WhatsApp seulement/.test(line(I({ email: null }))!.text) && line(I({ email: null }))!.tone === 'none');
check('compte bloqué : « compte bloqué »', /compte bloqué/.test(line(I({ banned: true }))!.text));
check('a refusé les promotions : « n\'a pas accepté les promotions »', /n'a pas accepté les promotions/.test(line(I({ notifyPromotions: false }))!.text));
check('connecté depuis moins de 7 jours : le dit', /connecté il y a moins de 7 jours/.test(line(I({ daysAway: 3 }))!.text) && /connecté il y a moins de 7 jours/.test(line(I({ daysAway: 6 }))!.text));
check('absent depuis 7 jours, accord donné, adresse réelle, rien envoyé : « Aucun e-mail Zara envoyé pour l\'instant » (sans inventer de raison)', /Aucun e-mail Zara envoyé pour l.instant/.test(line(I({ daysAway: 7 }))!.text) && line(I({ daysAway: 7 }))!.tone === 'none');
check('l\'adresse manquante passe avant les autres raisons (pas d\'adresse + promotions refusées)', /Pas d'adresse e-mail/.test(line(I({ email: null, notifyPromotions: false, daysAway: 1 }))!.text));
check('aucune ligne ne contient « undefined », « null » ou « NaN »', [line(I({ last: L() })), line(I({ email: null })), line(I()), line(I({ last: L({ clicks: 2 }), notifyPromotions: undefined }))].every((l) => !!l && !/undefined|null|NaN/.test(l.text)));
check('promotions « non renseignées » (undefined) : pas de faux « refusées »', !/refus/.test(line(I({ last: L(), notifyPromotions: undefined }))!.text));

console.log(`${ok} controles OK`);
if (!process.exitCode) console.log('TOUT EST BON');
