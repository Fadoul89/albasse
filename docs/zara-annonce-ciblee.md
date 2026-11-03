# « Annonce » ciblée de Zara : une publicité qui ressemble à une vraie « Ads »

Demande du patron : « Zara gère les publicités à l'écran. Ajouter aussi une publicité qui s'affiche comme une Ads, et bien ciblée. »

Zara affiche maintenant, dans le fil de l'accueil (juste après la **première catégorie**), une carte **« Annonce »** qui ressemble à une vraie pub
(Facebook, Instagram, Google) : nom de la boutique ✓, grande photo, nom de l'article, prix, boutons **« Acheter maintenant »** et **« 💬 Demander à Zara »**.
Elle est **choisie pour chaque client** avec de **vraies raisons**, et elle dit toujours **pourquoi** (« ⓘ Pourquoi cette annonce ? … »).

## Où l'allumer
Le même interrupteur que les autres publicités de Zara : Admin → **Promotions intelligentes** → « 🤖 Zara gère les publicités à l'écran ».
Éteint (ou script `add-zara-ads.sql` pas lancé) : aucune annonce. **Aucun nouveau script SQL.**

## Zara travaille 24 h sur 24, pour 5 publics
Zara prépare des annonces pour **cinq publics** : **Femmes, Hommes, Élèves, Étudiants, Administrateurs et cadres**.
Elle **change les annonces 4 fois par jour, jour et nuit** (à 00 h, 06 h, 12 h et 18 h, heure du Tchad) : le même client ne voit pas toujours le même article.

Un client appartient à un public **seulement d'après ce qu'il a écrit lui-même dans son compte** (rien n'est deviné d'après le prénom ou le comportement) :
- **Femmes / Hommes** : le genre choisi (inscription, profil, carte de Zara). Genre non précisé : pas de public de genre.
- **Étudiants** : le métier contient « étudiant », « étudiante », « étudiants », « etudiant », même la faute « etudient » (et en arabe طالب…).
- **Élèves** : « élève », « élèves », « lycéen », « collégienne »… (et en arabe تلميذ…). Un « étudiant en administration » reste étudiant.
- **Administrateurs et cadres** : « administrateur », « administratrice », « administration », « directeur », « ingénieur », « gestionnaire », « comptable », « banquier », « entrepreneur »… (la liste des métiers haut placés de Zara) et en arabe مدير, إداري…
- Un client peut être dans deux publics (un homme étudiant) : le public du **métier** passe d'abord, et le genre reste toujours un filtre.

## Comment Zara cible (seulement des choses vraies)
Dans cet ordre, la première raison vraie gagne :

| # | Raison | D'où vient la vérité | Phrase |
| --- | --- | --- | --- |
| 1 | **Article regardé de près**, pas commandé | le suivi de navigation de ce téléphone (plusieurs consultations, retours, variantes essayées, temps passé) ; regardé il y a moins de 30 jours | « Vous avez regardé cet article. Il vous attend toujours. » |
| 2 | **Catégorie explorée** (au moins 2 articles regardés dedans) | le suivi de navigation : un article de cette catégorie que le client n'a pas encore vu (une vraie promotion passe en premier) | « Vous aimez « Montres » ? Voici un article à découvrir. » |
| 3 | **Public du métier** : élève, étudiant, administrateur | le métier écrit dans le compte ; les prix viennent du catalogue | Élève : « Pour les élèves : un article à petit prix. » (un article du quart le moins cher de la boutique). Étudiant : « Pour les étudiants : … » (parmi les 40 % les moins chers, donc une autre annonce que celle des élèves). Administrateur : « Une sélection haut de gamme pour vous. » (le quart le plus cher). Une vraie promotion passe d'abord pour les élèves et étudiants. |
| 4 | **Public du genre** : femme ou homme | la catégorie de son genre (« Vêtements pour femmes », « Vitalité & Énergie Homme »), la vraie promotion puis le plus récent d'abord | « Choisi pour vous : « Vêtements pour femmes ». » |
| 5 | **Vraie promotion en cours** | ancien prix barré seulement pendant une vente flash ou une promotion de Zara, remise réelle de 5 à 60 % (`lib/promotions`) | « Prix réduit : -20 % jusqu'au 10 novembre » |

