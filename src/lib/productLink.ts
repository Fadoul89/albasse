// Retrouver un article à partir d'un lien collé (copié depuis la fiche du site, WhatsApp, etc.) plutôt que de le
// chercher par son nom — plus rapide quand on a déjà le lien sous la main.

// Extrait le slug d'un lien d'article : lien complet (https://www.albasseshopping.com/produit/mon-article),
// chemin seul (/produit/mon-article) ou juste le slug collé tout seul (mon-article).
export function extractProductSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withoutQuery = trimmed.split(/[?#]/)[0].replace(/\/+$/, '');
  const match = withoutQuery.match(/(?:^|\/)produit\/([^/]+)$/i);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  // pas de "/produit/" dans le texte collé : peut-être juste le slug, seul (sans domaine ni chemin)
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('/') && !trimmed.includes(' ')) return trimmed;
  return null;
}

export function findProductByPastedLink<T extends { slug: string }>(input: string, products: T[]): T | null {
  const slug = extractProductSlug(input);
  if (!slug) return null;
  return products.find((p) => p.slug.toLowerCase() === slug.toLowerCase()) ?? null;
}
