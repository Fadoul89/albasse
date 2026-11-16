# Tableau de bord « couleur hacker »

Demande du patron (16 novembre 2026) : un tableau de bord comme dans la vidéo « Dashboard », en couleurs hacker (fond noir, vert néon, écriture de terminal).
Tous les chiffres sont **vrais** : ils sont comptés dans la base au moment où l'écran s'ouvre. Rien n'est inventé.

## Où le trouver

- Admin › Tableau de bord › bouton noir et vert **« Tableau de bord hacker »** (tout en haut, sous le menu).
- Adresse directe : `www.albasseshopping.com/admin/tableau-de-bord-hacker`.
- L'ancien tableau de bord reste en place, sans changement. « ‹ retour » y ramène.
- Réservé aux administrateurs (avec la double vérification, comme le reste de l'admin).

## Ce qu'il montre

Boutons de période : **Aujourd'hui** (depuis minuit à N'Djamena) · **7 jours** · **30 jours** (par défaut) · **Tout**.

| Partie | Ce que c'est |
| --- | --- |
| Visiteurs | Personnes différentes venues sur le site. Une personne = un compte, sinon le même téléphone ou ordinateur, sinon la visite. |
| Nouveaux clients | Comptes créés sur la période. |
| Commandes | Commandes reçues (les annulées et les fausses ne comptent pas). « Chiffre livré » = seulement les commandes livrées. |
| Articles en vente | Articles actifs, et le nombre de grandes catégories où il y en a. |
| Visiteurs par semaine | 12 barres, du lundi au dimanche. La dernière barre (plus claire) est la semaine en cours, pas encore finie. La plus haute brille. |
| Visiteurs → comptes créés | La jauge : sur 100 visiteurs, combien ont créé un compte. Dessous : les commandes sur les visiteurs. |
| D'où viennent les visiteurs | TikTok, Publicité, Accès direct, Facebook, Google… (6 au plus). |
| Articles les plus regardés | Les 5 articles vus par le plus de personnes (un même téléphone qui revient compte une fois). |

Sous chaque chiffre, l'évolution par rapport à la période d'avant de même durée :
`▲` vert = en hausse, `▼` rouge = en baisse. En % quand la période d'avant compte au moins 20 ; sinon en nombre
(par exemple « ▲ +532 » plutôt qu'un « +5 911 % » qui ne veut rien dire). « Aujourd'hui » se compare à **hier à la même heure**.
« Tout » n'a pas de comparaison.

Les visites et les vues des administrateurs ne comptent jamais.

## Installation (une seule fois)

Lancer **`add-admin-dashboard.sql`** dans Supabase › SQL Editor. Il crée une seule fonction de lecture
(`admin_dashboard_overview`) : aucune table créée, aucune donnée changée. Relançable sans risque.

Tant qu'elle n'est pas installée, l'écran affiche : « la fonction de la base n'est pas encore installée. Lancez add-admin-dashboard.sql ».

## Sécurité

- La fonction refuse tout appel qui ne vient pas d'un administrateur (`is_admin()` : admin **et**, s'il l'a activée, double vérification faite).
  Les visiteurs anonymes ne peuvent même pas l'appeler.
- Elle renvoie seulement des **totaux** et des noms d'articles (publics) : aucun nom, numéro ou adresse de client.

## Tests

- Règles d'affichage : `node --import ./tests/zara/register.mjs tests/email/hacker-dashboard.test.ts`
- Fonction de la base (Postgres local jetable, jamais la vraie base) : `sh tests/sql/run-admin-dashboard.sh`
- Écran dans le navigateur (base simulée) : `NODE_PATH=/opt/node-tools/node_modules node tests/account/hacker-dashboard-ui.test.js <dossier du site fabriqué>`