Sans raison vraie : **aucune annonce** (Zara n'invente jamais). Une 6ᵉ raison existe **seulement après un ✕** : une vraie nouveauté (voir plus bas).

Ce qui ajuste le choix et la carte :
- **Genre** (seulement si le client l'a choisi : Homme / Femme) : un homme ne reçoit pas un article d'une catégorie « pour femmes » (et l'inverse). Genre non précisé : aucun filtre.
- **Ville** (profil du client) : la vraie livraison. N'Djamena : « Livraison à N'Djamena : gratuite · vous payez à la réception. » Une autre ville : son vrai tarif et « paiement à l'avance (Airtel Money ou Moov Money) ». Ville inconnue ou sans tarif : aucune ligne.
- **Jamais** : un article épuisé, retiré de la vente, sans photo, déjà commandé ; une promotion finie ; une remise absurde (-90 %).
- Le choix **tourne toutes les 6 heures** parmi les 5 meilleurs (et reste le même pendant ces 6 heures).
- Suivi coupé (signal « Ne pas me suivre » du navigateur) : jamais l'annonce « Vous avez regardé » ; seule une vraie promotion peut s'afficher.

## L'écran de l'administrateur : « 📣 Annonces de Zara · 24 h sur 24 »
Admin → **Promotions intelligentes** (sous le délai d'affichage) : pour **chaque public**, vous voyez **l'annonce que Zara montre en ce moment** (photo, nom, prix, accroche, raison), **le nombre de clients** de ce public (d'après leur compte, comptes de test non comptés) et **le prochain changement** (« Prochain changement : 12 h 00 »).
L'écran se met à jour tout seul chaque minute. Interrupteur éteint : il indique « Éteint : rien n'est affiché aux clients (c'est seulement un aperçu) ».
Un public sans annonce vraie (par exemple aucune femme en vente dans la catégorie « Vêtements pour femmes ») affiche « Aucune annonce vraie pour ce public pour le moment : Zara n'invente rien. »

## Ce que le client peut faire
- **Acheter maintenant** : la fiche de l'article. **Demander à Zara** : le chat de Zara présente cet article.
- **✕** : l'annonce disparaît, et **15 secondes plus tard Zara en propose une autre** : un **autre article**, jamais celui qui vient d'être fermé (il n'est plus proposé pendant 24 h). L'annonce suivante a la même allure (boutons, « Pourquoi cette annonce ? ») et **une vraie raison** : un autre article regardé, une catégorie explorée, le public du client, une vraie promotion, ou, si Zara n'a rien d'autre, une **vraie nouveauté** (article ajouté à la boutique depuis moins de 30 jours, d'après sa date dans la base : « Une nouveauté à découvrir. — Cet article a été ajouté à la boutique il y a 5 jours. »). S'il n'y a aucune vraie raison, Zara ne montre rien (elle n'invente jamais). La nouveauté ne sert **que** pour l'annonce qui suit un ✕, jamais pour la première.
- **Pas d'harcèlement** : au plus **3 ✕ sur 24 heures**. Au 3ᵉ ✕, Zara s'arrête ; elle reprend quand le plus ancien des 3 ✕ a 24 h. Les ✕ (article fermé + heure) sont gardés sur le téléphone ; si le visiteur recharge la page pendant les 15 secondes, l'attente continue (rien ne s'affiche tout de suite).
- Arabe : la carte, l'accroche, les boutons et la raison existent aussi en arabe.

## Honnêteté
- Le mot **« Annonce »** est écrit : c'est une publicité de la boutique pour ses propres articles (jamais « sponsorisé » par un tiers).
- Aucune fausse rareté, fausse urgence, faux compte à rebours ou faux pourcentage. Le prix, la photo, le stock et l'ancien prix viennent de la vraie fiche.
- Aucune donnée personnelle n'est montrée : seulement le nom de l'article regardé ou de la catégorie.

## Code et tests
- Règles (fonctions pures) : `src/lib/adTargeting.ts`, `src/lib/adAudiences.ts` (les publics) ; écran de l'administrateur : `src/components/ZaraAdsAudiences.tsx` ; carte : `src/components/TargetedAdCard.tsx` ; place dans l'accueil : `src/screens/HomeScreen.tsx`.
- `node --import ./tests/zara/register.mjs tests/email/ad-targeting.test.ts` (101 contrôles : publics, métiers, genre, rotation de 6 h, écran de l'administrateur, ✕ et annonce suivante après 15 secondes, nouveautés).
- Navigateur : `PARTS='€' node tests/zara/zara-ui.test.js <dist> <port>`.
