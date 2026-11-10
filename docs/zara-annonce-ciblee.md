# « Annonce » ciblée de Zara : une publicité qui ressemble à une vraie « Ads »

Demande du patron : « Zara gère les publicités à l'écran. Ajouter aussi une publicité qui s'affiche comme une Ads, et bien ciblée. »

Zara affiche maintenant, dans le fil de l'accueil (juste après la **première catégorie**), une carte **« Annonce »** qui ressemble à une vraie pub
(Facebook, Instagram, Google) : nom de la boutique ✓, grande photo, nom de l'article, prix, boutons **« Acheter maintenant »** et **« 💬 Demander à Zara »**.
Elle est **choisie pour chaque client** avec de **vraies raisons**, et elle dit toujours **pourquoi** (« ⓘ Pourquoi cette annonce ? … »).

## Où l'allumer
Le même interrupteur que les autres publicités de Zara : Admin → **Promotions intelligentes** → « 🤖 Zara gère les publicités à l'écran ».
Éteint (ou script `add-zara-ads.sql` pas lancé) : aucune annonce. **Aucun nouveau script SQL.**

## Zara travaille 24 h sur 24, pour 6 publics
Zara prépare des annonces pour **six publics** : **Femmes, Hommes, Élèves, Étudiants, Administrateurs et cadres, Militaires et forces de l'ordre**.
Elle **change les annonces 4 fois par jour, jour et nuit** (à 00 h, 06 h, 12 h et 18 h, heure du Tchad) : le même client ne voit pas toujours le même article.

Un client appartient à un public **seulement d'après ce qu'il a écrit lui-même dans son compte** (rien n'est deviné d'après le prénom ou le comportement) :
- **Femmes / Hommes** : le genre choisi (inscription, profil, carte de Zara). Genre non précisé : pas de public de genre.
- **Étudiants** : le métier contient « étudiant », « étudiante », « étudiants », « etudiant », même la faute « etudient » (et en arabe طالب…).
- **Élèves** : « élève », « élèves », « lycéen », « collégienne »… (et en arabe تلميذ…). Un « étudiant en administration » reste étudiant.
- **Administrateurs et cadres** : « administrateur », « administratrice », « administration », « directeur », « ingénieur », « gestionnaire », « comptable », « banquier », « entrepreneur »… (la liste des métiers haut placés de Zara) et en arabe مدير, إداري…
- **Militaires et forces de l'ordre** (demande du patron, 8 novembre 2026) : le métier contient « militaire », « soldat », « armée », « police », « policier », « gendarme », « gendarmerie », « douane », « agent de sécurité », « vigile », « garde nationale / nomade », « GNNT », un grade (« sergent », « caporal », « adjudant », « colonel », « commandant », « capitaine », « lieutenant », « commissaire », « général »…), les fautes courantes (« policie », « douan »), et en arabe عسكري، جندي، شرطي، دركي، ضابط، جيش، حرس… Les grades qui existent aussi dans la vie civile ne comptent que s'ils **ouvrent** le métier (« Colonel », « Commandant de brigade ») : « directeur général », « employé général », « militant » ne sont **pas** des militaires. Ce public passe **avant** « Administrateurs et cadres » (« colonel » et « commandant » sont aussi dans la liste des métiers haut placés). Un étudiant ou un élève militaire reste étudiant ou élève.
- Un client peut être dans deux publics (un homme étudiant) : le public du **métier** passe d'abord, et le genre reste toujours un filtre.

## Comment Zara cible (seulement des choses vraies)
Dans cet ordre, la première raison vraie gagne :

