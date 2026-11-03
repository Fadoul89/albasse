# « Annonce » ciblée de Zara : une publicité qui ressemble à une vraie « Ads »

Demande du patron : « Zara gère les publicités à l'écran. Ajouter aussi une publicité qui s'affiche comme une Ads, et bien ciblée. »

Zara affiche maintenant, dans le fil de l'accueil (juste après la **première catégorie**), une carte **« Annonce »** qui ressemble à une vraie pub
(Facebook, Instagram, Google) : nom de la boutique ✓, grande photo, nom de l'article, prix, boutons **« Acheter maintenant »** et **« 💬 Demander à Zara »**.
Elle est **choisie pour chaque client** avec de **vraies raisons**, et elle dit toujours **pourquoi** (« ⓘ Pourquoi cette annonce ? … »).

## Où l'allumer
Le même interrupteur que les autres publicités de Zara : Admin → **Promotions intelligentes** → « 🤖 Zara gère les publicités à l'écran ».
Éteint (ou script `add-zara-ads.sql` pas lancé) : aucune annonce. **Aucun nouveau script SQL.**

## Comment Zara cible (seulement des choses vraies)
Dans cet ordre, la première raison vraie gagne :

| # | Raison | D'où vient la vérité | Phrase |
| --- | --- | --- | --- |
| 1 | **Article regardé de près**, pas commandé | le suivi de navigation de ce téléphone (plusieurs consultations, retours, variantes essayées, temps passé) ; regardé il y a moins de 30 jours | « Vous avez regardé cet article. Il vous attend toujours. » |
| 2 | **Catégorie explorée** (au moins 2 articles regardés dedans) | le suivi de navigation : un article de cette catégorie que le client n'a pas encore vu (une vraie promotion passe en premier) | « Vous aimez « Montres » ? Voici un article à découvrir. » |
| 3 | **Vraie promotion en cours** | ancien prix barré seulement pendant une vente flash ou une promotion de Zara, remise réelle de 5 à 60 % (`lib/promotions`) | « Prix réduit : -20 % jusqu'au 10 novembre » |

Sans raison vraie : **aucune annonce** (Zara n'invente jamais).

Ce qui ajuste le choix et la carte :
- **Genre** (seulement si le client l'a choisi : Homme / Femme) : un homme ne reçoit pas un article d'une catégorie « pour femmes » (et l'inverse). Genre non précisé : aucun filtre.
- **Ville** (profil du client) : la vraie livraison. N'Djamena : « Livraison à N'Djamena : gratuite · vous payez à la réception. » Une autre ville : son vrai tarif et « paiement à l'avance (Airtel Money ou Moov Money) ». Ville inconnue ou sans tarif : aucune ligne.
- **Jamais** : un article épuisé, retiré de la vente, sans photo, déjà commandé ; une promotion finie ; une remise absurde (-90 %).
- Le choix **tourne chaque jour** parmi les 5 meilleurs (et reste le même toute la journée).
- Suivi coupé (signal « Ne pas me suivre » du navigateur) : jamais l'annonce « Vous avez regardé » ; seule une vraie promotion peut s'afficher.

## Ce que le client peut faire
- **Acheter maintenant** : la fiche de l'article. **Demander à Zara** : le chat de Zara présente cet article.
- **✕** : l'annonce disparaît pendant **24 heures** (gardé sur le téléphone).
- Arabe : la carte, l'accroche, les boutons et la raison existent aussi en arabe.

## Honnêteté
- Le mot **« Annonce »** est écrit : c'est une publicité de la boutique pour ses propres articles (jamais « sponsorisé » par un tiers).
- Aucune fausse rareté, fausse urgence, faux compte à rebours ou faux pourcentage. Le prix, la photo, le stock et l'ancien prix viennent de la vraie fiche.
- Aucune donnée personnelle n'est montrée : seulement le nom de l'article regardé ou de la catégorie.

## Code et tests
- Règles (fonctions pures) : `src/lib/adTargeting.ts` ; carte : `src/components/TargetedAdCard.tsx` ; place dans l'accueil : `src/screens/HomeScreen.tsx`.
- `node --import ./tests/zara/register.mjs tests/email/ad-targeting.test.ts` (42 contrôles).
- Navigateur : `PARTS='€' node tests/zara/zara-ui.test.js <dist> <port>`.
