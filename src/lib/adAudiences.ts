// Les « publics » des annonces de Zara : femmes, hommes, élèves, étudiants, administrateurs, militaires et forces de l'ordre (docs/zara-annonce-ciblee.md).
// Un client appartient à un public SEULEMENT d'après ce qu'il a lui-même écrit dans son compte : le genre choisi (Homme / Femme) et le métier
// (champ libre : « étudiant », « élève », « administrateur », « militaire »…). Rien n'est deviné d'après le prénom ou le comportement.
// Des fonctions pures, sans réseau : testées dans tests/email/ad-targeting.test.ts.

import { normalize } from './assistantBrain';
import { genderOf } from './clientGender';
import { isSeniorProfession } from './zaraAds';

export type Audience = 'femme' | 'homme' | 'eleve' | 'etudiant' | 'admin' | 'forces';
export const AUDIENCES: Audience[] = ['femme', 'homme', 'eleve', 'etudiant', 'admin', 'forces'];

// Les articles que Zara propose aux militaires et forces de l'ordre (choisis par le patron, 8 novembre 2026) : le slug de la fiche.
// Un article de cette liste épuisé, retiré de la vente ou sans photo n'est pas proposé (Zara n'invente rien).
export const FORCES_PRODUCT_SLUGS: readonly string[] = ['bagde-groupe-sanguin'];

export const AUDIENCE_LABEL: Record<Audience, { fr: string; ar: string; icon: string }> = {
  femme: { fr: 'Femmes', ar: 'النساء', icon: '👩' },
  homme: { fr: 'Hommes', ar: 'الرجال', icon: '👨' },
  eleve: { fr: 'Élèves', ar: 'التلاميذ', icon: '🎒' },
  etudiant: { fr: 'Étudiants', ar: 'الطلاب', icon: '🎓' },
  admin: { fr: 'Administrateurs et cadres', ar: 'الإداريون والمسؤولون', icon: '💼' },
  forces: { fr: 'Militaires et forces de l’ordre', ar: 'العسكريون وقوات الأمن', icon: '🪖' },
};

// mots (accents et lettres arabes pliés comme normalize()) : tolère le pluriel, le féminin et les fautes courantes (« etudient »)
const hasWord = (tokens: string[], test: (t: string) => boolean) => tokens.some(test);

// Militaires et forces de l'ordre, d'après le métier écrit par le client (champ libre) : militaire, soldat, armée, police, policier, gendarme, douane,
// garde nationale, agent de sécurité, et les grades (sergent, caporal, adjudant, colonel…). Les fautes courantes sont tolérées (« policie », « douan »).
// Les grades qui existent aussi dans la vie civile (« général », « colonel », « commandant », « capitaine », « lieutenant », « commissaire ») ne comptent que
// s'ils ouvrent le métier (« Colonel », « Commandant de brigade ») : « directeur général » ou « employé général » ne sont PAS des militaires.
const FORCES_TOKEN = (t: string) =>
  /^(militaires?|military|soldats?|armees?|army|polic(?:e|es|ie|ier|iers|iere|ieres)|gendarm\w*|douan\w*|gnnt|sergents?|caporal|caporaux|adjudants?|parachutistes?|commandos?|vigiles?)$/.test(t) ||
  t.startsWith('عسكر') || t.startsWith('جند') || t.startsWith('شرط') || t.startsWith('درك') || t.startsWith('حرس') || t.startsWith('جيش') || t.startsWith('ضابط') || t.startsWith('جمارك');
const FORCES_PHRASE = /(?:^|\s)(?:garde (?:nationale?|nomade|republicain|presidentielle|du corps|penitentiaire)|agents? de securite|agents? securite|forces? (?:de l ordre|armees?|de securite)|gardiens? de la paix)(?:\s|$)/;
const RANK_FIRST = /^(?:ex |ancien |ancienne )?(?:general|colonel|commandant|capitaine|lieutenant|commissaire)(?:\s|$)/;
const CIVIL_WORDS = /(?:^|\s)(?:employe|employee|directeur|directrice|director|manager|president|presidente|dg|pdg|dga|gestionnaire|comptable|vendeur|vendeuse|commercant|commercante|consultant|ingenieur|chef d entreprise)(?:\s|$)/;
export function isForcesProfession(profession: string | null | undefined): boolean {
  const n = normalize(profession ?? '');
  if (!n || n.length > 60) return false;
  const tokens = n.split(' ');
  if (hasWord(tokens, FORCES_TOKEN) || FORCES_PHRASE.test(n)) return true;
  return RANK_FIRST.test(n) && !CIVIL_WORDS.test(n);
}

// Le public de métier d'après le champ « métier » du compte, ou null (champ vide, métier inconnu, texte sans rapport).
export function professionAudience(profession: string | null | undefined): 'eleve' | 'etudiant' | 'admin' | 'forces' | null {
  const n = normalize(profession ?? '');
  if (!n || n.length > 60) return null;
  const tokens = n.split(' ');
  if (hasWord(tokens, (t) => t.startsWith('etudi') || t.startsWith('student') || t.startsWith('universit') || t === 'طالب' || t === 'طالبه' || t === 'طلاب' || t === 'طالبات')) return 'etudiant';
  if (hasWord(tokens, (t) => /^eleves?$/.test(t) || /^(collegien|collegienne|lyceen|lyceenne|ecolier|ecoliere)s?$/.test(t) || t === 'تلميذ' || t === 'تلميذه' || t === 'تلاميذ')) return 'eleve';
  // militaires et forces de l'ordre avant « administrateurs et cadres » (« colonel », « commandant » sont aussi dans la liste des métiers haut placés)
  if (isForcesProfession(profession)) return 'forces';
  if (hasWord(tokens, (t) => t.startsWith('administrat') || t === 'اداري' || t === 'اداريه') || isSeniorProfession(profession)) return 'admin';
  return null;
}

// Tous les publics d'un client : son genre (s'il l'a choisi) et son public de métier (s'il en a un).
export function audiencesOf(customer: { gender?: unknown; profession?: string | null } | null | undefined): Audience[] {
  const out: Audience[] = [];
  const g = genderOf(customer?.gender);
  if (g) out.push(g);
  const p = professionAudience(customer?.profession);
  if (p) out.push(p);
  return out;
}