| # | Raison | D'où vient la vérité | Phrase |
| --- | --- | --- | --- |
| 1 | **Article regardé de près**, pas commandé | le suivi de navigation de ce téléphone (plusieurs consultations, retours, variantes essayées, temps passé) ; regardé il y a moins de 30 jours | « Vous avez regardé cet article. Il vous attend toujours. » |
| 2 | **Catégorie explorée** (au moins 2 articles regardés dedans) | le suivi de navigation : un article de cette catégorie que le client n'a pas encore vu (une vraie promotion passe en premier) | « Vous aimez « Montres » ? Voici un article à découvrir. » |
| 3 | **Public du métier** : élève, étudiant, **militaire / forces de l'ordre**, administrateur | le métier écrit dans le compte ; les prix viennent du catalogue | Élève : « Pour les élèves : un article à petit prix. » (un article du quart le moins cher de la boutique). Étudiant : « Pour les étudiants : … » (parmi les 40 % les moins chers, donc une autre annonce que celle des élèves). Administrateur : « Une sélection haut de gamme pour vous. » (le quart le plus cher). Une vraie promotion passe d'abord pour les élèves et étudiants. |
| 4 | **Public du genre** : femme ou homme | la catégorie de son genre (« Vêtements pour femmes », « Vêtements pour hommes » ; « Vitalité & Énergie Homme » seulement pour les mariés de 32 ans et plus, voir plus bas), la vraie promotion puis le plus récent d'abord | « Choisi pour vous : « Vêtements pour femmes ». » |
| 5 | **Vraie promotion en cours** | ancien prix barré seulement pendant une vente flash ou une promotion de Zara, remise réelle de 5 à 60 % (`lib/promotions`) | « Prix réduit : -20 % jusqu'au 10 novembre » |

