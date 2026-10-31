# Les 3 couleurs des e-mails

Choisies par le patron (capture TikTok « ZK Proxima ») : **argenté #C0C0C0**, **violet aubergine #4B0082**, **doré #D4AF37**.

| Où | Couleur |
| --- | --- |
| En-tête (logo + « Albasse Shopping ») | fond violet, nom en doré, filet doré dessous, logo cerclé d'argenté |
| Titre de l'e-mail, prix des articles, liens | violet |
| Bouton (« Voir la vente flash », « Suivre mes commandes »…) | fond doré, texte violet |
| Remise « −20 % » | pastille dorée, texte violet |
| « 🔥 Vente flash » (Zara Marketing) | pastille violette, texte doré |
| Traits entre les articles, fond autour de l'e-mail | argenté |
| Pied de page (adresse, raison de l'envoi, « Me désinscrire ») | fond violet, texte argenté, lien doré souligné |

Règle : le doré n'est **jamais** un texte sur fond blanc (trop pâle, difficile à lire) ; il sert de fond (bouton, pastille, filet) ou de texte sur le violet.

## Où c'est dans le code
- Les 3 couleurs : `BRAND` dans `supabase/functions/brevo-email/orderEmails.ts` (un seul endroit à changer).
- Tous les e-mails passent par `layout()` du même fichier : bienvenue, commande reçue, commande livrée, e-mail de test, pub « absents depuis 7 jours » (`promoEmails.ts`) et Zara Marketing (`marketing.ts`).
- Les e-mails ne changent chez les clients qu'après le déploiement de la fonction `brevo-email` (le site n'est pas concerné).
- Pas encore changé (à confirmer) : la facture PDF, l'affiche du rapport Telegram, les écrans du site.
