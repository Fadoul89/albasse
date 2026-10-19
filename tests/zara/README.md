# Tests de Zara Kings

Ces tests ne font **aucune écriture** dans la vraie base : lecture seule avec la clé publique, et les commandes d'un client sont simulées.

## Avant de lancer
- Node 22 ou plus.
- Playwright installé à part (il n'est pas ajouté au projet) : `npm i --no-save playwright` puis `npx playwright install chromium`.
- La clé publique Supabase (la même que `EXPO_PUBLIC_SUPABASE_ANON_KEY`) dans la variable `SUPABASE_ANON_KEY`.

## Le « cerveau » de Zara (rapide, plus de 300 vérifications)
```
SUPABASE_ANON_KEY=... node --import ./tests/zara/register.mjs tests/zara/zara-brain.test.ts
```

## Le site complet dans le navigateur
```
npx expo export --platform web
SUPABASE_ANON_KEY=... node tests/zara/zara-ui.test.js dist 4333
```
`PARTS=MTOF` lance seulement certaines parties : A conseil, L langues, K bouton « + » / panier / commande, P installation du raccourci (question « Avez-vous déjà installé l'application ? », bouton Installer, photo iPhone, bouton d'installation sous chaque proposition d'articles avec une petite astuce dite une seule fois, retiré après « Plus tard » ou une fois installé ; seulement pour les visiteurs qui n'ont pas installé : souvenir sur l'appareil (« appinstalled » de Chrome, installation acceptée, raccourci ouvert depuis l'écran d'accueil, application Albasse), oublié si Chrome propose de nouveau l'installation ; bandeau du site masqué aussi ; iPhone : « Oui, déjà installée » sous les étapes ; Android sans installation en un toucher (Chrome pas encore prêt, Samsung Internet, navigateur de Facebook/WhatsApp) : Zara propose quand même, avec les étapes du bon navigateur, et dans le navigateur de Facebook/WhatsApp un bouton « 🌐 Ouvrir dans Chrome » (lien intent) ; les autres parties partent d'un visiteur qui a déjà répondu « Plus tard », option zaraInstall: null pour un vrai nouveau visiteur), R profil client modifiable, S statistiques de Zara (appareil iPhone/Android, commandes, comptes et installations « grâce à Zara », page administrateur « Statistiques de Zara »), M client avec compte reconnu et salué par son prénom (dont la connexion depuis Zara), T personnalité (politesse, compliments, adresse et numéro personnels), O Zara finalise l'achat dans le chat (fausse base : aucune vraie commande), F programme de fidélité (grade, points, comment gagner), U suivi de navigation (articles regardés, temps ACTIF, variantes, panier, recherches, suivi en arrière-plan (aucune fenêtre ni bouton), refus depuis la page de confidentialité, signal « Ne pas me suivre » du navigateur, envoi vers la base sans double comptage, reprise après coupure, 90 jours), V Zara intelligente (suggestions discrètes avec les vrais articles, « Non merci », historique « qu'est-ce que j'ai regardé », Zara ne parle jamais du suivi d'elle-même, « ne me suis plus » respecté seulement si le client l'écrit, aucun bouton de suivi dans le chat, signal du navigateur, arabe), W page administrateur « Suivi de navigation » (fausse base), X moments forts (Tabaski, Ramadan, Korité, mariage, fête des mères, Saint-Valentin, Black Friday : messages adaptés, rappel quand la date approche avec une date simulée) et achats en gros (cartons, grandes quantités, grosse commande : Zara passe la main à l'équipe WhatsApp avec un message déjà écrit, jamais de prix de gros), Y Zara vendeuse : conclure la vente (« je réfléchis » : le panier est gardé, stock bas seulement s'il est vrai, commande valable 48 h, rappel WhatsApp proposé seulement à celui qui hésite : panier ou article montré), preuves VRAIES (« commandé N fois ces 7 derniers jours » seulement à partir de 3 commandes réelles, jamais sans réponse de la base), pack (l'article qui complète, total des deux, jamais de remise), arabe ; Z rappel WhatsApp (prénom, numéro du Tchad, JOUR du rappel choisi parmi les 5 prochains jours ouvrables ou écrit par le client, confirmation avant l'envoi, « Changer le numéro » / « Changer le jour », annulation, refus ou panne de la base, « c'est cher » sans article = pas de rappel) et page administrateur « Rappels WhatsApp » (fausse base : liste triée par jour, « en retard » / « aujourd'hui ! », « Écrire sur WhatsApp », « Fait », supprimer une demande avec confirmation en deux temps (« Non » ne supprime rien, refus de la base = message), table absente, client non administrateur), H bouton de Zara (dans l'espace ouvert au milieu de la barre du bas, entre « Recherche » et « Panier », sans toucher les onglets ; coin en bas à droite sur les pages sans barre ; vibration et lumière réelles, zone tactile qui ne bouge jamais, bulle au-dessus ou en dessous selon la place, « moins d'animations » respecté, animations arrêtées quand le chat s'ouvre ; glisser-déposer à la souris et au doigt : suit sans ouvrir Zara, reste dans l'écran, place retenue après rechargement, lâché sur les onglets il revient dans l'espace du milieu), G psychologie commerciale et vente émotionnelle (le métier dit par le client est valorisé sans rien supposer du budget : seulement l'ordre des boutons de style change, et un compte avec un métier reçoit exactement les mêmes articles ; style dit par le client (élégant / tendance / sport / petit prix) qui classe les choix dans son budget ; phrases dans son style ; 3 gammes de prix (bon plan, coup de cœur, style premium) avec les vrais prix des fiches ; comparer deux articles (prix, écart exact, couleurs, tailles) et « Je prends » ; client qui hésite = proposition de comparer ; fidélité avec les VRAIS points du compte ; aucune fausse rareté, exclusivité, urgence ou pression ; arabe), J anciens boutons de Zara (ceux qui mènent quelque part restent touchables sur les anciens messages : promotions, nouveautés, catégories, compte, WhatsApp, menu ; partent : la langue, « Mon budget » d'une ancienne liste, les réponses à une question passée ; aucun pendant une commande ; boutons d'installation retirés après « Plus tard »), N bouton « Facebook » d'une fiche produit (Android/Chrome : l'application Facebook par fb://facewebmodal, page de partage seulement sans l'application ; dans l'application Albasse : fb:// puis la page de partage si Facebook ne s'ouvre pas en 1,5 s ; iPhone : lien facebook.com qui ouvre l'application ; ordinateur : nouvel onglet), Q catégorie touchée dans le chat (ses articles s'affichent dans le chat avec le bouton « + », 6 à la fois, « ➕ Voir plus » pour la suite, « 📄 Page » pour ouvrir la page de la catégorie ; Zara reste ouverte), I notifications push programmées (page « Promotions intelligentes », fausse base : rien n'est envoyé) : choisir l'article, message court (120 caractères), aperçu, jour et heure du Tchad (18:30 au Tchad = 17:30 UTC), heure déjà passée refusée, plusieurs programmations, annuler et « envoyer maintenant » avec confirmation (seulement si encore à venir), script SQL pas lancé = explication, client non administrateur refusé ; clics : badge vert « 👆 N clics · envoyée à X téléphones · % » sous chaque notification envoyée, « Actualiser les clics », page ouverte avec la marque ?push=… = un clic compté une seule fois par onglet, marque retirée de l'adresse, marque mal formée ignorée), 1 bouton « Commander sur WhatsApp » des fiches produit (fausse colonne des réglages : visible quand il est activé ou que le script SQL n'est pas lancé, caché avec sa petite phrase quand il est désactivé, jamais affiché un instant pendant le chargement ; interrupteur en haut de la page administrateur « Produits » : désactiver / réactiver, la fiche suit tout de suite ; script pas lancé = message et rien ne change ; client non administrateur refusé), 2 compte obligatoire à l'entrée du site (fausse colonne account_required : écran « Créez votre compte » sur l'accueil et les fiches, sans Zara ni bandeaux ; ouvertes sans compte : connexion, inscription, mot de passe oublié, confidentialité, contact ; réglage coupé ou script pas lancé = site ouvert ; robot de Google = pas de mur ; client connecté = jamais de mur, même un instant ; inscription courte nom / téléphone / mot de passe (e-mail, WhatsApp, profession facultatifs) : compte créé avec le numéro (23566123456@tel.albasseshopping.com, jamais affiché), « +235 66 12 34 56 » = « 66 12 34 56 », e-mail donné = enregistré dans le profil, numéro déjà inscrit, retour sur la fiche demandée ; connexion par numéro ou par e-mail (anciens comptes) ; mot de passe oublié avec le numéro = aide sur WhatsApp ; interrupteur de la page administrateur « Clients »), B C D E reste du site (panier, client connecté, panne, clavier, ordinateur).

## Le script SQL des statistiques de Zara (add-assistant-stats.sql)
Il n'est pas appliqué à la vraie base par les tests. Pour le vérifier sans toucher à la vraie base, on le joue sur un Postgres local jetable
(décor de test : rôles `anon` / `authenticated`, `auth.uid()`, `is_admin()`, tables `orders`, `profiles`, `app_installs`), après
`add-assistant-client-counter.sql`. Contrôles faits : le script se relance sans erreur ; un visiteur ne peut ni lire les tables ni appeler
les statistiques ; un client non administrateur est refusé ; l'administrateur reçoit les bons chiffres (commandes fausses et annulées
écartées, périodes début inclus / fin exclue, appareil inconnu = « Autre »).

## Le script SQL du suivi de navigation (add-browsing-intelligence.sql)
Même méthode : il n'est pas appliqué à la vraie base par les tests, on le joue sur un Postgres local jetable (même décor, plus les stubs `anon` /
`authenticated`). Contrôles faits : le script se relance sans erreur ; un visiteur ne peut ni lire les tables ni appeler le tableau de suivi ;
un client non administrateur est refusé ; un envoi n'est compté qu'une fois même s'il arrive deux fois (numéro d'envoi) ; seules des différences
sont ajoutées ; un achat n'est jamais « défait » par un retrait du panier ; les valeurs illisibles ou énormes sont ramenées à des valeurs sûres ;
« refuser » efface les lignes du visiteur ; l'effacement après 90 jours marche ; l'administrateur voit des références anonymes (V-xxxxxx / C-xxxxxxxx),
jamais l'identifiant brut ni le nom.

