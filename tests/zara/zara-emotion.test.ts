// Zara et les émotions du client (docs/zara-emotions.md) : rêve, échec, peur, soupçon, difficulté. Aucun réseau.
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
  hardship: ['je n\'ai plus d\'argent', 'je suis au chômage', 'je suis sans travail', 'j\'ai perdu mon travail', 'mon père est décédé', 'ma mère est malade', 'je suis en deuil', 'j\'ai des dettes', 'je n\'ai pas les moyens', 'je suis malade', 'ما عندي فلوس', 'انا عاطل عن العمل', 'توفي ابي', 'عندي ديون'],
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
check('« je n\'ai plus d\'argent et j\'ai peur » : difficulté d\'abord (aucune vente)', emotionFrom('je n\'ai plus d\'argent et j\'ai peur') === 'hardship');
check('« j\'ai raté mon examen, je rêve de réussir » : l\'échec d\'abord (soutien avant l\'ambition)', emotionFrom('j\'ai raté mon examen, je rêve de réussir') === 'setback');
check('« je me méfie, j\'ai peur » : le soupçon d\'abord (les faits à vérifier)', emotionFrom('je me méfie, j\'ai peur') === 'doubt');

// --- les anciens sujets ne bougent pas
check('« j\'ai peur d\'une arnaque » reste le sujet « confiance » du chat (la réponse vraie suit)', detectIntent('j\'ai peur d\'une arnaque') === 'trust');
check('« comment changer mon mot de passe » reste le sujet mot de passe', detectIntent('comment changer mon mot de passe') === 'password');

// --- les textes
const EMOTIONS = ['dream', 'setback', 'fear', 'doubt', 'hardship'] as const;
for (const lang of ['fr', 'ar'] as const) {
  const t = texts(lang);
  for (const e of EMOTIONS) check(`[${lang}] ${e} : au moins 2 phrases différentes (Zara ne répète pas la même)`, t.emotion[e].length >= 2 && new Set(t.emotion[e]).size === t.emotion[e].length);
  const all = EMOTIONS.flatMap((e) => t.emotion[e]).join('\n');
  check(`[${lang}] aucune promesse de réussite, de santé ni de résultat`, !/garanti|à coup sûr|100 ?%|guéri|vous allez (?:réussir|guérir)|ستنجح حتما|مضمون|ستشفى/i.test(all), all.slice(0, 80));
  check(`[${lang}] aucune culpabilité ni pression d'achat (pas de « dernière chance », « ne ratez pas »)`, !/dernière chance|ne ratez|dépêchez|avant qu'il|آخر فرصة|لا تفوت|أسرع/i.test(all));
  check(`[${lang}] difficulté : aucun prix, aucune promotion, aucune invitation à commander ni à acheter`, !t.emotion.hardship.some((l) => /promotion|prix|FCFA|commander|offre|عرض|سعر|اطلب|تخفيض/i.test(l)), t.emotion.hardship);
  check(`[${lang}] peur et soupçon : la phrase annonce des faits à vérifier (elle finit par « : »)`, [...t.emotion.fear, ...t.emotion.doubt].every((l) => l.trim().endsWith(':')));
  check(`[${lang}] peur et soupçon : Zara ne confirme JAMAIS une accusation (pas de « vous avez raison, c'est une arnaque »)`, ![...t.emotion.fear, ...t.emotion.doubt].some((l) => /c.?est une arnaque|ils vous ont|on vous a menti|هم نصابون/i.test(l)));
}
check('[fr] chaque phrase de Zara est écrite au féminin quand elle parle d\'elle (« désolée »)', texts('fr').emotion.hardship[0].includes('désolée'));

console.log(`\n${ok} contrôles réussis`);
