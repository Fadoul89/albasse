// Conditions générales d'Albasse Shopping.
// Rien d'inventé : chaque phrase reprend une règle qui existe déjà sur le site (page de commande, conditions de retour, conditions d'inscription,
// fidélité, politique de confidentialité). Le patron relit le texte avant publication.

export const TERMS_UPDATED = 'Novembre 2026';
export const TERMS_EMAIL = 'contact@albasseshopping.com';

export interface TermsSection {
  title: string;
  paragraphs: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Qui sommes-nous',
    paragraphs: [
      "Albasse Shopping est une boutique en ligne installée à N'Djamena, au Tchad. Les prix sont en francs CFA (FCFA).",
      `Pour toute question : ${TERMS_EMAIL}.`,
    ],
  },
  {
    title: '2. Votre compte',
    paragraphs: [
      'Vous donnez des informations exactes (nom et téléphone) et vous passez uniquement des commandes sérieuses, avec une réelle intention d’achat.',
      'En cas de 3 commandes non honorées ou de comportement abusif, votre compte peut être examiné, limité ou bloqué par l’administration.',
    ],
  },
  {
    title: '3. Commander',
    paragraphs: [
      'Le prix de chaque article est affiché sur sa fiche. Le total de votre commande, avec la livraison de votre ville, est affiché sur la page de commande avant que vous la confirmiez.',
      'Une commande non confirmée reste valable 48 heures. Passé ce délai, elle est signalée.',
    ],
  },
  {
    title: '4. Livraison',
    paragraphs: [
      'Nous livrons à N’Djamena et dans les autres villes du Tchad, avec nos agences de transport partenaires. Nos services de livraison sont ouverts de 8h30 à 16h.',
      'Merci de donner une adresse et un numéro de téléphone exacts, pour que le livreur puisse vous joindre.',
    ],
  },
  {
    title: '5. Paiement',
    paragraphs: [
      'À N’Djamena, vous payez à la livraison.',
      'Dans les autres villes, le paiement se fait à l’avance par Moov Money ou Airtel Money. Les numéros sont affichés en bas de la page de commande.',
      'L’emballage cadeau est facultatif : 2 000 FCFA.',
    ],
  },
  {
    title: '6. Retours et échanges',
    paragraphs: [
      'Article incorrect ou défectueux : prévenez-nous dans les 72 heures suivant la réception, avec une photo ou une vidéo. Les frais de retour sont à notre charge.',
      'Erreur de taille : nous faisons un échange, les frais de retour sont à la charge du client, et l’article doit être non porté, non lavé, avec ses étiquettes.',
      'Le détail est sur la page « Conditions de retour ».',
    ],
  },
  {
    title: '7. Fidélité et offres',
    paragraphs: [
      'Vous gagnez 1 point de fidélité par tranche de 5 000 FCFA d’une commande livrée. La remise de 10 % sur les articles s’applique à la 7e commande, une seule fois par client.',
      'Les offres spéciales (par exemple l’offre élèves et étudiants) s’appliquent aux clients concernés, selon les conditions annoncées avec l’offre.',
    ],
  },
  {
    title: '8. Vos données',
    paragraphs: [
      'Nous utilisons vos données seulement pour traiter vos commandes et vous écrire au sujet de votre compte ou de vos achats. Elles ne sont jamais vendues.',
      'Le détail, et la façon de demander l’effacement, sont sur la page « Politique de confidentialité ».',
    ],
  },
  {
    title: '9. Bon usage du site',
    paragraphs: [
      'Merci de ne pas utiliser le site pour des activités frauduleuses, du spam ou des abus.',
      'Nous pouvons modifier ces conditions : la date de la dernière mise à jour est indiquée en haut de la page.',
    ],
  },
];
