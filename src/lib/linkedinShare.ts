// Le bouton « LinkedIn » d'une fiche produit, à côté de « WhatsApp » et « Facebook » : la page de partage de LinkedIn s'ouvre dans un NOUVEL onglet
// avec le lien de l'article prêt à publier (la fiche de l'article reste affichée). Sur téléphone, si l'application LinkedIn est installée,
// le téléphone peut l'ouvrir lui-même pour ce lien. Des fonctions simples, sans réseau : testées dans tests/email/linkedin-share.test.ts.

export const LINKEDIN_SHARE_BASE = 'https://www.linkedin.com/sharing/share-offsite/';

export function linkedinShareUrl(pageUrl: string): string {
  return `${LINKEDIN_SHARE_BASE}?url=${encodeURIComponent(pageUrl)}`;
}

// Web seulement. Un vrai lien « nouvel onglet » touché dans le geste du client : les navigateurs de téléphone (et ceux de Facebook, TikTok,
// WhatsApp) le laissent passer, alors qu'une fenêtre ouverte par le programme est parfois bloquée.
export function shareOnLinkedIn(pageUrl: string) {
  const a = document.createElement('a');
  a.href = linkedinShareUrl(pageUrl);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
