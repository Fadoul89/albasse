// Tests du cerveau de Zara v3 (sans IA) : francais + arabe, questions une par une, conseil, budget, textes vrais.
// Lecture seule sur le vrai catalogue de la boutique.
import * as b from '../../src/lib/assistantBrain.ts';
import * as m from '../../src/lib/assistantMarketing.ts';
import * as tx from '../../src/lib/assistantText.ts';
import * as l from '../../src/lib/assistantLang.ts';
import * as pe from '../../src/lib/profileEdit.ts';
import * as at from '../../src/lib/assistantAttribution.ts';
import * as st from '../../src/lib/assistantStats.ts';
import * as bi from '../../src/lib/browsingInsights.ts';
import * as ac from '../../src/lib/activeTimer.ts';
import * as tc from '../../src/lib/trackingConsent.ts';
import * as ai from '../../src/lib/assistantInterest.ts';
import * as bo from '../../src/lib/browsingOverview.ts';
import * as oc from '../../src/lib/assistantOccasions.ts';
import * as sa from '../../src/lib/assistantSales.ts';
import * as ps from '../../src/lib/assistantPersona.ts';
import * as fb from '../../src/lib/facebookShare.ts';
import { chromeIntentUrl } from '../../src/lib/pwaInstallPrompt.ts';
import * as sp from '../../src/lib/scheduledPushTime.ts';
import { isMissingColumn } from '../../src/lib/dbErrors.ts';

