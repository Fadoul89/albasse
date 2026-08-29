// Contenu fictif de demonstration pour la banniere de preuve sociale.
// Noms, achats et temoignages imaginaires — ne represente aucun client reel.

export interface SocialProofItem {
  icon: string;
  text: string;
}

const NAMES = [
  // Liste 1
  'Amina Mahamat',
  'Youssouf Hassan',
  'Fatima Saleh',
  'Moussa Ibrahim',
  'Halima Abdou',
  'Adam Mahamat',
  'Khadidja Ousmane',
  'Ibrahim Deby',
  'Aicha Younous',
  'Mahamat Nour',
  'Zara Idriss',
  'Djibrine Ali',
  'Hawa Kalthouma',
  'Ahmat Seid',
  'Nadjib Ousman',
  'Mariam Brahim',
  'Idriss Mahamoud',
  'Sana Abakar',
  'Ousmane Djime',
  'Rahma Tidjani',
  // Liste 2 — Sud du Tchad
  'Béatrice Ngarle',
  'François Mbaïla',
  'Clarisse Koudjé',
  'Marcel Djoné',
  'Ruth Ngarsem',
  'Christian Mbairamadji',
  'Esther Ndeï',
  'Patrick Kemba',
  'Grâce Mbaïro',
  'Daniel Ngarle',
  'Judith Djasngar',
  'Emmanuel Koudjé',
  'Martine Mbairess',
  'Joseph Ngarndey',
  'Sarah Djoné',
  'Michel Mbaïla',
  'Élodie Ngarsem',
  'Samuel Kemba',
  'Noëlle Ndeï',
  'André Djasngar',
  'Prisca Mbaïro',
  'Rodrigue Ngarle',
  'Grâce Koudjé',
  'Stéphane Mbairamadji',
  'Alice Djoné',
  'Benjamin Ngarndey',
  'Céline Mbaïla',
  'Christian Ndeï',
  'Rebecca Ngarsem',
  'Paul Kemba',
];

const PRODUCTS = [
  'un parfum',
  'une montre',
  'des chaussures',
  'une chemise',
  'un sac',
  'une cravate',
  'un costume',
  'des accessoires',
];

const PURCHASE_ITEMS: SocialProofItem[] = NAMES.map((name, i) => ({
  icon: '🛍️',
  text: `${name} vient d'acheter ${PRODUCTS[i % PRODUCTS.length]}`,
}));

const ACCOUNT_ITEMS: SocialProofItem[] = [
  'Judith Djasngar',
  'Rodrigue Ngarle',
  'Alice Djoné',
  'Samuel Kemba',
  'Fatima Saleh',
  'Ibrahim Deby',
].map((name) => ({ icon: '🔔', text: `${name} vient de créer un compte` }));

const DELIVERY_ITEMS: SocialProofItem[] = [
  'Martine Mbairess',
  'André Djasngar',
  'Noëlle Ndeï',
  'Emmanuel Koudjé',
  'Halima Abdou',
  'Mahamat Nour',
].map((name) => ({ icon: '🔔', text: `${name} vient de confirmer sa commande à domicile` }));

const TESTIMONIAL_ITEMS: SocialProofItem[] = [
  { icon: '💬', text: '« Je n\'ai jamais vu un site comme ça au Tchad ! »' },
  { icon: '💬', text: '« On dirait vraiment un site européen ! »' },
  { icon: '💬', text: '« Livraison rapide, je recommande ! »' },
  { icon: '💬', text: '« Service client au top » — Merci Albasse Shopping 🙏' },
];

const STAR_TESTIMONIAL_ITEMS: SocialProofItem[] = [
  { icon: '⭐', text: 'Franchement, le site est très professionnel.' },
  { icon: '⭐', text: 'Bravo, enfin une boutique en ligne moderne au Tchad !' },
  { icon: '⭐', text: 'Produit de très bonne qualité, exactement comme sur les photos.' },
  { icon: '⭐', text: 'Très belle présentation !' },
];

const APP_ITEMS: SocialProofItem[] = [
  { icon: '📱', text: 'Notre application mobile est disponible' },
  { icon: '📱', text: 'Nous avons aussi une application mobile !' },
];

export const SOCIAL_PROOF_ITEMS: SocialProofItem[] = [
  ...PURCHASE_ITEMS,
  ...ACCOUNT_ITEMS,
  ...DELIVERY_ITEMS,
  ...TESTIMONIAL_ITEMS,
  ...STAR_TESTIMONIAL_ITEMS,
  ...APP_ITEMS,
];

export function shuffledSocialProofItems(): SocialProofItem[] {
  const arr = [...SOCIAL_PROOF_ITEMS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