## Le script SQL du jour de rappel (add-zara-callback-day.sql)
Même méthode : Postgres local jetable, après `add-zara-sales-boost.sql` (avec une demande déjà enregistrée avant). Contrôles faits : le script se relance
sans erreur ; l'ancienne fonction à 5 paramètres est remplacée par celle à 6 (le site d'avant, qui n'envoie pas de jour, marche encore) ; le jour est accepté
de hier à aujourd'hui + 14 (heure du Tchad), le reste est ignoré sans refuser la demande ; le même numéro met à jour le jour (et le garde s'il est vide) ;
la cloche de l'administrateur porte le jour (« — le 22/10 ») ; appel avec paramètres nommés et numéro « +235 … » ; numéro ou prénom invalide refusé ;
un visiteur et un client normal ne lisent rien, l'administrateur voit les demandes et leur jour.

## Le script SQL de Zara vendeuse (add-zara-sales-boost.sql)
Même méthode : on le joue sur un Postgres local jetable (décor : rôles `anon` / `authenticated`, `auth.uid()`, `is_admin()`, tables `orders` avec une colonne
`items` en jsonb, `profiles`, `admin_notifications`, droits par défaut comme dans Supabase). Contrôles faits : le script se relance sans erreur ; les ventes
par article ne comptent que les commandes non annulées, non « fausses », des 7 derniers jours (30 au plus), une commande qui contient deux fois le même article
compte une fois, une liste mal formée ou une ligne sans `product_id` est ignorée, la fonction marche même si la colonne `is_flagged_fake` n'existe pas ;
les rappels n'acceptent que les numéros du Tchad (8 chiffres commençant par 6 ou 9, avec ou sans +235 / 00235), nettoient le texte et le bornent, ne doublent pas un
numéro déjà en attente, s'arrêtent à 300 demandes par jour, marchent sans la cloche ; un visiteur et un client non administrateur ne peuvent ni lire, ni modifier, ni
supprimer, ni écrire directement dans la table ; l'administrateur lit et marque « fait ». Vérifié aussi en lecture seule sur la vraie base : le format des commandes
(`items[].product_id`, un identifiant qui existe dans `products`) est bien celui que la fonction attend.

