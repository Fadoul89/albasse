// Zara SEO : règles de la description d'un article (testables, sans réseau ni base : tests/seo/zara-seo.test.ts).
// Zara regarde la PHOTO de l'article et les FAITS connus (nom, catégorie, couleurs, tailles, description actuelle) et propose une description
// pour la page produit et pour Google. L'administrateur valide avant toute publication.
// Ce que Zara n'écrit JAMAIS : une marque, une matière, une taille, une origine ou une performance inventées ; un prix, une promotion, un stock,
// une livraison (le site les affiche lui-même, toujours à jour) ; « original », « authentique », « garanti », « meilleur »…
// Si l'IA répond mal ou n'est pas disponible, la description est fabriquée avec les seuls faits connus (modèle).

export const MIN_LEN = 60; // en dessous, la fiche est « trop courte »
export const MAX_LEN = 320;

export interface SeoFacts {
  name: string;
  category?: string | null;
  colors?: string[] | null;
  sizes?: string[] | null;
  description?: string | null; // description actuelle (peut être vide ou courte)
}

export type SeoSource = 'ia' | 'modele';

export interface SeoProposal {
  description: string;
  source: SeoSource;
  problems: string[]; // pourquoi la réponse de l'IA a été écartée (vide si elle est gardée)
}

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
// pour le texte fabriqué par le modèle : sans symboles que la base refuse (« < » « > » …)
const safe = (s: unknown) => clean(s).replace(/[<>*#`\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// phrase sur une ligne, point final ajouté s'il manque
export function tidy(text: string): string {
  const t = clean(text).replace(/^["«»“”\s]+|["«»“”\s]+$/g, '');
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

const BANNED: [RegExp, string][] = [
  [/\b(prix|fcfa|cfa|xaf|euros?)\b|[€$]/, 'prix'],
  [/\b(promo|promos|promotion|promotions|solde|soldes|remise|reduction|offre|offres)\b/, 'promotion'],
  [/\b(livraison|livre|livres|livrable)\b/, 'livraison'],
  [/\b(stock|disponible en stock|derniere?s? pieces?|stock limite)\b/, 'stock'],
  [/\b(original|originale|originaux|originales|authentique|authentiques|garanti|garantie|garantis|garanties|certifie|certifiee)\b/, 'affirmation non vérifiable'],
  [/\b(meilleur|meilleure|meilleurs|meilleures|numero 1|n°\s?1|top 1)\b/, 'superlatif'],
  [/\b(gratuit|gratuite|gratuits|gratuites)\b/, 'gratuit'],
  [/\b\d{1,3}\s?%/, 'pourcentage'],
  [/\b(avis|clients? satisfaits?|etoiles?)\b/, 'avis'],
];

export function checkDescription(raw: string, facts?: Pick<SeoFacts, 'name'>): { ok: boolean; problems: string[] } {
  const text = clean(raw);
  const f = fold(text);
  const problems: string[] = [];
  if (text.length < MIN_LEN) problems.push(`trop courte (${text.length} caractères, ${MIN_LEN} au moins)`);
  if (text.length > MAX_LEN) problems.push(`trop longue (${text.length} caractères, ${MAX_LEN} au plus)`);
  if (/[<>*#`\[\]{}]/.test(text)) problems.push('balises ou symboles interdits');
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push('émoji');
  for (const [re, label] of BANNED) if (re.test(f)) problems.push(label);
  if (facts && fold(clean(facts.name)) === f.replace(/[.!?…]+$/, '')) problems.push('identique au nom');
  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

const joinList = (items: string[], max = 12) => {
  const list = items.map(clean).filter(Boolean);
  const shown = list.slice(0, max);
  return shown.join(', ') + (list.length > max ? '…' : '');
};

// Description fabriquée avec les seuls faits connus (aucune invention). Toujours valide (60 à 320 caractères).
export function factsDescription(f: SeoFacts): string {
  const name = safe(f.name);
  const cat = safe(f.category);
  const nameHasCategory = !!cat && fold(name).includes(fold(cat).replace(/s$/, ''));
  const parts = [`${name}${cat && !nameHasCategory ? ` – ${cat}` : ''}.`];
  const colors = (f.colors ?? []).map(safe).filter(Boolean);
  const sizes = (f.sizes ?? []).map(safe).filter(Boolean);
  if (colors.length === 1) parts.push(`Couleur : ${colors[0]}.`);
  else if (colors.length > 1) parts.push(`Couleurs disponibles : ${joinList(colors)}.`);
  if (sizes.length > 0) parts.push(`${/chaussure/.test(fold(`${cat} ${name}`)) ? 'Pointures' : 'Tailles'} disponibles : ${joinList(sizes)}.`);
  parts.push('À commander sur Albasse Shopping, boutique en ligne au Tchad.');
  return parts.join(' ').slice(0, MAX_LEN);
}

export const SYSTEM_PROMPT = `Tu es Zara Kings, la conseillère d'Albasse Shopping, boutique en ligne au Tchad. Tu rédiges la description d'UN article, pour sa page produit et pour Google.

Tu reçois : les FAITS de l'article (nom, catégorie, couleurs, tailles, description actuelle éventuelle) et sa PHOTO.

Écris 2 ou 3 phrases en français simple, 150 à 280 caractères au total, claires et utiles à l'acheteur :
- décris ce que l'on VOIT sur la photo (type d'article, couleur, style, détails bien visibles) et reprends les faits fournis ;
- si une description actuelle existe, garde ses informations vraies.

INTERDIT (la description sera refusée) :
- inventer une marque, une matière, une taille, une origine, une performance, une odeur ou un ingrédient qu'on ne voit pas ou qui n'est pas dans les faits ;
- parler de prix, de promotion, de stock, de livraison, d'avis ou de garantie ;
- les mots « original », « authentique », « garanti », « meilleur », « gratuit » ;
- émojis, guillemets, listes, majuscules criardes.

Si la photo ne permet pas de décrire l'article, utilise seulement les faits. Réponds UNIQUEMENT avec ce JSON, rien d'autre : {"description": "…"}`;

export function userText(f: SeoFacts): string {
  const lines = [`Nom : ${clean(f.name)}`];
  if (clean(f.category)) lines.push(`Catégorie : ${clean(f.category)}`);
  const colors = (f.colors ?? []).map(clean).filter(Boolean);
  const sizes = (f.sizes ?? []).map(clean).filter(Boolean);
  if (colors.length) lines.push(`Couleurs : ${joinList(colors)}`);
  if (sizes.length) lines.push(`Tailles : ${joinList(sizes)}`);
  lines.push(`Description actuelle : ${clean(f.description) || '(aucune)'}`);
  return lines.join('\n');
}

// la réponse du modèle (JSON, parfois entouré de ```) → le texte de la description, ou null
export function parseModelReply(reply: string): string | null {
  const m = /\{[\s\S]*\}/.exec(String(reply ?? ''));
  if (!m) return null;
  try {
    const d = (JSON.parse(m[0]) as { description?: unknown }).description;
    return typeof d === 'string' ? d : null;
  } catch {
    return null;
  }
}

// callModel(texte, urlPhoto | null) → la réponse brute du modèle. Sans photo ou si la photo est refusée : un second essai avec les faits seuls.
export async function proposeDescription(
  facts: SeoFacts,
  imageUrl: string | null,
  callModel: ((text: string, imageUrl: string | null) => Promise<string>) | null
): Promise<SeoProposal> {
  const fallback = (problems: string[]): SeoProposal => ({ description: factsDescription(facts), source: 'modele', problems });
  if (!callModel) return fallback(['IA indisponible']);

  let reply: string | null = null;
  try {
    reply = await callModel(userText(facts), imageUrl);
  } catch {
    if (imageUrl) {
      try {
        reply = await callModel(userText(facts), null); // photo illisible : on essaie avec les faits seuls
      } catch {
        return fallback(['IA en erreur']);
      }
    } else {
      return fallback(['IA en erreur']);
    }
  }
  const text = parseModelReply(reply ?? '');
  if (!text) return fallback(['réponse illisible']);
  const description = tidy(text);
  const check = checkDescription(description, facts);
  return check.ok ? { description, source: 'ia', problems: [] } : fallback(check.problems);
}
