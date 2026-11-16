// Assistant marketing + psychologie de la vente : un levier n'est proposé que s'il est VRAI ; le texte de l'IA est contrôlé. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/marketing-levers.test.ts
import * as L from '../../supabase/functions/marketing-ai/levers.ts';
import { factLines, LEVER_KEYS, LEVER_LABELS, LEVER_REASONS, validLever, warningText } from '../../src/lib/marketingLevers.ts';
import { MIN_VIEWS_PROOF } from '../../src/lib/assistantViews.ts';
import { LOW_STOCK_MAX } from '../../src/lib/assistantSales.ts';
import { MAX_REAL_DISCOUNT_PCT, MIN_REAL_DISCOUNT_PCT } from '../../src/lib/promotions.ts';

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

const NOW = Date.parse('2026-11-16T08:00:00Z');
const inDays = (d: number) => new Date(NOW + d * 86400000).toISOString();
const cotton = { name: 'COTTON SWISS 100 % COTON', price: '40000.00', compare_at_price: '50000.00', stock: 500, is_flash_sale: false, flash_sale_ends_at: null, promo_ends_at: inDays(3) };

// --- les mêmes règles que le site
check('mêmes clés de leviers que l\'écran admin', JSON.stringify([...L.LEVERS]) === JSON.stringify([...LEVER_KEYS]));
check('mêmes seuils que le site (50 personnes, stock bas 5, remise vraie 5 à 60 %)', L.MIN_VIEWS_PROOF === MIN_VIEWS_PROOF && L.LOW_STOCK_MAX === LOW_STOCK_MAX && L.MIN_REAL_DISCOUNT_PCT === MIN_REAL_DISCOUNT_PCT && L.MAX_REAL_DISCOUNT_PCT === MAX_REAL_DISCOUNT_PCT);
check('chaque levier a un nom à l\'écran et chaque raison un texte', LEVER_KEYS.every((k) => !!LEVER_LABELS[k]) && ['no_product', 'few_views', 'no_discount', 'no_deadline', 'stock_ok', 'not_top'].every((r) => !!LEVER_REASONS[r]));

// --- les vrais chiffres
const f = L.computeFacts(cotton, 1842, 1, NOW);
check('COTTON SWISS : 40 000 au lieu de 50 000, 10 000 économisés, -20 %, 1 842 personnes, n° 1', f.price === 40000 && f.oldPrice === 50000 && f.saving === 10000 && f.pct === 20 && f.views === 1842 && f.rank === 1 && f.endsAt === new Date(cotton.promo_ends_at).toISOString(), f);
const ended = L.computeFacts({ ...cotton, promo_ends_at: inDays(-1) }, 1842, 1, NOW);
check('promotion finie : plus d\'ancien prix, plus d\'économie ni d\'échéance (comme sur le site)', ended.oldPrice === null && ended.saving === 0 && ended.endsAt === null);
const noWindow = L.computeFacts({ ...cotton, promo_ends_at: null }, 0, null, NOW);
check('ancien prix écrit mais aucune promotion en cours : rien à dire', noWindow.oldPrice === null && noWindow.saving === 0);
const flash = L.computeFacts({ ...cotton, promo_ends_at: null, is_flash_sale: true, flash_sale_ends_at: inDays(0.5) }, 0, null, NOW);
check('vente flash en cours : vraie remise et vraie échéance (la fin de la vente flash)', flash.saving === 10000 && flash.endsAt === inDays(0.5));
check('date de la base « 2026-11-16 18:45:30.828681+00 » : rendue en format standard (lisible sur iPhone)', L.computeFacts({ ...cotton, promo_ends_at: null, is_flash_sale: true, flash_sale_ends_at: '2026-11-16 18:45:30.828681+00' }, 0, null, NOW).endsAt === '2026-11-16T18:45:30.828Z');
check('remise de plus de 60 % : erreur de saisie, pas citée', L.computeFacts({ ...cotton, price: 10000 }, 0, null, NOW).saving === 0);
check('moins de 50 personnes : 0 (pas de chiffre), et donc pas de rang', L.computeFacts(cotton, 49, 3, NOW).views === 0 && L.computeFacts(cotton, 49, 3, NOW).rank === null);
check('rang au-delà de 10 : pas d\'« effet de mode »', L.computeFacts(cotton, 120, 11, NOW).rank === null && L.computeFacts(cotton, 120, 10, NOW).rank === 10);
const none = L.computeFacts(null, 0, null, NOW);
check('sans article : seulement le cadeau du chat', !none.hasProduct && none.gift && L.availableLevers(none).join() === 'reciprocity');

// --- les leviers vrais
const av = Object.fromEntries(L.leverAvailability(f).map((l) => [l.key, l]));
check('COTTON SWISS : preuve sociale, perte, urgence, mode, réciprocité ; PAS rareté (stock 500)', av.social.available && av.loss.available && av.urgency.available && av.trend.available && av.reciprocity.available && !av.scarcity.available && av.scarcity.reason === 'stock_ok', av);
const plain = L.computeFacts({ ...cotton, compare_at_price: null, promo_ends_at: null, stock: 3 }, 20, null, NOW);
const avp = Object.fromEntries(L.leverAvailability(plain).map((l) => [l.key, l]));
check('article sans promo, 20 personnes, stock 3 : rareté oui ; preuve sociale, perte, urgence, mode non (avec la raison)', avp.scarcity.available && !avp.social.available && avp.social.reason === 'few_views' && avp.loss.reason === 'no_discount' && avp.urgency.reason === 'no_deadline' && avp.trend.reason === 'not_top', avp);
check('sans article : la raison est « choisissez un article »', L.leverAvailability(none).filter((l) => !l.available).every((l) => l.reason === 'no_product'));

