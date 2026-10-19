// Psychologie commerciale de Zara : comprendre ce qui plaît au client, lui parler avec respect, lui proposer le bon article.
// Aucun réseau, aucun écran ici : tout est testable.
//
// Règles de fond (voir aussi les textes dans assistantText.ts, groupe « persona ») :
//  - le métier ne dit RIEN du budget : il change seulement le ton (l'ordre des questions) ; les préférences viennent du client ;
//  - jamais de fausse rareté, d'exclusivité, d'urgence ou de réduction inventée : seuls les prix et stocks du catalogue parlent ;
//  - personne n'est rabaissé à cause de son budget ou de son métier.

import { discount, normalize, type CatalogProduct } from './assistantBrain';
import type { StyleKey, ToneKey } from './assistantText';

export type { StyleKey, ToneKey };
export const STYLES: StyleKey[] = ['elegant', 'trend', 'sport', 'budget'];

// Ce que le client dit aimer. Les mots sont cherchés dans le texte déjà passé par normalize() (sans accents, arabe unifié).
const STYLE_WORDS: Record<StyleKey, RegExp> = {
  elegant: /\b(elegant|elegante|elegants|elegantes|elegance|classe|chic|raffine|raffinee|raffines|premium|luxe|luxueux|luxueuse|haut de gamme|prestige|soigne|soignee|soignes)\b|انيق|اناقه|فاخر|راقي|فخم|بريميوم|راقيه/,
  trend: /\b(tendance|tendances|moderne|modernes|a la mode|branche|branchee|trendy|actuel|actuels)\b|عصري|عصريه|موضه|حديث|مودرن/,
  sport: /\b(sport|sportif|sportive|sportifs|sportives|fitness|running|decontracte|decontractee)\b|رياضي|رياضه|رياضيه/,
  budget: /\b(petit prix|petits prix|economique|economiques|abordable|abordables|bon plan|bons plans|bonne affaire|bonnes affaires|petit budget|bas prix|prix doux)\b|اقتصادي|رخيص|رخيصه|سعر معقول|سعر مناسب|ميزانيه صغيره|اسعار مناسبه/,
};

// « J'aime... », « je cherche quelque chose de... », « mon style » : une vraie préférence, pas seulement un mot dans une recherche de produit.
const PREFERENCE_CUE = /\b(j aime|jaime|j adore|jadore|je prefere|je preferes|je voudrais|je veux|je cherche|plutot|quelque chose|un truc|du |de l |d un |d une |style|look|genre|mon style|envie|prefere)\b|احب|افضل|اريد|ابحث|شيء|شي |ستايل|ذوق/;

// Le style que le client dit aimer (null : rien de clair, ou plusieurs styles à la fois : Zara demande alors).
export function declaredStyle(text: string): StyleKey | null {
  const n = normalize(text);
  const tokens = n.split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.length > 14) return null;
  if (!PREFERENCE_CUE.test(` ${n} `)) return null;
  const found = STYLES.filter((k) => STYLE_WORDS[k].test(n));
  return found.length === 1 ? found[0] : null;
}

// Le style, seulement par ses mots (sans « j'aime… ») : pour lire un bouton ou une réponse courte à la question « quel style ? ».
export function styleWord(text: string): StyleKey | null {
  const n = normalize(text);
  const found = STYLES.filter((k) => STYLE_WORDS[k].test(n));
  return found.length === 1 ? found[0] : null;
}

// ---------------------------------------------------------------------------------------------
// Le métier : seulement pour le TON (jamais pour le budget ni le pouvoir d'achat)
// ---------------------------------------------------------------------------------------------

export type JobKind = 'pro' | 'student';

const PRO_JOBS = ['ingenieur', 'ingenieure', 'banquier', 'banquiere', 'entrepreneur', 'entrepreneure', 'cadre', 'directeur', 'directrice', 'medecin', 'docteur', 'avocat', 'avocate', 'comptable', 'enseignant', 'enseignante', 'professeur', 'commercant', 'commercante', 'fonctionnaire'];
const STUDENT_JOBS = ['etudiant', 'etudiante', 'eleve', 'lyceen', 'lyceenne', 'collegien', 'collegienne'];
const AR_PRO = ['مهندس', 'مهندسه', 'بنكي', 'موظف بنك', 'رجل اعمال', 'سيده اعمال', 'مدير', 'مديره', 'طبيب', 'طبيبه', 'دكتور', 'محامي', 'محاسب', 'معلم', 'معلمه', 'استاذ', 'استاذه', 'تاجر', 'موظف'];
const AR_STUDENT = ['طالب', 'طالبه', 'تلميذ', 'تلميذه'];

