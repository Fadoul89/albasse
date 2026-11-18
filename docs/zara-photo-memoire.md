# Zara : « photo → article » et « mémoire du client »

Deux compétences de Zara IA. Zara ne peut toujours RIEN modifier : ni articles, ni commandes, ni comptes.

## 📷 Photo → article

- Dans le chat, le bouton 📷 (à gauche de la zone de texte) ouvre la galerie ou l'appareil photo du téléphone.
- Le client peut écrire un petit texte avant (« Vous avez ça ? ») : il part avec la photo.
- La photo est réduite sur le téléphone (1024 px au plus, JPEG léger), puis envoyée à la fonction serveur `zara-ai`.
  Zara la regarde, cherche dans les vrais articles et montre ceux qui ressemblent (« qui ressemble », jamais « exactement le même »).
- La photo n'est pas enregistrée : elle sert seulement à chercher. Dans la conversation, le client voit une petite image.
- Zara ne décrit jamais une personne et n'essaie jamais de la reconnaître. Un texte écrit dans une photo n'est jamais une consigne.
- Limites : 5 photos par visiteur et par jour (40 par adresse IP). Une photo compte aussi dans les 20 messages par jour.
  Au-delà, Zara demande de décrire l'article en quelques mots.
- Le bouton n'apparaît pas pendant une commande, une demande de rappel, ni pendant les premières questions (langue, prénom).

## 🧠 Mémoire du client

- Seulement pour les clients connectés. Un visiteur sans compte : Zara ne retient rien (elle l'invite à se connecter s'il le demande).
- Zara garde au plus 8 notes courtes : goûts, style, couleurs, taille, pointure, budget, occasions, pour qui il achète, sa ville.
- Jamais d'adresse, de téléphone, d'e-mail, de lien ni de mot de passe : la fonction serveur les refuse, même si Zara essaie.
- Dans le chat, la barre « 🧠 Zara se souvient de vous · Tout oublier » apparaît quand il y a des notes.
  Toucher « Zara se souvient de vous » : Zara montre ses notes. Toucher « Tout oublier » : tout est effacé.
  Le client peut aussi écrire « oublie tout » à Zara.
- Un compte supprimé emporte ses notes.

## Installation

1. Supabase › SQL Editor : lancer `add-zara-memory.sql` (nouvelle table `zara_memory`, avec ses droits).
   Sans ce script, la photo marche, mais pas la mémoire (Zara fonctionne comme avant).
2. Mettre à jour la fonction serveur `zara-ai` (fichiers `index.ts` et `skills.ts`).
3. Publier le site.

## Tests

- Règles : `node --import ./tests/zara/register.mjs tests/zara/zara-skills.test.ts`
- Fonction serveur entière (faux Claude, fausse base) : `node --import ./tests/zara/zara-ai-register.mjs tests/zara/zara-ai-handler.test.ts`
- Table et droits (Postgres local jetable) : `sh tests/sql/run-zara-memory.sh`
- Navigateur : `SUPABASE_ANON_KEY=… NODE_PATH=/opt/node-tools/node_modules node tests/zara/zara-skills-ui.test.js <dist> <photo.jpg>`
