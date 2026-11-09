// Zara et les émotions du client (demande du patron, 8 novembre 2026) : « Les gens n'achètent pas pour des raisons logiques, ils achètent pour des raisons
// émotionnelles : ils sont prêts à tout pour ceux qui encouragent leurs rêves, justifient leurs échecs, apaisent leurs peurs, confirment leurs soupçons. »
// Zara écoute ce que le client écrit de LUI-MÊME (une phrase à la première personne) et répond d'abord à la personne, ensuite à l'article.
// Des fonctions pures, sans réseau : testées dans tests/zara/zara-emotion.test.ts. Voir docs/zara-emotions.md.
//
// Règles de fond (les mêmes que partout chez Zara : seul le VRAI parle) :
//  - rêve : elle encourage, sans rien promettre sur l'article (jamais « cet article vous fera réussir ») ;
//  - échec : elle soutient sans juger et sans excuser un tort : « un échec ne dit rien de votre valeur » ;
//  - peur et soupçon : elle donne raison au client de VÉRIFIER (c'est sa prudence qu'elle confirme, jamais une accusation fausse contre quelqu'un)
//    et lui donne des FAITS qu'il peut contrôler (paiement à la réception, boutique, téléphone, retours) ;
//  - difficulté (deuil, maladie) : AUCUNE vente, aucune pression : de la douceur, et l'équipe sur WhatsApp ;
//  - manque d'argent (« je n'ai plus d'argent », chômage, dettes) : aucune vente non plus ; Zara propose le programme d'affiliation Albasse Shopping
//    (gratuit, commission sur les commandes livrées par SON lien), sans rien promettre sur les gains (demande du patron, 9 novembre 2026) ;
//  - jamais de culpabilité, jamais de promesse de santé ou de réussite, jamais de pression sur quelqu'un de fragile.

import { normalize } from './assistantBrain';

export type Emotion = 'dream' | 'setback' | 'fear' | 'doubt' | 'hardship' | 'money';

// Les phrases passent par normalize() : sans accents, apostrophes en espaces, lettres arabes unifiées (ة -> ه, أ -> ا…).
// Le client parle de LUI : « je », « j'ai », « mon », « ma » ; « un cadeau pour un malade » ne compte pas comme une difficulté.
const HARDSHIP = new RegExp(
  [
    'je suis (?:en deuil|malade)',
    'j ai perdu (?:mon|ma|mes) (?:maison|pere|mere|mari|femme|fils|fille|enfant|frere|soeur)',
    '(?:mon|ma) (?:pere|mere|mari|femme|fils|fille|frere|soeur|enfant) (?:est|vient d etre) (?:decede|decedee|mort|morte|malade|hospitalise|hospitalisee)',
    '(?:mon|ma) (?:pere|mere|mari|femme|fils|fille|frere|soeur|enfant) (?:nous )?a quitt',
    'انا مريض|وفاه (?:ابي|امي|زوجي|زوجتي|ابني|اخي)|توفي (?:ابي|ابوي|امي|زوجي|اخي)|انا في حداد',
  ].join('|')
);

// Le manque d'argent, dit à la première personne : Zara ne vend rien, mais présente le programme d'affiliation (gratuit, honnête)
const MONEY = new RegExp(
  [
    'je n ai (?:plus |pas )d argent',
    'j ai (?:plus|pas) d argent',
    'je suis (?:fauche|ruine|ruinee|endette|endettee|au chomage|sans travail|sans emploi|sans boulot)',
    'j ai perdu (?:mon|ma|mes) (?:travail|emploi|boulot|place)',
    'je n ai pas les moyens',
    'je n arrive pas a payer',
    'j ai des dettes',
    'ما عندي (?:فلوس|مال|شغل)|ما عندي ما اشتري|انا مفلس|انا عاطل|عندي ديون',
  ].join('|')
);

const SETBACK = new RegExp(
  [
    'j ai (?:rate|echoue|tout perdu|fait faillite|honte)',
    'j ai (?:encore )?perdu (?:mon argent|mon commerce|mon entreprise|mon proces)',
    'je n y arrive (?:pas|plus)',
    'je n ai pas de chance',
    'pas de chance',
    'malchance',
    'on s est moque de moi',
    'je me sens (?:nul|nulle|inutile)',
    'je suis (?:decourage|decouragee|decu|decue|triste)',
    '(?:mon|ma) (?:echec|faillite|echecs)',
    'j ai echoue|فشلت|رسبت|خسرت|انا محبط|محبطه|محبط|ما عندي حظ|مالي حظ|اشعر بالفشل|استهزؤوا بي|سخروا مني|انا حزين|انا تعبان',
  ].join('|')
);

// « J'ai peur de me faire arnaquer », « j'ai peur de la taille », « je crains que » : une inquiétude dite à la première personne
const FEAR = /(?:^| )(?:j ai peur|j ai un peu peur|j ai tres peur|je crains|je m inquiete|je suis inquiet|je suis inquiete|je ne suis pas rassure|je ne suis pas rassuree|je suis stresse|je suis stressee|j ai la trouille)(?: |$)|انا خايف|انا خائف|اخاف|عندي خوف|انا قلق|قلقان|قلقه/;

// « Je me méfie », « j'ai des doutes », « c'est louche », « on m'a dit que c'est une arnaque » : un soupçon que le client veut vérifier
const DOUBT = /(?:^| )(?:je me mefie|je me mefies|j ai des doutes|j ai un doute|je doute|je soupconne|je ne vous fais pas confiance|je n ai pas confiance|c est louche|ca me semble louche|ca sent l arnaque|on m a dit que .{0,30}(?:arnaque|arnaqueur|faux|voleur|escroc|escroquerie))(?: |$)|اشك|عندي شك|لا اثق|ما اثق|مو واثق|مشكوك|يبدو لي نصب|قالوا لي ان/;

// Le rêve ou l'ambition : « je rêve de », « mon rêve », « je veux réussir / devenir / impressionner », « mon objectif »
const DREAM = /(?:^| )(?:je reve|je reve de|mon reve|j ai un reve|je revais|mon ambition|mon objectif|mon but|mon projet de vie|j aimerais (?:devenir|reussir|impressionner)|je veux (?:reussir|devenir|impressionner|changer de vie|etre (?:respecte|respectee|admire|admiree|elegant|elegante|beau|belle|fier|fiere)))(?: |$)|حلمي|احلم|هدفي|طموحي|اريد (?:ان) ?(?:انجح|اصبح|اغير حياتي|ابهر)|اريد النجاح/;

// L'émotion que le client exprime dans sa phrase, ou null. Une difficulté (deuil, maladie, manque d'argent) passe avant tout le reste : Zara ne vend alors rien.
export function emotionFrom(text: string): Emotion | null {
  const n = normalize(text);
  if (!n || n.split(' ').filter(Boolean).length > 40) return null;
  if (HARDSHIP.test(n)) return 'hardship'; // deuil, maladie : jamais de vente, même si l'argent manque aussi
  if (MONEY.test(n)) return 'money';
  if (SETBACK.test(n)) return 'setback';
  if (DOUBT.test(n)) return 'doubt';
  if (FEAR.test(n)) return 'fear';
  if (DREAM.test(n)) return 'dream';
  return null;
}
