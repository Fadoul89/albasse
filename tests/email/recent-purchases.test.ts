// Texte de la barre « achats récents » (src/lib/recentPurchasesText.ts) : seulement la ville et l'article, jamais d'invention.
// Lancer : node --import ./tests/zara/register.mjs tests/email/recent-purchases.test.ts
import { agoLabel, purchaseText } from '../../src/lib/recentPurchasesText.ts';

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

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

check('moins de 2 minutes : « à l’instant »', agoLabel(ago(30_000), NOW) === "à l'instant");
check('35 minutes : « il y a 35 min »', agoLabel(ago(35 * 60_000), NOW) === 'il y a 35 min');
check('5 heures : « il y a 5 h »', agoLabel(ago(5 * 3600_000), NOW) === 'il y a 5 h');
check('1 jour et 3 jours : singulier et pluriel', agoLabel(ago(26 * 3600_000), NOW) === 'il y a 1 jour' && agoLabel(ago(3 * 86_400_000 + 1000), NOW) === 'il y a 3 jours');
check('date illisible : pas de texte', agoLabel('pas une date', NOW) === '');
check('ville + article + délai', purchaseText({ city: "N'Djamena", product: 'Capuche', created_at: ago(2 * 3600_000) }, NOW) === "🛍️ Un client de N'Djamena a commandé : Capuche · il y a 2 h");
check('sans ville : « Un client a commandé »', purchaseText({ city: null, product: 'Slip-on', created_at: ago(60_000 * 10) }, NOW) === '🛍️ Un client a commandé : Slip-on · il y a 10 min');
const long = purchaseText({ city: 'Moundou', product: 'A'.repeat(80), created_at: ago(0) }, NOW);
check('nom d’article trop long : coupé avec « … »', /A{39}… ·/.test(long) && long.length < 100, long);
console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