## Ce que les tests ne prouvent pas
- Les tests utilisent une fausse base pour tout ce qui s'écrit (suivi, commandes, statistiques) : rien n'est écrit dans la vraie base.
- La mesure du temps actif est testée dans un navigateur de test (onglet caché, actualisation, retour sur la fiche, coupure de connexion) ; sur de
  vrais téléphones, les veilles et changements d'application peuvent varier : le temps compte au plus 2 secondes par seconde et jamais pendant
  une veille, mais le chiffre reste une estimation.

## Le script SQL des notifications programmées (add-scheduled-push.sql)
Même méthode, sur un Postgres local jetable (décor : rôles, `auth.uid()`, `is_admin()`, `products`, `product_notifications` avec un
déclencheur qui note les envois, faux `cron.schedule` / `cron.unschedule` car pg_cron n'existe pas en local). Contrôles faits : le script
se relance sans erreur (un seul minuteur, toutes les minutes) ; un visiteur ne lit rien ; un client non administrateur ne voit ni ne
programme rien et ne peut pas lancer l'envoi ; message de plus de 160 caractères refusé ; au passage du minuteur, seule la notification
arrivée à son heure part (titre, message, article), celle en retard de plus de 6 h passe en « expirée », l'annulée ne part pas, pas de
double envoi ; « envoyer maintenant » part au passage suivant ; un article supprimé emporte ses notifications programmées.

## Le script SQL des clics (add-push-clicks.sql)
Même décor, après add-scheduled-push.sql (plus une table `web_push_subscriptions` de 11 abonnés). Contrôles faits : relançable ; à l'envoi
le nombre de téléphones abonnés est noté ; la marque de la base (16 premiers caractères du SHA-256 de « titre + retour à la ligne +
message ») est la même que celle du téléphone, emoji compris ; un visiteur peut compter un clic ; marque inconnue, mal formée ou en
majuscules : rien ; une notification pas encore envoyée ou envoyée il y a plus de 30 jours ne compte pas ; le visiteur ne lit toujours
pas la table.
