// Zara et les émotions du client (docs/zara-emotions.md) : rêve, échec, peur, soupçon, difficulté, manque d'argent. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/zara/zara-emotion.test.ts
import { emotionFrom } from '../../src/lib/assistantEmotion.ts';
import { detectIntent } from '../../src/lib/assistantBrain.ts';
import { texts } from '../../src/lib/assistantText.ts';

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

const groups: Record<string, string[]> = {
  dream: ['je rêve de devenir quelqu\'un de respecté', 'mon rêve est d\'ouvrir mon commerce', 'je veux réussir dans la vie', 'je veux impressionner ma future belle-famille', 'je veux être respecté', 'mon objectif : changer ma vie', 'j\'aimerais devenir directeur', 'حلمي أن أكون ناجحا', 'أحلم بحياة أفضل', 'هدفي أن أنجح'],
  setback: ['j\'ai raté mon entretien', 'j\'ai échoué à mon examen', 'je n\'ai pas de chance', 'on s\'est moqué de moi', 'je me sens nul', 'j\'ai tout perdu', 'je suis découragé', 'j\'ai honte de moi', 'فشلت في الامتحان', 'رسبت هذه السنة', 'انا محبط'],
  fear: ['j\'ai peur de me faire arnaquer', 'j\'ai peur que la taille ne convienne pas', 'je m\'inquiète pour la livraison', 'je crains que ce soit de la copie', 'je suis stressé', 'انا خايف من النصب', 'اخاف ان لا يصل الطلب', 'انا قلق'],
  doubt: ['je me méfie', 'j\'ai des doutes sur ce site', 'je ne vous fais pas confiance', 'c\'est louche', 'je soupçonne une arnaque', 'on m\'a dit que c\'est une arnaque', 'اشك في هذا الموقع', 'لا اثق في المتاجر عبر الانترنت'],
  hardship: ['mon père est décédé', 'ma mère est malade', 'je suis en deuil', 'je suis malade', 'j\'ai perdu ma mère', 'توفي ابي', 'انا مريض'],
  money: ['je n\'ai plus d\'argent', 'je n\'ai plus d\'argent du tout', 'je suis au chômage', 'je suis sans travail', 'j\'ai perdu mon travail', 'j\'ai des dettes', 'je n\'ai pas les moyens', 'je suis fauché', 'je suis ruiné', 'ما عندي فلوس', 'انا عاطل عن العمل', 'عندي ديون'],
};
for (const [emotion, list] of Object.entries(groups)) {
  const bad = list.filter((t) => emotionFrom(t) !== emotion);
  check(`${emotion} : ${list.length} phrases (français et arabe) reconnues`, bad.length === 0, bad.map((t) => [t, emotionFrom(t)]));
}

// --- ce qui n'est PAS une émotion : une demande normale ne change jamais
const normal = [
  'bonjour',
  'je cherche une montre',
  'je veux un parfum pour homme',
  'je veux une robe rouge',
  'un cadeau pour un malade',
  'cadeau pour ma mère qui est à l\'hôpital',
  'quel est le prix',
  'montre pas chère',
  'je cherche un cadeau pour mon père',
  'combien coûte la livraison',
  'j\'ai perdu mon mot de passe',
  'je n\'arrive pas à me connecter',
  'je suis militaire',
  'comment commander',
  'quelles sont vos promotions',
  'je voudrais changer de taille',
  'je suis fatigué de chercher une montre',
  'أريد ساعة',
  'عطر رجالي',
];
check('une demande normale, un cadeau « pour un malade », « j\'ai perdu mon mot de passe » : aucune émotion (rien n\'est deviné)', normal.every((t) => emotionFrom(t) === null), normal.filter((t) => emotionFrom(t) !== null).map((t) => [t, emotionFrom(t)]));
check('une phrase très longue (plus de 40 mots) n\'est jamais lue comme une émotion', emotionFrom(Array.from({ length: 50 }, () => 'mot').join(' ') + ' j\'ai peur') === null);
check('texte vide ou espaces : aucune émotion', emotionFrom('') === null && emotionFrom('   ') === null);

// --- la difficulté passe avant tout : Zara ne vend rien
check('« je n\'ai plus d\'argent et j\'ai peur » : le manque d\'argent d\'abord (aucune vente, le programme d\'affiliation)', emotionFrom('je n\'ai plus d\'argent et j\'ai peur') === 'money');
check('« mon père est décédé et je n\'ai plus d\'argent » : le deuil d\'abord (aucune proposition du tout, même pas l\'affiliation)', emotionFrom('mon père est décédé et je n\'ai plus d\'argent') === 'hardship');
check('« je suis malade et au chômage » : la maladie d\'abord (aucune proposition)', emotionFrom('je suis malade et au chômage') === 'hardship');
check('« j\'ai raté mon examen, je rêve de réussir » : l\'échec d\'abord (soutien avant l\'ambition)', emotionFrom('j\'ai raté mon examen, je rêve de réussir') === 'setback');
check('« je me méfie, j\'ai peur » : le soupçon d\'abord (les faits à vérifier)', emotionFrom('je me méfie, j\'ai peur') === 'doubt');

