// Zara Marketing Intelligence, côté application (src/lib/marketingAI.ts) : le tableau des 3 contrôles doit dire EXACTEMENT la même chose que le verrou
// de la fonction (liveGate dans marketing.ts) ; sinon l'écran pourrait montrer « débloqué » alors que le serveur refuse (ou l'inverse).
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing-ui-lib.test.ts
import { clampInt, gateOk, gateView, pct, since } from '../../src/lib/marketingAI.ts';
import { liveGate } from '../../supabase/functions/brevo-email/marketing.ts';

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
const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

// toutes les combinaisons utiles d'âges et d'états : l'écran et le serveur doivent toujours être d'accord
let agree = 0;
let total = 0;
let disagreement: unknown = null;
for (const brevoOk of [true, false, null]) for (const brevoAge of [null, 1, 23, 25]) for (const simAge of [null, 1, 47, 49]) for (const blocking of [null, 0, 2]) for (const testAge of [null, 1, 29 * 24, 31 * 24]) for (const messageId of [null, '<x@y>']) {
  const row = {
    brevo_ok: brevoOk,
    brevo_checked_at: brevoAge === null ? null : iso(NOW - brevoAge * H),
    last_simulation_at: simAge === null ? null : iso(NOW - simAge * H),
    last_simulation_blocking: blocking,
    test_email_at: testAge === null ? null : iso(NOW - testAge * H),
    test_email_message_id: messageId,
  };
  const screen = gateOk(gateView(row, NOW));
  const server = liveGate(
    { brevoOk, brevoCheckedAt: brevoAge === null ? null : NOW - brevoAge * H, simulationAt: simAge === null ? null : NOW - simAge * H, simulationBlocking: blocking, testEmailAt: testAge === null ? null : NOW - testAge * H, testEmailMessageId: messageId },
    NOW
  ).ok;
  total++;
  if (screen === server) agree++;
  else disagreement ??= { row, screen, server };
}
check(`l’écran et le verrou du serveur sont d’accord dans les ${total} combinaisons d’états et d’âges`, agree === total, disagreement);

const fresh = { brevo_ok: true, brevo_checked_at: iso(NOW - H), last_simulation_at: iso(NOW - H), last_simulation_blocking: 0, test_email_at: iso(NOW - H), test_email_message_id: '<a@b>' };
check('tout est à jour : 3 contrôles cochés', gateView(fresh, NOW).every((g) => g.ok && !g.stale));
const old = gateView({ ...fresh, brevo_checked_at: iso(NOW - 30 * H) }, NOW);
check('un contrôle Brevo de 30 h : décoché et marqué « à refaire » (stale)', !old[0].ok && old[0].stale && old[1].ok);
check('simulation avec 2 blocages : décochée, pas « à refaire »', !gateView({ ...fresh, last_simulation_blocking: 2 }, NOW)[1].ok && !gateView({ ...fresh, last_simulation_blocking: 2 }, NOW)[1].stale);
check('e-mail de test sans identifiant Brevo : décoché', !gateView({ ...fresh, test_email_message_id: null }, NOW)[2].ok);

check('pourcentages : « — » sans mesure, jamais 0 % trompeur', pct(0, 0) === '—' && pct(4, 4) === '100 %' && pct(1, 4) === '25 %' && pct(1, 3) === '33 %');
check('durées lisibles', since(null, NOW) === 'jamais' && since(NOW - 30_000, NOW) === 'à l’instant' && since(NOW - 10 * 60_000, NOW) === 'il y a 10 min' && since(NOW - 5 * H, NOW) === 'il y a 5 h' && since(NOW - 72 * H, NOW) === 'il y a 3 jours');
check('nombres saisis ramenés dans les limites (500 -> 200, 30 -> 23, abc -> défaut)', clampInt('500', 1, 200, 50) === 200 && clampInt('30', 0, 23, 9) === 23 && clampInt('abc', 1, 60, 7) === 7 && clampInt('0', 1, 60, 7) === 1 && clampInt('7,6', 1, 60, 7) === 8);

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