Sans raison vraie : **aucune annonce** (Zara n'invente jamais). Une 6ᵉ raison existe **seulement après un ✕** : une vraie nouveauté (voir plus bas).

## « Vitalité & Énergie » : seulement pour les mariés de 32 ans et plus
Demande du patron (4 novembre 2026) : **les annonces de Zara n'affichent pas les articles « Vitalité & Énergie » (catégorie « Vitalité & Énergie Homme »), sauf aux clients mariés âgés de 32 ans et plus.**
- Vrai pour **toutes** les annonces de Zara : la carte **« Annonce »** (article regardé, catégorie explorée, public du genre, promotion, nouveauté après un ✕) **et** la carte **« Zara vous conseille »** de l'accueil. Même un article « Vitalité & Énergie » regardé 3 fois n'est pas rappelé dans une annonce à un client non autorisé.
- Un client est autorisé **seulement** s'il a lui-même écrit sa **date de naissance** (âge de 32 ans ou plus, calculé avec le jour de N'Djamena) **et** choisi **« Marié(e) »** (Compte › Modifier mon profil, ou à l'inscription). Le jour des 32 ans, il est autorisé ; la veille, non.
- Pas autorisé : visiteur sans compte, célibataire, marié de moins de 32 ans, ancien compte qui n'a pas répondu, date illisible. Zara ne devine rien.
- La catégorie reste « pour les hommes » : une femme, mariée ou non, ne voit jamais ces articles dans une annonce (comme avant).
- L'écran de l'administrateur (« Annonces de Zara · 24 h sur 24 ») n'en montre jamais non plus : il prend un client « type » sans réponses.
- **Ces articles restent en vente normalement** dans leur catégorie, sur leur fiche et dans la recherche : seule la publicité change. Les messages de promotion de l'administrateur (fenêtre « Promotions intelligentes ») ne sont pas touchés : c'est son choix.
- Code : `src/lib/adSensitive.ts` (règle), utilisée par `src/lib/adTargeting.ts` et `src/components/ZaraAdCard.tsx`.

Ce qui ajuste le choix et la carte :
- **Genre** (seulement si le client l'a choisi : Homme / Femme) : un homme ne reçoit pas un article d'une catégorie « pour femmes » (et l'inverse). Genre non précisé : aucun filtre.
- **Ville** (profil du client) : la vraie livraison. N'Djamena : « Livraison à N'Djamena : gratuite · vous payez à la réception. » Une autre ville : son vrai tarif et « commande sur WhatsApp » (tant qu'Airtel Money et Moov Money sont retirés ; sinon « paiement à l'avance (Airtel Money ou Moov Money) »). Ville inconnue ou sans tarif : aucune ligne.
- **Jamais** : un article épuisé, retiré de la vente, sans photo, déjà commandé ; une promotion finie ; une remise absurde (-90 %).
- Le choix **tourne toutes les 6 heures** parmi les 5 meilleurs (et reste le même pendant ces 6 heures).
- Suivi coupé (signal « Ne pas me suivre » du navigateur) : jamais l'annonce « Vous avez regardé » ; seule une vraie promotion peut s'afficher.

## L'écran de l'administrateur : « 📣 Annonces de Zara · 24 h sur 24 »
Admin → **Promotions intelligentes** (sous le délai d'affichage) : pour **chaque public**, vous voyez **l'annonce que Zara montre en ce moment** (photo, nom, prix, accroche, raison), **le nombre de clients** de ce public (d'après leur compte, comptes de test non comptés) et **le prochain changement** (« Prochain changement : 12 h 00 »).
L'écran se met à jour tout seul chaque minute. Interrupteur éteint : il indique « Éteint : rien n'est affiché aux clients (c'est seulement un aperçu) ».
Un public sans annonce vraie (par exemple aucune femme en vente dans la catégorie « Vêtements pour femmes ») affiche « Aucune annonce vraie pour ce public pour le moment : Zara n'invente rien. »

## L'annonce des militaires et forces de l'ordre : le badge « groupe sanguin »
- L'article est **choisi par le patron** : « Bagde Groupe sanguin » (écusson brodé militaire, 5 000 FCFA ; fiche `/produit/bagde-groupe-sanguin`). Il est repéré par son **slug** dans `FORCES_PRODUCT_SLUGS` (`src/lib/adAudiences.ts`) : pour proposer d'autres articles à ce public, il suffit d'ajouter leur slug à cette liste.
- Phrase : « Pensé pour les militaires et les forces de l'ordre. » ; raison : « Vous avez indiqué un métier militaire ou de sécurité (armée, police, gendarmerie…) dans votre compte, et cet article est conçu pour les militaires et les forces de l'ordre. » (aussi en arabe). **Aucune fausse rareté, aucun faux pourcentage.**
- Un article de cette liste **épuisé, retiré de la vente ou sans photo n'est pas proposé** : Zara ne met jamais un autre article à sa place (le public « forces » n'a alors pas d'annonce, comme les autres publics sans article vrai).
- Un militaire qui a **regardé de près** un autre article reçoit d'abord cet article (« Vous avez regardé… », raisons 1 et 2 du tableau) ; le badge vient ensuite.
- Le badge est dans la catégorie « Sacs et Bagages » (aucun public de genre) : une femme gendarme et un homme militaire le reçoivent tous les deux.
- Il reste en vente normalement partout (catégorie, recherche, fiche).
- L'écran de l'administrateur « Annonces de Zara · 24 h sur 24 » (Promotions intelligentes) affiche ce 6ᵉ public avec le nombre de clients concernés (d'après leur métier) et l'annonce du moment.
- Les annonces ne s'affichent que si l'interrupteur « Zara gère les publicités à l'écran » est allumé (il l'est aujourd'hui).

### Zara dans le chat (« Zara assistante »)
Le même article est proposé par Zara dans sa conversation, de deux façons :
1. **Le client le dit** : « je suis militaire », « je suis policier », « je suis gendarme », « je suis dans l'armée / la police / la gendarmerie / les forces de l'ordre », « je travaille à la douane », « en tant que militaire », « أنا عسكري », « أنا في الجيش »… (visiteur ou client connecté). Zara répond « Respect à vous 🙏 Voici un article pensé pour les militaires et les forces de l'ordre : l'écusson brodé « groupe sanguin », pour vos uniformes, vestes et équipements. » et montre **la carte du badge** (bouton « Commander », prix et stock vrais). Si le client dit sa profession **et** une demande (« je suis militaire et je cherche une montre »), Zara répond à sa demande : le badge n'est pas proposé à la place.
2. **Le compte le dit** : pour un client **connecté** dont le métier (écrit dans son compte) est militaire ou des forces de l'ordre, le **menu de Zara** a un bouton en plus : **« 🪖 Badge groupe sanguin »** (en arabe « 🪖 شارة فصيلة الدم »). Les autres clients, et les visiteurs, ne le voient pas : rien n'est deviné.
- Badge épuisé ou retiré de la vente : Zara dit seulement « Dites-moi ce que vous cherchez » (jamais un autre article à la place).
- Zara n'ouvre jamais son chat toute seule : ces propositions n'apparaissent que si le client ouvre le chat.
- Code : `forcesFrom` (`src/lib/assistantPersona.ts`), `forcesReply` et le bouton du menu (`src/store/assistantStore.ts`), textes français et arabe (`src/lib/assistantText.ts`). Tests : `tests/zara/zara-forces.test.ts` (44 contrôles) et la partie `€` de `tests/zara/zara-ui.test.js` (chat du visiteur, bouton du client militaire, « je suis policier et je cherche une montre »).

## « Maison & Mobilier » : beaucoup plus pour les femmes que pour les hommes
Demande du patron (8 novembre 2026) : *« Proposez les articles de Maison & Mobilier beaucoup plus aux femmes qu'aux hommes. »*
- **Seulement d'après le genre que le client a choisi dans son compte** (Femme / Homme) : Zara ne devine rien d'après le prénom. Un client qui n'a pas répondu n'est pas concerné par cette règle (aujourd'hui : 21 femmes, 127 hommes, 594 sans réponse : plus il y a de clients qui répondent, plus la règle sert ; le sondage de l'accueil le leur demande).
- **Sur 6 tranches de 6 heures qui se suivent** (Zara change l'annonce 4 fois par jour) : une **femme** reçoit « Maison & Mobilier » **4 fois** (les 2 autres : sa catégorie « Vêtements pour femmes ») ; un **homme** **1 fois** (les 5 autres : sa catégorie). Soit environ **4 fois plus** pour les femmes. Les chiffres sont dans `HOME_SLOTS_OF_6` (`src/lib/adTargeting.ts`) : pour changer la proportion, il suffit de les ajuster.
- La catégorie est repérée par son nom de code `maison-mobilier` ; ses sous-catégories comptent aussi. 25 articles sont en vente aujourd'hui.
- **Une femme** qui n'a aucun article de sa catégorie en vente reçoit toujours « Maison & Mobilier » ; **un homme** n'en reçoit jamais « à la place » d'un article de sa catégorie manquant (seulement pendant sa tranche).
- Les raisons vraies passent **avant** : un article regardé de près, une catégorie explorée, le métier (élève, étudiant, militaire, administrateur). Un homme ne reçoit jamais une catégorie réservée aux femmes (comme avant).
- La raison affichée reste vraie : « Pourquoi cette annonce ? Vous avez choisi « Femme » dans votre compte : voici un article de « Maison & Mobilier ». » Aucune fausse rareté ni faux pourcentage.
- L'écran de l'administrateur « Annonces de Zara · 24 h sur 24 » montre, pour « Femmes » et « Hommes », l'annonce de la tranche en cours : « Femmes » montre « Maison & Mobilier » 4 tranches sur 6.
- Tests : `tests/email/ad-targeting.test.ts` (169 contrôles dont les parts de tranches : femmes 4/6, hommes 1/6) et la partie `€` du navigateur (horloge réglée sur des tranches précises).

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
- `node --import ./tests/zara/register.mjs tests/email/ad-targeting.test.ts` (154 contrôles : publics, métiers, militaires et forces de l'ordre, genre, rotation de 6 h, écran de l'administrateur, ✕ et annonce suivante après 15 secondes, nouveautés, « Vitalité & Énergie » réservé aux mariés de 32 ans et plus).
- Navigateur : `PARTS='€' node tests/zara/zara-ui.test.js <dist> <port>`.

## Offre élèves et étudiants (9 novembre 2026)
Pour les publics **élèves** et **étudiants**, l'annonce est maintenant la **grande affiche** de l'offre du patron (URBANSOLE à 12 500 FCFA, code EE26), avant tous les autres choix, tant que l'article est en vente à plus de 12 500 FCFA. Voir `docs/offre-eleves-etudiants.md`.
