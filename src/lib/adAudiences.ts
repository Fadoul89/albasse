// Les « publics » des annonces de Zara : femmes, hommes, élèves, étudiants, administrateurs (docs/zara-annonce-ciblee.md).
// Un client appartient à un public SEULEMENT d'après ce qu'il a lui-même écrit dans son compte : le genre choisi (Homme / Femme) et le métier
// (champ libre : « étudiant », « élève », « administrateur »…). Rien n'est deviné d'après le prénom ou le comportement.
// Des fonctions pures, sans réseau : testées dans tests/email/ad-targeting.test.ts.

import { normalize } from './assistantBrain';
import { genderOf } from './clientGender';
import { isSeniorProfession } from './zaraAds';

export type Audience = 'femme' | 'homme' | 'eleve' | 'etudiant' | 'admin';
export const AUDIENCES: Audience[] = ['femme', 'homme', 'eleve', 'etudiant', 'admin'];

export const AUDIENCE_LABEL: Record<Audience, { fr: string; ar: string; icon: string }> = {
  femme: { fr: 'Femmes', ar: 'النساء', icon: '👩' },
  homme: { fr: 'Hommes', ar: 'الرجال', icon: '👨' },
  eleve: { fr: 'Élèves', ar: 'التلاميذ', icon: '🎒' },
  etudiant: { fr: 'Étudiants', ar: 'الطلاب', icon: '🎓' },
  admin: { fr: 'Administrateurs et cadres', ar: 'الإداريون والمسؤولون', icon: '💼' },
};

// mots (accents et lettres arabes pliés comme normalize()) : tolère le pluriel, le féminin et les fautes courantes (« etudient »)
const hasWord = (tokens: string[], test: (t: string) => boolean) => tokens.some(test);

// Le public de métier d'après le champ « métier » du compte, ou null (champ vide, métier inconnu, texte sans rapport).
export function professionAudience(profession: string | null | undefined): 'eleve' | 'etudiant' | 'admin' | null {
  const n = normalize(profession ?? '');
  if (!n || n.length > 60) return null;
  const tokens = n.split(' ');
  if (hasWord(tokens, (t) => t.startsWith('etudi') || t.startsWith('student') || t.startsWith('universit') || t === 'طالب' || t === 'طالبه' || t === 'طلاب' || t === 'طالبات')) return 'etudiant';
  if (hasWord(tokens, (t) => /^eleves?$/.test(t) || /^(collegien|collegienne|lyceen|lyceenne|ecolier|ecoliere)s?$/.test(t) || t === 'تلميذ' || t === 'تلميذه' || t === 'تلاميذ')) return 'eleve';
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