const FR_LABELS: Record<string, string> = { ingenieur: 'ingénieur', ingenieure: 'ingénieure', medecin: 'médecin', etudiant: 'étudiant', etudiante: 'étudiante', eleve: 'élève', lyceen: 'lycéen', lyceenne: 'lycéenne', collegien: 'collégien', collegienne: 'collégienne', banquiere: 'banquière', commercant: 'commerçant', commercante: 'commerçante' };

const word = (list: string[]) => list.map((w) => w.replace(/ /g, '\\s')).join('|');
// « je suis ingénieur », « moi je suis étudiante », « je travaille comme banquier », « أنا مهندس » : le métier est dit volontairement,
// juste après la formule (« je suis un cadre photo » ou « je cherche un cadre » ne comptent pas).
const JOB_RE = new RegExp(
  `(?:\\bje suis|\\bmoi c est|\\bje travaille (?:comme|en tant que)|\\ben tant que|\\bmon metier est|\\bma profession est)\\s+(?:un |une |l |le |la |d |de )?(${word([...PRO_JOBS, ...STUDENT_JOBS])})\\b(?=$|\\s(?:et|depuis|chez|a|dans|je|j|alors|donc|avec|mais|qui|en|au|pour|ici|de|du|d)\\b)`
);
const AR_JOB_RE = new RegExp(`(?:انا|اشتغل|مهنتي|وظيفتي)\\s+(?:ك|ال)?(${word([...AR_PRO, ...AR_STUDENT])})`);

export interface Job {
  kind: JobKind;
  label: string;
}

export function jobFrom(text: string): Job | null {
  const n = normalize(text);
  if (n.split(' ').filter(Boolean).length > 12) return null;
  const fr = JOB_RE.exec(n);
  if (fr) {
    const w = fr[1];
    return { kind: STUDENT_JOBS.includes(w) ? 'student' : 'pro', label: FR_LABELS[w] ?? w };
  }
  const ar = AR_JOB_RE.exec(n);
  if (ar) return { kind: AR_STUDENT.includes(ar[1]) ? 'student' : 'pro', label: ar[1] };
  return null;
}

// Le métier écrit dans le compte du client (champ libre, rempli par lui) : même lecture, sans phrase autour.
export function jobKindOfProfession(profession: string | null | undefined): JobKind | null {
  const n = normalize(profession ?? '');
  if (!n) return null;
  if ([...STUDENT_JOBS, ...AR_STUDENT].some((w) => n.includes(w))) return 'student';
  if ([...PRO_JOBS, ...AR_PRO].some((w) => n.includes(w))) return 'pro';
  return null;
}

// L'ordre des boutons de style : le métier ne décide de rien, il change seulement ce qu'on lit en premier.
export function styleOrder(job: JobKind | null): StyleKey[] {
  if (job === 'student') return ['trend', 'budget', 'sport', 'elegant'];
  return ['elegant', 'trend', 'sport', 'budget'];
}

// ---------------------------------------------------------------------------------------------
// Le ton de Zara
// ---------------------------------------------------------------------------------------------

export interface ToneInput {
  style: StyleKey | null; // dit par le client (jamais déduit de son métier)
  hesitant: boolean; // il vient de dire qu'il réfléchit
  loyal: boolean; // il a vraiment des points de fidélité
}

export function toneOf(i: ToneInput): ToneKey {
  if (i.style) return i.style;
  if (i.hesitant) return 'hesitant';
  if (i.loyal) return 'loyal';
  return 'neutral';
}

// ---------------------------------------------------------------------------------------------
// Classer et choisir : toujours dans le catalogue réel (prix, stock, photos)
// ---------------------------------------------------------------------------------------------

const SPORT_WORDS = ['sport', 'survetement', 'jogging', 'running', 'training', 'basket', 'baskets', 'maillot', 'short', 'fitness', 'football', 'sneakers'];
const isSporty = (p: CatalogProduct) => SPORT_WORDS.some((w) => p.nameTokens.includes(w) || p.descTokens.includes(w) || p.catTokens.includes(w));

