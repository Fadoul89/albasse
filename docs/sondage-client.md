# Le petit sondage du site : les questions qui ne bloquent plus l'inscription

Demande du patron (7 novembre 2026) : *« Pour la création de compte, demande seulement l'information sur cette page. Les autres, comme le sexe et la date de naissance, le numéro WhatsApp, demande-les comme un sondage à l'intérieur du site. »*

## Avant / après
- **Avant** : on créait son compte (nom, téléphone, mot de passe), puis un écran « Dernière étape » couvrait la page avec 3 questions **obligatoires** (Homme/Femme, date de naissance, célibataire/marié) et des informations facultatives. Impossible d'entrer dans le site sans y répondre.
- **Maintenant** : le compte est créé avec **seulement** le nom, le téléphone, le mot de passe (et l'e-mail s'il est écrit, facultatif). Le client entre tout de suite dans le site. Les autres questions viennent **ensuite**, dans une petite carte sur l'accueil, une question à la fois. **Aucune n'est obligatoire.**

## La carte « ✨ Zara : un petit sondage » (accueil)
Une carte sur la page d'accueil, **juste sous la ligne des catégories et l'annonce de Zara** (elle ne repousse donc ni le haut de l'accueil ni l'annonce) ; ce n'est pas une fenêtre : elle ne gêne jamais la fenêtre « Télécharge l'app ». **« Question 2 sur 5 »**, une seule question à la fois, **chaque réponse est enregistrée tout de suite** (si le client ferme le site au milieu, ce qui est répondu est gardé) :

| # | Question | Réponse | Ce qui est écrit |
| --- | --- | --- | --- |
| 1 | Pour mieux vous conseiller, vous êtes… | 👨 Homme / 👩 Femme | `gender` |
| 2 | 🎂 Quelle est votre date de naissance ? | jour/mois/année (« 25031998 » devient « 25/03/1998 » tout seul) ; la date doit exister, ne pas être dans le futur et donner un âge plausible | `birth_date` |
| 3 | 💍 Quelle est votre situation ? | 🙋 Célibataire / 💍 Marié(e) | `marital_status` |
| 4 | 💬 Votre numéro WhatsApp est-il le même que votre téléphone ? | « Oui, le même » (rien n'est écrit : le WhatsApp est déjà le téléphone) ou « Un autre numéro » (8 à 15 chiffres) | `whatsapp_number` (seulement si un autre numéro) |
| 5 | 🔔 Voulez-vous recevoir les nouveautés et les offres d'Albasse Shopping ? | « Oui, avec plaisir » (les 3 réglages de Mon compte → Notifications passent à « oui ») ou « Non merci » (rien ne change) | `notify_new_products`, `notify_promotions`, `notify_flash_sale` |

- **« Plus tard »** ferme la carte. Elle revient **3 jours après, trois fois au plus** (puis le sondage ne demande plus). Un compte neuf la voit tout de suite, dès sa première arrivée sur l'accueil. Le souvenir est sur le téléphone du client.
- **Seulement ce qui manque** : la carte n'affiche que les questions sans réponse. Un client qui a tout répondu ne la voit jamais.
- **Jamais** pour l'équipe (administrateur) ni pour un visiteur sans compte.
- **Rien n'est deviné ni coché à la place du client.**
- Tout reste modifiable à tout moment dans **Compte › Modifier mon profil** et **Mon compte › Notifications**.

## Les notifications : l'accord reste explicite
Les conditions d'inscription disent : *« J'accepte de recevoir les notifications commerciales uniquement si je donne mon accord. »* Avant, ce n'était que la case pré-cochée de l'étape 2. Maintenant le compte est créé **sans** accord (les 3 réglages restent à « non ») et la question 5 le demande clairement. **Conséquence pour le patron** : tant qu'un nouveau client n'a pas répondu « Oui, avec plaisir », Zara Marketing (e-mails) et les notifications ne lui écrivent pas. C'est plus honnête, mais il y aura moins de clients autorisés qu'avec la case pré-cochée.
La question 5 n'est posée que si les trois réglages sont à « non » ; un client qui a dit « oui » à au moins un réglage n'est jamais redemandé. Un « Non merci » est gardé sur le téléphone : la question ne revient pas.

## Les anciens clients
Ils voient aussi la carte, avec **seulement ce qui leur manque**. C'est un changement : avant, les anciens clients ne recevaient que la question Homme/Femme ; la date de naissance, la situation et la question WhatsApp leur sont maintenant proposées aussi (toujours « Plus tard » possible, 3 fois au plus).
- La question WhatsApp n'est posée que si le WhatsApp du compte est vide ou égal au téléphone, et une seule fois (« Oui, le même » est gardé sur le téléphone).
- Un client qui avait coupé les 3 notifications dans Mon compte peut se voir poser la question 5 une fois (« Non merci » la fait disparaître pour de bon sur ce téléphone).

## Les colonnes de la base
Aucun script SQL. Les colonnes `gender`, `birth_date`, `marital_status` existent déjà et acceptent le vide ; le sexe, la naissance et la situation ne sont demandés que si la colonne existe dans la base (profil lu avec la clé). Une réponse refusée par la base : message « Enregistrement impossible », la carte reste pour réessayer.

## Ce que ça change pour les annonces et les statistiques
Un nouveau client dont la date de naissance ou la situation sont inconnues : les annonces qui ont besoin de ces informations (par exemple « Vitalité & Énergie » réservé aux mariés de 32 ans et plus) ne lui sont pas montrées tant qu'il n'a pas répondu. Dans Admin › Clients, il est « Non précisé » jusqu'à sa réponse.

## Où est le code
- Règles pures (questions qui restent, quand la carte est montrée, contrôle de la date et du numéro) : `src/lib/clientSurvey.ts` (test : `node --import ./tests/zara/register.mjs tests/email/client-survey.test.ts`).
- La carte : `src/components/SurveyCard.tsx`, affichée sur `src/screens/HomeScreen.tsx`.
- Le formulaire court : `src/components/RegisterForm.tsx` (écran d'entrée et page `/inscription`).
- Navigateur : partie `%` de `tests/zara/zara-ui.test.js` (inscription courte, sondage complet, « Plus tard », erreurs, qui ne voit pas la carte).