// --- choisir
check('« Automatique » : les 2 meilleurs leviers vrais (urgence puis perte pour COTTON SWISS)', JSON.stringify(L.chooseLevers(f, 'auto')) === '["urgency","loss"]', L.chooseLevers(f, 'auto'));
check('« Automatique » sans promo : rareté puis réciprocité', JSON.stringify(L.chooseLevers(plain, 'auto')) === '["scarcity","reciprocity"]', L.chooseLevers(plain, 'auto'));
check('un levier vrai choisi : celui-là seulement', JSON.stringify(L.chooseLevers(f, 'social')) === '["social"]');
check('un levier PAS vrai (rareté avec 500 en stock) : refusé', L.chooseLevers(f, 'scarcity') === null && L.chooseLevers(plain, 'social') === null);

// --- ce que l'IA reçoit
const ins = L.leverInstructions(f, ['social', 'loss']);
check('l\'IA reçoit les faits exacts et le plan « Version 1 · Preuve sociale, version 2 · Aversion à la perte »', ins.includes('1842 personnes ont regardé cet article ces 30 derniers jours') && ins.includes('40 000 FCFA au lieu de 50 000 FCFA') && ins.includes('économise 10 000 FCFA') && ins.includes('version 1 = Preuve sociale') && ins.includes('version 2 = Aversion à la perte') && ins.includes('« Version N · <nom du levier> »'), ins);
check('preuve sociale : « regardé », jamais « acheté »', L.leverFact(f, 'social').includes('jamais « acheté »'));
check('effet de mode : « parmi les 3 plus regardés » pour le n° 1 (sans inventer de place exacte)', L.leverFact(f, 'trend').includes('des 3 articles les plus regardés'));
check('réciprocité : cadeau surprise du chat, sans valeur promise', /cadeau surprise/.test(L.leverFact(f, 'reciprocity')) && /ne promets aucune valeur/.test(L.leverFact(f, 'reciprocity')));
check('urgence : la vraie date de fin, à l\'heure de N\'Djamena', /heure de N'Djamena/.test(L.leverFact(f, 'urgency')) && /novembre/.test(L.leverFact(f, 'urgency')));
check('aucun levier vrai : texte simple et honnête', /sans urgence ni rareté/.test(L.leverInstructions(f, [])));
check('les règles générales interdisent « stock limité », « dernière chance »… sans fait', /stock limité/.test(L.LEVERS_SYSTEM) && /dernière chance/.test(L.LEVERS_SYSTEM) && /chiffre qui n'est pas dans les faits/.test(L.LEVERS_SYSTEM));

// --- le contrôle du texte écrit par l'IA
const good = 'Version 1 · Preuve sociale\n👀 1842 personnes ont regardé ce tissu ces 30 derniers jours !\nCOTTON SWISS : 40 000 FCFA au lieu de 50 000 FCFA, vous gardez 10 000 FCFA.';
check('un texte fidèle aux faits : aucun avertissement', L.falseClaims(good, f).length === 0, L.falseClaims(good, f));
check('« stock limité » avec 500 en stock : signalé', L.falseClaims('Stock limité, foncez !', f).includes('rareté'));
check('« dernière chance » sans date de fin : signalé ; avec une vraie date : accepté', L.falseClaims('Dernière chance !', plain).includes('urgence') && !L.falseClaims('Dernière chance !', f).includes('urgence'));
check('un faux nombre de personnes (2 000 au lieu de 1 842) : signalé', L.falseClaims('Déjà 2 000 personnes ont regardé', f).includes('nombre de personnes'));
check('« personnes ont acheté » / « clients satisfaits » : signalé', L.falseClaims('1842 personnes ont acheté', f).includes('achats') && L.falseClaims('Des clients satisfaits', f).includes('achats'));
check('un prix inventé (35 000 FCFA) : signalé', L.falseClaims('Seulement 35 000 FCFA', f).includes('prix'));

// --- l'écran admin
const lines = factLines(f);
check('écran : les vrais chiffres en lignes simples', lines[0] === "👀 1 842 personnes l'ont regardé en 30 jours (n° 1 des plus regardés)" && lines[1] === '💰 40 000 FCFA au lieu de 50 000 FCFA : 10 000 FCFA économisés (-20 %)' && /^⏰ La promotion se termine /.test(lines[2]) && lines[3] === '📦 Stock : 500 (pas de « stock limité »)', lines);
check('écran : moins de 50 personnes et stock bas dits clairement', factLines(plain)[0].startsWith('👀 Moins de 50 personnes') && factLines(plain).includes('⏳ Plus que 3 en stock'), factLines(plain));
check('écran : sans article, aucune ligne', factLines(none).length === 0 && factLines(null).length === 0);
const avList = L.leverAvailability(f);
check('écran : un levier qui n\'est plus vrai revient à « Automatique »', validLever('scarcity', avList) === 'auto' && validLever('social', avList) === 'social' && validLever('auto', avList) === 'auto' && validLever('social', null) === 'auto');
check('écran : avertissement en phrase simple', warningText(['rareté', 'prix']) === '⚠️ Vérifiez avant de publier : il parle de stock limité alors que le stock est normal ; un prix ne correspond pas aux vrais prix de l’article.' && warningText([]) === null && warningText(undefined) === null);

console.log(`\n${ok} contrôles réussis`);