// Remet la liste dans l'ordre du style choisi par le client (rien n'est ajouté ni retiré, l'ordre de départ sert d'égalité).
export function rankForStyle<T extends CatalogProduct>(list: T[], style: StyleKey | null): T[] {
  if (!style) return list;
  const indexed = list.map((p, i) => ({ p, i }));
  switch (style) {
    case 'elegant': // du plus haut de gamme (prix) vers le plus accessible
      indexed.sort((a, b) => b.p.price - a.p.price || a.i - b.i);
      break;
    case 'budget': // du plus accessible, remises vraies en premier à prix égal
      indexed.sort((a, b) => a.p.price - b.p.price || discount(b.p) - discount(a.p) || a.i - b.i);
      break;
    case 'trend': // les plus récents d'abord
      indexed.sort((a, b) => b.p.createdAt - a.p.createdAt || a.i - b.i);
      break;
    case 'sport': // les articles de sport d'abord
      indexed.sort((a, b) => Number(isSporty(b.p)) - Number(isSporty(a.p)) || a.i - b.i);
      break;
  }
  return indexed.map((x) => x.p);
}

export interface Ranges<T extends CatalogProduct = CatalogProduct> {
  deal: T; // bon plan : le plus accessible de la sélection
  favorite: T | null; // coup de coeur : ce qui correspond le mieux à ses goûts
  premium: T; // style premium : le plus haut de gamme de la sélection (par le prix)
}

// Trois idées à trois niveaux de prix. Il faut au moins deux prix vraiment différents (20 % d'écart) : sinon null et Zara le dit.
// `liked` : les articles que le client a le plus regardés (ordre d'intérêt), seulement s'il autorise le suivi.
export function threeRanges<T extends CatalogProduct>(list: T[], opts: { style?: StyleKey | null; liked?: string[] } = {}): Ranges<T> | null {
  const pool = [...new Map(list.filter((p) => p.price > 0 && p.stock > 0).map((p) => [p.id, p])).values()];
  if (pool.length < 2) return null;
  const byPrice = [...pool].sort((a, b) => a.price - b.price || discount(b) - discount(a));
  const deal = byPrice[0];
  const premium = byPrice[byPrice.length - 1];
  if (deal.id === premium.id || premium.price < deal.price * 1.2) return null;
  const others = pool.filter((p) => p.id !== deal.id && p.id !== premium.id);
  let favorite: T | null = null;
  const likedRank = (opts.liked ?? []).map((id) => others.find((p) => p.id === id)).find(Boolean);
  if (likedRank) favorite = likedRank;
  else if (opts.style) favorite = rankForStyle(others, opts.style)[0] ?? null;
  if (!favorite && others.length > 0) {
    // sans goût connu : l'article du milieu (ni le moins cher, ni le plus cher)
    const middle = [...others].sort((a, b) => a.price - b.price);
    favorite = middle[Math.floor((middle.length - 1) / 2)];
  }
  return { deal, favorite, premium };
}

export interface Comparison {
  cheaper: CatalogProduct | null; // null : même prix
  diff: number; // écart de prix (FCFA)
  moreChoice: CatalogProduct | null; // celui qui a le plus de couleurs + tailles (null : égalité)
}

// Ce qu'on peut dire de vrai entre deux articles : le prix, et le choix de couleurs / tailles. Rien sur la qualité ou la marque.
export function compareFacts(a: CatalogProduct, b: CatalogProduct): Comparison {
  const diff = Math.abs(a.price - b.price);
  const cheaper = diff === 0 ? null : a.price < b.price ? a : b;
  const choice = (p: CatalogProduct) => p.colors.length + p.sizes.length;
  const moreChoice = choice(a) === choice(b) ? null : choice(a) > choice(b) ? a : b;
  return { cheaper, diff, moreChoice };
}

// Ce que Zara n'écrit JAMAIS dans ses messages de vente (utilisé par les tests sur tous les textes du module).
export const FORBIDDEN_CLAIMS =
  /exclusi|elite|élite|reserve aux|réservé aux|introuvable|piece unique|pièce unique|derniere chance|dernière chance|depechez|dépêchez|vite\b|urgent|ne ratez|offre limitee|offre limitée|seulement pour vous|pauvre|fauche|radin|bon marche pour vous|مستعجل|لا تفوت|حصري|نخبة|اسرع|أسرع/i;