const KEY = process.env.SUPABASE_ANON_KEY!;
const URL_SB = 'https://xtitsmmccpkelxfjyqyh.supabase.co';
let failures = 0;
function ok(label: string, cond: unknown, extra?: unknown) {
  if (!cond) failures++;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 220));
}
const get = async (q: string) => (await fetch(`${URL_SB}/rest/v1/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
type P = b.CatalogProduct;

async function main() {
  console.log('== prenoms (francais et arabe)');
  const names: [string, string | null][] = [
    ['Fatimé', 'Fatimé'], ['fatimé', 'Fatimé'], ['  Aïcha  ', 'Aïcha'], ["Je m'appelle Fatimé Ali", 'Fatimé'], ["moi c'est Ali", 'Ali'],
    ['Bonjour, je suis Mahamat', 'Mahamat'], ['Mon nom est Saleh', 'Saleh'], ['Jean-Pierre', 'Jean-Pierre'], ['Mahamat Saleh Idriss', 'Mahamat'],
    ['non', null], ['Passer', null], ['plus tard', null], ['je cherche des chaussures pour homme', null], ['12345', null], ['A', null], ['https://x.com', null], ['', null],
    ['فاطمة', 'فاطمة'], ['اسمي محمد', 'محمد'], ['أنا علي', 'علي'], ['مرحبا اسمي صالح', 'صالح'], ['لا', null], ['تخطي', null], ['لاحقا', null],
    ['MAHAMAT', 'Mahamat'], ['FATIMÉ', 'Fatimé'], ['JEAN-PIERRE', 'Jean-Pierre'], ['AL', 'Al'],
  ];
  for (const [input, expected] of names) ok(`« ${input} » -> ${expected}`, b.firstNameFrom(input) === expected, b.firstNameFrom(input));

  console.log('\n== client avec compte : prenom tire du nom complet du profil');
  const fullNames: [string | null | undefined, string | null][] = [
    ['Ahmed Hassan', 'Ahmed'], ['MAHAMAT ABDERAMAN', 'Mahamat'], ['JEAN-PIERRE Dupont', 'Jean-Pierre'], ['  Fatimé   Ali ', 'Fatimé'], ['Mr Ali Hassan', 'Ali'],
    ['Mme Fatimé Ali', 'Fatimé'], ['M. Saleh', 'Saleh'], ['Dr Idriss', 'Idriss'], ['Madame Aïcha Moussa', 'Aïcha'], ['الدكتور محمد علي', 'محمد'],
    ['السيدة فاطمة', 'فاطمة'], ['محمد علي', 'محمد'], ['Dr', null], ['Mr.', null], ['12345', null], ['', null], ['   ', null], [null, null], [undefined, null], ['A. Saleh', null],
  ];
  for (const [input, expected] of fullNames) ok(`compte « ${input} » -> ${expected}`, b.firstNameOfFullName(input) === expected, b.firstNameOfFullName(input));

  console.log('\n== ce que veut le visiteur (francais)');
  const intents: [string, b.Intent][] = [
    ['es-tu un robot ?', 'bot'], ['tu es une vraie personne ?', 'bot'], ["c'est une IA ?", 'bot'],
    ['merci beaucoup', 'thanks'], ['Bonjour', 'greeting'], ['salam', 'greeting'], ['bonjour je cherche des chaussures', 'search'],
    ['comment créer un compte', 'account'], ["je veux m'inscrire", 'account'], ['suivre ma commande', 'orders'], ['mes commandes', 'orders'],
    ['livraison à Moundou', 'delivery'], ['je peux payer comment', 'delivery'], ['airtel money', 'delivery'], ['frais de livraison', 'delivery'],
    ['promotions', 'promo'], ['vos soldes', 'promo'], ['nouveautés', 'new'], ['catégories', 'categories'], ['comment commander', 'order'],
    ['numéro whatsapp', 'contact'], ['horaires', 'contact'], ['adresse de la boutique', 'contact'],
    ['chaussures homme', 'search'], ['montre', 'search'], ['parfum femme', 'search'], ['robe', 'search'], ['sac a main', 'search'], ['rolex', 'search'],
    ['trop cher', 'price'], ["c'est cher", 'price'], ['je peux négocier ?', 'price'],
    ['vous êtes fiables ?', 'trust'], ["c'est une arnaque ?", 'trust'], ["je n'ai pas confiance", 'trust'],
    ['je vais réfléchir', 'later'], ['plus tard', 'later'], ['pas maintenant', 'later'],
    ['idée cadeau', 'gift'], ['un cadeau pour ma femme', 'gift'], ['pour un anniversaire', 'gift'], ['Je veux faire une cadeau a mon marie', 'gift'],
    ['conseil', 'advice'], ['je voudrais un conseil', 'advice'], ["aide-moi à choisir", 'advice'], ['conseille-moi un parfum', 'advice'],
    ['mon budget', 'budget'], ['budget 20000', 'budget'],
    ['commande valable 48h', 'rules'], ['délai de 48 heures', 'rules'], ['les fausses commandes', 'rules'],
    ['infos importantes', 'info'],
    ['emballage cadeau', 'wrap'], ['je veux emballer le colis', 'wrap'], ['vous faites emballage ?', 'wrap'],
    ['je veux retourner un article', 'returns'], ['remboursement', 'returns'], ['conditions de retour', 'returns'], ['échanger la taille', 'returns'], ['article défectueux', 'returns'],
    ['qui êtes-vous', 'about'], ['depuis quand existez-vous', 'about'], ['vous êtes là depuis 2013', 'about'], ['votre histoire', 'about'],
    ['quelle est l’adresse du site ?', 'about'], ['lien du site', 'about'], ['site officiel', 'about'], ['رابط الموقع', 'about'], ['comment commander sur votre site', 'order'],
  ];
  for (const [input, expected] of intents) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));

  console.log('\n== ce que veut le visiteur (arabe)');
  const arIntents: [string, b.Intent][] = [
    ['مرحبا', 'greeting'], ['السلام عليكم', 'greeting'], ['شكرا', 'thanks'], ['عروض', 'promo'], ['الجديد', 'new'], ['الفئات', 'categories'],
    ['غالي', 'price'], ['هذا غالي جدا', 'price'], ['هل انتم موثوقون', 'trust'], ['هل يوجد ضمان', 'trust'], ['خايف من النصب', 'trust'],
    ['كم سعر التوصيل', 'delivery'], ['التوصيل الى انجامينا', 'delivery'], ['كيف ادفع', 'delivery'],
    ['اريد هدية لزوجي', 'gift'], ['هدية عيد ميلاد', 'gift'], ['تغليف الهدايا', 'wrap'], ['اريد تغليف', 'wrap'],
    ['شروط الارجاع', 'returns'], ['اريد استبدال المنتج', 'returns'], ['استرجاع', 'returns'], ['منتج معيب', 'returns'],
    ['حسابي', 'account'], ['كيف اسجل', 'account'], ['طلباتي', 'orders'], ['ميزانيتي 20000', 'budget'],
    ['من انتم', 'about'], ['واتساب', 'contact'], ['ساعات العمل', 'contact'], ['انصحني', 'advice'], ['هل انت روبوت', 'bot'], ['لاحقا', 'later'],
    ['عطر رجالي', 'search'], ['حذاء', 'search'],
  ];
  for (const [input, expected] of arIntents) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));

  console.log('\n== politesse et conversation (francais)');
  const talkFr: [string, b.Intent][] = [
    ['Bonjour !', 'greeting'], ['Salut Zara !', 'greeting'], ['Bonsoir', 'greeting'], ['salam', 'greeting'], ['coucou', 'greeting'], ['hello', 'greeting'], ['Bonjour Zara Kings', 'greeting'],
    ['Merci.', 'thanks'], ['Merci beaucoup', 'thanks'], ['merci Zara', 'thanks'], ['ok merci', 'thanks'], ['merci pour votre aide', 'thanks'], ['merci infiniment', 'thanks'],
    ['merci je cherche une montre', 'search'], ['merci, et la livraison à Moundou ?', 'delivery'], ['merci mais je veux un parfum', 'search'],
    ['Ça va ?', 'smalltalk'], ['ça va bien ?', 'smalltalk'], ['Bonjour ça va ?', 'smalltalk'], ['Comment allez-vous ?', 'smalltalk'], ['comment vas-tu Zara', 'smalltalk'], ['Salut, comment ça va ?', 'smalltalk'],
    ['Bonne nuit', 'goodbye'], ['Au revoir', 'goodbye'], ['à bientôt', 'goodbye'], ['bonne journée', 'goodbye'], ['bonne soirée', 'goodbye'], ['À plus', 'goodbye'], ['à plus tard', 'goodbye'], ['ciao', 'goodbye'], ['merci, bonne journée', 'goodbye'],
    ['Tu es belle 😍', 'compliment'], ['t’es magnifique', 'compliment'], ['bravo', 'compliment'], ['je t’aime', 'compliment'], ['vous êtes adorable', 'compliment'], ['tu es très gentille', 'compliment'],
    ['Zara, quelle est ton adresse ?', 'personal'], ['Tu habites où ?', 'personal'], ['où habites-tu', 'personal'], ['Zara, donne-moi ton numéro', 'personal'], ['Je veux ton WhatsApp personnel', 'personal'],
    ['Je veux t’appeler', 'personal'], ['quel âge as-tu ?', 'personal'], ['tu es mariée ?', 'personal'], ['tu as des enfants ?', 'personal'], ['comment te contacter', 'personal'],
    // la boutique, elle, répond normalement (adresse, numéro, horaires)
    ['adresse de la boutique', 'contact'], ['numéro whatsapp', 'contact'], ['votre numéro', 'contact'], ['où est la boutique', 'contact'], ['horaires', 'contact'],
    // des phrases de vente restent des phrases de vente
    ['à plus de 10 000 FCFA', 'search'], ['une belle robe', 'search'], ['vous êtes fiables ?', 'trust'], ['je vais réfléchir', 'later'], ['plus tard', 'later'], ['merci', 'thanks'],
  ];
  for (const [input, expected] of talkFr) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));

  console.log('\n== politesse et conversation (arabe)');
  const talkAr: [string, b.Intent][] = [
    ['صباح الخير', 'greeting'], ['السلام عليكم', 'greeting'], ['مساء الخير', 'greeting'], ['مرحبا زارا', 'greeting'],
    ['شكرا جزيلا', 'thanks'], ['جزاك الله خيرا', 'thanks'], ['شكرا', 'thanks'], ['شكرا اريد عطر رجالي', 'search'],
    ['كيف حالك', 'smalltalk'], ['السلام عليكم كيف حالك', 'smalltalk'], ['كيفك يا زارا', 'smalltalk'],
    ['تصبح على خير', 'goodbye'], ['مع السلامة', 'goodbye'], ['إلى اللقاء', 'goodbye'],
    ['انت جميلة', 'compliment'], ['ماشاء الله عليك', 'compliment'], ['احبك', 'compliment'],
    ['ما هو عنوانك', 'personal'], ['اين تسكنين', 'personal'], ['اعطني رقمك', 'personal'], ['اريد ان اتصل بك', 'personal'], ['واتسابك', 'personal'], ['كم عمرك', 'personal'], ['هل انت متزوجة', 'personal'],
    ['عنوان المتجر', 'contact'], ['رقم الواتساب', 'contact'], ['ساعات العمل', 'contact'],
  ];
  for (const [input, expected] of talkAr) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));

  console.log('\n== commande dans le chat : nom complet, telephone, adresse, oui / non, paiement');
  const fullNameCases: [string, string | null][] = [
    ['ahmed hassan', 'Ahmed Hassan'], ['MAHAMAT SALEH IDRISS', 'Mahamat Saleh Idriss'], ['Mahamat Saleh Idriss Abakar', 'Mahamat Saleh Idriss Abakar'], ['je m’appelle Fatimé Ali', 'Fatimé Ali'],
    ['محمد علي', 'محمد علي'], ['Jean-Pierre Dupont', 'Jean-Pierre Dupont'], ['A. Saleh', 'A. Saleh'], ['Ali', 'Ali'],
    ['12345', null], ['merci beaucoup', null], ['non', null], ['je veux commander', null], ['quel est le prix ?', null], ['A', null], ['Mahamat Saleh Idriss Abakar Ali Hassan', null],
    ['https://x.com', null], ['tu es belle', null], ['bonjour', null], ['', null],
  ];
  for (const [input, expected] of fullNameCases) ok(`nom complet « ${input} » -> ${expected}`, b.fullNameFrom(input) === expected, b.fullNameFrom(input));
  const phoneCases: [string, string | null][] = [
    ['66123456', '66123456'], ['+235 66 12 34 56', '66123456'], ['00235 66123456', '66123456'], ['٦٦١٢٣٤٥٦', '66123456'], ['91234567', '91234567'], ['66 12 34 56', '66123456'], ['mon numéro est 66123456', '66123456'],
    ['55123456', null], ['1234', null], ['6612345', null], ['661234567', null], ['abc', null], ['', null],
  ];
  for (const [input, expected] of phoneCases) ok(`telephone « ${input} » -> ${expected}`, b.phoneFrom(input) === expected, b.phoneFrom(input));
  const addressCases: [string, string | null][] = [
    ['Quartier Farcha, rue 12', 'Quartier Farcha, rue 12'], ['  Farcha   près du marché ', 'Farcha près du marché'], ['حي فرشا قرب الصيدلية', 'حي فرشا قرب الصيدلية'],
    ['Quartier Moursal près de la boutique Albasse', 'Quartier Moursal près de la boutique Albasse'], ['Farcha, face à la livraison de gaz', 'Farcha, face à la livraison de gaz'],
    ['ab', null], ['1234', null], ['https://x.com/adresse', null], ['x'.repeat(151), null], ['merci', null], ['bonjour', null], ['oui', null], ['non merci', null], ['ok merci', null], ['شكرا', null],
  ];
  for (const [input, expected] of addressCases) ok(`adresse « ${input.slice(0, 30)} » -> ${expected && expected.slice(0, 30)}`, b.addressFrom(input) === expected, b.addressFrom(input));
  const yesNoCases: [string, string | null][] = [['oui', 'yes'], ['Oui merci', 'yes'], ['ok', 'yes'], ["d'accord", 'yes'], ['non', 'no'], ['non merci', 'no'], ['pas du tout', 'no'], ['نعم', 'yes'], ['لا', 'no'], ['peut-être', null], ['oui mais non', null]];
  for (const [input, expected] of yesNoCases) ok(`oui / non « ${input} » -> ${expected}`, b.yesNo(input) === expected, b.yesNo(input));
  const payCases: [string, string | null][] = [['airtel', 'airtel_money'], ['Airtel Money', 'airtel_money'], ['moov', 'moov_money'], ['je paie à la livraison', 'cash_on_delivery'], ['cash', 'cash_on_delivery'], ['كاش', 'cash_on_delivery'], ['عند الاستلام', 'cash_on_delivery'], ['ايرتل', 'airtel_money'], ['bonjour', null]];
  for (const [input, expected] of payCases) ok(`paiement « ${input} » -> ${expected}`, b.paymentFrom(input) === expected, b.paymentFrom(input));
  ok('annuler la commande : « annuler », « stop », « laisse tomber », « الغاء » (mais pas « oui »)', ['annuler', 'annule la commande', 'stop', 'laisse tomber', 'الغاء'].every((x) => b.wantsCancelOrder(x)) && !b.wantsCancelOrder('oui') && !b.wantsCancelOrder('je veux commander'));
  ok('confirmer : « oui », « je confirme », « ok », « اكد » (mais pas « non » ni « modifier »)', ['oui', 'je confirme', 'confirmer', 'ok', 'اكد'].every((x) => b.wantsConfirmOrder(x)) && !b.wantsConfirmOrder('non') && !b.wantsConfirmOrder('modifier'));
  ok('modifier : « modifier », « changer l\'adresse », « erreur » (mais pas « oui »)', ['modifier', 'je veux changer l’adresse', 'erreur'].every((x) => b.wantsEditOrder(x)) && !b.wantsEditOrder('oui'));

  console.log('\n== commande dans le chat : textes (fr et ar)');
  const recapSample: tx.RecapData = { lines: [{ name: 'Rolex', variant: ' (Taille 41 · Blanc)', qty: 2, subtotal: 25000 }, { name: 'Parfum', variant: '', qty: 1, subtotal: 8000 }], city: 'Moundou', fee: 2500, gift: true, total: 37500, name: 'Ahmed Hassan', phone: '66123456', address: 'Quartier Farcha', method: 'airtel_money' };
  const fr2 = tx.texts('fr').checkout;
  const ar2 = tx.texts('ar').checkout;
  const recapFr = fr2.recap(recapSample);
  ok('recapitulatif (fr) : articles, livraison, emballage cadeau, total, coordonnees, paiement a l\'avance', recapFr.includes('• Rolex (Taille 41 · Blanc) × 2 : 25 000 FCFA') && recapFr.includes('🚚 Livraison à Moundou : 2 500 FCFA') && recapFr.includes('🎁 Emballage cadeau : 2 000 FCFA') && recapFr.includes('💰 Total : 37 500 FCFA') && recapFr.includes('👤 Ahmed Hassan · 📞 66123456') && recapFr.includes('📍 Quartier Farcha, Moundou') && recapFr.includes('📱 Paiement à l’avance par Airtel Money') && recapFr.endsWith('👇'), recapFr);
  ok('recapitulatif : frais « a confirmer » si inconnus, « gratuite » si 0, pas de ligne cadeau sans emballage, paiement a la livraison', fr2.recap({ ...recapSample, fee: null, gift: false, method: 'cash_on_delivery' }).includes('à confirmer par l’équipe') && !fr2.recap({ ...recapSample, fee: null, gift: false }).includes('Emballage') && fr2.recap({ ...recapSample, fee: 0 }).includes('gratuite') && fr2.recap({ ...recapSample, method: 'cash_on_delivery' }).includes('💵 Paiement à la livraison, en espèces'));
  const arSample: tx.RecapData = { ...recapSample, lines: [{ name: 'ساعة', variant: '', qty: 2, subtotal: 25000 }], city: 'موندو', name: 'علي', address: 'حي فرشا' };
  const recapAr = ar2.recap(arSample);
  ok('recapitulatif (ar) : articles, livraison, emballage, total, coordonnees, paiement', recapAr.includes('• ساعة × 2: 25 000 FCFA') && recapAr.includes('🚚 التوصيل إلى موندو: 2 500 FCFA') && recapAr.includes('🎁 تغليف الهدية') && recapAr.includes('💰 المجموع: 37 500 FCFA') && recapAr.includes('👤 علي · 📞 66123456') && recapAr.includes('📍 حي فرشا، موندو') && recapAr.includes('الدفع مسبقاً عبر Airtel Money'), recapAr);
  ok('paiement a la livraison seulement a N\'Djamena : la question change selon la ville (fr et ar)', /À la livraison \(N'Djamena\)/.test(fr2.askPay(true)) && !/À la livraison/.test(fr2.askPay(false)) && /عند الاستلام \(إنجامينا\)/.test(ar2.askPay(true)) && !/عند الاستلام/.test(ar2.askPay(false)) && /seulement à N'Djamena/.test(fr2.codOnlyHome) && /فقط في إنجامينا/.test(ar2.codOnlyHome));
  ok('confirmation : « enregistree » (jamais « payee » ni « confirmee »), numero, total ; instructions de paiement', fr2.placed('Ahmed', 'ABCD1234') === '🎉 Merci Ahmed ! Votre commande #ABCD1234 a bien été enregistrée.' && /تم تسجيل طلبك رقم #ABCD1234/.test(ar2.placed('علي', 'ABCD1234')) && fr2.payNumber(5000, '60 60 51 51', 'Airtel Money') === '📱 Envoyez 5 000 FCFA au 60 60 51 51 (Airtel Money).' && fr2.payUrl('https://pay.example.com') === '📱 Payez ici : https://pay.example.com' && fr2.payCash.includes('espèces') && ![fr2.placed('A', 'B'), fr2.failed, fr2.payCash, fr2.payNumber(1, '2', 'x')].some((t) => /payée|paiement reçu|confirmée/i.test(t)), [fr2.placed('Ahmed', 'ABCD1234'), fr2.payNumber(5000, '60 60 51 51', 'Airtel Money')]);
  ok('echec : Zara dit que la commande n\'est PAS enregistree et que le panier est garde (fr et ar)', /pas pu enregistrer votre commande/.test(fr2.failed) && /panier est gardé/.test(fr2.failed) && /لم أستطع تسجيل طلبك/.test(ar2.failed) && /سلتك محفوظة/.test(ar2.failed));

  console.log('\n== programme de fidelite : grade, points, comment gagner (fr et ar)');
  const loyIntents: [string, b.Intent][] = [
    ['quel est mon grade', 'loyalty'], ['mes points de fidélité', 'loyalty'], ['comment gagner des points', 'loyalty'], ['quels sont les grades', 'loyalty'], ['programme de fidélité', 'loyalty'],
    ['combien de points j’ai', 'loyalty'], ['je suis au niveau Bronze ?', 'loyalty'], ['mon grade', 'loyalty'], ['ما هي درجتي', 'loyalty'], ['كيف اكسب نقاط', 'loyalty'], ['نقاطي', 'loyalty'], ['برنامج الولاء', 'loyalty'],
    ['montre en or', 'search'], ['ساعة ذهبية', 'search'], ['payer en argent liquide', 'delivery'], ['point de vente', 'search'], ['bijou en argent', 'search'], ['bague en argent', 'search'], ['payer en argent', 'delivery'], ['mes commandes', 'orders'], ['mon compte', 'account'],
  ];
  for (const [input, expected] of loyIntents) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));
  const loyKinds: [string, string][] = [['comment gagner des points', 'earn'], ['كيف اكسب نقاط', 'earn'], ['comment avoir des points', 'earn'], ['quels sont les grades', 'tiers'], ['les paliers', 'tiers'], ['الدرجات', 'tiers'], ['quel est mon grade', 'mine'], ['mes points', 'mine'], ['نقاطي', 'mine'], ['comment connaître mon grade', 'mine']];
  for (const [input, expected] of loyKinds) ok(`fidelite « ${input} » -> ${expected}`, b.loyaltyKind(input) === expected, b.loyaltyKind(input));
  const lo = tx.texts('fr').loyalty;
  const loAr = tx.texts('ar').loyalty;
  ok('0 point : Bronze, « bienvenue dans le programme », il manque 25 points pour Argent (vrai palier)', lo.mine({ points: 0, tier: 'bronze', next: { key: 'argent', missing: 25 } }) === 'Bienvenue dans notre programme de fidélité ! 🥉 Vous êtes actuellement au grade Bronze. Chaque achat éligible sur albasseshopping.com vous permet de gagner des points. Continuez vos achats pour vous rapprocher du grade Argent ! 🎁\n⭐ Vos points : 0\nIl vous manque 25 points pour atteindre le grade Argent 🥈.', lo.mine({ points: 0, tier: 'bronze', next: { key: 'argent', missing: 25 } }));
  ok('proche du grade suivant (13 points) : exactement l\'exemple du patron + les points', lo.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } }).startsWith('Bonne nouvelle ! 😍 Vous êtes au grade Argent 🥈 et il ne vous manque que 13 points pour atteindre le grade Or 🥇 ! Continuez à profiter de nos articles sur albasseshopping.com. Chaque achat éligible vous rapproche de votre objectif ! 🎁') && lo.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } }).includes('⭐ Vos points : 37'));
  ok('grade avec 20 points a gagner : « Félicitations ! 🎉 ... Argent 🥈 », le nombre exact, puis l\'invitation a continuer', lo.mine({ points: 30, tier: 'argent', next: { key: 'or', missing: 20 } }) === 'Félicitations ! 🎉 Votre grade actuel chez Albasse Shopping est Argent 🥈.\n⭐ Vos points : 30\nIl vous manque 20 points pour atteindre le grade Or 🥇.\nContinuez à acheter sur albasseshopping.com pour gagner des points de fidélité et progresser vers le grade supérieur ! 🛍️❤️');
  ok('1 point restant : « 1 point » (singulier) ; grade Platine -> Diamond 👑', /il ne vous manque que 1 point pour atteindre le grade Diamond 👑/.test(lo.mine({ points: 99, tier: 'platine', next: { key: 'diamond', missing: 1 } })) && !/1 points/.test(lo.mine({ points: 99, tier: 'platine', next: { key: 'diamond', missing: 1 } })));
  ok('grade le plus haut (Diamond 👑) : pas de « points manquants », felicitations', /Diamond 👑 : c’est le plus haut grade du programme/.test(lo.mine({ points: 120, tier: 'diamond', next: null })) && !/manque/.test(lo.mine({ points: 120, tier: 'diamond', next: null })));
  const loyNums = (t: string) => (t.replace(/[\s  ]/g, '').match(/\d+/g) ?? []).sort().join(',');
  ok('aucun nombre invente : seuls les points du client et les points manquants apparaissent dans la reponse', loyNums(lo.mine({ points: 30, tier: 'argent', next: { key: 'or', missing: 20 } })) === '20,30' && loyNums(lo.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } })) === '13,37' && loyNums(loAr.mine({ points: 30, tier: 'argent', next: { key: 'or', missing: 20 } })) === '20,30' && loyNums(lo.mine({ points: 120, tier: 'diamond', next: null })) === '120');
  const tiersTxt = lo.earn;
  ok('comment gagner : phrase du patron, adresse officielle, regle reelle (1 point / 5 000 FCFA livres), les 5 grades et leurs vrais paliers', tiersTxt.startsWith('C’est simple ! 😊 Achetez vos articles sur https://albasseshopping.com et gagnez des points de fidélité selon les règles du programme. Plus vous progressez, plus vous vous rapprochez des grades supérieurs ! 🛍️💎') && /1 point pour chaque tranche de 5 000 FCFA du total d’une commande livrée/.test(tiersTxt) && tiersTxt.includes('🥉 Bronze (au départ) · 🥈 Argent (25 points) · 🥇 Or (50 points) · 💎 Platine (75 points) · 👑 Diamond (100 points)'), tiersTxt);
  ok('liste des grades (fr et ar) : les 5 grades, pas de promesse de recompense', lo.tiers.includes('👑 Diamond (100 points)') && loAr.tiers.includes('🥈 الفضية (25 نقطة)') && loAr.tiers.includes('👑 الماسية (100 نقطة)') && ![lo.earn, lo.tiers, loAr.earn, loAr.tiers].some((t) => /cadeau offert|gratuit|remise|réduction|bon d’achat|تخفيض|هدية مجانية/i.test(t)));
  ok('sans compte connecte ou si les points ne se lisent pas : jamais de grade ni de nombre, on invite a consulter le compte sur albasseshopping.com (fr et ar)', /albasseshopping\.com/.test(lo.needLogin) && !/\d/.test(lo.needLogin) && /albasseshopping\.com/.test(lo.unavailable) && !/\d/.test(lo.unavailable) && /albasseshopping\.com/.test(loAr.needLogin) && !/\d/.test(loAr.needLogin) && !/\d/.test(loAr.unavailable));
  ok('points gagnes par une commande : « 5 points » / « 1 point » (regle de la base) ; en arabe : نقطة واحدة, نقطتان, 5 نقاط', lo.orderPoints(5) === '🎁 Fidélité : cette commande vous rapportera 5 points une fois livrée.' && lo.orderPoints(1).includes('1 point une') && loAr.orderPoints(1).includes('نقطة واحدة') && loAr.orderPoints(2).includes('نقطتان') && loAr.orderPoints(5).includes('5 نقاط'));
  ok('arabe : grade, points restants, enthousiasme', /بشرى سارة/.test(loAr.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } })) && /الدرجة الفضية/.test(loAr.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } })) && /13 نقطة/.test(loAr.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } })), loAr.mine({ points: 37, tier: 'argent', next: { key: 'or', missing: 13 } }));

  console.log('\n== politesse : sur quel ton Zara repond');
  const gk: [string, string | null][] = [['Bonjour', 'hello'], ['bonsoir Zara', 'evening'], ['Salut', 'hi'], ['salam', 'salam'], ['السلام عليكم', 'salam'], ['صباح الخير', 'morning'], ['مساء الخير', 'evening'], ['مرحبا', 'hello'], ['merci', null]];
  for (const [input, expected] of gk) ok(`salutation « ${input} » -> ${expected}`, b.greetingKind(input) === expected, b.greetingKind(input));
  const bk: [string, string | null][] = [['bonne nuit', 'night'], ['تصبح على خير', 'night'], ['bonne soirée', 'evening'], ['bonne journée', 'day'], ['au revoir', 'plain'], ['مع السلامة', 'plain'], ['bonjour', null]];
  for (const [input, expected] of bk) ok(`au revoir « ${input} » -> ${expected}`, b.goodbyeKind(input) === expected, b.goodbyeKind(input));
  ok('merci beaucoup / infiniment / جزيلا -> « beaucoup » ; merci / شكرا -> simple', b.thanksKind('merci beaucoup') === 'much' && b.thanksKind('merci infiniment') === 'much' && b.thanksKind('شكرا جزيلا') === 'much' && b.thanksKind('merci') === 'plain' && b.thanksKind('شكرا') === 'plain');
  const pk: [string, string | null][] = [['quelle est ton adresse', 'address'], ['tu habites où', 'live'], ['donne moi ton numéro', 'phone'], ['ton whatsapp', 'whatsapp'], ['je veux t’appeler', 'call'], ['tu es mariée', 'life'], ['ما هو عنوانك', 'address'], ['اين تسكنين', 'live'], ['رقمك', 'phone'], ['واتسابك', 'whatsapp'], ['اريد ان اتصل بك', 'call'], ['كم عمرك', 'life'], ['adresse de la boutique', null], ['merci', null]];
  for (const [input, expected] of pk) ok(`question perso « ${input} » -> ${expected}`, b.personalKind(input) === expected, b.personalKind(input));

  console.log('\n== langue : arabe detecte, chiffres arabes, villes en arabe');
  ok('arabe detecte, francais non', l.hasArabic('مرحبا') && !l.hasArabic('bonjour') && l.hasArabic('parfum عطر') && l.detectLang('عطر') === 'ar' && l.detectLang('parfum') === null);
  ok('chiffres arabes : ٢٠٠٠٠ -> 20000', l.arabicDigits('٢٠٠٠٠') === '20000' && l.arabicDigits('۱۵۰۰۰') === '15000');
  ok('lettres unifiees : هدية = هديه, أحذية = احذيه', l.foldArabic('هدية') === 'هديه' && l.foldArabic('أحذية') === 'احذيه');
  ok('arabe -> francais : « أريد هدية لزوجي » -> cadeau mari', l.arabicToFrench('أريد هدية لزوجي') === 'cadeau mari', l.arabicToFrench('أريد هدية لزوجي'));
  ok('arabe -> francais : « عطر للرجال » -> parfum homme', l.arabicToFrench('عطر للرجال') === 'parfum homme', l.arabicToFrench('عطر للرجال'));
  ok('arabe -> francais : « ساعة رجالية » -> montre homme', l.arabicToFrench('ساعة رجالية') === 'montre homme', l.arabicToFrench('ساعة رجالية'));
  ok('arabe -> francais : « حذاء أسود » -> chaussures noir', l.arabicToFrench('حذاء أسود') === 'chaussures noir', l.arabicToFrench('حذاء أسود'));
  ok('arabe -> francais : les mots latins restent (rolex)', l.arabicToFrench('ساعة rolex') === 'montre rolex', l.arabicToFrench('ساعة rolex'));
  ok('villes en arabe', l.arabicCityToLatin('التوصيل الى مونذو') === 'Moundou' && l.arabicCityToLatin('انجامينا') === "N'Djamena" && l.arabicCityToLatin('ابشي') === 'Abéché' && l.arabicCityToLatin('الى سار') === 'Sarh' && l.arabicCityToLatin('مرحبا') === null);

  console.log('\n== villes, livraison, paiement (vraies villes de la boutique)');
  const rows = await get('cities?select=name,delivery_fee,delivery_agency&is_active=eq.true&order=sort_order,name');
  const cities: b.City[] = rows.map((c: any) => ({ name: c.name, fee: c.delivery_fee, agency: c.delivery_agency }));
  ok('43 villes actives lues', cities.length === 43, cities.length);
  const city = (t: string) => b.matchCity(cities, t)?.name ?? null;
  const cases: [string, string | null][] = [
    ['livraison à Moundou', 'Moundou'], ['ndjamena', "N'Djamena"], ["N'Djaména", "N'Djamena"], ['Ndjamena centre', "N'Djamena"], ['abeche', 'Abéché'], ['je suis à Sarh', 'Sarh'],
    ['Faya', 'Faya-Largeau'], ['bol', 'Bol'], ['kélo', 'Kélo'], ['am timan', 'Am Timan'], ['goz beida', 'Goz Beïda'],
    ['je veux une robe', null], ['comment ça va', null], ['paiement', null], ['bonjour', null], ['chaussures homme noir', null],
    ['التوصيل الى انجامينا', "N'Djamena"], ['هل توصلون الى مونذو', 'Moundou'], ['ابشي', 'Abéché'], ['سار', 'Sarh'], ['عطر', null], ['مرحبا', null],
  ];
  for (const [input, expected] of cases) ok(`ville dans « ${input} » -> ${expected}`, city(input) === expected, city(input));
  const find = (n: string) => cities.find((c) => c.name === n)!;
  const nd = b.cityReply(find("N'Djamena"));
  ok("N'Djamena : livraison gratuite et paiement a la livraison, aucun numero Mobile Money", /gratuite/.test(nd) && /payez à la livraison/.test(nd) && !/Airtel|Moov|60 60|99 22/.test(nd), nd);
  const mo = b.cityReply(find('Moundou'));
  ok("Moundou : 2 500 FCFA par l'agence STTL ou Sud Voyage, paiement a l'avance, Airtel 60 60 51 51 et Moov 99 22 10 17", /2\s?500 FCFA/.test(mo) && /par l'agence STTL ou Sud Voyage/.test(mo) && /à l'avance/.test(mo) && /\n📱 Airtel Money 60 60 51 51\n📲 Moov Money 99 22 10 17$/.test(mo), mo);
  const moAr = b.cityReply(find('Moundou'), 'ar');
  ok('Moundou en arabe : tarif, agence, Airtel et Moov, paiement a l\'avance', /2\s?500 FCFA/.test(moAr) && /STTL ou Sud Voyage/.test(moAr) && /مسبقا/.test(moAr) && /Airtel Money 60 60 51 51/.test(moAr) && /Moov Money 99 22 10 17/.test(moAr), moAr);
  const ndAr = b.cityReply(find("N'Djamena"), 'ar');
  ok("N'Djamena en arabe : gratuit + paiement a la livraison, aucun numero", /مجاني/.test(ndAr) && /عند الاستلام/.test(ndAr) && !/Airtel|Moov/.test(ndAr), ndAr);
  const ab = b.cityReply(find('Abéché'));
  ok("Abeche : par l'agence Abou Aziza", /par l'agence Abou Aziza/.test(ab) && !/STTL/.test(ab), ab);
  const mg = b.cityReply(find('Mongo'));
  ok("Mongo : par l'agence Liberté", /par l'agence Liberté/.test(mg) && !/Abou Aziza/.test(mg), mg);
  const unknownFee = cities.find((c) => c.fee == null)!;
  const uf = b.cityReply(unknownFee);
  ok(`${unknownFee.name} (tarif non fixe) : « a confirmer » + paiement a l'avance`, /à confirmer/.test(uf) && /à l'avance/.test(uf) && /60 60 51 51/.test(uf) && !/STTL/.test(uf), uf);
  ok("toute ville hors N'Djamena : paiement a l'avance avec les deux numeros (fr et ar)", cities.filter((c) => !b.isHomeCity(c.name)).every((c) => ['fr', 'ar'].every((lg) => { const r = b.cityReply(c, lg as l.Lang); return /Airtel Money 60 60 51 51/.test(r) && /Moov Money 99 22 10 17/.test(r); })));
  ok('note de service : 8h30-16h + 48 h (fr)', /de 8h30 à 16h/.test(b.serviceNote(true)) && /valable 48 h\.$/.test(b.serviceNote(true)) && /réglez dans ce délai\.$/.test(b.serviceNote(false)));
  ok('note de service : 8:30-16:00 + 48 heures (ar)', /8:30/.test(b.serviceNote(true, 'ar')) && /16:00/.test(b.serviceNote(true, 'ar')) && /48 ساعة/.test(b.serviceNote(true, 'ar')) && /ادفع خلال هذه المدة/.test(b.serviceNote(false, 'ar')), b.serviceNote(false, 'ar'));
  ok('infos importantes (fr + ar) : horaires, paiement par ville, 48 h', [b.importantInfo('fr'), b.importantInfo('ar')].every((s) => /8.30/.test(s) && /48/.test(s) && /Airtel Money/.test(s)) && /seulement à N'Djamena/.test(b.importantInfo('fr')) && /فقط في إنجامينا/.test(b.importantInfo('ar')));

  console.log('\n== catalogue (vrais produits)');
  const cats = await get('categories?select=id,name,slug');
  const catName = new Map<string, string>(cats.map((c: any) => [c.id, c.name]));
  const catSlug = new Map<string, string>(cats.map((c: any) => [c.id, c.slug]));
  const prods = await get('products?select=id,name,slug,price,compare_at_price,stock,category_id,colors,sizes,description,images,created_at&is_active=eq.true&limit=1000');
  const catalog: P[] = prods.map((p: any) =>
    b.buildProduct({ id: p.id, name: p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price, stock: p.stock, category: catName.get(p.category_id) ?? '', category_slug: catSlug.get(p.category_id) ?? '', colors: p.colors, sizes: p.sizes, description: p.description, image: (p.images ?? [])[0] ?? null, created_at: p.created_at })
  );
  ok('au moins 300 produits actifs lus', catalog.length >= 300, catalog.length);
  const top = (q: string, n = 4) => b.searchCatalog(catalog, q, n);
  const shoes = top('chaussures homme');
  ok('« chaussures homme » : que des chaussures, en stock', shoes.length === 4 && shoes.every((p) => p.category === 'Chaussures' && p.stock > 0), shoes.map((p) => p.name));
  ok('« robe » : des robes', top('robe').slice(0, 3).every((p) => /robe/i.test(p.name)));
  ok('« montre » : des montres', top('montre').every((p) => p.category === 'Montre'));
  ok('mot inconnu -> aucun resultat', top('helicoptere').length === 0 && top('riz').length === 0);
  ok('jamais un produit en rupture', catalog.filter((p) => p.stock <= 0).every((p) => !top(p.name, 6).some((r) => r.id === p.id)));
  const pr = m.parseNeed('عطر رجالي');
  ok('recherche en arabe « عطر رجالي » : des parfums', top(pr.query).length > 0 && top(pr.query).every((p) => p.category === 'Parfum'), [pr.query, top(pr.query).map((p) => p.name)]);
  const promo = b.promotions(catalog, 4);
  ok('promotions : 4 produits en stock, avec photo, plus forte remise d\'abord', promo.length === 4 && promo.every((p) => p.stock > 0 && p.image), promo.map((p) => p.name));
  ok('les produits ont des tailles et des couleurs lues dans la base', catalog.some((p) => p.sizes.length >= 2) && catalog.some((p) => p.colors.length >= 2), [catalog.filter((p) => p.sizes.length >= 2).length, catalog.filter((p) => p.colors.length >= 2).length]);

  console.log('\n== comprendre le besoin : cadeau ? pour qui ? quel article ? precis ou large ?');
  const need = (t: string) => {
    const p = m.parseNeed(t);
    return { gift: p.gift, who: p.who ?? null, slug: p.slug ?? null, rest: p.rest, broad: m.isBroad(p) };
  };
  const needCases: [string, { gift: boolean; who: string | null; slug: string | null; broad: boolean }][] = [
    ['Je veux faire une cadeau a mon marie', { gift: true, who: 'lui', slug: null, broad: true }],
    ['un cadeau pour mon mari', { gift: true, who: 'lui', slug: null, broad: true }],
    ['cadeau pour ma femme', { gift: true, who: 'elle', slug: null, broad: true }],
    ['idée cadeau', { gift: true, who: null, slug: null, broad: true }],
    ['cadeau pour ma fille', { gift: true, who: 'enfant', slug: null, broad: true }],
    ['un parfum pour ma mère', { gift: false, who: 'elle', slug: 'parfum', broad: true }],
    ['cadeau parfum pour lui', { gift: true, who: 'lui', slug: 'parfum', broad: true }],
    ['chaussures', { gift: false, who: null, slug: 'chaussures', broad: true }],
    ['pour homme', { gift: false, who: 'lui', slug: null, broad: true }],
    ['je cherche pour femme', { gift: false, who: 'elle', slug: null, broad: true }],
    ['montre homme', { gift: false, who: 'lui', slug: 'montre', broad: true }],
    ['robe', { gift: false, who: null, slug: 'vetements-pour-femmes', broad: true }],
    ['sac', { gift: false, who: null, slug: 'sacs-et-bagages', broad: true }],
    ['bébé', { gift: false, who: 'enfant', slug: 'bebe-et-maternite', broad: true }],
    ['rolex', { gift: false, who: null, slug: null, broad: false }],
    ['chaussures noires', { gift: false, who: null, slug: 'chaussures', broad: false }],
    ['montre rolex doree', { gift: false, who: null, slug: 'montre', broad: false }],
    ['cadeau rolex', { gift: true, who: null, slug: null, broad: false }],
    ['helicoptere', { gift: false, who: null, slug: null, broad: false }],
    ['اريد هدية لزوجي', { gift: true, who: 'lui', slug: null, broad: true }],
    ['هدية لزوجتي', { gift: true, who: 'elle', slug: null, broad: true }],
    ['عطر', { gift: false, who: null, slug: 'parfum', broad: true }],
    ['عطر للرجال', { gift: false, who: 'lui', slug: 'parfum', broad: true }],
    ['ساعة رجالية', { gift: false, who: 'lui', slug: 'montre', broad: true }],
    ['حذاء للاطفال', { gift: false, who: 'enfant', slug: 'chaussures', broad: true }],
    ['للنساء', { gift: false, who: 'elle', slug: null, broad: true }],
    ['ساعة rolex', { gift: false, who: null, slug: 'montre', broad: false }],
    ['حذاء اسود', { gift: false, who: null, slug: 'chaussures', broad: false }],
  ];
  for (const [input, exp] of needCases) {
    const got = need(input);
    ok(`besoin « ${input} » -> ${exp.gift ? 'cadeau ' : ''}${exp.who ?? '?'} ${exp.slug ?? '?'} ${exp.broad ? '(large : questions)' : '(precis : produits)'}`, got.gift === exp.gift && got.who === exp.who && got.slug === exp.slug && got.broad === exp.broad, got);
  }
  ok('le budget ecrit ne compte pas comme un mot precis : « chaussures homme moins de 20000 » est large', need('chaussures homme moins de 20000').broad && m.parseNeed('chaussures homme moins de 20000').query === 'chaussures homme');
  ok('arabe : la requete de recherche est ramenee au francais', m.parseNeed('أريد هدية لزوجي').query === 'cadeau mari' && m.parseNeed('عطر اقل من 20000').query === 'parfum', [m.parseNeed('أريد هدية لزوجي').query, m.parseNeed('عطر اقل من 20000').query]);

  console.log('\n== les questions, une a la fois');
  const q = (n: m.Need) => m.nextQuestion(n);
  const qCases: [string, m.Need, string][] = [
    ['cadeau, rien de connu', { gift: true }, 'who'],
    ['cadeau pour lui', { gift: true, who: 'lui' }, 'type'],
    ['cadeau pour lui, montre', { gift: true, who: 'lui', slug: 'montre' }, 'budget'],
    ['cadeau pour lui, « je ne sais pas » deja demande', { gift: true, who: 'lui', typeAsked: true }, 'budget'],
    ['cadeau pour lui, montre, budget donne', { gift: true, who: 'lui', slug: 'montre', budget: { min: 0, max: 20000 } }, 'done'],
    ['cadeau, budget donne d\'avance mais pas pour qui', { gift: true, budget: { min: 0, max: 20000 } }, 'who'],
    ['conseil sans rien', { gift: false }, 'type'],
    ['conseil, « je ne sais pas » deja demande', { gift: false, typeAsked: true }, 'budget'],
    ['chaussures (pour qui ?)', { gift: false, slug: 'chaussures' }, 'who'],
    ['chaussures pour lui', { gift: false, slug: 'chaussures', who: 'lui' }, 'budget'],
    ['robe (pas besoin de demander pour qui)', { gift: false, slug: 'vetements-pour-femmes' }, 'budget'],
    ['sac', { gift: false, slug: 'sacs-et-bagages' }, 'budget'],
    ['pour homme (quel article ?)', { gift: false, who: 'lui' }, 'type'],
    ['pour homme, article demande', { gift: false, who: 'lui', typeAsked: true }, 'budget'],
    ['montre pour lui, budget donne', { gift: false, slug: 'montre', who: 'lui', budget: { min: 0, max: null } }, 'done'],
  ];
  for (const [label, n, expected] of qCases) ok(`question suivante : ${label} -> ${expected}`, q(n) === expected, q(n));
  // jamais deux fois la meme question : on simule les reponses pas a pas
  const steps: string[] = [];
  let sim: m.Need = { gift: true };
  for (let i = 0; i < 6 && m.nextQuestion(sim) !== 'done'; i++) {
    const qq = m.nextQuestion(sim);
    steps.push(qq);
    if (qq === 'who') sim = { ...sim, who: 'lui' };
    else if (qq === 'type') sim = { ...sim, slug: 'montre', typeAsked: true };
    else sim = { ...sim, budget: { min: 0, max: null } };
  }
  ok('cadeau : pour qui -> quel article -> budget -> resultat (3 questions, jamais deux fois la meme)', steps.join(',') === 'who,type,budget', steps);
  ok('le budget d\'un besoin survit au stockage (JSON)', JSON.stringify(m.rangeOfNeed({ gift: false, budget: { min: 30000, max: null } })) === JSON.stringify({ min: 30000, max: null }) || m.rangeOfNeed({ gift: false, budget: { min: 30000, max: null } }).max === Infinity);
  ok('un besoin sans budget = pas de limite', m.rangeOfNeed({ gift: false }).max === Infinity && m.budgetOfRange({ min: 0, max: Infinity }).max === null && m.budgetOfRange({ min: 0, max: 5000 }).max === 5000);

  console.log('\n== les boutons de la question « quel article ? »');
  const choose = (who: l.Who | undefined, gift: boolean, lang: l.Lang = 'fr') => m.typeChoices(catalog, who, gift, lang);
  const slugsOf = (c: { slug: string }[]) => c.map((x) => x.slug).join('|');
  ok('cadeau pour lui : montre, parfum, chaussures, lunettes', slugsOf(choose('lui', true)) === 'montre|parfum|chaussures|lunettes', slugsOf(choose('lui', true)));
  ok('cadeau pour elle : parfum, sacs, vetements femmes, cosmetique', slugsOf(choose('elle', true)) === 'parfum|sacs-et-bagages|vetements-pour-femmes|cosmetique', slugsOf(choose('elle', true)));
  ok('cadeau pour un enfant : jouets, bebe', slugsOf(choose('enfant', true)) === 'velos-pour-enfants-jouets-et-jeux|bebe-et-maternite', slugsOf(choose('enfant', true)));
  ok('achat pour lui : chaussures, montre, parfum, vetements, lunettes', slugsOf(choose('lui', false)) === 'chaussures|montre|parfum|vetements|lunettes', slugsOf(choose('lui', false)));
  ok('sans personne : 6 categories, les plus demandees d\'abord', choose(undefined, false).length === 6 && slugsOf(choose(undefined, false)).startsWith('parfum|chaussures|montre|vetements'), slugsOf(choose(undefined, false)));
  ok('boutons en arabe : noms arabes', choose('lui', true, 'ar').map((c) => c.name).join('|') === 'ساعات|عطور|أحذية|نظارات', choose('lui', true, 'ar').map((c) => c.name));
  ok('chaque bouton est une vraie categorie avec des produits en stock', ['lui', 'elle', 'enfant'].every((w) => [true, false].every((g) => choose(w as l.Who, g).every((c) => catalog.some((p) => p.categorySlug === c.slug && p.stock > 0 && p.price > 0)))));
  ok('toutes les categories de la boutique ont un nom arabe', cats.every((c: any) => !!l.CATEGORY_AR[c.slug]), cats.filter((c: any) => !l.CATEGORY_AR[c.slug]).map((c: any) => c.slug));

  console.log('\n== marketing : budget');
  const rng = (t: string) => { const r = m.parseBudget(t); return r ? `${r.min}-${Number.isFinite(r.max) ? r.max : '∞'}` : null; };
  const budgets: [string, string | null][] = [
    ['20 000', '0-20000'], ['moins de 15000', '0-15000'], ['entre 10 000 et 30 000', '10000-30000'], ['20k', '0-20000'], ['plus de 50 mille', '50000-∞'],
    ['2 montres', null], ['je veux 3 chaussures', null], ["j'ai 25.000 fcfa", '0-25000'], ['de 5000 à 8000', '5000-8000'], ['budget illimité', null], ['', null],
    ['اقل من 20000', '0-20000'], ['بين 10000 و 30000', '10000-30000'], ['اكثر من 50000', '50000-∞'], ['٢٠٠٠٠', '0-20000'], ['ميزانيتي 15 الف', '0-15000'], ['عطر اقل من ٢٥٠٠٠', '0-25000'], ['قطعتين', null],
  ];
  for (const [input, expected] of budgets) ok(`budget « ${input} » -> ${expected}`, rng(input) === expected, rng(input));
  const strips: [string, string][] = [
    ['chaussures homme moins de 20000', 'chaussures homme'], ['montre entre 10 000 et 30 000', 'montre'], ['parfum à partir de 50000 fcfa', 'parfum'],
    ['sac à main moins de 15 000 FCFA', 'sac à main'], ['20000', ''], ['budget 20000', ''], ["jusqu'à 20k", ''], ['robe', 'robe'], ['montre homme', 'montre homme'],
    ['عطر اقل من 20000', 'عطر'], ['عطر أقل من ٢٠٠٠٠', 'عطر'], ['ميزانيتي 15000', ''], ['ساعة بين 10000 و 30000', 'ساعة'],
  ];
  for (const [input, expected] of strips) ok(`sans le budget : « ${input} » -> « ${expected} »`, m.stripBudget(input) === expected, m.stripBudget(input));
  const rt = m.decodeRange(m.encodeRange({ min: 30000, max: Infinity }));
  ok("un budget sans plafond survit a l'envoi dans un bouton", !!rt && rt.min === 30000 && rt.max === Infinity && m.decodeRange('0-10000')!.max === 10000 && m.decodeRange('abc') === null);
  ok('budget en toutes lettres (fr)', /^à moins de 10\s?000 FCFA$/.test(tx.texts('fr').rangeText({ min: 0, max: 10000 })) && /^entre 10\s?000 FCFA et 30\s?000 FCFA$/.test(tx.texts('fr').rangeText({ min: 10000, max: 30000 })) && /^à partir de 100\s?000 FCFA$/.test(tx.texts('fr').rangeText({ min: 100000, max: Infinity })));
  ok('budget en toutes lettres (ar)', /^بأقل من 10\s?000 FCFA$/.test(tx.texts('ar').rangeText({ min: 0, max: 10000 })) && /^بين 10\s?000 FCFA و 30\s?000 FCFA$/.test(tx.texts('ar').rangeText({ min: 10000, max: 30000 })) && /^ابتداء من 100\s?000 FCFA$/.test(tx.texts('ar').rangeText({ min: 100000, max: Infinity })), tx.texts('ar').rangeText({ min: 10000, max: 30000 }));
  ok('4 budgets proposes (fr et ar), du plus petit au plus grand', m.budgetOptions('fr').length === 4 && m.budgetOptions('ar').length === 4 && m.BUDGETS.every((x, i) => i === 0 || m.BUDGETS[i - 1].range.max === x.range.min) && m.budgetOptions('ar')[0].label.includes('أقل من') && m.budgetOptions('ar')[3].label.includes('أكثر من'), m.budgetOptions('ar').map((x) => x.label));

  console.log('\n== marketing : selections de produits (vrai catalogue)');
  const sell = (p: P) => p.stock > 0 && p.price > 0;
  const parfum = m.pickInBudget(catalog, { kind: 'category', slug: 'parfum' }, { min: 10000, max: 30000 }, 4);
  ok('parfum entre 10 000 et 30 000 : 4 produits dans le budget, en stock', parfum.items.length === 4 && !parfum.fallback && parfum.items.every((p) => p.category === 'Parfum' && p.price >= 10000 && p.price <= 30000 && sell(p)), parfum.items.map((p) => [p.name, p.price]));
  const shoesMen = m.pickInBudget(catalog, { kind: 'category', slug: 'chaussures', who: 'lui' }, { min: 0, max: 20000 }, 4);
  ok('chaussures pour lui a moins de 20 000 : des chaussures dans le budget, d\'abord celles pour homme', shoesMen.items.length > 0 && !shoesMen.fallback && shoesMen.items.every((p) => p.category === 'Chaussures' && p.price <= 20000), shoesMen.items.map((p) => [p.name, p.price]));
  const menFirst = m.candidatesFor(catalog, { kind: 'category', slug: 'chaussures', who: 'lui' }).slice(0, 4);
  ok('chaussures pour lui : les produits « homme » passent avant', menFirst.every((p) => /homme|men|man|messieur/i.test(`${p.name} ${p.nameTokens.join(' ')} ${p.descTokens.join(' ')} ${p.colorTokens.join(' ')}`)), menFirst.map((p) => p.name));
  const cheap = m.pickInBudget(catalog, { kind: 'category', slug: 'montre' }, { min: 0, max: 100 }, 4);
  ok('budget trop bas : on montre les moins chers (repli)', cheap.fallback && cheap.items.length === 4 && cheap.items.every((p, i) => i === 0 || cheap.items[i - 1].price <= p.price), cheap.items.map((p) => p.price));
  const rich = m.pickInBudget(catalog, { kind: 'category', slug: 'montre' }, { min: 90000000, max: Infinity }, 4);
  ok('budget trop haut : on montre les plus chers (repli)', rich.fallback && rich.items.length === 4 && rich.items.every((p, i) => i === 0 || rich.items[i - 1].price >= p.price), rich.items.map((p) => p.price));
  const noCtx = m.pickInBudget(catalog, null, { min: 0, max: 10000 }, 4);
  ok('budget sans sujet precis : les meilleures remises dans le budget', noCtx.items.length === 4 && noCtx.items.every((p) => p.price <= 10000 && sell(p)), noCtx.items.map((p) => [p.name, p.price]));

  const gifts = (who: l.Who, slug?: string, range = m.ANY_BUDGET) => m.giftPicks(catalog, who, range, 4, slug);
  const elle = gifts('elle');
  ok('cadeau pour elle : 4 produits varies (2 categories ou plus), en stock, avec photo', elle.length === 4 && new Set(elle.map((p) => p.category)).size >= 2 && elle.every((p) => sell(p) && p.image), elle.map((p) => [p.category, p.name]));
  const lui = gifts('lui');
  ok('cadeau pour lui : 4 produits varies', lui.length === 4 && new Set(lui.map((p) => p.category)).size >= 2 && lui.every((p) => ['Montre', 'Parfum', 'Chaussures', 'Lunettes'].includes(p.category)), lui.map((p) => [p.category, p.name]));
  const kid = gifts('enfant');
  ok('cadeau pour un enfant : bebe ou jouets', kid.length >= 1 && kid.every((p) => ['Bébé et Maternité', 'Vélos pour enfants & Jouets et Jeux'].includes(p.category)), kid.map((p) => [p.category, p.name]));
  const luiMontre = gifts('lui', 'montre');
  ok('cadeau pour lui, une montre : 4 montres', luiMontre.length === 4 && luiMontre.every((p) => p.category === 'Montre' && sell(p)), luiMontre.map((p) => p.name));
  const luiParfum = gifts('lui', 'parfum');
  ok('cadeau pour lui, un parfum : des parfums (pour homme d\'abord)', luiParfum.length === 4 && luiParfum.every((p) => p.category === 'Parfum'), luiParfum.map((p) => p.name));
  const elleSac = gifts('elle', 'sacs-et-bagages');
  ok('cadeau pour elle, un sac : des sacs', elleSac.length > 0 && elleSac.every((p) => p.category === 'Sacs et Bagages'), elleSac.map((p) => p.name));
  const luiAutre = gifts('lui', 'sacs-et-bagages');
  ok('cadeau pour lui, une categorie hors liste : quand meme des produits de cette categorie', luiAutre.length > 0 && luiAutre.every((p) => p.category === 'Sacs et Bagages'), luiAutre.map((p) => p.name));
  const giftCheap = gifts('elle', undefined, { min: 0, max: 10000 });
  ok('cadeau pour elle a moins de 10 000 : tout est dans le budget', giftCheap.every((p) => p.price <= 10000), giftCheap.map((p) => p.price));
  ok('pas de doublon dans un cadeau', new Set(elle.map((p) => p.id)).size === elle.length);
  const whoCtx = m.candidatesFor(catalog, { kind: 'who', who: 'lui' }).slice(0, 4);
  ok('« pour lui » sans article : un peu de tout (2 categories ou plus)', whoCtx.length === 4 && new Set(whoCtx.map((p) => p.category)).size >= 2, whoCtx.map((p) => [p.category, p.name]));
  const giftDay = m.pickInBudget(catalog, { kind: 'gift', who: 'lui', slug: 'montre' }, { min: 0, max: 30000 }, 4);
  ok('cadeau pour lui, montre, moins de 30 000 : dans le budget', giftDay.items.length > 0 && giftDay.items.every((p) => p.price <= 30000 && p.category === 'Montre'), giftDay.items.map((p) => [p.name, p.price]));

  console.log('\n== alternatives moins cheres (« c\'est cher »)');
  const shown = m.pickInBudget(catalog, { kind: 'category', slug: 'parfum' }, { min: 30000, max: 100000 }, 4).items;
  const alts = m.cheaperOptions(catalog, { kind: 'category', slug: 'parfum' }, shown.map((p) => p.price), 3);
  const minShown = Math.min(...shown.map((p) => p.price));
  ok('parfums montres 30 000-100 000 : des parfums au moins 10 % moins chers', alts.length > 0 && alts.every((p) => p.category === 'Parfum' && p.price < minShown * 0.9 && sell(p)), [minShown, alts.map((p) => [p.name, p.price])]);
  const cheapest = [...catalog].filter((p) => p.categorySlug === 'parfum' && sell(p)).sort((a, c) => a.price - c.price)[0];
  ok('rien de moins cher que le moins cher de la categorie -> liste vide (Zara le dit honnetement)', m.cheaperOptions(catalog, { kind: 'category', slug: 'parfum' }, [cheapest.price], 3).length === 0 && m.cheaperOptions(catalog, null, [], 3).length === 0);
  ok('sans sujet : alternatives prises dans les promotions', m.cheaperOptions(catalog, null, [90000000], 3).every((p) => !!p.compareAt));

  console.log('\n== produits qui se completent');
  const pair = (slug: string, lang: l.Lang = 'fr') => m.crossSellTarget(catalog, slug, lang);
  ok('a completer : chaussures -> sacs et bagages, montre -> parfum, bebe -> jouets', pair('chaussures')?.name === 'Sacs et Bagages' && pair('montre')?.name === 'Parfum' && pair('bebe-et-maternite')?.name === 'Vélos pour enfants & Jouets et Jeux', [pair('chaussures'), pair('montre'), pair('bebe-et-maternite')]);
  ok('a completer en arabe : montre -> عطور', pair('montre', 'ar')?.name === 'عطور', pair('montre', 'ar'));
  ok('a completer : rien pour une categorie sans suggestion', pair('voiture') === null && pair('inconnue') === null);
  ok('categorie dominante des resultats', m.dominantSlug(top('chaussures homme')) === 'chaussures' && m.dominantSlug([]) === '');

  console.log('\n== raisons vraies (jamais inventees)');
  const base = catalog.find((p) => sell(p))!;
  const fake = (over: Partial<P>): P => ({ ...base, name: 'Rolex dorée', price: 12500, compareAt: 25000, stock: 3, colors: [], sizes: [], ...over });
  const why = (p: P, range = m.ANY_BUDGET, lang: l.Lang = 'fr', cheapest = false) => m.whyReasons(p, range, lang, cheapest);
  const w1 = why(fake({}));
  ok('remise vraie (50 %) + stock bas vrai (3)', w1.length === 2 && /50 % de remise/.test(w1[0]) && /12\s?500 FCFA au lieu de 25\s?000 FCFA/.test(w1[0]) && /plus que 3 en stock/.test(w1[1]), w1);
  ok('produit sans remise, stock normal, une couleur, pas de taille : seulement « en stock » (rien d\'invente)', JSON.stringify(why(fake({ compareAt: null, stock: 40, colors: ['Noir'], sizes: [] }))) === JSON.stringify(['en stock']), why(fake({ compareAt: null, stock: 40, colors: ['Noir'] })));
  ok('petite remise (< 10 %) : pas citee', !why(fake({ compareAt: 13000, stock: 40 })).some((r) => /%/.test(r)));
  ok('couleurs et tailles reelles citees', why(fake({ compareAt: null, stock: 40, colors: ['Noir', 'Blanc', 'Bleu', 'Rouge'], sizes: ['40', '41', '42'] })).join(' ').includes('disponible en Noir, Blanc, Bleu') && why(fake({ compareAt: null, stock: 40, colors: ['Noir', 'Blanc'], sizes: ['40', '41', '42'] })).join(' ').includes('tailles : 40, 41, 42'));
  ok('« dans votre budget » seulement si le prix y est vraiment', why(fake({ compareAt: null, stock: 40 }), { min: 0, max: 20000 }).includes('dans votre budget') && !why(fake({ compareAt: null, stock: 40 }), { min: 0, max: 10000 }).includes('dans votre budget') && !why(fake({ compareAt: null, stock: 40 }), m.ANY_BUDGET).includes('dans votre budget'));
  ok('« le plus abordable » seulement pour les alternatives moins cheres', why(fake({ compareAt: null, stock: 40 }), m.ANY_BUDGET, 'fr', true).includes('le plus abordable de la sélection') && !why(fake({ compareAt: null, stock: 40 })).includes('le plus abordable de la sélection'));
  ok('au plus 3 raisons', why(fake({ stock: 2, colors: ['a', 'b'], sizes: ['1', '2'] }), { min: 0, max: 20000 }).length === 3);
  const advFr = m.whyAdvice(fake({}), m.ANY_BUDGET, 'fr');
  const advAr = m.whyAdvice(fake({}), m.ANY_BUDGET, 'ar');
  ok('conseil en francais : « Mon conseil{nom} : « Rolex dorée » — ... »', /^Mon conseil\{nom\} : « Rolex dorée » — 50 % de remise : 12\s?500 FCFA au lieu de 25\s?000 FCFA · plus que 3 en stock\.$/.test(advFr), advFr);
  ok('conseil en arabe : « نصيحتي{nom}: «Rolex dorée» — ... »', /^نصيحتي\{nom\}: «Rolex dorée» — خصم 50 %/.test(advAr) && /بدل/.test(advAr) && /بقي 3 فقط/.test(advAr), advAr);
  ok('le nom du produit trop long est raccourci', m.whyAdvice(fake({ name: 'A'.repeat(100) }), m.ANY_BUDGET).includes('…'));

  console.log('\n== textes de vente (fr + ar)');
  ok('stock bas (3) : fr et ar', /plus que 3 en stock/.test(m.lowStockLine([fake({ stock: 3 })]) ?? '') && /بقي 3 فقط/.test(m.lowStockLine([fake({ stock: 3 })], 'ar') ?? ''));
  ok('stock a 1', /qu’un en stock/.test(m.lowStockLine([fake({ stock: 1 })]) ?? '') && /قطعة واحدة فقط/.test(m.lowStockLine([fake({ stock: 1 })], 'ar') ?? ''));
  ok('stock normal (10) ou rupture : aucune urgence affichee', m.lowStockLine([fake({ stock: 10 })]) === null && m.lowStockLine([fake({ stock: 0 })]) === null && m.lowStockLine([]) === null && m.lowStockLine([], 'ar') === null);
  ok('la rarete la plus forte est annoncee', /Cartier/.test(m.lowStockLine([fake({ stock: 4, name: 'Rolex dorée' }), fake({ stock: 2, name: 'Cartier' })]) ?? ''));
  const maxPct = m.maxDiscountPct(catalog);
  ok('plus forte remise du catalogue : un entier entre 5 et 90', maxPct !== null && Number.isInteger(maxPct) && maxPct >= 5 && maxPct <= 90, maxPct);
  const pitch = m.productPitch(fake({ stock: 3 }));
  ok('fiche produit regardee (fr) : prix barre, -50 %, stock, « Acheter »', /12\s?500 FCFA au lieu de 25\s?000 FCFA \(-50 %\)/.test(pitch) && /Plus que 3 en stock/.test(pitch) && /« Acheter »/.test(pitch), pitch);
  const pitchAr = m.productPitch(fake({ stock: 3 }), 'ar');
  ok('fiche produit regardee (ar) : prix barre, -50 %, stock, Acheter', /بدل 25\s?000 FCFA \(-50 %\)/.test(pitchAr) && /بقي 3 فقط/.test(pitchAr) && /Acheter/.test(pitchAr), pitchAr);
  ok('fiche sans remise ni rarete : ni « au lieu de » ni « plus que »', !/au lieu de|Plus que|qu’un/.test(m.productPitch(fake({ compareAt: null, stock: 40 }))));
  ok('panier : nombre d\'articles et total (fr et ar)', /2 articles pour 25\s?000 FCFA/.test(m.cartReminder(2, 25000)) && /1 article pour/.test(m.cartReminder(1, 5000)) && /25\s?000 FCFA/.test(m.cartReminder(2, 25000, 'ar')) && /سلتك/.test(m.cartReminder(2, 25000, 'ar')));
  ok("objection de prix (fr) : promotions (jusqu'a -50 %), budget, livraison gratuite a N'Djamena", /jusqu’à -50 %/.test(m.priceReply(50)) && !/jusqu’à/.test(m.priceReply(null)) && /Djamena, la livraison est gratuite/.test(m.priceReply(50)));
  ok('objection de prix (ar)', /حتى -50 %/.test(m.priceReply(50, 'ar')) && /ميزانيتك/.test(m.priceReply(50, 'ar')) && /مجاني/.test(m.priceReply(50, 'ar')));
  const trust = m.trustReply({ address: 'Marché Central', city: "N'Djamena", phone: '+23560605151' });
  ok('confiance (fr) : « première plateforme de vente en ligne du Tchad, depuis 2013 », Service Qualite Garantie, adresse, telephone', /première plateforme de vente en ligne du Tchad, depuis 2013/.test(trust) && /Service, Qualité, Garantie/.test(trust) && /ne payez qu’en recevant/.test(trust) && /Marché Central, N'Djamena/.test(trust) && /\+235 60 60 51 51/.test(trust), trust);
  const trustAr = m.trustReply({ address: 'Marché Central', city: "N'Djamena", phone: '+23560605151' }, 'ar');
  ok('confiance (ar) : أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013', /أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013/.test(trustAr) && /خدمة، جودة، ضمان/.test(trustAr) && /\+235 60 60 51 51/.test(trustAr), trustAr);
  ok('confiance sans donnees : le message reste complet', /Service, Qualité, Garantie/.test(m.trustReply({})) && !/📍|📞/.test(m.trustReply({})));
  ok('a propos (fr + ar) : premiere plateforme, depuis 2013 (l\'entreprise, pas l\'assistante)', /première plateforme de vente en ligne du Tchad/.test(m.aboutReply()) && /depuis 2013/.test(m.aboutReply()) && /2013/.test(m.aboutReply('ar')) && /أول منصة/.test(m.aboutReply('ar')) && !/10 ans/.test(m.aboutReply() + m.aboutReply('ar') + trust));
  const ret = m.returnsReply();
  ok('retours (fr) : 72 h, photo ou video, frais a notre charge si article incorrect, echange de taille a la charge du client, garder l\'emballage', /72 h/.test(ret) && /photo ou une vidéo/.test(ret) && /frais de retour sont à notre charge/.test(ret) && /échange possible/.test(ret) && /à votre charge/.test(ret) && /emballage d’origine/.test(ret), ret);
  const retAr = m.returnsReply('ar');
  ok('retours (ar) : 72 heures, photo ou video, echange de taille', /72 ساعة/.test(retAr) && /صورة أو فيديو/.test(retAr) && /الاستبدال/.test(retAr) && /عبوته الأصلية/.test(retAr), retAr);
  ok('numero de telephone formate', m.formatPhone('+23560605151') === '+235 60 60 51 51' && m.formatPhone('60605151') === '+235 60 60 51 51' && m.formatPhone(null) === null);
  ok('emballage cadeau (fr) : 2 000 FCFA par commande, image cadeau, Mes commandes', /2\s?000 FCFA par commande/.test(m.giftWrapReply()) && /image cadeau/.test(m.giftWrapReply()) && /Mes commandes/.test(m.giftWrapReply()));
  ok('emballage cadeau (ar) : 2 000 FCFA par commande, image cadeau', /2\s?000 FCFA/.test(m.giftWrapReply('ar')) && /صورة الهدية/.test(m.giftWrapReply('ar')) && /طلباتي/.test(m.giftWrapReply('ar')), m.giftWrapReply('ar'));
  ok('cadeau : phrase qui propose l\'emballage a 2 000 FCFA (fr + ar)', /emballage cadeau à 2\s?000 FCFA par commande/.test(m.giftWrapPitch()) && /تغليف الهدايا بـ 2\s?000 FCFA/.test(m.giftWrapPitch('ar')));
  ok('« plus tard » : on garde la porte ouverte (favoris), fr et ar', /favoris/.test(m.laterReply()) && /\{nom\}/.test(m.laterReply()) && /مفضلتك/.test(m.laterReply('ar')));
  ok('phrases d\'encouragement : 8 differentes, elles tournent, en fr et en ar', new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => b.encouragement(i))).size === 8 && b.encouragement(8) === b.encouragement(0) && new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => b.encouragement(i, 'ar'))).size === 8);
  ok('phrases d\'encouragement : aucune fausse promesse (pas de « dernier », « plus que », pourcentage)', [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !/dernier|plus que|%/.test(b.encouragement(i))));

  console.log('\n== noms et ponctuation selon la langue');
  ok('{nom} -> « , Ali » en francais et « ، Ali » en arabe', tx.withName('fr', 'Bonjour{nom} !', 'Ali') === 'Bonjour, Ali !' && tx.withName('ar', 'مرحبا{nom}!', 'علي') === 'مرحبا، علي!' && tx.withName('fr', 'Bonjour{nom} !', null) === 'Bonjour !' && tx.withName('ar', 'مرحبا{nom}!', null) === 'مرحبا!');
  ok('nom de categorie selon la langue', tx.categoryLabel('ar', 'parfum', 'Parfum') === 'عطور' && tx.categoryLabel('fr', 'parfum', 'Parfum') === 'Parfum' && tx.categoryLabel('ar', 'inconnue', 'Divers') === 'Divers');
  ok('accueil : meme texte que l\'exemple du patron (fr), avec le prenom, le rang du jour et l\'invitation', tx.texts('fr').welcome('Moussa', 3, false) === 'Salut Moussa ! 😍👋 Bienvenue chez Albasse Shopping ! Vous êtes mon 3ᵉ client aujourd’hui, ça me fait plaisir de vous accueillir ! 🥰🛍️\nDites-moi, qu’est-ce qui vous ferait plaisir aujourd’hui ? Je suis là pour vous aider à trouver les meilleurs articles ! ❤️', tx.texts('fr').welcome('Moussa', 3, false));
  ok('accueil sans rang connu : aucune phrase sur le nombre de clients (jamais de nombre invente)', !/client aujourd/.test(tx.texts('fr').welcome('Moussa', null, false)) && /^Salut Moussa ! 😍👋 Bienvenue chez Albasse Shopping ! Ça me fait plaisir de vous accueillir ! 🥰🛍️/.test(tx.texts('fr').welcome('Moussa', null, false)) && !/\d/.test(tx.texts('ar').welcome('علي', null, false)) && !/\d/.test(tx.texts('fr').welcome(null, null, false)), [tx.texts('fr').welcome('Moussa', null, false), tx.texts('ar').welcome('علي', null, false)]);
  ok('accueil : 1ᵉʳ, 2ᵉ, 3ᵉ, 12ᵉ, 237ᵉ client ; sans prenom : « Salut ! »', tx.ordinalFr(1) === '1ᵉʳ' && tx.ordinalFr(2) === '2ᵉ' && tx.ordinalFr(12) === '12ᵉ' && tx.texts('fr').welcome(null, 1, false).includes('mon 1ᵉʳ client aujourd’hui') && tx.texts('fr').welcome(null, 237, false).includes('mon 237ᵉ client aujourd’hui') && tx.texts('fr').welcome(null, 3, false).startsWith('Salut ! 😍👋'));
  ok('accueil (ar) : prenom, rang du jour, invitation', tx.texts('ar').welcome('علي', 3, false) === 'مرحباً علي! 😍👋 أهلاً بك في Albasse Shopping! أنت رقم 3 بين عملائي اليوم، ويسعدني استقبالك! 🥰🛍️\nما الذي يسعدك اليوم؟ أنا هنا لمساعدتك في إيجاد أفضل المنتجات! ❤️', tx.texts('ar').welcome('علي', 3, false));
  ok('si le prenom a deja ete dit dans le 1er message : pas de second « Salut » ni de second prenom', !/Salut|Moussa/.test(tx.texts('fr').welcome('Moussa', 3, true)) && tx.texts('fr').welcome('Moussa', 3, true).startsWith('Bienvenue chez Albasse Shopping ! Vous êtes mon 3ᵉ client') && !/مرحباً|علي/.test(tx.texts('ar').welcome('علي', 3, true)) && tx.texts('ar').welcome('علي', 3, true).startsWith('أهلاً بك في Albasse Shopping!'));
  ok('chaque langue a son sens d\'ecriture', tx.texts('fr').dir === 'ltr' && tx.texts('ar').dir === 'rtl');
  ok('inconnue -> francais', tx.texts('xx' as l.Lang).dir === 'ltr');

  console.log('\n== client avec compte : salutation par le prenom (fr et ar)');
  const fr = tx.texts('fr');
  const ar = tx.texts('ar');
  ok('1er message (avant le choix de la langue) : « Salut Ahmed ! 😍👋 » et « مرحباً Ahmed! 😍👋 »', fr.hello('Ahmed') === 'Salut Ahmed ! 😍👋' && ar.hello('Ahmed') === 'مرحباً Ahmed! 😍👋', [fr.hello('Ahmed'), ar.hello('Ahmed')]);
  ok('client qui se connecte pendant la conversation : accueilli par son prenom (fr et ar)', fr.memberBack('Ahmed') === 'Salut Ahmed ! 😍👋 Vous êtes bien connecté(e), ça me fait plaisir de vous retrouver ! 🥰' && /Ahmed/.test(ar.memberBack('Ahmed')) && l.hasArabic(ar.memberBack('Ahmed')) && /يسعدني/.test(ar.memberBack('Ahmed')), [fr.memberBack('Ahmed'), ar.memberBack('Ahmed')]);
  ok('bulle du bouton pour le client avec compte (fr et ar)', fr.teaserMember('Ahmed') === 'Salut Ahmed ! 😍👋 Zara Kings est à votre service 🛍️' && /Ahmed/.test(ar.teaserMember('Ahmed')) && l.hasArabic(ar.teaserMember('Ahmed')), [fr.teaserMember('Ahmed'), ar.teaserMember('Ahmed')]);
  ok('installation : la question « Avez-vous deja installe l\'application ? » existe en fr et ar, avec la photo (texte + alternative) et « Oui, deja installee »', (() => { const f = tx.texts('fr'), a = tx.texts('ar'); return /^Avez-vous déjà installé l’application Albasse Shopping sur votre téléphone \?/.test(f.install.ask) && l.hasArabic(a.install.ask) && /Albasse Shopping/.test(a.install.ask) && !l.hasArabic(f.install.ask) && /agrandir/.test(f.install.photoHint) && l.hasArabic(a.install.photoHint) && /Partager/.test(f.install.photoAlt) && l.hasArabic(a.install.photoAlt) && f.chip.alreadyInstalled === '✅ Oui, déjà installée' && l.hasArabic(a.chip.alreadyInstalled) && f.chip.installHelp === '📲 Voir comment installer' && l.hasArabic(a.chip.installHelp) && l.hasArabic(a.install.yes) && /Parfait, merci/.test(f.install.yes); })());
  ok('installation du raccourci : le nom est « Albasse Shopping » (avec l\'espace, comme l\'application) dans les textes fr et ar', (() => { const f = tx.texts('fr'), a = tx.texts('ar'); return [f.chip.installApp, f.install.offer, f.install.accepted, f.install.already, a.chip.installApp, a.install.offer, a.install.accepted, a.install.already].every((t) => /Albasse Shopping/.test(t) && !/AlbasseShopping/.test(t)); })());
  ok('client connecte dont le compte n\'a pas de prenom : Zara voit qu\'il est connecte et ne l\'invite jamais a se connecter (fr et ar)', /connecté/.test(fr.askNameMember) && /\?/.test(fr.askNameMember) && !/connectez-vous|Me connecter|déjà un compte/.test(fr.askNameMember) && l.hasArabic(ar.askNameMember) && !l.hasArabic(fr.askNameMember) && !/[A-Za-z]/.test(ar.askNameMember) && !/سجّل الدخول وسأتعرف/.test(ar.askNameMember), [fr.askNameMember, ar.askNameMember]);
  ok('visiteur sans compte : on lui propose aussi de se connecter pour etre reconnu (fr et ar)', /déjà un compte/.test(fr.askNameGuest) && /reconnaîtrai/.test(fr.askNameGuest) && l.hasArabic(ar.askNameGuest) && !l.hasArabic(fr.askNameGuest) && fr.askName === 'Comment puis-je vous appeler ?', [fr.askNameGuest, ar.askNameGuest]);
  ok('aucune fausse promesse dans les salutations (ni prix, ni stock, ni pourcentage, ni « commande confirmee »)', [fr.hello('Ahmed'), fr.memberBack('Ahmed'), fr.teaserMember('Ahmed'), ar.memberBack('Ahmed'), ar.teaserMember('Ahmed')].every((s) => !/%|FCFA|stock|remise|confirm|-\s?\d/i.test(s)));

  console.log('\n== personnalite : variantes, honnetete, pas de faux numero');
  const frKinds = { hello: ['hello', 'evening', 'hi', 'salam', 'morning'] as const, goodbye: ['night', 'evening', 'day', 'plain'] as const, personal: ['address', 'live', 'phone', 'whatsapp', 'call', 'life'] as const };
  for (const lang of ['fr', 'ar'] as const) {
    const T = tx.texts(lang);
    const groups: [string, string[]][] = [
      ...frKinds.hello.flatMap((k) => [[`salutation ${k} (${lang})`, T.talk.hello(k, true)], [`salutation ${k} inconnu (${lang})`, T.talk.hello(k, false)]] as [string, string[]][]),
      ...frKinds.goodbye.map((k) => [`au revoir ${k} (${lang})`, T.talk.goodbye(k)] as [string, string[]]),
      ...frKinds.personal.map((k) => [`vie perso ${k} (${lang})`, T.talk.personal(k)] as [string, string[]]),
      [`ca va (${lang})`, T.talk.fine], [`merci (${lang})`, T.talk.thanks], [`merci beaucoup (${lang})`, T.talk.thanksMuch], [`apres un compliment (${lang})`, T.talk.afterCompliment], [`compliment (${lang})`, T.talk.compliment],
    ];
    ok(`${lang} : chaque situation a au moins 2 phrases differentes (Zara ne se repete pas)`, groups.every(([, lines]) => lines.length >= 2 && new Set(lines).size === lines.length), groups.filter(([, lines]) => lines.length < 2 || new Set(lines).size !== lines.length).map(([k]) => k));
    ok(`${lang} : aucune phrase ne cite de numero, de prix ou de pourcentage (rien d'invente)`, groups.every(([, lines]) => lines.every((l) => !/\d{3,}|\+\d|%|FCFA/.test(l))), groups.filter(([, lines]) => lines.some((l) => /\d{3,}|\+\d|%|FCFA/.test(l))).map(([k]) => k));
    const personal = frKinds.personal.flatMap((k) => T.talk.personal(k));
    ok(`${lang} : Zara ne pretend jamais avoir un domicile, un numero, un mari ou des enfants`, personal.every((l) => !/j['’]habite|ma maison|mon (mari|numéro|whatsapp|adresse|domicile)|mes enfants|ma famille|أسكن في|(^|\s)(منزلي|زوجي|أولادي|رقمي|عنواني)(\s|$)/.test(l)), personal);
    ok(`${lang} : Zara dit qu'elle est une assistante virtuelle quand on lui parle de sa vie`, frKinds.personal.every((k) => T.talk.personal(k).every((l) => (lang === 'fr' ? /assistante virtuelle/ : /مساعدتك الافتراضية|مساعدة افتراضية/).test(l))), frKinds.personal.map((k) => T.talk.personal(k)[0]));
    ok(`${lang} : adresse -> renvoie vers le bouton de la boutique ; numero -> vers le bouton WhatsApp officiel`, T.talk.personal('address').every((l) => /\n/.test(l)) && ['phone', 'whatsapp', 'call'].every((k) => T.talk.personal(k as 'phone').every((l) => /\n/.test(l))));
  }
  ok('salut a quelqu\'un deja connu : « retrouver » ; a un inconnu : pas de « retrouver » (on ne pretend pas le connaitre)', tx.texts('fr').talk.hello('hi', true).every((l) => /retrouver|revoir/.test(l)) && tx.texts('fr').talk.hello('hi', false).every((l) => !/retrouver|revoir/.test(l)));
  ok('bonsoir -> bonsoir ; salam -> salam ; bonjour -> bonjour (meme ton que le client)', tx.texts('fr').talk.hello('evening', false).every((l) => /^Bonsoir/.test(l)) && tx.texts('fr').talk.hello('salam', false).every((l) => /salam/i.test(l)) && tx.texts('fr').talk.hello('hello', false).every((l) => /^Bonjour/.test(l)));
  ok('mots d\'accueil : « Bonsoir ! », « Salut ! », « Salam ! », « Bonjour ! » (et en arabe)', tx.texts('fr').talk.helloWord('evening') === 'Bonsoir !' && tx.texts('fr').talk.helloWord('hi') === 'Salut !' && tx.texts('fr').talk.helloWord('salam') === 'Salam !' && tx.texts('fr').talk.helloWord('hello') === 'Bonjour !' && tx.texts('ar').talk.helloWord('salam') === 'وعليكم السلام!' && tx.texts('ar').talk.helloWord('evening') === 'مساء الخير!');
  ok('les phrases d\'exemple du patron sont la (compliment, adresse, numero)', tx.texts('fr').talk.compliment[0] === 'Oh, merci beaucoup ! 🥰 Vous êtes adorable ! Je suis votre assistante virtuelle Zara, toujours là pour vous aider 😊❤️🛍️' && !/sourire/.test(tx.texts('fr').talk.compliment.join(' ')) && !/ابتسامة/.test(tx.texts('ar').talk.compliment.join(' ')) && tx.texts('fr').talk.afterCompliment[0].startsWith('Avec grand plaisir ! 😊❤️ Je suis toujours là pour vous aider.') && tx.texts('fr').talk.personal('address')[0].startsWith('😊 Je suis votre assistante virtuelle, disponible en ligne pour vous aider ! Vous pouvez me retrouver ici sur Albasse Shopping.') && tx.texts('fr').talk.personal('phone')[0].startsWith('😊 Je n’ai pas de numéro personnel. Je travaille en ligne comme assistante virtuelle de marketing digital chez Albasse Shopping. Je suis là pour vous aider directement ici !') && tx.texts('fr').talk.personal('whatsapp')[0].startsWith('Haha 😊 Je n’ai pas de WhatsApp personnel.') && tx.texts('fr').talk.personal('live')[0].startsWith('Haha 😊 Je n’ai pas de domicile comme une personne.'));

  console.log('\n== textes arabes : tout en arabe (sauf les noms propres et les boutons du site)');
  const ALLOWED = /Albasse|Shopping|Airtel|Moov|Money|FCFA|Acheter|Ajouter|panier|Voir|produit|le\b|au|N'Djamena|Mongo|Rolex|dorée|Test|STTL|Sud|Voyage|Abou|Aziza|Liberté|Abéché|Français|Chrome|Safari|Samsung|Internet|albasseshopping\.com/g;
  const sampleArgs: Record<string, unknown[]> = {
    welcome: ['علي', 3, false], teaser: ['علي'], hello: ['علي'], nice: ['علي'], 'card.only': [3], 'chip.withCategory': ['عطور'], promoIntro: [50], foundFor: ['عطر', 'بأقل من 10 000 FCFA'], fallbackFor: ['عطر', 'بأقل من 10 000 FCFA'],
    nothingFor: ['عطر'], askWho: [true], askType: ['lui', true], giftIntro: ['lui'], pairIntro: ['عطور'], rangeText: [{ min: 0, max: 10000 }], lowStock: ['ساعة', 3], pitch: ['ساعة', '10 000 FCFA', 3],
    cartReminder: [2, 25000], priceReply: [50], trust: ['السوق المركزي', '+235 60 60 51 51'], whyAdvice: ['ساعة', ['سبب']], 'why.discount': [50, 12500, 25000], 'why.lowStock': [3],
    'why.colors': ['أسود'], 'why.sizes': ['40'], cityNotFound: ['سار'], cityFee: ['موندو', '2 500 FCFA', null], cityNoFee: ['موندو', null], serviceNote: [true], 'contact.hours': ['8:00'],
    budgetBest: ['بأقل من 10 000 FCFA'], budgetFallback: ['بأقل من 10 000 FCFA'],
    'loyalty.mine': [{ points: 30, tier: 'argent', next: { key: 'or', missing: 20 } }], 'loyalty.orderPoints': [5],
    'checkout.askPay': [true], 'checkout.methodLabel': ['airtel_money'], 'checkout.recap': [{ lines: [{ name: 'ساعة', variant: '', qty: 2, subtotal: 25000 }], city: 'موندو', fee: 2500, gift: true, total: 37500, name: 'علي', phone: '66123456', address: 'حي فرشا', method: 'airtel_money' }],
    'checkout.placed': ['علي', '12345678'], 'checkout.totalToPay': [37500], 'checkout.payInitiated': ['Airtel Money', 'تم'], 'checkout.payUrl': ['https://pay.example.com'], 'checkout.payNumber': [37500, '60 60 51 51', 'Airtel Money'], 'checkout.payTeam': ['66123456', 'Airtel Money'], 'chip.useAddress': ['حي فرشا'],
    'cart.added': ['ساعة', ' (المقاس 41)', 2, 25000], 'cart.priceChanged': ['ساعة', '10 000 FCFA', '12 000 FCFA'], 'install.iosSteps': [false],
    'interest.sizesReply': ['حذاء', ['40', '41']], 'interest.colorsReply': ['حذاء', ['أسود'], ['40']], 'wholesale.prefill': ['عطر'],
    'callback.confirm': ['علي', '66 12 34 56', 'ساعة', 'الخميس 22 أكتوبر'], 'callback.done': ['الخميس 22 أكتوبر'],
    'chip.take': ['ساعة'], 'persona.ranges.deal': ['ساعة', '12 500 FCFA'], 'persona.ranges.favorite': ['عطر', '18 000 FCFA'], 'persona.ranges.premium': ['حذاء', '45 000 FCFA'],
    'persona.compare.line': ['ساعة', '12 500 FCFA', ['لونان', 'المقاسات 40, 41']], 'persona.compare.cheaper': ['ساعة', '2 500 FCFA'], 'persona.compare.moreChoice': ['ساعة'],
    'persona.compare.colors': [3], 'persona.compare.sizes': ['40, 41'], 'persona.loyal.points': [30, 'argent', 20, 'or'], 'closing.proof': [5], 'closing.pack': ['ساعة', 'عطر', 25000],
    categoryIntro: ['ساعات', 12], categoryMore: ['ساعات', 7, 12, 12], 'chip.categoryPage': ['ساعات'],
  };
  const leaks: string[] = [];
  let count = 0;
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (path === 'dir') return;
      count++;
      const rest = node.replace(/\{nom\}/g, '').replace(/https?:\/\/\S+/g, '').replace(ALLOWED, '');
      const latin = rest.match(/[A-Za-zÀ-ÿ]{3,}/g);
      if (latin) leaks.push(`${path}: ${latin.join(',')}`);
    } else if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (typeof node === 'function') walk((node as (...a: unknown[]) => unknown)(...(sampleArgs[path] ?? ['علي', 5, true])), `${path}()`);
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(tx.texts('ar'), '');
  for (const d of [{ points: 0, tier: 'bronze', next: { key: 'argent', missing: 25 } }, { points: 37, tier: 'argent', next: { key: 'or', missing: 13 } }, { points: 120, tier: 'diamond', next: null }] as const) walk(tx.texts('ar').loyalty.mine({ ...d, next: d.next ? { ...d.next } : null } as never), `loyalty.mine(${d.points})`);
  // toutes les variantes de la conversation (la visite ci-dessus ne voit que la variante par defaut de chaque texte)
  const arTalk = tx.texts('ar').talk;
  for (const k of ['hello', 'evening', 'hi', 'salam', 'morning'] as const) { walk(arTalk.hello(k, true), `talk.hello(${k},known)`); walk(arTalk.hello(k, false), `talk.hello(${k})`); }
  for (const k of ['night', 'evening', 'day', 'plain'] as const) walk(arTalk.goodbye(k), `talk.goodbye(${k})`);
  for (const k of ['address', 'live', 'phone', 'whatsapp', 'call', 'life'] as const) walk(arTalk.personal(k), `talk.personal(${k})`);
  ok(`aucun mot francais oublie dans les ${count} textes arabes`, leaks.length === 0, leaks);
  let frCount = 0;
  const frArabic: string[] = [];
  const walkFr = (node: unknown, path: string) => {
    if (typeof node === 'string') { frCount++; if (l.hasArabic(node) && !/العربية|^Français$/.test(node) && path !== 'ui.otherLang' && path !== 'chip.otherLang') frArabic.push(path); }
    else if (Array.isArray(node)) node.forEach((x, i) => walkFr(x, `${path}[${i}]`));
    else if (typeof node === 'function') walkFr((node as (...a: unknown[]) => unknown)(...(sampleArgs[path] ?? ['Ali', 5, true])), `${path}()`);
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walkFr(v, path ? `${path}.${k}` : k);
  };
  const frSample: Record<string, unknown[]> = {
    welcome: ['Ali', 3, false], teaser: ['Ali'], hello: ['Ali'], nice: ['Ali'], 'card.only': [3], 'chip.withCategory': ['Parfum'], promoIntro: [50], foundFor: ['parfum', 'à moins de 10 000 FCFA'], fallbackFor: ['parfum', 'à moins de 10 000 FCFA'],
    nothingFor: ['parfum'], askWho: [true], askType: ['lui', true], giftIntro: ['lui'], pairIntro: ['Parfum'], rangeText: [{ min: 0, max: 10000 }], lowStock: ['Montre', 3], pitch: ['Montre', '10 000 FCFA', 3],
    cartReminder: [2, 25000], priceReply: [50], trust: ['Marché Central', '+235 60 60 51 51'], whyAdvice: ['Montre', ['raison']], 'why.discount': [50, 12500, 25000], 'why.lowStock': [3],
    'why.colors': ['noir'], 'why.sizes': ['40'], cityNotFound: ['Sarh'], cityFee: ['Moundou', '2 500 FCFA', null], cityNoFee: ['Moundou', null], serviceNote: [true], 'contact.hours': ['8h'],
    budgetBest: ['à moins de 10 000 FCFA'], budgetFallback: ['à moins de 10 000 FCFA'],
    'loyalty.mine': [{ points: 30, tier: 'argent', next: { key: 'or', missing: 20 } }], 'loyalty.orderPoints': [5],
    'checkout.askPay': [true], 'checkout.methodLabel': ['airtel_money'], 'checkout.recap': [{ lines: [{ name: 'Montre', variant: '', qty: 2, subtotal: 25000 }], city: 'Moundou', fee: 2500, gift: true, total: 37500, name: 'Ali', phone: '66123456', address: 'Farcha', method: 'airtel_money' }],
    'checkout.placed': ['Ali', 'ABCD1234'], 'checkout.totalToPay': [37500], 'checkout.payInitiated': ['Airtel Money', 'ok'], 'checkout.payUrl': ['https://pay.example.com'], 'checkout.payNumber': [37500, '60 60 51 51', 'Airtel Money'], 'checkout.payTeam': ['66123456', 'Airtel Money'], 'chip.useAddress': ['Farcha'],
    'interest.sizesReply': ['Sandale', ['40', '41']], 'interest.colorsReply': ['Sandale', ['Noir'], ['40']], 'wholesale.prefill': ['Parfum'],
    categoryIntro: ['Montre', 12], categoryMore: ['Montre', 7, 12, 12], 'chip.categoryPage': ['Montre'],
  };
  for (const k of Object.keys(sampleArgs)) delete sampleArgs[k];
  Object.assign(sampleArgs, frSample);
  walkFr(tx.texts('fr'), '');
  for (const d of [{ points: 0, tier: 'bronze', next: { key: 'argent', missing: 25 } }, { points: 37, tier: 'argent', next: { key: 'or', missing: 13 } }, { points: 120, tier: 'diamond', next: null }] as const) walkFr(tx.texts('fr').loyalty.mine({ ...d, next: d.next ? { ...d.next } : null } as never), `loyalty.mine(${d.points})`);
  const frTalk = tx.texts('fr').talk;
  for (const k of ['hello', 'evening', 'hi', 'salam', 'morning'] as const) { walkFr(frTalk.hello(k, true), `talk.hello(${k},known)`); walkFr(frTalk.hello(k, false), `talk.hello(${k})`); }
  for (const k of ['night', 'evening', 'day', 'plain'] as const) walkFr(frTalk.goodbye(k), `talk.goodbye(${k})`);
  for (const k of ['address', 'live', 'phone', 'whatsapp', 'call', 'life'] as const) walkFr(frTalk.personal(k), `talk.personal(${k})`);
  ok(`aucune lettre arabe dans les ${frCount} textes francais (sauf le bouton de langue)`, frArabic.length === 0, frArabic);
  ok('chaque texte arabe contient bien de l\'arabe (sauf chiffres et noms)', (() => { const bad: string[] = []; const w = (node: unknown, path: string) => { if (typeof node === 'string') { if (node.length > 6 && !l.hasArabic(node)) bad.push(path); } else if (Array.isArray(node)) node.forEach((x, i) => w(x, `${path}[${i}]`)); else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (typeof v !== 'function') w(v, path ? `${path}.${k}` : k); }; w(tx.texts('ar'), ''); return bad.length === 0 ? true : bad; })());
  ok('textes importants : le francais et l\'arabe disent la meme chose (chiffres identiques)', ['info', 'rules', 'howToOrder', 'wrapReply', 'returns'].every((k) => { const nums = (s: string) => (s.replace(/[\s  ]/g, '').match(/\d+/g) ?? []).filter((n) => n !== '00').sort().join(','); const f = nums((tx.texts('fr') as any)[k]); const a = nums((tx.texts('ar') as any)[k]); return f === a; }), ['info', 'rules', 'howToOrder', 'wrapReply', 'returns'].map((k) => [k, (tx.texts('fr') as any)[k].replace(/[\s  ]/g, '').match(/\d+/g)?.sort().join(','), (tx.texts('ar') as any)[k].replace(/[\s  ]/g, '').match(/\d+/g)?.sort().join(',')]));

  // ---- Intelligence commerciale de Zara : profil de navigation, niveaux d'interet, suggestions discretes ----
  console.log('\n== intelligence commerciale : suivi de navigation, interet, suggestions, envoi sans double comptage');
  {
    const T0 = Date.UTC(2026, 9, 18, 8, 0, 0);
    const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
    const shoe = { id: 'p-shoe', name: 'Chaussures noires', slug: 'chaussures-noires', categoryId: 'c1', categorySlug: 'chaussures', categoryName: 'Chaussures' };
    const shirt = { id: 'p-shirt', name: 'Chemise bleue', slug: 'chemise-bleue', categoryId: 'c2', categorySlug: 'vetements', categoryName: 'Vêtements' };
    const perf = (n: number) => ({ id: `p-perf${n}`, name: `Parfum ${n}`, slug: `parfum-${n}`, categoryId: 'c3', categorySlug: 'parfums', categoryName: 'Parfums' });
    const fresh = () => bi.emptyProfile('visiteur-test', T0);
    const view = (p: bi.BrowsingProfile, m: bi.ProductMeta, at: number) => bi.applyProductView(p, m, at);

    // --- consultations
    let a = view(fresh(), shoe, T0);
    ok('1re consultation : 1 vue, 1 visite, produit et categorie retenus', a.counted && a.profile.products['p-shoe'].views === 1 && a.profile.products['p-shoe'].sessions === 1 && a.profile.categories['chaussures'].productIds.join() === 'p-shoe' && a.profile.order.join() === 'p-shoe', a.profile.products['p-shoe']);
    const reload = view(a.profile, shoe, T0 + 5 * SEC);
    ok('actualisation de la page (meme fiche rouverte en moins de 8 s) : la MEME consultation, rien n\'est recompte', !reload.counted && reload.profile.products['p-shoe'].views === 1);
    const again = view(a.profile, shoe, T0 + 20 * SEC);
    ok('meme fiche rouverte 20 s plus tard : une nouvelle consultation (2 vues) mais pas « retour apres d\'autres produits »', again.counted && again.profile.products['p-shoe'].views === 2 && again.profile.products['p-shoe'].returnsAfterOthers === 0);
    const b = view(a.profile, shirt, T0 + 30 * SEC);
    const back = view(b.profile, shoe, T0 + 60 * SEC);
    ok('retour sur la chaussure apres avoir regarde une chemise : « retour apres d\'autres produits » compte 1', back.profile.products['p-shoe'].returnsAfterOthers === 1 && back.profile.products['p-shoe'].views === 2 && back.profile.order.join() === 'p-shirt,p-shoe');
    const nextVisit = view(back.profile, shoe, T0 + 3 * HOUR);
    ok('visite differente (plus de 30 min plus tard) : le produit est compte dans 2 visites', back.profile.products['p-shoe'].sessions === 1 && nextVisit.profile.products['p-shoe'].sessions === 2 && nextVisit.profile.sessionKey !== back.profile.sessionKey, [back.profile.products['p-shoe'].sessions, nextVisit.profile.products['p-shoe'].sessions]);
    const sameVisit = view(back.profile, shoe, T0 + 10 * MIN);
    ok('dans la meme visite (moins de 30 min) : toujours 1 visite', sameVisit.profile.products['p-shoe'].sessions === 1 && sameVisit.profile.sessionKey === back.profile.sessionKey);
    // le profil n'est pas modifie en place (fonctions pures)
    ok('les fonctions ne modifient jamais le profil recu (pas d\'effet de bord)', a.profile.products['p-shoe'].views === 1 && fresh().order.length === 0 && JSON.stringify(a.profile).includes('"views":1'));

    // --- temps ACTIF
    let t = bi.applyActiveTime(a.profile, shoe, 12, 12, T0 + 12 * SEC);
    t = bi.applyActiveTime(t, shoe, 8, 20, T0 + 20 * SEC);
    ok('temps actif cumule (12 s puis 8 s = 20 s), duree de la derniere consultation = 20 s', Math.round(t.products['p-shoe'].activeSeconds) === 20 && t.products['p-shoe'].lastDurationSeconds === 20);
    const huge = bi.applyActiveTime(a.profile, shoe, 99999, 99999, T0 + SEC);
    ok('un seul ajout de plus d\'une heure n\'est jamais du temps actif (plafonne a 3 600 s)', huge.products['p-shoe'].activeSeconds === 3600);
    ok('temps nul ou negatif : ignore', bi.applyActiveTime(a.profile, shoe, 0, 0, T0) === a.profile && bi.applyActiveTime(a.profile, shoe, -5, -5, T0) === a.profile);

    // --- variantes
    let v = a.profile;
    for (const [k, val] of [['image', null], ['image', null], ['size', '41'], ['size', '42'], ['size', '41'], ['color', 'Noir'], ['color', 'Marron']] as const) v = bi.applyVariantClick(v, shoe, k, val, T0 + 5 * SEC);
    const rec = v.products['p-shoe'];
    ok('clics : 2 images, 3 clics de taille (2 tailles distinctes), 2 clics de couleur (2 couleurs distinctes)', rec.imageClicks === 2 && rec.sizeClicks === 3 && rec.sizes.join() === '41,42' && rec.colorClicks === 2 && rec.colors.join() === 'Noir,Marron', rec);
    let many = a.profile;
    for (let i = 0; i < 30; i++) many = bi.applyVariantClick(many, shoe, 'size', `T${i}`, T0);
    ok('liste des tailles essayees plafonnee (12 valeurs)', many.products['p-shoe'].sizes.length === 12 && many.products['p-shoe'].sizeClicks === 30);

    // --- panier / achat
    let c = bi.applyCartEvent(a.profile, shoe, 'add', T0 + 40 * SEC);
    ok('ajout au panier : statut « au panier »', c.products['p-shoe'].cartStatus === 'in_cart' && c.products['p-shoe'].cartChangedAt === T0 + 40 * SEC);
    c = bi.applyCartEvent(c, shoe, 'remove', T0 + 50 * SEC);
    ok('retire du panier : statut « retire »', c.products['p-shoe'].cartStatus === 'removed');
    c = bi.applyCartEvent(c, shoe, 'purchase', T0 + 60 * SEC);
    ok('achat : statut « achete » avec la date de commande', c.products['p-shoe'].cartStatus === 'purchased' && c.products['p-shoe'].orderedAt === T0 + 60 * SEC);
    const afterBuy = bi.applyCartEvent(c, shoe, 'remove', T0 + 70 * SEC);
    ok('apres un achat, « retire du panier » ne defait pas la commande', afterBuy.products['p-shoe'].cartStatus === 'purchased');
    const unseen = bi.applyCartEvent(fresh(), shirt, 'add', T0);
    ok('article ajoute depuis le chat de Zara sans avoir ouvert sa fiche : un enregistrement est cree (0 vue, au panier)', unseen.products['p-shirt'].views === 0 && unseen.products['p-shirt'].cartStatus === 'in_cart' && unseen.products['p-shirt'].name === 'Chemise bleue');

    // --- recherches
    ok('recherche : mise en minuscules, espaces nettoyes', bi.sanitizeSearch('  Parfum   ROUGE ') === 'parfum rouge');
    ok('recherche : jamais un telephone, une adresse e-mail, un lien, ni un texte trop court ou trop long', bi.sanitizeSearch('66123456') === null && bi.sanitizeSearch('+235 66 12 34 56') === null && bi.sanitizeSearch('moi@mail.com') === null && bi.sanitizeSearch('https://x.com') === null && bi.sanitizeSearch('a') === null && bi.sanitizeSearch('x'.repeat(61)) === null && bi.sanitizeSearch('montre 2') === 'montre 2');
    let sr = fresh();
    for (const [q, dt] of [['p', 0], ['pa', 1000], ['par', 2000], ['parf', 3000], ['parfum', 4000]] as const) sr = bi.applySearch(sr, q, T0 + dt);
    ok('recherche qui se complete lettre apres lettre : UNE seule entree (« parfum »)', sr.searches.map((x) => x.q).join() === 'parfum', sr.searches);
    sr = bi.applySearch(sr, 'chemise', T0 + 60 * SEC);
    sr = bi.applySearch(sr, 'chemise', T0 + 61 * SEC);
    ok('deux recherches differentes gardees, la meme recherche repetee n\'est pas doublee', sr.searches.map((x) => x.q).join() === 'parfum,chemise');
    let flood = fresh();
    for (let i = 0; i < 40; i++) flood = bi.applySearch(flood, `recherche numero ${i}`, T0 + i * MIN);
    ok('historique des recherches plafonne a 20', flood.searches.length === 20 && flood.searches[19].q === 'recherche numero 39');

    // --- niveau d'interet : plusieurs signaux, jamais le temps seul
    const R = (over: Partial<bi.ProductRecord> = {}): bi.ProductRecord => ({ ...(bi.applyProductView(fresh(), shoe, T0).profile.products['p-shoe']), ...over });
    const lvl = (over: Partial<bi.ProductRecord>) => bi.estimateInterest(R(over)).level;
    ok('INTERET LEGER : une seule consultation, rapide', lvl({}) === 'leger');
    ok('le temps passe SEUL n\'est jamais une preuve : 5 minutes, 1 heure = toujours « leger »', lvl({ activeSeconds: 300 }) === 'leger' && lvl({ activeSeconds: 3600 }) === 'leger');
    ok('INTERET MOYEN : il revient sur la fiche (2 vues)', lvl({ views: 2 }) === 'moyen');
    ok('INTERET MOYEN : du temps passe A EXAMINER (temps + photos, ou temps + taille/couleur, ou photos + variante)', lvl({ activeSeconds: 40, imageClicks: 2 }) === 'moyen' && lvl({ activeSeconds: 40, colorClicks: 1 }) === 'moyen' && lvl({ imageClicks: 2, sizeClicks: 1 }) === 'moyen');
    ok('INTERET MOYEN : un signal fort seul (3 vues, ou retour apres d\'autres produits, ou 2 tailles essayees)', lvl({ views: 3 }) === 'moyen' && lvl({ returnsAfterOthers: 1 }) === 'moyen' && lvl({ sizes: ['41', '42'], sizeClicks: 2 }) === 'moyen');
    ok('INTERET ELEVE : l\'article est ajoute au panier (ou deja achete)', lvl({ cartStatus: 'in_cart' }) === 'eleve' && lvl({ cartStatus: 'purchased' }) === 'eleve');
    ok('« retire du panier » n\'est pas un signal d\'interet eleve a lui seul', lvl({ cartStatus: 'removed' }) === 'leger');
    ok('INTERET ELEVE : deux signaux forts (3 vues + retour apres d\'autres produits)', lvl({ views: 3, returnsAfterOthers: 1 }) === 'eleve');
    ok('INTERET ELEVE : un signal fort confirme par du temps ou des photos (3 vues + 35 s ; retour + 2 photos)', lvl({ views: 3, activeSeconds: 35 }) === 'eleve' && lvl({ returnsAfterOthers: 1, imageClicks: 2 }) === 'eleve');
    ok('INTERET ELEVE : plusieurs variantes + plusieurs consultations (2 couleurs, 2 tailles, 3 vues)', lvl({ views: 3, colors: ['Noir', 'Marron'], colorClicks: 2 }) === 'eleve');
    ok('2 visites avec 2 vues chacune = « plusieurs consultations » (signal fort)', lvl({ views: 2, sessions: 2 }) === 'moyen' && bi.strongSignals(R({ views: 2, sessions: 2 })).repeat === true);
    ok('les raisons sont donnees (tableau de suivi) : panier, plusieurs consultations, retour, variantes, temps, photos', bi.estimateInterest(R({ cartStatus: 'in_cart', views: 3, returnsAfterOthers: 1, sizes: ['a', 'b'], activeSeconds: 60, imageClicks: 3 })).signals.join('|') === 'panier|plusieurs consultations|retour après d’autres produits|plusieurs variantes|temps passé|photos examinées');

    // --- interet par categorie
    let cat = fresh();
    cat = view(cat, perf(1), T0).profile;
    cat = view(cat, perf(2), T0 + MIN).profile;
    ok('categorie : 2 produits regardes = interet leger', bi.categoryInterest(cat, 'parfums')?.level === 'leger' && bi.categoryInterest(cat, 'parfums')?.distinctProducts === 2);
    cat = view(cat, perf(3), T0 + 2 * MIN).profile;
    ok('categorie : 3 produits differents = interet moyen', bi.categoryInterest(cat, 'parfums')?.level === 'moyen' && bi.categoryInterest(cat, 'parfums')?.distinctProducts === 3);
    const catHigh = bi.applyCartEvent(cat, perf(2), 'add', T0 + 3 * MIN);
    ok('categorie : 3 produits dont un au panier = interet eleve', bi.categoryInterest(catHigh, 'parfums')?.level === 'eleve');
    ok('categorie inconnue : rien', bi.categoryInterest(cat, 'jouets') === null);
    ok('categories qui interessent le plus : parfums en tete', bi.topCategories(cat)[0]?.key === 'parfums');

    // --- suggestions discretes
    const ctx = (now: number, allowed = true) => ({ now, allowed });
    ok('suggestion : AUCUNE tant que le suivi n\'est pas autorise', bi.pickSuggestion(back.profile, ctx(T0 + 2 * MIN, false)) === null);
    ok('suggestion : aucune si le client n\'a presque rien regarde', bi.pickSuggestion(a.profile, ctx(T0 + MIN)) === null);
    ok('suggestion : le temps passe seul ne declenche rien', bi.pickSuggestion(bi.applyActiveTime(a.profile, shoe, 900, 900, T0), ctx(T0 + 20 * MIN)) === null);
    const sg1 = bi.pickSuggestion(back.profile, ctx(T0 + 2 * MIN));
    ok('suggestion : la chaussure revient apres une chemise -> « product_revisit » pour CETTE chaussure', !!sg1 && sg1.kind === 'product_revisit' && sg1.productId === 'p-shoe' && sg1.key === 'product:p-shoe' && sg1.type === 'shoes', sg1);
    ok('suggestion : un article au panier n\'est pas propose (Zara a deja son rappel de panier)', bi.pickSuggestion(bi.applyCartEvent(back.profile, shoe, 'add', T0 + 61 * SEC), ctx(T0 + 2 * MIN)) === null);
    let colors = view(fresh(), shirt, T0).profile;
    colors = bi.applyVariantClick(colors, shirt, 'color', 'Bleu', T0 + 10 * SEC);
    colors = bi.applyVariantClick(colors, shirt, 'color', 'Blanc', T0 + 20 * SEC);
    const sgColors = bi.pickSuggestion(colors, ctx(T0 + MIN));
    ok('suggestion : plusieurs couleurs d\'un meme vetement -> « variants » (couleurs et tailles)', !!sgColors && sgColors.kind === 'variants' && sgColors.type === 'clothing' && sgColors.productId === 'p-shirt', sgColors);
    const sgPerf = bi.pickSuggestion(cat, ctx(T0 + 5 * MIN));
    ok('suggestion : 3 parfums regardes -> « perfume_browse » (fraiche, boisee, sucree, intense)', !!sgPerf && sgPerf.kind === 'perfume_browse' && sgPerf.categoryKey === 'parfums' && sgPerf.type === 'perfume', sgPerf);
    let shoes3 = fresh();
    for (let i = 1; i <= 3; i++) shoes3 = view(shoes3, { id: `p-s${i}`, name: `Sandale ${i}`, categoryId: 'c9', categorySlug: 'sandales', categoryName: 'Sandales' }, T0 + i * MIN).profile;
    const sgCat = bi.pickSuggestion(shoes3, ctx(T0 + 10 * MIN));
    ok('suggestion : 3 articles d\'une meme categorie -> « category_browse »', !!sgCat && sgCat.kind === 'category_browse' && sgCat.key === 'cat:sandales', sgCat);
    // priorite : l'article qui revient passe avant la categorie
    const both = bi.applyProductView(bi.applyProductView(bi.applyProductView(cat, perf(1), T0 + 3 * MIN).profile, perf(2), T0 + 4 * MIN).profile, perf(1), T0 + 5 * MIN).profile;
    ok('priorite : un article qui revient passe avant une suggestion de categorie', bi.pickSuggestion(both, ctx(T0 + 6 * MIN))?.kind === 'product_revisit');

    // pas a chaque clic : delai, une par visite, deux par jour, meme sujet 24 h, refus 7 jours
    const shown = bi.applySuggestion(back.profile, 'product:p-shoe', 'product_revisit', 'shown', T0 + 2 * MIN, 'p-shoe');
    ok('apres une suggestion montree : plus aucune a moins de 30 minutes', bi.pickSuggestion(shown, ctx(T0 + 20 * MIN)) === null);
    ok('...ni dans la meme visite (une seule par visite)', bi.pickSuggestion(shown, ctx(T0 + 31 * MIN)) === null);
    ok('la derniere suggestion est retenue sur le produit (type et date)', shown.products['p-shoe'].lastSuggestionKind === 'product_revisit' && shown.products['p-shoe'].lastSuggestionAt === T0 + 2 * MIN);
    // nouvelle visite 3 h plus tard, meme sujet : pas repete avant 24 h
    const later = view(shown, shoe, T0 + 3 * HOUR).profile;
    ok('nouvelle visite 3 h plus tard : la MEME suggestion n\'est pas repetee avant 24 h', bi.pickSuggestion(later, ctx(T0 + 3 * HOUR + MIN)) === null);
    const nextDay = view(shown, shoe, T0 + DAY + 3 * HOUR).profile;
    ok('le lendemain, nouvelle visite : la suggestion peut revenir', bi.pickSuggestion(nextDay, ctx(T0 + DAY + 3 * HOUR + MIN))?.productId === 'p-shoe');
    let two = bi.applySuggestion(fresh(), 'product:x', 'product_revisit', 'shown', T0 - 5 * HOUR);
    two = bi.applySuggestion(two, 'product:y', 'product_revisit', 'accepted', T0 - 2 * HOUR);
    const richProfile = view(view(view(two, shoe, T0 + HOUR).profile, shirt, T0 + HOUR + MIN).profile, shoe, T0 + HOUR + 2 * MIN).profile;
    ok('au plus 2 suggestions par jour', bi.pickSuggestion(richProfile, ctx(T0 + HOUR + 3 * MIN)) === null);
    const refused = bi.applySuggestion(back.profile, 'product:p-shoe', 'product_revisit', 'dismissed', T0 + 3 * MIN, 'p-shoe');
    ok('« Non merci » : plus aucune suggestion pendant 7 jours (le client est respecte)', refused.quietUntil === T0 + 3 * MIN + 7 * DAY && bi.pickSuggestion(refused, ctx(T0 + 6 * DAY)) === null);
    ok('...et apres 7 jours, une nouvelle visite peut en recevoir une (autre sujet ou nouvelle consultation)', bi.pickSuggestion(view(view(view(refused, shoe, T0 + 8 * DAY).profile, shirt, T0 + 8 * DAY + MIN).profile, shoe, T0 + 8 * DAY + 2 * MIN).profile, ctx(T0 + 8 * DAY + 3 * MIN)) !== null);

    // --- types de produits
    ok('type de produit : chaussures, parfums, vetements, autre', bi.productTypeOf('Sandale cuir') === 'shoes' && bi.productTypeOf('Nike Air', 'chaussures') === 'shoes' && bi.productTypeOf('Eau de parfum Oud') === 'perfume' && bi.productTypeOf('Khamrah', 'parfums') === 'perfume' && bi.productTypeOf('Chemise bleue') === 'clothing' && bi.productTypeOf('Costume homme') === 'clothing' && bi.productTypeOf('Montre Rolex') === 'other' && bi.productTypeOf(null) === 'other');

    // --- ce que Zara peut demander
    const hist = view(view(view(fresh(), shoe, T0).profile, shirt, T0 + MIN).profile, perf(1), T0 + 2 * MIN).profile;
    ok('Zara demande « articles consultes recemment » : du plus recent au plus ancien', bi.recentProducts(hist, 5, T0 + 5 * MIN).map((r) => r.id).join() === 'p-perf1,p-shirt,p-shoe');
    ok('...limite au nombre demande et aux 14 derniers jours', bi.recentProducts(hist, 2, T0 + 5 * MIN).length === 2 && bi.recentProducts(hist, 5, T0 + 15 * DAY).length === 0);
    ok('Zara demande « articles consultes plusieurs fois » et « secondes passees sur la fiche »', bi.repeatedProducts(back.profile).map((r) => r.id).join() === 'p-shoe' && bi.secondsOn(t, 'p-shoe') === 20 && bi.secondsOn(t, 'inconnu') === 0);

    // --- limites et vie privee
    let big = fresh();
    for (let i = 0; i < 80; i++) big = view(big, { id: `p${i}`, name: `Article ${i}`, categorySlug: 'divers' }, T0 + i * MIN).profile;
    ok('au plus 60 produits retenus (les plus anciens sont oublies) et 40 dans l\'ordre de consultation', Object.keys(big.products).length === 60 && !big.products['p0'] && !!big.products['p79'] && big.order.length === 40);
    const old = view(view(fresh(), shoe, T0 - 100 * DAY).profile, shirt, T0 - DAY).profile;
    const pruned = bi.pruneProfile(old, T0);
    ok('duree de conservation 90 jours : le produit vu il y a 100 jours est efface, celui d\'hier reste', !pruned.products['p-shoe'] && !!pruned.products['p-shirt'] && !pruned.order.includes('p-shoe') && !pruned.categories['chaussures'] && !!pruned.categories['vetements']);
    ok('recherches et suggestions de plus de 90 jours effacees aussi', bi.pruneProfile(bi.applySearch(fresh(), 'montre', T0 - 100 * DAY), T0).searches.length === 0 && bi.pruneProfile(bi.applySuggestion(fresh(), 'cat:x', 'category_browse', 'shown', T0 - 100 * DAY), T0).suggestions.length === 0);

    // --- envoi vers la base : seulement la difference, jamais de double comptage
    let d1 = bi.applyActiveTime(view(fresh(), shoe, T0).profile, shoe, 14, 14, T0 + 14 * SEC);
    d1 = bi.applyVariantClick(d1, shoe, 'size', '41', T0 + 15 * SEC);
    let first = bi.pendingDeltas(d1);
    ok('1er envoi : toutes les valeurs (1 vue, 14 s, 1 clic de taille, interet leger, pas de panier)', first.deltas.length === 1 && first.deltas[0].views === 1 && first.deltas[0].activeSeconds === 14 && first.deltas[0].sizeClicks === 1 && first.deltas[0].interest === 'leger' && first.deltas[0].cartStatus === 'none' && first.deltas[0].lastDurationSeconds === 14, first.deltas[0]);
    ok('envoi qui echoue (rien note comme parti) : la meme difference est renvoyee, rien n\'est perdu', JSON.stringify(bi.pendingDeltas(d1).deltas) === JSON.stringify(first.deltas));
    const acked = bi.markSynced(d1, first.snapshots);
    ok('apres un envoi reussi : plus rien a envoyer (aucun double comptage, meme si on appelle deux fois)', bi.pendingDeltas(acked).deltas.length === 0 && bi.pendingDeltas(bi.markSynced(acked, first.snapshots)).deltas.length === 0);
    const more = bi.applyActiveTime(bi.applyCartEvent(acked, shoe, 'add', T0 + 40 * SEC), shoe, 6, 20, T0 + 40 * SEC);
    const second = bi.pendingDeltas(more);
    ok('apres un nouveau geste : seulement la difference (6 s de plus, au panier, interet eleve), 0 vue de plus', second.deltas.length === 1 && second.deltas[0].views === 0 && second.deltas[0].activeSeconds === 6 && second.deltas[0].cartStatus === 'in_cart' && second.deltas[0].interest === 'eleve', second.deltas[0]);
    const cartOnly = bi.pendingDeltas(bi.markSynced(more, second.snapshots));
    const cartRemoved = bi.pendingDeltas(bi.applyCartEvent(bi.markSynced(more, second.snapshots), shoe, 'remove', T0 + 50 * SEC));
    ok('un simple changement de panier (sans compteur) est envoye aussi', cartOnly.deltas.length === 0 && cartRemoved.deltas.length === 1 && cartRemoved.deltas[0].cartStatus === 'removed' && cartRemoved.deltas[0].views === 0);
    ok('jamais de valeur negative dans ce qui part', [...first.deltas, ...second.deltas, ...cartRemoved.deltas].every((x) => x.views >= 0 && x.activeSeconds >= 0 && x.imageClicks >= 0 && x.sizeClicks >= 0 && x.colorClicks >= 0));

    // --- enregistrement sur le telephone
    const round = bi.parseProfile(bi.serializeProfile(back.profile), T0);
    ok('profil enregistre puis relu : identique', !!round && JSON.stringify(round) === JSON.stringify(back.profile));
    ok('profil abime, d\'une autre version ou sans produits : ignore sans erreur (profil vide)', bi.parseProfile('{pas du json', T0) === null && bi.parseProfile('', T0) === null && bi.parseProfile(null, T0) === null && bi.parseProfile(JSON.stringify({ version: 2, visitorId: 'x', products: {} }), T0) === null && bi.parseProfile(JSON.stringify({ version: 1, visitorId: 'x' }), T0) === null);
    const partial = bi.parseProfile(JSON.stringify({ version: 1, visitorId: 'abc', products: {} }), T0);
    ok('profil incomplet complete avec des valeurs sures (listes vides, pas de suggestion bloquee)', !!partial && partial.order.length === 0 && partial.searches.length === 0 && partial.suggestions.length === 0 && partial.quietUntil === 0 && partial.visitorId === 'abc' && typeof partial.sessionKey === 'string');
    // --- recherches envoyees vers la base : seulement les nouvelles, une seule fois
    let sx = bi.applySearch(bi.applySearch(fresh(), 'parfum oud', T0), 'chemise', T0 + MIN);
    const sPending = bi.pendingDeltas(sx);
    ok('recherches pas encore parties : toutes les deux (sans produit consulte, il y a quand meme un envoi)', sPending.searches.map((x) => x.q).join() === 'parfum oud,chemise' && sPending.searchesUpTo === T0 + MIN && sPending.deltas.length === 0);
    const sAcked = bi.markSynced(sx, sPending.snapshots, sPending.searchesUpTo);
    ok('apres un envoi reussi : plus aucune recherche a envoyer ; une nouvelle recherche part seule', bi.pendingDeltas(sAcked).searches.length === 0 && bi.pendingDeltas(bi.applySearch(sAcked, 'montre', T0 + 5 * MIN)).searches.map((x) => x.q).join() === 'montre');
    ok('envoi qui echoue : les memes recherches repartent plus tard (rien de perdu)', bi.pendingDeltas(sx).searches.length === 2);

    // --- chronometre du temps ACTIF
    {
      const now0 = T0;
      const tm = new ac.ActiveTimer(now0);
      for (let i = 1; i <= 10; i++) tm.tick(now0 + i * 1000, true);
      ok('10 secondes actives = 10 s', tm.seconds === 10);
      for (let i = 11; i <= 20; i++) tm.tick(now0 + i * 1000, false);
      ok('onglet cache ou client inactif : le temps ne compte pas (toujours 10 s)', tm.seconds === 10);
      tm.tick(now0 + 3600 * 1000, true);
      ok('un « trou » d\'une heure (telephone en veille, onglet gele) compte 2 secondes au plus, jamais toute l\'heure', tm.seconds === 12, tm.seconds);
      tm.tick(now0 + 3600 * 1000 - 5000, true);
      ok('une horloge qui recule n\'ajoute rien', tm.seconds === 12);
      const base = { visible: true, focused: true, lastInteractionAt: now0, now: now0 + 10_000 };
      ok('actif : onglet visible, fenetre au premier plan, geste il y a moins d\'une minute', ac.isActive(base) === true);
      ok('inactif : onglet cache', ac.isActive({ ...base, visible: false }) === false);
      ok('inactif : fenetre pas au premier plan', ac.isActive({ ...base, focused: false }) === false);
      ok('inactif : aucun geste depuis 1 minute (page laissee ouverte)', ac.isActive({ ...base, now: now0 + 59_999 }) === true && ac.isActive({ ...base, now: now0 + 60_000 }) === false);
    }

    // --- choix du visiteur : refuser le suivi
    {
      const mem = () => { const m = new Map<string, string>(); return { m, store: { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null), setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }; };
      const a = mem();
      ok('sans choix et sans signal du navigateur : le suivi est actif (le visiteur est informe et peut refuser)', tc.readChoice(a.store) === 'unset' && tc.isTrackingAllowed(a.store, {}) === true);
      ok('signal « Ne pas me suivre » du navigateur (Do Not Track = 1 ou Global Privacy Control) : suivi refuse', tc.isTrackingAllowed(a.store, { doNotTrack: '1' }) === false && tc.isTrackingAllowed(a.store, { doNotTrack: 'yes' }) === false && tc.isTrackingAllowed(a.store, { globalPrivacyControl: true }) === false && tc.isTrackingAllowed(a.store, { doNotTrack: '0' }) === true && tc.isTrackingAllowed(a.store, { doNotTrack: null }) === true);
      tc.writeChoice('denied', a.store, T0);
      ok('« Refuser » : le suivi s\'arrete (meme sans signal du navigateur) et le choix est retenu', tc.readChoice(a.store) === 'denied' && tc.isTrackingAllowed(a.store, {}) === false);
      tc.writeChoice('granted', a.store, T0);
      ok('le visiteur accepte lui-meme : le suivi repart, MEME si son navigateur dit « Ne pas me suivre » (son choix gagne)', tc.readChoice(a.store) === 'granted' && tc.isTrackingAllowed(a.store, { doNotTrack: '1' }) === true);
      const bad = mem(); bad.m.set('albasse_tracking_choice', '{abime'); const bad2 = mem(); bad2.m.set('albasse_tracking_choice', JSON.stringify({ choice: 'peut-etre' }));
      ok('choix abime ou inconnu : traite comme « pas de choix » (jamais d\'erreur)', tc.readChoice(bad.store) === 'unset' && tc.readChoice(bad2.store) === 'unset');
      ok('stockage bloque : pas d\'erreur, le suivi suit les signaux du navigateur', tc.readChoice(null) === 'unset' && tc.isTrackingAllowed(null, {}) === true && tc.isTrackingAllowed(null, { doNotTrack: '1' }) === false);
      const b = mem();
      ok('plus de message d\'information qui derange : les fonctions du message n\'existent plus', !('noticeSeen' in tc) && !('markNoticeSeen' in tc));
    }
    ok('niveaux affiches en francais : Leger, Moyen, Eleve', bi.INTEREST_LABELS.leger === 'Léger' && bi.INTEREST_LABELS.moyen === 'Moyen' && bi.INTEREST_LABELS.eleve === 'Élevé');
  }

  // ---- Statistiques de Zara : appareil, memoire « vient de Zara », chiffres, periodes ----
  console.log('\n== statistiques de Zara : appareils, attribution, chiffres, periodes');
  {
    const UA = {
      iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    };
    ok('Zara reconnait l\'appareil : iPhone, Android (telephone), Tablette (iPad et tablette Android), PC (Windows, Mac, inconnu)', at.deviceFromUserAgent(UA.iphone) === 'iPhone' && at.deviceFromUserAgent(UA.android) === 'Android' && at.deviceFromUserAgent(UA.ipad) === 'Tablette' && at.deviceFromUserAgent(UA.androidTablet) === 'Tablette' && at.deviceFromUserAgent(UA.windows) === 'PC' && at.deviceFromUserAgent(UA.mac) === 'PC' && at.deviceFromUserAgent('') === 'PC' && at.deviceFromUserAgent(null) === 'PC' && at.deviceFromUserAgent(undefined) === 'PC');

    // memoire de « il vient de toucher un bouton de Zara » (stockage simule)
    const mem = () => { const m = new Map<string, string>(); return { m, store: { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null), setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }; };
    const T0 = Date.UTC(2026, 9, 18, 8, 0, 0);
    const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
    const a = mem();
    at.markIntent('signup', 'Android', a.store, T0);
    ok('« Creer mon compte » touche chez Zara : retenu avec l\'appareil, valable 3 jours', at.readIntent('signup', a.store, T0 + 2 * DAY)?.device === 'Android' && at.readIntent('signup', a.store, T0 + 3 * DAY - MIN)?.device === 'Android' && at.readIntent('signup', a.store, T0 + 3 * DAY + MIN) === null);
    const b = mem();
    at.markIntent('install', 'iPhone', b.store, T0);
    ok('« Installer » touche chez Zara : valable 30 minutes seulement', at.readIntent('install', b.store, T0 + 29 * MIN)?.device === 'iPhone' && at.readIntent('install', b.store, T0 + 31 * MIN) === null);
    ok('les deux memoires sont separees (compte / installation)', at.readIntent('install', a.store, T0) === null && at.readIntent('signup', b.store, T0) === null);
    at.clearIntent('signup', a.store);
    ok('une fois compte, la memoire est effacee (un seul compte compte)', at.readIntent('signup', a.store, T0) === null && a.m.size === 0);
    const bad = mem();
    bad.m.set('albasse_zara_signup_intent', '{pas du json');
    const bad2 = mem(); bad2.m.set('albasse_zara_signup_intent', JSON.stringify({ at: T0, device: 'Windows Phone' }));
    const bad3 = mem(); bad3.m.set('albasse_zara_signup_intent', JSON.stringify({ at: T0 + 10 * DAY, device: 'iPhone' }));
    const bad4 = mem(); bad4.m.set('albasse_zara_signup_intent', JSON.stringify({ device: 'iPhone' }));
    ok('memoire abimee, appareil inconnu, date dans le futur ou sans date : ignorees, jamais d\'erreur', at.readIntent('signup', bad.store, T0) === null && at.readIntent('signup', bad2.store, T0) === null && at.readIntent('signup', bad3.store, T0) === null && at.readIntent('signup', bad4.store, T0) === null);
    let threw = false;
    try { at.markIntent('signup', 'PC', null, T0); at.clearIntent('signup', null); threw = at.readIntent('signup', null, T0) !== null; } catch { threw = true; }
    ok('stockage bloque (navigation privee) : rien ne plante, rien n\'est compte', !threw);
    const broken = { getItem: () => { throw new Error('bloque'); }, setItem: () => { throw new Error('bloque'); }, removeItem: () => { throw new Error('bloque'); } };
    let threw2 = false;
    try { at.markIntent('install', 'PC', broken, T0); at.clearIntent('install', broken); at.readIntent('install', broken, T0); } catch { threw2 = true; }
    ok('stockage qui lance des erreurs : rien ne plante', !threw2);

    // chiffres : meme jeu de donnees que le test de la base
    const raw = {
      conversations: [{ device: 'iPhone', n: 1 }, { device: 'Android', n: 1 }, { device: 'Autre', n: 2 }],
      events: [{ event: 'install_question', device: 'iPhone', n: 1 }, { event: 'install_question', device: 'Android', n: 1 }, { event: 'install_ios_guide', device: 'iPhone', n: 1 }, { event: 'install_already', device: 'Android', n: 1 }, { event: 'install_later', device: 'Autre', n: 1 }],
      orders: [{ device: 'Android', status: 'pending', n: 1, amount: 10000 }, { device: 'Android', status: 'delivered', n: 1, amount: 20000 }, { device: 'iPhone', status: 'paid', n: 1, amount: 5000 }, { device: 'Android', status: 'cancelled', n: 1, amount: 3000 }],
      accounts: [{ device: 'Android', n: 2 }, { device: 'iPhone', n: 1 }],
      installs: [{ device: 'Android', n: 1 }, { device: 'iPhone', n: 1 }],
      totals: { orders: 4, orders_amount: 42000, accounts: 5, installs: 3 },
    };
    const z = st.buildZaraStats(raw);
    ok('ventes de Zara : 3 commandes (l\'annulee n\'est pas une vente), 35 000 FCFA, dont 1 livree de 20 000 ; 1 annulee signalee', z.sales.count === 3 && z.sales.amount === 35000 && z.sales.delivered.count === 1 && z.sales.delivered.amount === 20000 && z.sales.cancelled === 1, z.sales);
    ok('ventes par appareil : Android 2 (30 000), iPhone 1 (5 000)', z.sales.byDevice.Android.count === 2 && z.sales.byDevice.Android.amount === 30000 && z.sales.byDevice.iPhone.count === 1 && z.sales.byDevice.iPhone.amount === 5000 && z.sales.byDevice.PC.count === 0, z.sales.byDevice);
    ok('comptes grace a Zara : 3 (Android 2, iPhone 1) ; installations : 2 (Android 1, iPhone 1)', z.accounts.count === 3 && z.accounts.byDevice.Android === 2 && z.accounts.byDevice.iPhone === 1 && z.installs.count === 2 && z.installs.byDevice.Android === 1 && z.installs.byDevice.iPhone === 1, [z.accounts, z.installs.byDevice]);
    ok('conversations : 4 (iPhone 1, Android 1, autre 2)', z.conversations.total === 4 && z.conversations.byDevice.iPhone === 1 && z.conversations.byDevice.Android === 1 && z.conversations.byDevice.Autre === 2);
    ok('parcours d\'installation : 2 questions, 1 deja installee, 1 plus tard, 1 aide iPhone', z.installs.questions === 2 && z.installs.alreadyInstalled === 1 && z.installs.later === 1 && z.installs.iosGuides === 1, z.installs);
    ok('part de Zara dans la boutique : 75 % des commandes (3 sur 4), 60 % des comptes (3 sur 5), 66,7 % des installations (2 sur 3)', z.shares.orders === 75 && z.shares.accounts === 60 && z.shares.installs === 66.7, z.shares);
    ok('3 ventes pour 4 conversations = 75 ventes pour 100 conversations', z.ordersPer100Chats === 75, z.ordersPer100Chats);
    const zEmpty = st.buildZaraStats(null);
    const zEmpty2 = st.buildZaraStats({});
    const allZero = (x: st.ZaraStats) => x.sales.count === 0 && x.sales.amount === 0 && x.accounts.count === 0 && x.installs.count === 0 && x.conversations.total === 0 && x.shares.orders === null && x.shares.accounts === null && x.shares.installs === null && x.ordersPer100Chats === null;
    ok('aucune donnee (rien recu, periode vide) : tout a zero, pourcentages vides, jamais NaN', allZero(zEmpty) && allZero(zEmpty2) && JSON.stringify(zEmpty).indexOf('NaN') === -1 && JSON.stringify(zEmpty).indexOf('null') !== -1);
    const zStr = st.buildZaraStats({ orders: [{ device: 'Windows Phone', status: 'delivered', n: '2', amount: '12500.5' }, { device: 'iPhone', status: 'paid', n: 'abc', amount: null as unknown as number }], conversations: [{ device: 'PC', n: '7' }] });
    ok('nombres recus en texte acceptes ; appareil inconnu = « Autre » ; valeur illisible = 0', zStr.sales.count === 2 && zStr.sales.amount === 12500.5 && zStr.sales.byDevice.Autre.count === 2 && zStr.sales.byDevice.iPhone.count === 0 && zStr.conversations.byDevice.PC === 7, zStr.sales);
    ok('appareils affiches : iPhone, Android, Tablette, PC (Ordinateur), Autre', st.DEVICES.join('|') === 'iPhone|Android|Tablette|PC|Autre' && st.DEVICE_LABELS.PC === 'Ordinateur');

    // periodes : « aujourd'hui » commence a minuit a N'Djamena (UTC+1)
    const at0 = Date.UTC(2026, 9, 18, 5, 30, 0); // 06:30 a N'Djamena, le 18 octobre
    const pb = (p: st.StatsPeriod, now = at0) => st.periodBounds(p, now);
    ok('periode « Aujourd\'hui » : depuis minuit heure du Tchad (23:00 UTC la veille)', pb('today').since === '2026-10-17T23:00:00.000Z' && pb('today').until === null, pb('today'));
    ok('periode « Hier » : de minuit a minuit, fin exclue', pb('yesterday').since === '2026-10-16T23:00:00.000Z' && pb('yesterday').until === '2026-10-17T23:00:00.000Z', pb('yesterday'));
    ok('periode « 7 jours » = aujourd\'hui + 6 jours avant ; « 30 jours » = aujourd\'hui + 29', pb('7d').since === '2026-10-11T23:00:00.000Z' && pb('30d').since === '2026-09-18T23:00:00.000Z', [pb('7d'), pb('30d')]);
    ok('periode « Ce mois » : depuis le 1er a minuit heure du Tchad', pb('month').since === '2026-09-30T23:00:00.000Z', pb('month'));
    ok('periode « Depuis le debut » : sans limite', pb('all').since === null && pb('all').until === null);
    ok('juste apres minuit a N\'Djamena (00:30 le 18) : toujours le 18 ; juste avant (23:30 le 17) : le 17', pb('today', Date.UTC(2026, 9, 17, 23, 30, 0)).since === '2026-10-17T23:00:00.000Z' && pb('today', Date.UTC(2026, 9, 17, 22, 30, 0)).since === '2026-10-16T23:00:00.000Z');
    ok('changement de mois et d\'annee : 1er janvier a minuit heure du Tchad = 31 decembre 23:00 UTC', pb('month', Date.UTC(2027, 0, 15, 10, 0, 0)).since === '2026-12-31T23:00:00.000Z');
    ok('periodes proposees : aujourd\'hui, hier, 7 jours, 30 jours, ce mois, depuis le debut (en francais)', st.PERIOD_ORDER.join('|') === 'today|yesterday|7d|30d|month|all' && st.PERIOD_LABELS.all === 'Depuis le début' && st.PERIOD_LABELS.today === "Aujourd'hui");

    ok('erreur de la base : fonction absente = « pas encore active », droit refuse = « acces refuse », reste = erreur', st.classifyStatsError({ code: 'PGRST202' }) === 'not_installed' && st.classifyStatsError({ code: '42883' }) === 'not_installed' && st.classifyStatsError({ status: 404 }) === 'not_installed' && st.classifyStatsError({ code: '42501' }) === 'forbidden' && st.classifyStatsError({ code: 'XX000', message: 'boom' }) === 'error' && st.classifyStatsError(null) === 'error' && st.classifyStatsError(undefined) === 'error');
    ok('colonne absente (script pas applique) reconnue : PGRST204 ou 42703 + nom de la colonne ; autre erreur non', isMissingColumn({ code: 'PGRST204', message: "Could not find the 'assistant_device' column of 'orders' in the schema cache" }, 'assistant_device') && isMissingColumn({ code: '42703', message: 'column "via_assistant" of relation "app_installs" does not exist' }, 'via_assistant') && !isMissingColumn({ code: 'PGRST204', message: "Could not find the 'gift_wrap' column" }, 'assistant_device') && !isMissingColumn({ code: '23505', message: 'assistant_device duplicate' }, 'assistant_device') && !isMissingColumn(null, 'assistant_device'));
  }

  // ---- Profil client modifiable : regles de validation (les memes que l'inscription) ----
  console.log('\n== profil client modifiable : validation');
  {
    const base = { fullName: 'Ahmed Hassan', phone: '66123456', whatsappNumber: '99221017', profession: 'Commerçant', region: "N'Djamena", country: 'Tchad', address: 'Quartier Chagoua' };
    const okRes = pe.checkProfileForm(base);
    ok('profil complet valide : les 7 champs sont envoyes tels quels', okRes.ok && JSON.stringify(okRes.changes) === JSON.stringify({ full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: '99221017', profession: 'Commerçant', region: "N'Djamena", country: 'Tchad', address: 'Quartier Chagoua' }), okRes);
    const spaced = pe.checkProfileForm({ ...base, fullName: '  Ahmed    Hassan ', address: '  Quartier   Chagoua  ' });
    ok('espaces en trop enleves (nom et adresse)', spaced.ok && spaced.changes.full_name === 'Ahmed Hassan' && spaced.changes.address === 'Quartier Chagoua', spaced);
    const noName = pe.checkProfileForm({ ...base, fullName: '   ' });
    ok('nom vide : refuse, et le champ montre est le nom', !noName.ok && noName.field === 'fullName', noName);
    const oneLetter = pe.checkProfileForm({ ...base, fullName: 'A' });
    ok('nom d\'une seule lettre : refuse', !oneLetter.ok && oneLetter.field === 'fullName', oneLetter);
    const badPhone = pe.checkProfileForm({ ...base, phone: '123' });
    ok('telephone trop court : refuse, le champ montre est le telephone', !badPhone.ok && badPhone.field === 'phone' && /8 à 15 chiffres/.test(badPhone.message), badPhone);
    const letters = pe.checkProfileForm({ ...base, phone: '66 12 34 ab' });
    ok('telephone avec des lettres : refuse', !letters.ok && letters.field === 'phone', letters);
    const plus = pe.checkProfileForm({ ...base, phone: '+235 66 12 34 56' });
    ok('telephone avec « + » et espaces : accepte (comme a l\'inscription)', plus.ok && plus.changes.phone === '+235 66 12 34 56', plus);
    const badWa = pe.checkProfileForm({ ...base, whatsappNumber: '12' });
    ok('WhatsApp invalide : refuse, le champ montre est WhatsApp', !badWa.ok && badWa.field === 'whatsappNumber' && /WhatsApp/.test(badWa.message), badWa);
    const empties = pe.checkProfileForm({ ...base, phone: '', whatsappNumber: '  ', profession: '', region: '', address: '' });
    ok('champs facultatifs vides : acceptes et envoyes comme « vide » (null), jamais une chaine vide', empties.ok && empties.changes.phone === null && empties.changes.whatsapp_number === null && empties.changes.profession === null && empties.changes.region === null && empties.changes.address === null && empties.changes.full_name === 'Ahmed Hassan', empties);
    const onlyKnown = pe.checkProfileForm(base);
    ok('seules les 7 colonnes permises sont envoyees (jamais is_admin, loyalty_points, banned, e-mail...)', onlyKnown.ok && Object.keys(onlyKnown.changes).sort().join(',') === 'address,country,full_name,phone,profession,region,whatsapp_number', onlyKnown.ok && Object.keys(onlyKnown.changes));
    const prof = { id: 'u1', email: 'a@b.c', avatar_url: null, full_name: 'Ahmed Hassan', phone: '66123456', whatsapp_number: null, profession: null, region: null, country: null, address: null } as unknown as Parameters<typeof pe.formFromProfile>[0];
    const f = pe.formFromProfile(prof);
    ok('formulaire rempli avec le profil (vide si la base n\'a rien)', f.fullName === 'Ahmed Hassan' && f.phone === '66123456' && f.whatsappNumber === '' && f.address === '', f);
    ok('« Enregistrer » inactif tant que rien n\'a change', !pe.profileFormChanged(f, prof) && !pe.profileFormChanged({ ...f, fullName: '  Ahmed   Hassan ' }, prof));
    ok('« Enregistrer » actif des qu\'une information change', pe.profileFormChanged({ ...f, address: 'Chagoua' }, prof) && pe.profileFormChanged({ ...f, phone: '66123457' }, prof));
  }

  // ---- Zara : suggestions discretes, historique, choix du suivi ----
  console.log('\n== Zara intelligence : suivi (arreter, reprendre, expliquer), « qu\'est-ce que j\'ai regarde », suggestions avec le vrai catalogue');
  {
    // --- comprendre le client
    const stopPhrases = ['ne me suis plus', 'Arrête de me suivre', 'ne me suivez plus', 'je ne veux pas être suivi', 'refuse le suivi', 'désactive le suivi', 'supprime mon historique', 'ne retiens pas ce que je regarde', 'efface mes données', 'arrête le suivi', 'لا تتبعني', 'توقف عن متابعتي', 'امسح سجل التصفح'];
    const notTracking = ['suivre ma commande', 'suivi de ma commande', 'où est mon colis', "je n'ai pas de suivi de ma commande", 'arrêter le suivi de ma commande', 'je veux suivre mon colis', 'parfum pour homme', 'montre-moi des sandales', 'rolex', 'chaussures noires', "j'ai regardé des chaussures, vous avez quoi", 'tracking colis', 'mes commandes', 'طلباتي', 'تتبع طلبي', 'merci', 'oui', 'combien coûte la livraison', 'cherche des produits'];
    ok('« ne me suis plus » et ses variantes (francais, arabe) : arreter le suivi', stopPhrases.every((t) => b.trackingKind(t) === 'stop' && b.detectIntent(t) === 'tracking'), stopPhrases.filter((t) => b.trackingKind(t) !== 'stop'));
    ok('suivre une COMMANDE ou un colis, une recherche de produit, un merci : jamais pris pour le suivi de navigation', notTracking.every((t) => b.detectIntent(t) !== 'tracking'), notTracking.filter((t) => b.detectIntent(t) === 'tracking'));
    const neverTalks = ['tu peux me suivre', 'tu me suis ?', 'que sais-tu de moi', "qu'est-ce que j'ai regardé", 'mes derniers articles vus', 'historique de navigation', 'ماذا شاهدت', 'هل تتبعني', 'active le suivi'];
    ok('Zara ne parle JAMAIS du suivi d\'elle-meme : aucune de ces questions n\'est reconnue comme un sujet de suivi (le client ne sait pas qu\'il est suivi)', neverTalks.every((t) => b.trackingKind(t) === null && b.detectIntent(t) !== 'tracking'), neverTalks.filter((t) => b.trackingKind(t) !== null));
    ok('« suivre ma commande » reste « orders »', b.detectIntent('suivre ma commande') === 'orders' && b.detectIntent('suivi de ma commande') === 'orders');
    ok('le chat n\'a AUCUN bouton ni texte de suivi : pas de chip, pas de reponse sur l\'historique ou sur ce qui est retenu', !Object.keys(tx.texts('fr').chip).some((k) => /track|viewed|privacy/i.test(k)) && !Object.keys(tx.texts('ar').chip).some((k) => /track|viewed|privacy/i.test(k)) && !('history' in tx.texts('fr')) && Object.keys(tx.texts('fr').tracking).sort().join() === 'stopped,stoppedAlready,unavailable');

    // --- un catalogue d'essai, plus le vrai
    const mk = (id: string, name: string, over: Partial<Parameters<typeof b.buildProduct>[0]> = {}): P =>
      b.buildProduct({ id, name, slug: id, price: 20000, compare_at_price: null, stock: 5, category: 'Chaussures', category_slug: 'chaussures', colors: ['Noir', 'Marron'], sizes: ['40', '41', '42'], description: '', image: 'x.jpg', created_at: '2026-01-01T00:00:00Z', ...over });
    const sandale = mk('p-shoe', 'Sandale cuir', { price: 15000 });
    const sandale2 = mk('p-shoe2', 'Sandale été', { price: 16000, created_at: '2026-03-01T00:00:00Z' });
    const sandale3 = mk('p-shoe3', 'Sandale luxe', { price: 40000 });
    const sandaleOut = mk('p-shoe4', 'Sandale rupture', { price: 15500, stock: 0 });
    const chemise = mk('p-shirt', 'Chemise bleue', { category: 'Vêtements', category_slug: 'vetements', colors: ['Bleu', 'Blanc'], sizes: ['M', 'L'] });
    const montre = mk('p-watch', 'Montre acier', { category: 'Montres', category_slug: 'montres', colors: [], sizes: [] });
    const parfumFrais = mk('p-pf1', 'Parfum Aqua', { category: 'Parfum', category_slug: 'parfum', colors: [], sizes: [], description: 'Une fragrance fraîche aux notes d’agrumes.' });
    const parfumBois = mk('p-pf2', 'Parfum Santal', { category: 'Parfum', category_slug: 'parfum', colors: [], sizes: [], description: 'Notes boisées de santal et de cèdre.' });
    const parfumNeutre = mk('p-pf3', 'Parfum Royal', { category: 'Parfum', category_slug: 'parfum', colors: [], sizes: [], description: '' });
    const parfumRupture = mk('p-pf4', 'Parfum Intense Noir', { category: 'Parfum', category_slug: 'parfum', colors: [], sizes: [], description: 'Intense', stock: 0 });
    const demo: P[] = [sandale, sandale2, sandale3, sandaleOut, chemise, montre, parfumFrais, parfumBois, parfumNeutre, parfumRupture];

    // --- familles de parfums : seulement ce que la fiche DIT
    ok('famille de parfum : « fraiche » seulement si la fiche le dit (description ou nom)', ai.matchesFamily(parfumFrais, 'fresh') && !ai.matchesFamily(parfumFrais, 'woody') && ai.matchesFamily(parfumBois, 'woody') && !ai.matchesFamily(parfumBois, 'fresh'));
    ok('un parfum sans description n\'est range dans AUCUNE famille (rien n\'est devine)', ai.FAMILIES.every((f) => !ai.matchesFamily(parfumNeutre, f)));
    ok('familles proposees : fraiche, boisee, sucree, intense, rien d\'autre', ai.FAMILIES.join() === 'fresh,woody,sweet,intense' && ai.isFamily('fresh') && !ai.isFamily('floral') && !ai.isFamily('') && !ai.isFamily(undefined));
    ok('parfums proposes pour une famille : en stock et annonces par la fiche', ai.familyPicks(demo, 'fresh').map((p) => p.id).join() === 'p-pf1' && ai.familyPicks(demo, 'woody').map((p) => p.id).join() === 'p-pf2');
    ok('parfum en rupture : jamais propose, meme si sa fiche dit « intense »', ai.familyPicks(demo, 'intense').length === 0 && !ai.perfumesInStock(demo).some((p) => p.id === 'p-pf4'));
    ok('parfums en stock : seulement les parfums, du plus recent au plus ancien', ai.perfumesInStock(demo).every((p) => ['p-pf1', 'p-pf2', 'p-pf3'].includes(p.id)) && ai.perfumesInStock(demo).length === 3);

    // --- articles similaires et autres articles de la categorie
    ok('modeles similaires : meme categorie, en stock, sans l\'article lui-meme, les plus proches en prix d\'abord', ai.similarProducts(demo, sandale).map((p) => p.id).join() === 'p-shoe2,p-shoe3', ai.similarProducts(demo, sandale).map((p) => p.id));
    ok('modeles similaires : un article en rupture n\'est jamais propose', !ai.similarProducts(demo, sandale, 10).some((p) => p.id === 'p-shoe4'));
    ok('modeles similaires : aucun autre dans la categorie = liste vide (Zara le dit)', ai.similarProducts(demo, montre).length === 0 && ai.similarProducts(demo, chemise).length === 0);
    ok('autres articles de la categorie : sans ceux deja regardes', ai.moreInCategory(demo, 'chaussures', ['p-shoe']).map((p) => p.id).sort().join() === 'p-shoe2,p-shoe3' && ai.moreInCategory(demo, 'chaussures', ['p-shoe', 'p-shoe2', 'p-shoe3']).length === 0 && ai.moreInCategory(demo, 'inconnu', []).length === 0);
    const av = ai.availability(demo);
    ok('disponibilite : article en stock oui, en rupture ou inconnu non ; categorie avec d\'autres articles a montrer', av.available('p-shoe') && !av.available('p-shoe4') && !av.available('nope') && av.categoryHasMore('chaussures', ['p-shoe']) && !av.categoryHasMore('chaussures', ['p-shoe', 'p-shoe2', 'p-shoe3']) && !av.categoryHasMore('montres', ['p-watch']));

    // --- le choix de la suggestion tient compte de ce que la boutique peut vraiment proposer
    const T0 = Date.UTC(2026, 9, 18, 8, 0, 0), MIN = 60000;
    const shoeMeta = { id: 'p-shoe4', name: 'Sandale rupture', categoryId: 'c1', categorySlug: 'chaussures', categoryName: 'Chaussures' };
    const meta2 = { id: 'p-shoe', name: 'Sandale cuir', categoryId: 'c1', categorySlug: 'chaussures', categoryName: 'Chaussures' };
    const otherMeta = { id: 'p-shirt', name: 'Chemise bleue', categoryId: 'c2', categorySlug: 'vetements', categoryName: 'Vêtements' };
    const seenTwice = (m: typeof shoeMeta) => { let p = bi.emptyProfile('v', T0); p = bi.applyProductView(p, m, T0).profile; p = bi.applyProductView(p, otherMeta, T0 + MIN).profile; return bi.applyProductView(p, m, T0 + 3 * MIN).profile; };
    ok('suggestion : l\'article qui revient est EN RUPTURE -> on ne le propose pas', bi.pickSuggestion(seenTwice(shoeMeta), { now: T0 + 5 * MIN, allowed: true, ...av }) === null);
    ok('...mais sans verification du stock (ancien comportement), il serait propose', bi.pickSuggestion(seenTwice(shoeMeta), { now: T0 + 5 * MIN, allowed: true })?.productId === 'p-shoe4');
    const pick = bi.pickSuggestion(seenTwice(meta2), { now: T0 + 5 * MIN, allowed: true, ...av });
    ok('suggestion : l\'article qui revient est en stock -> propose', pick?.productId === 'p-shoe' && pick.type === 'shoes', pick);
    let cat3 = bi.emptyProfile('v', T0);
    for (const [i, id] of ['p-shoe', 'p-shoe2', 'p-shoe3'].entries()) cat3 = bi.applyProductView(cat3, { id, name: `Sandale ${i}`, categorySlug: 'chaussures', categoryName: 'Chaussures' }, T0 + i * MIN).profile;
    ok('suggestion de categorie : tous les articles de la categorie ont deja ete vus -> rien a montrer, donc pas de suggestion', bi.pickSuggestion(cat3, { now: T0 + 6 * MIN, allowed: true, ...av }) === null && bi.pickSuggestion(cat3, { now: T0 + 6 * MIN, allowed: true })?.kind === 'category_browse');

    // --- les messages (textes de l'exemple du patron) et leurs boutons
    const sug = (over: Partial<bi.Suggestion>): bi.Suggestion => ({ kind: 'product_revisit', key: 'product:p-shoe', productId: 'p-shoe', categoryKey: 'chaussures', type: 'shoes', level: 'eleve', ...over });
    const shoes = ai.planSuggestion(sug({}), demo, 'fr');
    ok('chaussures : le message exact du patron, avec « Voir les tailles », « Modeles similaires », « Non merci »', shoes?.text === '😊 Cette paire semble vous intéresser ! Voulez-vous revoir les tailles disponibles ou découvrir des modèles similaires ?' && shoes.chips.map((c) => c.op).join() === 'sizes,similar,no', shoes);
    const cloth = ai.planSuggestion(sug({ kind: 'variants', key: 'product:p-shirt', productId: 'p-shirt', type: 'clothing' }), demo, 'fr');
    ok('vetement : « Ce modele vous plait ? 👕 Je peux vous presenter les couleurs et les tailles disponibles. » avec le bouton couleurs et tailles', cloth?.text === 'Ce modèle vous plaît ? 👕 Je peux vous présenter les couleurs et les tailles disponibles.' && cloth.chips.map((c) => c.op).join() === 'colors,similar,no', cloth);
    const perf = ai.planSuggestion(sug({ kind: 'perfume_browse', key: 'cat:parfum', productId: null, categoryKey: 'parfum', type: 'perfume' }), demo, 'fr');
    ok('plusieurs parfums : le message du patron et les 4 familles (fraiche, boisee, sucree, intense) + « Non merci »', perf?.text === '🥰 Vous découvrez plusieurs parfums. Préférez-vous une fragrance fraîche, boisée, sucrée ou intense ? Je peux vous aider à choisir.' && perf.chips.map((c) => `${c.op}:${c.arg}`).join() === 'family:fresh,family:woody,family:sweet,family:intense,no:', perf);
    const catPlan = ai.planSuggestion(sug({ kind: 'category_browse', key: 'cat:chaussures', productId: null, categoryKey: 'chaussures', type: 'shoes' }), demo, 'fr');
    ok('categorie : « J\'ai quelques suggestions qui pourraient vous plaire ! 🛍️ Voulez-vous voir d\'autres articles dans cette categorie ? »', catPlan?.text === 'J’ai quelques suggestions qui pourraient vous plaire ! 🛍️ Voulez-vous voir d’autres articles dans cette catégorie ?' && catPlan.chips.map((c) => `${c.op}:${c.arg}`).join() === 'more:chaussures,no:', catPlan);
    const perfOne = ai.planSuggestion(sug({ key: 'product:p-pf1', productId: 'p-pf1', type: 'perfume', categoryKey: 'parfum' }), demo, 'fr');
    ok('un parfum qui revient : proposer des parfums du meme genre', !!perfOne && /parfum/i.test(perfOne.text) && perfOne.chips.map((c) => c.op).join() === 'similar,no');
    const watch = ai.planSuggestion(sug({ key: 'product:p-watch', productId: 'p-watch', type: 'other', categoryKey: 'montres' }), demo, 'fr');
    ok('autre article sans tailles ni couleurs : seulement « modeles similaires » et « Non merci » (rien d\'invente)', !!watch && watch.chips.map((c) => c.op).join() === 'similar,no');
    ok('article sans taille : pas de bouton « Voir les tailles »', ai.planSuggestion(sug({ key: 'product:p-watch', productId: 'p-watch', type: 'shoes' }), demo, 'fr')?.chips.map((c) => c.op).join() === 'similar,no');
    ok('article en rupture, inconnu ou sans produit : aucun message', ai.planSuggestion(sug({ key: 'product:p-shoe4', productId: 'p-shoe4' }), demo, 'fr') === null && ai.planSuggestion(sug({ productId: 'inconnu' }), demo, 'fr') === null && ai.planSuggestion(sug({ productId: null }), demo, 'fr') === null);
    ok('aucun parfum en stock : pas de suggestion « parfums »', ai.planSuggestion(sug({ kind: 'perfume_browse', productId: null, type: 'perfume' }), [sandale], 'fr') === null);
    const arShoes = ai.planSuggestion(sug({}), demo, 'ar');
    ok('arabe : le message et les boutons sont en arabe', !!arShoes && l.hasArabic(arShoes.text) && arShoes.chips.every((c) => l.hasArabic(c.label)), arShoes);
    ok('aucun message de suggestion ne parle de suivi, de donnees ou de « je vous observe » (rien d\'alarmant)', [shoes, cloth, perf, catPlan, perfOne, watch, arShoes].every((x) => !!x && !/suivi|surveill|observ|donn[ée]es|trac|متابع|مراقب|تتبع/i.test(x.text)));

    // --- les textes du suivi : verite, pas d'alarme
    const tf = tx.texts('fr'), ta = tx.texts('ar');
    ok('« ne me suis plus » : confirme l\'arret ET l\'effacement', /ne retiens plus/.test(tf.tracking.stopped) && /effacé/.test(tf.tracking.stopped));
    ok('reponses sur les tailles et les couleurs : seulement ce que la fiche propose (jamais « stock par taille »)', tf.interest.sizesReply('Sandale', ['40', '41']) === 'Voici les tailles proposées pour « Sandale » : 40, 41 😊 Touchez le bouton + de la fiche pour l’ajouter à votre panier.' && !/stock/i.test(tf.interest.sizesReply('Sandale', ['40'])) && tf.interest.colorsReply('Sandale', ['Noir'], []) === 'Voici ce que propose « Sandale » 😊\n🎨 Couleurs : Noir');
    ok('rappel de l\'emballage cadeau apres chaque article : meme montant que la boutique (2 000 FCFA) en francais et en arabe, propose au moment de commander', tf.cart.wrapNudge.replace(/\s/g, '').includes('2000FCFA') && ta.cart.wrapNudge.replace(/\s/g, '').includes('2000FCFA') && l.hasArabic(ta.cart.wrapNudge) && !l.hasArabic(tf.cart.wrapNudge) && /au moment de commander/.test(tf.cart.wrapNudge) && tf.cart.wrapNudge.includes('🎁') && ta.cart.wrapNudge.includes('🎁'));
    ok('famille introuvable : Zara dit qu\'elle prefere ne rien inventer', /ne rien inventer/.test(tf.interest.familyNone('fraîche')) && /ألا أخترع/.test(ta.interest.familyNone('منعشة')));

    // --- sur le VRAI catalogue
    const realPerf = ai.perfumesInStock(catalog);
    const counts = Object.fromEntries(ai.FAMILIES.map((f) => [f, ai.familyPicks(catalog, f, 99).length]));
    console.log('info  vrai catalogue :', realPerf.length, 'parfums en stock ; annonces par leur fiche :', JSON.stringify(counts));
    ok('vrai catalogue : chaque parfum propose pour une famille est en stock, avec un prix, et sa fiche cite bien la famille', ai.FAMILIES.every((f) => ai.familyPicks(catalog, f, 99).every((p) => p.stock > 0 && p.price > 0 && ai.matchesFamily(p, f))));
    const realShoe = catalog.find((p) => p.stock > 0 && p.price > 0 && b.normalize(p.category).includes('chaussure'));
    if (realShoe) {
      const sim = ai.similarProducts(catalog, realShoe, 4);
      ok(`vrai catalogue : modeles similaires a « ${realShoe.name} » -> ${sim.length} articles de la meme categorie, en stock`, sim.every((p) => p.categorySlug === realShoe.categorySlug && p.stock > 0 && p.id !== realShoe.id));
      const planReal = ai.planSuggestion({ kind: 'product_revisit', key: `product:${realShoe.id}`, productId: realShoe.id, categoryKey: realShoe.categorySlug, type: bi.productTypeOf(realShoe.name, realShoe.categorySlug, realShoe.category), level: 'eleve' }, catalog, 'fr');
      ok('vrai catalogue : une suggestion pour une vraie chaussure en stock existe et propose les tailles reelles', !!planReal && planReal.chips.some((c) => c.op === 'sizes') === realShoe.sizes.length > 0, planReal && planReal.chips.map((c) => c.op));
    }
  }

  // ---- Tableau de suivi (administrateur) : lecture sure de la reponse de la base, textes lisibles ----
  console.log('\n== tableau de suivi : lecture de la base, filtres, durees');
  {
    const raw = {
      rows: [
        { visitor_ref: 'V-a1b2c3', account_ref: 'C-12345678', session_id: 's1', product_id: 'p1', product_name: 'Sandale', category_name: 'Chaussures', views: 4, sessions: 2, active_seconds: 185, last_duration_seconds: 62, last_viewed_at: '2026-10-18T08:00:00Z', variant_clicks: 7, cart_status: 'in_cart', order_status: 'paid', interest: 'eleve', last_suggestion_kind: 'product_revisit', last_suggestion_at: '2026-10-18T08:05:00Z' },
        { visitor_ref: 'V-0a0b0c', product_id: 'p3', product_name: 'Chemise', views: 1, interest: 'leger' },
      ],
      top_products: [{ product_id: 'p1', product_name: 'Sandale', category_name: 'Chaussures', views: 9, active_seconds: 420, visitors: 3, high_interest: 2 }],
      top_categories: [{ category: 'Chaussures', views: 11, visitors: 4 }, { views: 2 }],
      top_searches: [{ query: 'sandales', n: 6 }, { query: '', n: 3 }],
      levels: { eleve: 1, moyen: 0, leger: 2 },
      totals: { visitors: 3, rows: 2 },
    };
    const ov = bo.buildBrowsingOverview(raw);
    ok('lecture : la ligne complete est bien reprise (champs de la base -> champs de l\'ecran)', ov.rows[0].visitorRef === 'V-a1b2c3' && ov.rows[0].accountRef === 'C-12345678' && ov.rows[0].productName === 'Sandale' && ov.rows[0].activeSeconds === 185 && ov.rows[0].lastDurationSeconds === 62 && ov.rows[0].variantClicks === 7 && ov.rows[0].cartStatus === 'in_cart' && ov.rows[0].orderStatus === 'paid' && ov.rows[0].interest === 'eleve' && ov.rows[0].lastSuggestionKind === 'product_revisit', ov.rows[0]);
    ok('lecture : une ligne incomplete recoit des valeurs sures (0, « pas au panier », interet leger, aucune suggestion)', ov.rows[1].views === 1 && ov.rows[1].sessions === 0 && ov.rows[1].cartStatus === 'none' && ov.rows[1].accountRef === null && ov.rows[1].orderStatus === null && ov.rows[1].lastSuggestionKind === null && ov.rows[1].interest === 'leger');
    ok('lecture : classements, niveaux et totaux', ov.topProducts[0].highInterest === 2 && ov.topCategories[0].category === 'Chaussures' && ov.topCategories[1].category === 'Sans catégorie' && ov.topSearches.length === 1 && ov.topSearches[0].query === 'sandales' && ov.levels.eleve === 1 && ov.levels.leger === 2 && ov.totals.visitors === 3);
    const junk = bo.buildBrowsingOverview({ rows: [{ visitor_ref: null, product_id: 5, views: 'abc', interest: 'bizarre', cart_status: 'x', last_suggestion_kind: 'inconnu' }, null, 'texte'], levels: 'x', totals: null, top_products: 'x' });
    ok('donnees abimees (nombres illisibles, valeurs inconnues, lignes vides) : jamais d\'erreur, valeurs sures', junk.rows.length === 1 && junk.rows[0].views === 0 && junk.rows[0].interest === 'leger' && junk.rows[0].cartStatus === 'none' && junk.rows[0].lastSuggestionKind === null && junk.rows[0].productName === 'Article sans nom' && junk.totals.visitors === 0 && junk.topProducts.length === 0);
    ok('reponse vide, nulle ou inattendue : tout est vide, rien ne casse', [null, undefined, 5, 'x', [], {}].every((x) => { const e = bo.buildBrowsingOverview(x); return e.rows.length === 0 && e.levels.eleve === 0 && e.totals.rows === 0; }));
    ok('filtre par niveau d\'interet', bo.filterRows(ov.rows, 'all').length === 2 && bo.filterRows(ov.rows, 'eleve').length === 1 && bo.filterRows(ov.rows, 'moyen').length === 0 && bo.filterRows(ov.rows, 'leger')[0].productId === 'p3');
    ok('durees : secondes, minutes, heures', [[8, '8 s'], [59, '59 s'], [60, '1 min 00 s'], [75, '1 min 15 s'], [185, '3 min 05 s'], [3600, '1 h 00 min'], [3725, '1 h 02 min'], [-5, '0 s'], [8.6, '9 s']].every(([n, txt]) => bo.formatSeconds(n as number) === txt), [8, 75, 185, 3600].map((n) => bo.formatSeconds(n)));
    const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
    const ago = (ms: number) => bo.formatAgo(new Date(NOW - ms).toISOString(), NOW);
    ok('« il y a ... » : a l\'instant, minutes, heures, jours, date au-dela de 30 jours, vide si inconnu', ago(20000) === 'à l’instant' && ago(5 * 60000) === 'il y a 5 min' && ago(3 * 3600000) === 'il y a 3 h' && ago(2 * 86400000) === 'il y a 2 j' && /2026|2025/.test(ago(60 * 86400000)) && bo.formatAgo(null, NOW) === '—' && bo.formatAgo('pas une date', NOW) === '—', [ago(20000), ago(5 * 60000), ago(3 * 3600000), ago(2 * 86400000), ago(60 * 86400000)]);
    ok('libelles lisibles : panier, commande, suggestions, niveaux (sans jargon)', bo.CART_LABELS.in_cart === 'Au panier' && bo.CART_LABELS.purchased === 'Acheté' && bo.ORDER_STATUS_LABELS.delivered === 'Livrée' && bo.SUGGESTION_LABELS.perfume_browse === 'Familles de parfums' && bi.INTEREST_LABELS.eleve === 'Élevé' && bo.INTEREST_FILTERS.join() === 'all,eleve,moyen,leger');
  }

  // ---- Moments forts et achats en gros ----
  console.log('\n== moments forts (Tabaski, Ramadan...) et achats en gros (WhatsApp)');
  {
    const wholesaleYes = ['prix en gros', 'je veux le prix de gros', 'vous vendez en gros ?', 'prix par carton', 'un carton de parfum', 'je veux acheter en gros', 'grosse commande', 'grandes quantités', "c'est pour revendre", 'je suis grossiste', 'commande en quantité', 'je veux 50 pièces', '100 parfums svp', '20 chemises', 'combien le carton', 'سعر الجملة', 'اريد كرتون', 'بالجملة', 'كميات كبيرة', 'اريد 30 قطعة'.replace('قطعة', 'parfums')];
    const wholesaleNo = ['en gros je cherche un parfum', 'un parfum pour homme', 'une montre', 'je veux 2 parfums', '3 chemises', '5 pièces', 'budget 30000', 'rolex', 'chaussures 42', 'livraison à Moundou', 'merci beaucoup', 'tabaski', 'prix de la rolex', 'moins de 50000 fcfa'];
    ok('gros, cartons, grandes quantites, revente (francais et arabe) : reconnus comme « achat en gros »', wholesaleYes.every((t) => b.wantsWholesale(t) && b.detectIntent(t) === 'wholesale'), wholesaleYes.filter((t) => !(b.wantsWholesale(t) && b.detectIntent(t) === 'wholesale')));
    ok('« en gros je cherche... », petites quantites (2, 3, 5), budgets et prix : jamais pris pour un achat en gros', wholesaleNo.every((t) => !b.wantsWholesale(t) && b.detectIntent(t) !== 'wholesale'), wholesaleNo.filter((t) => b.wantsWholesale(t) || b.detectIntent(t) === 'wholesale'));
    const occYes: [string, oc.OccasionKey][] = [
      ['tabaski', 'tabaski'], ['Tabaski approche', 'tabaski'], ['un cadeau pour la Tabaski', 'tabaski'], ['aid el kebir', 'tabaski'], ['عيد الأضحى', 'tabaski'],
      ['ramadan', 'ramadan'], ['Ramadan Karim', 'ramadan'], ['رمضان', 'ramadan'],
      ['Korité', 'korite'], ['aid el fitr', 'korite'], ['عيد الفطر', 'korite'],
      ['mariage', 'wedding'], ['un cadeau de mariage', 'wedding'], ['je me marie', 'wedding'], ['زواج', 'wedding'], ['عرس', 'wedding'],
      ['fête des mères', 'mothersDay'], ['cadeau fete des meres', 'mothersDay'], ['عيد الأم', 'mothersDay'],
      ['Black Friday', 'blackFriday'], ['blackfriday', 'blackFriday'], ['الجمعة السوداء', 'blackFriday'],
      ['Saint-Valentin', 'valentine'], ['St Valentin', 'valentine'], ['valentine', 'valentine'], ['عيد الحب', 'valentine'],
    ];
    ok('moments forts reconnus (francais et arabe) : Tabaski, Ramadan, Korite, mariage, fete des meres, Black Friday, Saint-Valentin', occYes.every(([t, k]) => oc.occasionOf(t) === k), occYes.filter(([t, k]) => oc.occasionOf(t) !== k));
    const occNo = ['parfum pour homme', 'montre', 'chaussures noires', 'je veux un cadeau', 'anniversaire', 'livraison', 'promotions', 'black', 'ma mere', 'friday', 'rolex'];
    ok('sans moment fort : rien n\'est reconnu (« black » seul est une couleur, « ma mere » n\'est pas la fete des meres)', occNo.every((t) => oc.occasionOf(t) === null), occNo.filter((t) => oc.occasionOf(t) !== null));
    ok('le nom du moment fort est retire, le reste dit ce que cherche le client', oc.stripOccasion('un parfum pour la fête des mères') === 'un parfum pour la' && oc.stripOccasion('cadeau Tabaski budget 20000') === 'cadeau budget 20000' && oc.stripOccasion('Black Friday') === '');
    const d = (iso: string) => Date.parse(`${iso}T09:00:00Z`);
    ok('Zara parle d\'elle-meme seulement quand la date approche (Black Friday : 21 jours avant ; rien ailleurs)', oc.upcomingOccasion(d('2026-10-18')) === null && oc.upcomingOccasion(d('2026-11-05')) === null && oc.upcomingOccasion(d('2026-11-06')) === 'blackFriday' && oc.upcomingOccasion(d('2026-11-27')) === 'blackFriday' && oc.upcomingOccasion(d('2026-11-29')) === null);
    ok('Saint-Valentin (10 jours avant), Ramadan (14 jours avant, jusqu\'a 14 jours apres), Korite, Tabaski', oc.upcomingOccasion(d('2027-01-24')) === null && oc.upcomingOccasion(d('2027-01-26')) === 'ramadan' && oc.upcomingOccasion(d('2027-02-13')) === 'valentine' && oc.upcomingOccasion(d('2027-02-20')) === 'ramadan' && oc.upcomingOccasion(d('2027-03-05')) === 'korite' && oc.upcomingOccasion(d('2027-05-05')) === 'tabaski' && oc.upcomingOccasion(d('2027-06-01')) === null);
    ok('deux fetes proches : la plus proche passe en premier (le 10 fevrier 2027, le Ramadan a deja commence avant la Saint-Valentin)', oc.upcomingOccasion(d('2027-02-10')) === 'ramadan' && oc.upcomingOccasion(d('2027-02-13')) === 'valentine' && oc.upcomingOccasion(d('2027-02-04')) === 'ramadan');
    const tf2 = tx.texts('fr'), ta2 = tx.texts('ar');
    const keys: oc.OccasionKey[] = ['tabaski', 'ramadan', 'korite', 'wedding', 'mothersDay', 'valentine', 'blackFriday'];
    ok('textes des moments forts : tous presents en francais et en arabe (arabe avec de l\'arabe)', keys.every((k) => tf2.occasion[k].length > 20 && ta2.occasion[k].length > 20 && l.hasArabic(ta2.occasion[k]) && !l.hasArabic(tf2.occasion[k])));
    ok('aucune remise ni pourcentage annonces dans les messages des moments forts (seulement des idees, et « vraies promotions »)', keys.every((k) => !/%|\d+ ?FCFA de remise|-\s?\d+/.test(tf2.occasion[k].replace(/2\s000 FCFA/g, '')) && !/remise|solde|gratuit|offert/i.test(tf2.occasion[k])));
    ok('Black Friday : seulement les VRAIES promotions de la boutique', /vraies promotions/.test(tf2.occasion.blackFriday) && /العروض الحقيقية/.test(ta2.occasion.blackFriday));
    ok('l\'emballage cadeau cite dans les messages a le meme montant que la boutique (2 000 FCFA)', ['wedding', 'mothersDay', 'valentine'].every((k) => tf2.occasion[k as oc.OccasionKey].replace(/\s/g, '').includes('2000FCFA') && ta2.occasion[k as oc.OccasionKey].replace(/\s/g, '').includes('2000FCFA')));
    ok('gros : Zara ne donne AUCUN prix de gros (pas de chiffre, pas de FCFA) et envoie vers l\'equipe sur WhatsApp', !/\d/.test(tf2.wholesale.ask + tf2.wholesale.nudge) && /WhatsApp/.test(tf2.wholesale.ask) && /واتساب/.test(ta2.wholesale.ask) && /équipe/.test(tf2.wholesale.ask));
    ok('message WhatsApp deja ecrit pour l\'equipe : article, quantite (ou cartons), ville', tf2.wholesale.prefill('Parfum Oud').includes('« Parfum Oud »') && /Quantité/.test(tf2.wholesale.prefill(null)) && /Ville/.test(tf2.wholesale.prefill(null)) && !tf2.wholesale.prefill(null).includes('«') && l.hasArabic(ta2.wholesale.prefill('عطر')));
  }

  console.log('\n== Zara vendeuse : conclure la vente, preuves vraies, packs, rappel WhatsApp');
  {
    const cbYes = ['rappelez-moi', 'Rappelle moi demain', 'appelez moi svp', 'contactez-moi sur whatsapp', 'écrivez-moi plus tard', 'je veux que vous me rappeliez', 'pouvez-vous me contacter', 'ecris moi', 'اتصلوا بي', 'كلموني من فضلك', 'راسلوني على واتساب'];
    ok('« rappelez-moi » (francais et arabe) : le client demande que l\'equipe le recontacte', cbYes.every((t) => b.wantsCallback(t) && b.detectIntent(t) === 'callback'), cbYes.filter((t) => b.detectIntent(t) !== 'callback'));
    const cbNo = ['comment vous contacter', 'numero whatsapp', 'quelle est votre adresse', 'comment vous appelez-vous', 'je m\'appelle Moise', 'je veux commander', 'livraison', 'ou etes vous', 'je réfléchis', 'plus tard'];
    ok('pas de faux rappel : « comment vous contacter », « je m\'appelle Moise », « je réfléchis »...', cbNo.every((t) => !b.wantsCallback(t)), cbNo.filter((t) => b.wantsCallback(t)));
    ok('« je réfléchis » reste une hesitation (Zara conclut la vente), « c\'est cher » reste une objection de prix', b.detectIntent('je réfléchis') === 'later' && b.detectIntent('plus tard') === 'later' && b.detectIntent('c\'est cher') === 'price' && b.detectIntent('numero whatsapp') === 'contact');
    const okPhones = ['66 12 34 56', '+235 66 12 34 56', '00235 91 23 45 67', '٦٦١٢٣٤٥٦', '91234567'];
    const badPhones = ['12345678', '6612', '', 'abcdefgh', '5512345678', '66 12 34 5'];
    ok('numero WhatsApp du Tchad : 8 chiffres commencant par 6 ou 9 (+235 accepte), rien d\'autre', okPhones.every((t) => b.phoneFrom(t) !== null) && badPhones.every((t) => b.phoneFrom(t) === null), [okPhones.filter((t) => b.phoneFrom(t) === null), badPhones.filter((t) => b.phoneFrom(t) !== null)]);

    // preuves vraies
    const map = sa.buildSalesMap([{ product_id: 'a', orders_count: 12 }, { product_id: 'b', orders_count: 2 }, { product_id: 3, orders_count: 9 }, { product_id: 'c', orders_count: 'x' }, { product_id: 'd', orders_count: -4 }, null, { product_id: 'e', orders_count: 3.5 }]);
    ok('les ventes venant de la base : tout ce qui est douteux est ignore (id absent, nombre faux, negatif, decimal)', map.size === 2 && map.get('a') === 12 && map.get('b') === 2, [...map.entries()]);
    ok('reponse vide ou fonction absente : aucune vente, donc Zara ne dit AUCUN chiffre', sa.buildSalesMap(null).size === 0 && sa.buildSalesMap({ code: 'PGRST202' }).size === 0 && sa.provenSales(null, 'a') === 0 && sa.provenSales(undefined, 'a') === 0);
    ok(`un chiffre n'est annonce qu'a partir de ${sa.MIN_SALES_PROOF} commandes (2 : rien ; 3 : annonce ; 12 : annonce)`, sa.provenSales(map, 'b') === 0 && sa.provenSales(new Map([['x', 3]]), 'x') === 3 && sa.provenSales(map, 'a') === 12 && sa.provenSales(map, 'zzz') === 0);
    ok('l\'article le plus commande est choisi parmi ceux qui ont un chiffre solide (sinon aucun)', sa.bestSeller([{ id: 'b' }, { id: 'a' }], map)?.id === 'a' && sa.bestSeller([{ id: 'b' }, { id: 'q' }], map) === null && sa.bestSeller([], map) === null);
    const fr = tx.texts('fr'), ar = tx.texts('ar');
    ok('phrase de preuve : le vrai nombre, « 7 derniers jours », ni pourcentage ni promesse', /\b12\b/.test(fr.closing.proof(12)) && /7 derniers jours/.test(fr.closing.proof(12)) && !/%|garanti|meilleur|numero 1|n°\s?1/i.test(fr.closing.proof(12)) && /12/.test(ar.closing.proof(12)) && l.hasArabic(ar.closing.proof(12)));
    ok('stock bas : seulement entre 1 et ' + sa.LOW_STOCK_MAX + ' (jamais de fausse rarete)', sa.LOW_STOCK_MAX === 5);

    // packs : article qui complete, jamais celui deja au panier, jamais sans stock ni photo ; aucune remise
    const mk = (id: string, slug: string, price: number, stock = 5, image: string | null = 'x.jpg'): P => ({ id, name: `Article ${id}`, slug: `a-${id}`, price, compareAt: null, stock, category: slug, categorySlug: slug, colors: [], sizes: [], image, createdAt: 1, nameTokens: [], catTokens: [], descTokens: [] } as unknown as P);
    const cat = [mk('s1', 'chaussures', 30000), mk('p1', 'parfum', 12000), mk('p2', 'parfum', 18000), mk('m1', 'montre', 50000), mk('x1', 'parfum', 9000, 0), mk('x2', 'parfum', 8000, 4, null)];
    const base = { id: 's1', categorySlug: 'chaussures', price: 30000 };
    const c1 = sa.pickComplement(cat, base, ['s1'], null);
    ok('pack : apres des chaussures, un article d\'une categorie qui va avec (montre : sacs-et-bagages absent), en stock et avec photo', c1?.id === 'm1', c1?.id);
    const c2 = sa.pickComplement(cat.filter((p) => p.id !== 'm1'), { id: 's1', categorySlug: 'chaussures', price: 30000 }, ['s1'], null);
    ok('pack : jamais d\'article epuise ou sans photo (x1 et x2 sont ecartes)', c2 === null || (c2.stock > 0 && !!c2.image), c2?.id);
    const c3 = sa.pickComplement(cat, { id: 'm1', categorySlug: 'montre', price: 50000 }, ['m1'], new Map([['p2', 7], ['p1', 3]]));
    ok('pack : parmi les complements, le plus commande (chiffres vrais) passe en premier', c3?.id === 'p2', c3?.id);
    ok('pack : l\'article deja dans le panier n\'est jamais re-propose', sa.pickComplement(cat, { id: 'm1', categorySlug: 'montre', price: 50000 }, ['m1', 'p1', 'p2'], null) === null || sa.pickComplement(cat, { id: 'm1', categorySlug: 'montre', price: 50000 }, ['m1', 'p1', 'p2'], null)?.categorySlug !== 'parfum');
    ok('pack : aucun complement pour une categorie inconnue', sa.pickComplement(cat, { id: 'z', categorySlug: 'inconnue', price: 1 }, [], null) === null);
    ok('texte du pack : les deux articles et le total, sans remise ni pourcentage', /Article A/.test(fr.closing.pack('Article A', 'Article B', 42000)) && /42\s000 FCFA/.test(fr.closing.pack('Article A', 'Article B', 42000)) && !/remise|%|gratuit|offert|économ/i.test(fr.closing.pack('A', 'B', 42000) + fr.closing.packIntro) && l.hasArabic(ar.closing.pack('ساعة', 'عطر', 42000)));

    // rappel WhatsApp
    ok('note pour l\'equipe : articles sans doublon, court, avec « (+N) » si coupe', sa.callbackNote([]) === '' && sa.callbackNote(['Montre A', 'Montre A', ' Parfum B ']) === 'Montre A, Parfum B' && sa.callbackNote(['A'.repeat(100), 'B'.repeat(100), 'C'.repeat(100)], 150) === `${'A'.repeat(100)} (+2)` && sa.callbackNote(['A', 'B', 'C']).length < 281);
    const confirmFr = fr.callback.confirm('Awa', '66 12 34 56', 'Montre A', 'Jeudi 22 oct.');
    ok('confirmation avant d\'envoyer : prenom, numero, article, JOUR choisi et « C\'est d\'accord ? » (le client voit ce qui est transmis)', /Awa/.test(confirmFr) && /66 12 34 56/.test(confirmFr) && /Montre A/.test(confirmFr) && /Jeudi 22 oct\./.test(confirmFr) && /d’accord \?/.test(confirmFr) && /WhatsApp/.test(confirmFr) && !/Montre A/.test(fr.callback.confirm('Awa', '66 12 34 56', '', 'Jeudi 22 oct.')));
    const doneFr = fr.callback.done('Jeudi 22 oct.');
    ok('pas de double point apres le jour (« oct.. »), en francais comme en arabe', !/\.\./.test(confirmFr + doneFr + fr.callback.confirm('A', '66 12 34 56', 'B', 'Demain (mardi 20 oct.)') + fr.callback.done('Demain (mardi 20 oct.)')), [confirmFr, doneFr]);
    ok('textes du rappel et de la conclusion : tous presents en francais et en arabe, aucune promesse de delai precis', [fr.callback.askName, doneFr, fr.callback.askDay, fr.callback.badDay, fr.callback.failed, fr.callback.badPhone, fr.closing.later, fr.closing.cartKept, fr.closing.callbackOffer, fr.chip.callback, fr.chip.callbackDayFix].every((t) => t.length > 8) && [ar.callback.askName, ar.callback.done('الخميس'), ar.callback.askDay, ar.callback.badDay, ar.callback.failed, ar.callback.badPhone, ar.closing.later, ar.closing.cartKept, ar.closing.callbackOffer, ar.chip.callback, ar.chip.callbackDayFix].every((t) => l.hasArabic(t)) && /Jeudi 22 oct\./.test(doneFr) && !/\d+\s?(min|minutes|heures?)|dans l'heure|immédiatement/.test(doneFr + fr.closing.callbackOffer));

    // jour du rappel : les prochains jours ouvrables (heure du Tchad = UTC+1), jamais le dimanche, « aujourd'hui » seulement avant 15 h
    const lundiMatin = sa.callbackDays(new Date('2026-10-19T08:00:00Z'), 'fr');
    ok('jours proposes (lundi 9 h) : aujourd\'hui, demain, puis 3 autres jours', lundiMatin.length === 5 && lundiMatin[0].iso === '2026-10-19' && /^Aujourd’hui \(lundi 19 oct\.\)$/.test(lundiMatin[0].label) && lundiMatin[1].iso === '2026-10-20' && /^Demain \(mardi 20 oct\.\)$/.test(lundiMatin[1].label) && lundiMatin[4].iso === '2026-10-23' && lundiMatin[4].label === 'Vendredi 23 oct.', lundiMatin.map((d) => d.label));
    const lundiSoir = sa.callbackDays(new Date('2026-10-19T14:30:00Z'), 'fr');
    ok('apres 15 h (heure du Tchad) : « aujourd\'hui » n\'est plus propose', lundiSoir[0].iso === '2026-10-20' && lundiSoir.every((d) => d.offset >= 1), lundiSoir.map((d) => d.iso));
    const samedi = sa.callbackDays(new Date('2026-10-24T08:00:00Z'), 'fr');
    ok('le dimanche est saute (samedi 24 -> lundi 26)', samedi[0].iso === '2026-10-24' && samedi[1].iso === '2026-10-26' && samedi.every((d) => d.weekday !== 0), samedi.map((d) => d.iso));
    ok('le fuseau du Tchad compte (23 h 30 UTC = deja le lendemain a N\'Djamena)', sa.chadDayIso(new Date('2026-10-19T23:30:00Z')) === '2026-10-20' && sa.chadDayIso(new Date('2026-10-19T12:00:00Z')) === '2026-10-19');
    ok('jours en arabe : noms arabes, pas de mot francais', sa.callbackDays(new Date('2026-10-19T08:00:00Z'), 'ar').every((d) => l.hasArabic(d.label) && !/[a-z]/i.test(d.label)));
    ok('libelle d\'un jour de la base (AAAA-MM-JJ) : « vendredi 23 oct. », sans dependre du fuseau de l\'appareil', sa.dayLabelOf('2026-10-23') === 'vendredi 23 oct.' && sa.dayLabelOf('2026-10-25') === 'dimanche 25 oct.' && sa.dayLabelOf('n\'importe quoi') === 'n\'importe quoi');
    const pick = (t: string) => sa.dayFromText(t, lundiMatin)?.iso ?? null;
    ok('jour ecrit par le client : demain, aujourd\'hui, un nom de jour, « le 23 », en arabe', pick('demain') === '2026-10-20' && pick('aujourd hui') === '2026-10-19' && pick('jeudi') === '2026-10-22' && pick('le 23') === '2026-10-23' && pick('vendredi 23') === '2026-10-23' && pick('غدا') === '2026-10-20' && pick('اليوم') === '2026-10-19' && pick('الخميس') === '2026-10-22', ['demain', 'jeudi', 'le 23'].map(pick));
    ok('jour ecrit hors de la liste ou illisible : rien n\'est devine (dimanche, le 30, bonjour)', pick('dimanche') === null && pick('le 30') === null && pick('bonjour') === null && pick('') === null);
    ok('la validite 48 h annoncee est la vraie regle de la boutique', fr.closing.validity.includes('48 h') && ar.closing.validity.includes('48'));
    ok('aucun paiement ni coordonnee bancaire dans les messages de conclusion et de rappel', !/airtel|moov|carte|iban|code secret|mot de passe/i.test(JSON.stringify([fr.closing, fr.callback, fr.chip.callback])));
  }

  console.log('\n== Psychologie commerciale de Zara : style dit par le client, metier (ton seulement), trois gammes, comparer, fidelite, regles ethiques');
  {
    const fr = tx.texts('fr'), ar = tx.texts('ar');
    // --- le style que le client DIT aimer
    const styleCases: [string, ps.StyleKey | null][] = [
      ['j\'aime les tenues élégantes', 'elegant'], ['je cherche quelque chose de premium', 'elegant'], ['je veux du haut de gamme', 'elegant'], ['j\'aime le luxe', 'elegant'],
      ['je veux quelque chose de moderne', 'trend'], ['j\'aime ce qui est tendance', 'trend'], ['plutôt à la mode', 'trend'],
      ['j\'aime le sport', 'sport'], ['je cherche un look sportif', 'sport'], ['je veux un style décontracté', 'sport'],
      ['je cherche un petit prix', 'budget'], ['je veux quelque chose d\'économique', 'budget'], ['j\'aime les bonnes affaires', 'budget'], ['je cherche un bon plan', 'budget'],
      ['أحب الأناقة', 'elegant'], ['أريد شيئا فاخرا', 'elegant'], ['أحب ما هو عصري', 'trend'], ['أريد شيئا رياضيا', 'sport'], ['أبحث عن سعر مناسب', 'budget'],
      ['chaussures', null], ['montre moi un survêtement', null], ['rolex', null], ['élégant', null], ['je veux un parfum et une montre', null], ['', null],
      ['j\'aime l\'élégant mais aussi petit prix', null], // deux styles a la fois : Zara demande au lieu de deviner
    ];
    const badStyle = styleCases.filter(([t, k]) => ps.declaredStyle(t) !== k).map(([t]) => [t, ps.declaredStyle(t)]);
    ok(`style dit par le client (${styleCases.length} phrases, francais et arabe) : reconnu seulement quand c'est une vraie preference, jamais devine d'un mot de recherche`, badStyle.length === 0, badStyle);
    ok('un style par ses mots (reponse courte a la question « quel style ? ») : « élégant » -> elegant, « petit prix » -> budget, « sportif » -> sport', ps.styleWord('élégant') === 'elegant' && ps.styleWord('petit prix') === 'budget' && ps.styleWord('sportif') === 'sport' && ps.styleWord('bonjour') === null);

    // --- le metier : seulement le TON, jamais le budget
    const jobCases: [string, ps.JobKind | null][] = [
      ['je suis ingénieur', 'pro'], ['Je suis banquier', 'pro'], ['moi je suis entrepreneur', 'pro'], ['je travaille comme comptable', 'pro'], ['je suis cadre dans une banque', 'pro'],
      ['moi je suis étudiante', 'student'], ['je suis élève', 'student'], ['Bonjour je suis ingénieur chez Total', 'pro'],
      ['أنا مهندس', 'pro'], ['أنا طالب', 'student'], ['أنا طالبة', 'student'],
      ['je suis un cadre photo', null], ['je cherche un cadre', null], ['je suis Mahamat', null], ['ingénieur', null], ['je veux une montre', null],
    ];
    const badJob = jobCases.filter(([t, k]) => (ps.jobFrom(t)?.kind ?? null) !== k).map(([t]) => [t, ps.jobFrom(t)]);
    ok(`metier dit par le client (${jobCases.length} phrases) : reconnu juste apres « je suis... », jamais dans « un cadre photo » ni dans un prenom`, badJob.length === 0, badJob);
    ok('metier ecrit dans le compte (champ libre) : « Ingénieur » -> pro, « Étudiant en droit » -> student, « Commerçant » -> pro, vide ou inconnu -> rien', ps.jobKindOfProfession('Ingénieur') === 'pro' && ps.jobKindOfProfession('Étudiant en droit') === 'student' && ps.jobKindOfProfession('Commerçant') === 'pro' && ps.jobKindOfProfession('') === null && ps.jobKindOfProfession(null) === null && ps.jobKindOfProfession('Chanteur') === null);
    const tones = (['pro', 'student', null] as (ps.JobKind | null)[]).map((j) => ps.toneOf({ style: null, hesitant: false, loyal: false }));
    ok('REGLE : le metier ne dit rien du budget ni du style : sans preference dite par le client, le ton reste « neutral » (ingenieur, banquier, etudiant, inconnu)', tones.every((t) => t === 'neutral'));
    ok('le metier change seulement l\'ORDRE des boutons de style (memes 4 styles, rien d\'ajoute ni de retire) : pro -> elegant d\'abord, etudiant -> tendance d\'abord', ps.styleOrder('pro')[0] === 'elegant' && ps.styleOrder('student')[0] === 'trend' && [...ps.styleOrder('pro')].sort().join() === [...ps.styleOrder('student')].sort().join() && ps.styleOrder(null).length === 4 && ps.styleOrder('pro').includes('budget') && ps.styleOrder('student').includes('elegant'));
    ok('priorite du ton : le style dit par le client > hesitation > fidelite > neutre', ps.toneOf({ style: 'sport', hesitant: true, loyal: true }) === 'sport' && ps.toneOf({ style: null, hesitant: true, loyal: true }) === 'hesitant' && ps.toneOf({ style: null, hesitant: false, loyal: true }) === 'loyal' && ps.toneOf({ style: null, hesitant: false, loyal: false }) === 'neutral');

    // --- classer selon le style (catalogue de test : prix, stock, nouveaute, sport)
    const mkp = (id: string, price: number, extra: Partial<P> = {}): P => ({ id, name: `Article ${id}`, slug: `a-${id}`, price, compareAt: null, stock: 10, category: 'montre', categorySlug: 'montre', colors: [], sizes: [], image: 'x.jpg', createdAt: 1, nameTokens: [], catTokens: [], colorTokens: [], descTokens: [], ...extra } as unknown as P);
    const L = [mkp('a', 20000, { createdAt: 5 }), mkp('b', 8000, { createdAt: 9, nameTokens: ['survetement'] }), mkp('c', 45000, { createdAt: 1 }), mkp('d', 12000, { createdAt: 7, descTokens: ['sport'] }), mkp('e', 8000, { createdAt: 2, compareAt: 10000 })];
    const ids = (x: P[]) => x.map((p) => p.id).join('');
    ok('style : sans style, la liste ne change pas (meme ordre)', ps.rankForStyle(L, null) === L);
    ok('style « elegant » : du plus haut de gamme (prix) au plus accessible', ids(ps.rankForStyle(L, 'elegant')) === 'cadbe', ids(ps.rankForStyle(L, 'elegant')));
    ok('style « petit prix » : du plus accessible, remise vraie en premier a prix egal (e avant b)', ids(ps.rankForStyle(L, 'budget')) === 'ebdac', ids(ps.rankForStyle(L, 'budget')));
    ok('style « tendance » : les plus recents d\'abord', ids(ps.rankForStyle(L, 'trend')) === 'bdaec', ids(ps.rankForStyle(L, 'trend')));
    ok('style « sport » : les articles de sport d\'abord (survetement, sport), puis les autres dans l\'ordre de depart', ids(ps.rankForStyle(L, 'sport')) === 'bdace', ids(ps.rankForStyle(L, 'sport')));
    ok('classer ne change jamais le contenu : rien d\'ajoute, rien de retire, la liste d\'origine intacte', (['elegant', 'budget', 'trend', 'sport'] as ps.StyleKey[]).every((k) => ids(ps.rankForStyle(L, k)).split('').sort().join('') === 'abcde') && ids(L) === 'abcde');
    // le budget du client reste respecte meme avec un style
    const cat = [mkp('p1', 5000), mkp('p2', 15000), mkp('p3', 30000), mkp('p4', 60000)];
    const inB = m.pickInBudget(cat, null, { min: 0, max: 35000 }, 4, 'elegant');
    ok('budget + style : « elegant » avec un budget de 35 000 FCFA -> le plus haut de gamme DANS le budget en premier (30 000), jamais au-dessus du budget', inB.items.map((p) => p.id).join() === 'p3,p2,p1' && inB.items.every((p) => p.price <= 35000) && !inB.fallback, inB.items.map((p) => p.id));
    ok('style « petit prix » : le moins cher d\'abord ; sans style, comme avant (aucun changement)', m.pickInBudget(cat, null, { min: 0, max: Infinity }, 4, 'budget').items[0].id === 'p1' && m.pickInBudget(cat, null, { min: 0, max: Infinity }, 4).items.map((p) => p.id).join() === m.pickInBudget(cat, null, { min: 0, max: Infinity }, 4, null).items.map((p) => p.id).join());

    // --- trois gammes de prix : prix et stocks du catalogue seulement
    const R = ps.threeRanges(cat);
    ok('3 gammes : bon plan = le moins cher, style premium = le plus cher, coup de coeur = un autre article (le milieu sans gout connu) ; trois articles differents', !!R && R.deal.id === 'p1' && R.premium.id === 'p4' && !!R.favorite && ['p2', 'p3'].includes(R.favorite.id) && new Set([R.deal.id, R.favorite.id, R.premium.id]).size === 3, R && [R.deal.id, R.favorite?.id, R.premium.id]);
    const R2 = ps.threeRanges(cat, { liked: ['p3', 'p2'] });
    ok('3 gammes : le coup de coeur suit l\'article que le client a le plus regarde (p3), sans jamais prendre le bon plan ni le premium', R2?.favorite?.id === 'p3' && ps.threeRanges(cat, { liked: ['p1', 'p4'] })?.favorite?.id !== 'p1' && ps.threeRanges(cat, { liked: ['p1', 'p4'] })?.favorite?.id !== 'p4');
    ok('3 gammes : avec un style dit (« tendance » : le plus recent), le coup de coeur le suit', ps.threeRanges([mkp('x', 5000), mkp('y', 15000, { createdAt: 1 }), mkp('z', 30000, { createdAt: 9 }), mkp('w', 60000)], { style: 'trend' })?.favorite?.id === 'z');
    ok('3 gammes : deux articles seulement -> deux idees (pas de coup de coeur invente) ; moins de deux, ou prix presque egaux (moins de 20 % d\'ecart), ou meme prix -> aucune gamme', ps.threeRanges([mkp('a', 5000), mkp('b', 20000)])?.favorite === null && ps.threeRanges([mkp('a', 5000)]) === null && ps.threeRanges([mkp('a', 10000), mkp('b', 11000)]) === null && ps.threeRanges([mkp('a', 10000), mkp('b', 10000)]) === null && ps.threeRanges([]) === null);
    ok('3 gammes : un article epuise (stock 0) ou sans prix n\'est jamais propose ; un article en double compte une fois', (() => { const r = ps.threeRanges([mkp('a', 5000, { stock: 0 }), mkp('b', 9000), mkp('c', 30000), mkp('c', 30000)]); return !!r && r.deal.id === 'b' && r.premium.id === 'c'; })());

    // --- comparer deux articles : prix, couleurs, tailles (rien sur la qualite)
    const cf = ps.compareFacts(mkp('a', 25000, { colors: ['noir', 'bleu', 'gris'], sizes: ['M', 'L'] }), mkp('b', 17500, { colors: ['noir'], sizes: ['M'] }));
    ok('comparer : le moins cher (b), l\'ecart exact (7 500 FCFA), le plus de choix (a : 5 contre 2)', cf.cheaper?.id === 'b' && cf.diff === 7500 && cf.moreChoice?.id === 'a', cf);
    const cf2 = ps.compareFacts(mkp('a', 10000, { colors: ['noir'] }), mkp('b', 10000, { colors: ['bleu'] }));
    ok('comparer : meme prix -> aucun « moins cher », meme choix -> aucun « plus de choix » (rien d\'invente)', cf2.cheaper === null && cf2.diff === 0 && cf2.moreChoice === null);

    // --- intentions : « trois gammes », « comparer »
    const rangesYes = ['trois gammes de prix', 'je veux 3 options', 'plusieurs gammes de prix svp', 'donne moi trois idées', 'différents prix', 'ثلاثة خيارات بأسعار مختلفة', 'عندك عدة فئات سعرية؟'];
    const compareYes = ['comparer ces articles', 'compare les deux', 'quelle différence entre ces deux modèles ?', 'lequel choisir ?', 'laquelle est mieux', 'قارن بين هذه المنتجات', 'ما الفرق بين الاثنين؟ الفرق بين'];
    ok('intention « trois gammes » (francais et arabe) reconnue', rangesYes.every((t) => b.wantsRanges(t) && b.detectIntent(t) === 'ranges'), rangesYes.filter((t) => b.detectIntent(t) !== 'ranges'));
    ok('intention « comparer » (francais et arabe) reconnue', compareYes.every((t) => b.wantsCompare(t) && b.detectIntent(t) === 'compare'), compareYes.filter((t) => b.detectIntent(t) !== 'compare'));
    const notThose = ['rolex', 'chaussures', 'je veux commander', 'c\'est cher', 'promotions', 'livraison', 'je réfléchis', 'budget', 'trois chemises svp', 'bonjour', 'conseil'];
    ok('pas de fausse alerte : les autres demandes gardent leur intention', notThose.every((t) => !b.wantsRanges(t) && !b.wantsCompare(t)), notThose.filter((t) => b.wantsRanges(t) || b.wantsCompare(t)));

    // --- textes : completude (francais et arabe) et REGLES ETHIQUES
    const tonesKeys = ['elegant', 'trend', 'sport', 'budget', 'hesitant', 'loyal', 'neutral'] as const;
    ok('phrases de ton : au moins 3 pour chaque style (rotation sans repetition), 1 pour hesitation et fidelite, aucune pour « neutral » (l\'encouragement habituel sert) ; meme nombre en arabe', (['elegant', 'trend', 'sport', 'budget'] as const).every((k) => fr.persona.tone[k].length >= 3) && fr.persona.tone.hesitant.length >= 1 && fr.persona.tone.loyal.length >= 1 && fr.persona.tone.neutral.length === 0 && tonesKeys.every((k) => fr.persona.tone[k].length === ar.persona.tone[k].length));
    const collect = (t: ReturnType<typeof tx.texts>, withArgs: boolean) => {
      const x = t.persona;
      const price = '12 500 FCFA';
      return [
        x.askStyle, x.compareOffer, x.jobAck.pro, x.jobAck.student, ...Object.values(x.styleSet), ...tonesKeys.flatMap((k) => x.tone[k]),
        x.ranges.intro, x.ranges.closing, x.ranges.tooClose, x.ranges.deal('Article', price), x.ranges.favorite('Article', price), x.ranges.premium('Article', price),
        x.compare.intro, x.compare.samePrice, x.compare.ask, x.compare.needTwo, x.compare.line('Article', price, [withArgs ? '2 couleurs' : 'لونان']), x.compare.cheaper('Article', '2 500 FCFA'), x.compare.moreChoice('Article'), x.compare.colors(2), x.compare.sizes('40, 41'),
        x.loyal.intro, x.loyal.points(30, 'argent', 20, 'or'), x.loyal.points(100, 'diamond', 0, null),
        t.chip.styleElegant, t.chip.styleTrend, t.chip.styleSport, t.chip.styleBudget, t.chip.myStyle, t.chip.ranges, t.chip.compare, t.chip.newForMe, t.chip.take('Article'),
      ];
    };
    const allFr = collect(fr, true), allAr = collect(ar, false);
    ok('REGLE ETHIQUE : aucune fausse rarete, exclusivite, urgence, pression ni mot qui rabaisse dans les textes de vente (francais et arabe)', [...allFr, ...allAr].every((t) => !ps.FORBIDDEN_CLAIMS.test(t)), [...allFr, ...allAr].filter((t) => ps.FORBIDDEN_CLAIMS.test(t)));
    ok('REGLE ETHIQUE : aucun pourcentage, aucune remise ni promotion inventee dans ces textes (seuls les prix du catalogue passent en parametre)', [...allFr, ...allAr].every((t) => !/%|remise|promo|gratuit|offert|réduction|reduction|تخفيض|خصم|مجان/.test(t)), [...allFr, ...allAr].filter((t) => /%|remise|promo|gratuit|offert|réduction|reduction|تخفيض|خصم|مجان/.test(t)));
    ok('REGLE ETHIQUE : « premium » est decrit par ce qui est vrai (le plus haut de gamme de la selection, par le prix), jamais par une qualite ou des finitions non verifiees', /le plus haut de gamme de cette sélection/.test(fr.persona.ranges.premium('A', '1 FCFA')) && !/finition|qualité supérieure|matière/i.test(allFr.join(' ')));
    ok('REGLE : Zara ne revele jamais ce qu\'elle a vu de la navigation du client (« vous avez regarde », « historique », « j\'ai vu que vous »...) dans ses textes de vente', [...allFr, ...allAr].every((t) => !/vous avez (regard|consult|vu)|j ai vu|j'ai vu|j’ai vu|historique|je vous (suis|surveille)|مشاهدت|شاهدت|سجل تصفح|راقبت/i.test(t)), [...allFr, ...allAr].filter((t) => /vous avez (regard|consult|vu)|j’ai vu|historique|مشاهدت|شاهدت/i.test(t)));
    ok('textes : tout est present en arabe (aucune chaine vide), sans mot francais', allAr.every((t) => t.length > 3) && allAr.every((t) => !/[A-Za-z]{4,}/.test(t.replace(/FCFA|Article/g, ''))), allAr.filter((t) => /[A-Za-z]{4,}/.test(t.replace(/FCFA|Article/g, ''))));
    ok('le metier valorise sans rien supposer : la phrase de reponse au metier ne parle ni de prix, ni de budget, ni d\'argent, et pose la question du style', [fr.persona.jobAck.pro, fr.persona.jobAck.student].every((t) => !/budget|prix|argent|riche|moyens|salaire/i.test(t.replace('petit prix', '')) && /élégant/.test(t)) && /\?/.test(fr.persona.jobAck.pro));
    ok('loyaute : les points affiches viennent du compte (parametre), le grade suivant seulement s\'il reste des points a gagner', /Vos points : 30/.test(fr.persona.loyal.points(30, 'argent', 20, 'or')) && /20 points pour le grade Or/.test(fr.persona.loyal.points(30, 'argent', 20, 'or')) && !/pour le grade/.test(fr.persona.loyal.points(100, 'diamond', 0, null)) && /Diamond/.test(fr.persona.loyal.points(100, 'diamond', 0, null)), [fr.persona.loyal.points(30, 'argent', 20, 'or'), fr.persona.loyal.points(100, 'diamond', 0, null)]);
    ok('comparer : le texte donne le prix, les couleurs, les tailles et l\'ecart exact ; une seule phrase « le plus accessible »', /Article : 12 500 FCFA · 2 couleurs/.test(fr.persona.compare.line('Article', '12 500 FCFA', ['2 couleurs'])) && /2 500 FCFA de moins/.test(fr.persona.compare.cheaper('Article', '2 500 FCFA')) && fr.persona.compare.colors(1) === '1 couleur' && fr.persona.compare.colors(3) === '3 couleurs');
  }

  {
    console.log('\n== Categorie touchee dans le chat : les articles s\'affichent dans le chat');
    const fr = tx.texts('fr'), ar = tx.texts('ar');
    ok('categorie : titre avec le nom et le nombre d\'articles disponibles, le prenom du client a sa place', fr.categoryIntro('Montre', 12) === '🛍️ Montre : voici nos articles{nom} 👇 (12 disponibles)' && fr.categoryIntro('Montre', 1) === '🛍️ Montre : voici nos articles{nom} 👇', [fr.categoryIntro('Montre', 12), fr.categoryIntro('Montre', 1)]);
    ok('categorie : « la suite » dit ou on en est (7 a 12 sur 12)', fr.categoryMore('Montre', 7, 12, 12) === '🛍️ Montre : la suite, 7 à 12 sur 12 👇' && /7.*12.*12/.test(ar.categoryMore('ساعات', 7, 12, 12)));
    ok('categorie : boutons « Voir plus » et « Page » en francais et en arabe', fr.chip.seeMore === '➕ Voir plus' && fr.chip.categoryPage('Montre') === '📄 Page « Montre »' && /عرض المزيد/.test(ar.chip.seeMore) && /ساعات/.test(ar.chip.categoryPage('ساعات')));
  }

  {
    console.log('\n== Partage Facebook d\'une fiche produit : l\'application Facebook sur telephone, pas le navigateur');
    const page = 'https://www.albasseshopping.com/produit/rolex-or?ref=a&b=1';
    const web = fb.facebookSharerUrl(page);
    ok('la page de partage Facebook contient le lien de l\'article (encode une fois)', web === 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(page), web);
    const android = fb.facebookShareTarget(page, 'android');
    const m1 = /^intent:\/\/facewebmodal\/f\?href=([^#]+)#Intent;scheme=fb;package=com\.facebook\.katana;S\.browser_fallback_url=([^;]+);end$/.exec(android.url);
    ok('Android (Chrome) : ouverture de l\'application Facebook (fb://facewebmodal), page de partage du site seulement sans l\'application', android.kind === 'intent' && !!m1 && decodeURIComponent(m1[1]) === web && decodeURIComponent(m1[2]) === web, android);
    const app = fb.facebookShareTarget(page, 'android-app');
    ok('Android dans l\'application Albasse : fb:// d\'abord, puis la page de partage si Facebook ne s\'ouvre pas', app.kind === 'app' && app.url === 'fb://facewebmodal/f?href=' + encodeURIComponent(web) && app.fallback === web, app);
    ok('le lien de l\'article arrive intact dans l\'application Facebook (href decode -> u decode)', new URL(decodeURIComponent(app.url.split('href=')[1])).searchParams.get('u') === page);
    const ios = fb.facebookShareTarget(page, 'ios');
    ok('iPhone : le lien facebook.com touche (lien universel : l\'application Facebook s\'ouvre si elle est installee)', ios.kind === 'link' && ios.url === web, ios);
    const desk = fb.facebookShareTarget(page, 'desktop');
    ok('ordinateur : la page de partage dans un nouvel onglet (comme avant)', desk.kind === 'tab' && desk.url === web, desk);
    ok('sans navigateur (tests) : appareil « ordinateur »', fb.currentFacebookDevice() === 'desktop');
  }

  {
    console.log('\n== Navigateur de Facebook / WhatsApp : ouvrir la page dans Chrome pour pouvoir installer');
    const href = 'https://www.albasseshopping.com/produit/rolex-or?ref=a&b=1';
    const url = chromeIntentUrl(href);
    const m = /^intent:\/\/www\.albasseshopping\.com\/produit\/rolex-or\?ref=a&b=1#Intent;scheme=https;package=com\.android\.chrome;S\.browser_fallback_url=([^;]+);end$/.exec(url);
    ok('« Ouvrir dans Chrome » : la meme page (chemin et parametres) dans Chrome, et la page reste ouverte si Chrome manque', !!m && decodeURIComponent(m[1]) === href, url);
  }

  {
    console.log('\n== Notifications push programmees : heure du Tchad, titre, verifications');
    ok('18:30 au Tchad = 17:30 UTC (UTC+1 toute l\'annee)', sp.chadToIso('2026-10-21', '18:30') === '2026-10-21T17:30:00.000Z');
    ok('minuit au Tchad = 23:00 UTC la veille', sp.chadToIso('2026-10-21', '00:00') === '2026-10-20T23:00:00.000Z');
    ok('date ou heure invalide : rien', sp.chadToIso('21/10/2026', '18:30') === null && sp.chadToIso('2026-10-21', '6h') === null && sp.chadToIso('', '') === null);
    ok('heure du Tchad d\'un instant', sp.chadTimeOf('2026-10-21T17:30:00.000Z') === '18:30' && sp.chadTimeOf('2026-10-20T23:00:00.000Z') === '00:00');
    ok('libelle : « mercredi 21 oct. a 18:30 »', sp.chadLabel('2026-10-21T17:30:00.000Z') === 'mercredi 21 oct. à 18:30', sp.chadLabel('2026-10-21T17:30:00.000Z'));
    ok('titre : le nom de l\'article avec 🛍️, coupe proprement a 60 caracteres', sp.pushTitleFor('  Rolex   or  ') === '🛍️ Rolex or' && sp.pushTitleFor('x'.repeat(100)).length <= 60 && sp.pushTitleFor('x'.repeat(100)).endsWith('…'));
    const now = new Date('2026-10-21T10:15:00.000Z'); // 11:15 au Tchad
    ok('creneau par defaut : dans une heure, a l\'heure pile (12:00 au Tchad)', JSON.stringify(sp.defaultChadSlot(now)) === JSON.stringify({ date: '2026-10-21', time: '12:00' }), sp.defaultChadSlot(now));
    const base = { productId: 'p', message: 'Promo', date: '2026-10-21', time: '18:30' };
    ok('tout est bon : aucune remarque', sp.scheduleProblem(base, now) === null);
    ok('sans article / sans message / message trop long / sans heure / heure passee : la bonne remarque',
      sp.scheduleProblem({ ...base, productId: null }, now) === 'Choisissez un article.' &&
      sp.scheduleProblem({ ...base, message: '   ' }, now) === 'Écrivez un message court.' &&
      /trop long/.test(sp.scheduleProblem({ ...base, message: 'x'.repeat(121) }, now) || '') &&
      sp.scheduleProblem({ ...base, time: '' }, now) === 'Choisissez le jour et l’heure.' &&
      /déjà passée/.test(sp.scheduleProblem({ ...base, time: '11:00' }, now) || ''));
  }

  {
    console.log('\n== Clics des notifications programmees : la marque du telephone = celle de la base');
    const title = '🛍️ MANTEAU HOMME ORIGINAL', message = 'Ce soir seulement : -20 % sur cet article 🔥';
    const h = await sp.pushClickHash(title, message);
    ok('marque : 16 caracteres, la meme que dans la base (SHA-256 de « titre + ligne + message », emoji compris)', h === '3d2f2e1122f825b4', h);
    // le service worker du site (public/sw.js) calcule exactement la meme marque
    const { readFileSync } = await import('node:fs');
    const vm = await import('node:vm');
    const swContext: Record<string, unknown> = { self: { addEventListener() {}, location: { origin: 'https://www.albasseshopping.com' } }, crypto: globalThis.crypto, TextEncoder, URL, caches: {}, Response };
    vm.runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), swContext);
    const swTag = await (swContext.pushClickTag as (t: string, b: string) => Promise<string>)(title, message);
    ok('le service worker calcule la meme marque', swTag === h, swTag);
    const opened = await (swContext.withClickTag as (n: unknown, t: string) => Promise<string>)({ title, body: message }, 'https://www.albasseshopping.com/produit/manteau');
    ok('la page ouverte au toucher porte la marque ?push=…', opened === 'https://www.albasseshopping.com/produit/manteau?push=' + h, opened);
    ok('lecture de la marque dans l\'adresse (et rien si elle est absente ou mal formee)', sp.readPushTag('?push=' + h) === h && sp.readPushTag('?a=1&push=' + h + '&b=2') === h && sp.readPushTag('') === null && sp.readPushTag('?push=abc') === null && sp.readPushTag('?push=3D2F2E1122F825B4') === null);
    ok('statistiques : « 👆 3 clics » et « envoyee a 11 telephones · 27 % »', JSON.stringify(sp.clickStats(3, 11)) === JSON.stringify({ main: '👆 3 clics', sub: 'envoyée à 11 téléphones · 27 %' }), sp.clickStats(3, 11));
    ok('statistiques : 0 ou 1 clic au singulier, sans destinataires connus pas de pourcentage', sp.clickStats(0, null).main === '👆 0 clic' && sp.clickStats(1, 1).sub === 'envoyée à 1 téléphone · 100 %' && sp.clickStats(null, undefined).sub === null);
  }

  {
    console.log('\n== compte obligatoire a l\'entree, comptes crees avec le numero de telephone');
    const pa = await import('../../src/lib/phoneAuth.ts');
    const aw = await import('../../src/lib/accountWall.ts');
    const same = ['66 12 34 56', '66123456', '+235 66 12 34 56', '00235 66 12 34 56', '+235-66-12-34-56', '(+235) 66.12.34.56'].map(pa.phoneDigits);
    ok('le meme numero ecrit de plusieurs facons donne le meme compte (23566123456)', same.every((d) => d === '23566123456'), same);
    ok('numero etranger garde son indicatif ; trop court, trop long ou avec des lettres : refuse', pa.phoneDigits('+33 6 12 34 56 78') === '33612345678' && pa.phoneDigits('12') === null && pa.phoneDigits('1234567890123456') === null && pa.phoneDigits('66 12 ab 56') === null && pa.phoneDigits('') === null);
    ok('adresse du compte : 23566123456@tel.albasseshopping.com (rien pour un numero invalide)', pa.phoneLoginEmail('66 12 34 56') === '23566123456@tel.albasseshopping.com' && pa.phoneLoginEmail('abc') === null);
    ok('connexion : un numero donne l\'adresse du numero, un e-mail reste un e-mail (en minuscules)', pa.loginEmailFor(' 66 12 34 56 ') === '23566123456@tel.albasseshopping.com' && pa.loginEmailFor('Awa@Example.com') === 'awa@example.com' && pa.loginEmailFor('awa@') === null && pa.loginEmailFor('bonjour') === null);
    ok('l\'adresse tiree du numero ne s\'affiche jamais ; un vrai e-mail oui', pa.visibleEmail('23566123456@tel.albasseshopping.com') === null && pa.visibleEmail('ali@example.com') === 'ali@example.com' && pa.visibleEmail(null) === null && pa.isPhoneLoginEmail('X@TEL.ALBASSESHOPPING.COM'));
    ok('notification « Nouveau client » : l\'adresse devient le numero lisible', pa.withPrettyPhoneLogins('23566123456@tel.albasseshopping.com') === '📱 +235 66 12 34 56' && pa.withPrettyPhoneLogins('ali@example.com') === 'ali@example.com' && pa.withPrettyPhoneLogins('33612345678@tel.albasseshopping.com') === '📱 +33612345678');
    const base = { required: true, settingsLoading: false, authLoading: false, isAuthenticated: false, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/126.0 Mobile Safari/537.36' };
    ok('visiteur sans compte + compte obligatoire : le mur', aw.mustSignUp(base));
    ok('pas de mur : connecte, reglage coupe ou absent, pendant le chargement (reglage ou session)', !aw.mustSignUp({ ...base, isAuthenticated: true }) && !aw.mustSignUp({ ...base, required: false }) && !aw.mustSignUp({ ...base, required: undefined }) && !aw.mustSignUp({ ...base, settingsLoading: true }) && !aw.mustSignUp({ ...base, authLoading: true }));
    const bots = ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'meta-externalagent/1.1', 'WhatsApp/2.23.20.0 A', 'Mozilla/5.0 (compatible; bingbot/2.0)'];
    ok('robots de Google, Facebook, WhatsApp, Bing : pas de mur (articles sur Google, apercus des liens)', bots.every((ua) => !aw.mustSignUp({ ...base, userAgent: ua })));
    const people = ['Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0]', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0'];
    ok('vrais telephones (Cubot, navigateur de Facebook, Instagram) : le mur', people.every((ua) => aw.mustSignUp({ ...base, userAgent: ua })));
    ok('pages ouvertes sans compte : connexion, inscription, mot de passe, confidentialite, retours, contact ; le reste est couvert', ['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'PrivacyPolicy', 'ReturnPolicy', 'Contact'].every((r) => !aw.wallCovers(r)) && ['Tabs', 'Product', 'Category', 'Checkout', undefined].every((r) => aw.wallCovers(r)));
  }

  {
    console.log('\n== rappel des notifications (installe sans notifications)');
    const pr = await import('../../src/lib/pushReminderRule.ts');
    const now = Date.UTC(2026, 9, 20, 10);
    const day = 24 * 3600 * 1000;
    const base = { supported: true, permission: 'default' as const, installed: true, record: null, now };
    ok('installe, jamais demande : Zara propose d\'activer', pr.pushReminder(base) === 'ask');
    ok('pas installe, pas pris en charge (application Albasse, Safari hors ecran d\'accueil) ou deja active : rien', pr.pushReminder({ ...base, installed: false }) === 'none' && pr.pushReminder({ ...base, supported: false }) === 'none' && pr.pushReminder({ ...base, permission: 'granted' }) === 'none' && pr.pushReminder({ ...base, permission: null }) === 'none');
    ok('bloquees : les etapes pour debloquer', pr.pushReminder({ ...base, permission: 'denied' }) === 'blocked');
    const after = (outcome: string, ms: number) => pr.pushReminder({ ...base, record: { at: now - ms, outcome } });
    ok('question ignoree : redit le lendemain, pas avant', after('asked', day - 60000) === 'none' && after('asked', day + 60000) === 'ask');
    ok('« Plus tard » : 3 jours de pause', after('later', 3 * day - 60000) === 'none' && after('later', 3 * day + 60000) === 'ask');
    ok('etapes donnees : 7 jours de pause', pr.pushReminder({ ...base, permission: 'denied', record: { at: now - 6 * day, outcome: 'steps' } }) === 'none' && pr.pushReminder({ ...base, permission: 'denied', record: { at: now - 8 * day, outcome: 'steps' } }) === 'blocked');
    ok('le bouton du menu ignore la pause (tant que ce n\'est pas active)', pr.pushReminder({ ...base, record: { at: now, outcome: 'later' }, ignorePause: true }) === 'ask');
    const fr = tx.texts('fr');
    const ar = tx.texts('ar');
    ok('textes en francais et en arabe (rappel, bouton, bulle)', [fr.push.ask, fr.push.done, fr.push.later, fr.push.notGranted, fr.push.failed, fr.push.blockedAndroid, fr.push.blockedIos, ar.push.ask, ar.push.done, ar.push.later, ar.push.blockedAndroid].every((t) => t.length > 20) && fr.chip.enablePush === '🔔 Activer les notifications' && ar.chip.enablePush === '🔔 تفعيل الإشعارات' && fr.teaserPush('Ali') === '🔔 Ali, activez les notifications pour ne rater aucune promo !' && fr.teaserPush(null) === '🔔 Activez les notifications pour ne rater aucune promo !');
  }

  console.log('\n' + (failures === 0 ? 'TOUT EST BON' : `${failures} ECHEC(S)`));
  process.exit(failures === 0 ? 0 : 1);
}
main();