// --- les anciens sujets ne bougent pas
check('« j\'ai peur d\'une arnaque » reste le sujet « confiance » du chat (la réponse vraie suit)', detectIntent('j\'ai peur d\'une arnaque') === 'trust');
check('« comment changer mon mot de passe » reste le sujet mot de passe', detectIntent('comment changer mon mot de passe') === 'password');

// --- les textes
const EMOTIONS = ['dream', 'setback', 'fear', 'doubt', 'hardship', 'money'] as const;
const NO_MONEY = ['dream', 'setback', 'fear', 'doubt', 'hardship'] as const; // « garanti » n'a sa place que dans « aucun gain n'est garanti »
for (const lang of ['fr', 'ar'] as const) {
  const t = texts(lang);
  for (const e of EMOTIONS) check(`[${lang}] ${e} : au moins 2 phrases différentes (Zara ne répète pas la même)`, t.emotion[e].length >= 2 && new Set(t.emotion[e]).size === t.emotion[e].length);
  const all = NO_MONEY.flatMap((e) => t.emotion[e]).join('\n');
  check(`[${lang}] aucune promesse de réussite, de santé ni de résultat`, !/garanti|à coup sûr|100 ?%|guéri|vous allez (?:réussir|guérir)|ستنجح حتما|مضمون|ستشفى/i.test(all), all.slice(0, 80));
  check(`[${lang}] aucune culpabilité ni pression d'achat (pas de « dernière chance », « ne ratez pas »)`, !/dernière chance|ne ratez|dépêchez|avant qu'il|آخر فرصة|لا تفوت|أسرع/i.test(all + '\n' + t.emotion.money.join('\n')));
  check(`[${lang}] difficulté (deuil, maladie) : aucun prix, aucune promotion, aucune invitation à commander ni à acheter, aucune affiliation`, !t.emotion.hardship.some((l) => /promotion|prix|FCFA|commander|offre|affiliation|commission|عرض|سعر|اطلب|تخفيض|عمولة|الشراكة/i.test(l)), t.emotion.hardship);
  check(`[${lang}] manque d'argent : le programme d'affiliation Albasse Shopping est proposé, gratuit, avec la commission sur les commandes livrées par SON lien`, t.emotion.money.every((l) => (lang === 'fr' ? /programme d’affiliation Albasse Shopping/.test(l) && /gratuit/.test(l) && /commission/.test(l) && /livrée/.test(l) : /Albasse Shopping/.test(l) && /مجاني/.test(l) && /عمولة/.test(l) && /يُسلَّم/.test(l))), t.emotion.money);
  check(`[${lang}] manque d'argent : le taux dépend de l'article, l'équipe valide la candidature, AUCUN gain n'est promis (jamais « gagnez », « revenu », « argent facile »)`, t.emotion.money.every((l) => (lang === 'fr' ? /(?:dépend de|selon) l’article/.test(l) && /valid/.test(l) && /(?:rien vous promettre|aucun gain)/.test(l) : /حسب المنتج/.test(l) && /(?:يراجع|يوافق)/.test(l) && /(?:لا أستطيع أن أعدك|لا يوجد أي ربح)/.test(l))) && !t.emotion.money.some((l) => /gagnez|gagner|revenu|riche|facile|garanti|rapidement|ستربح|ستكسب|ثراء|سهل|فورا/i.test(l.replace(/ربح مضمون/g, ''))), t.emotion.money);
  check(`[${lang}] manque d'argent : aucun prix, aucune promotion, aucune invitation à commander`, !t.emotion.money.some((l) => /promotion|prix|FCFA|commandez|achetez|عرض|سعر|اطلب|اشتر|تخفيض/i.test(l)), t.emotion.money);
  check(`[${lang}] peur et soupçon : la phrase annonce des faits à vérifier (elle finit par « : »)`, [...t.emotion.fear, ...t.emotion.doubt].every((l) => l.trim().endsWith(':')));
  check(`[${lang}] peur et soupçon : Zara ne confirme JAMAIS une accusation (pas de « vous avez raison, c'est une arnaque »)`, ![...t.emotion.fear, ...t.emotion.doubt].some((l) => /c.?est une arnaque|ils vous ont|on vous a menti|هم نصابون/i.test(l)));
  // le message de confiance : « plateforme marketplace », ni adresse de boutique ni téléphone (demande du patron)
  check(`[${lang}] confiance : Albasse Shopping est une plateforme marketplace, sans adresse de boutique ni téléphone`, (lang === 'fr' ? /plateforme marketplace/.test(t.trust) && !/Boutique|Marché Central|📍/.test(t.trust) : /منصة/.test(t.trust) && !/المتجر:|📍/.test(t.trust)) && !/📞|\+?235|60 60 51 51/.test(t.trust), t.trust);
}
check('[fr] chaque phrase de Zara est écrite au féminin quand elle parle d\'elle (« désolée »)', texts('fr').emotion.hardship[0].includes('désolée') && texts('fr').emotion.money[0].includes('désolée'));
check('[fr] confiance : toujours « Votre confiance compte pour nous », « depuis 2013 » et le paiement à la réception à N\'Djamena', /Votre confiance compte pour nous/.test(texts('fr').trust) && /depuis 2013/.test(texts('fr').trust) && /ne payez qu’en recevant votre commande/.test(texts('fr').trust));

console.log(`\n${ok} contrôles réussis`);
