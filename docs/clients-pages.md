# Admin › Clients : la liste en pages numérotées (1 2 3 4)

Demande du patron : « pour voir toute la liste, divisée en pages 1 2 3 4 ».

Avant : la liste montrait 20 clients, puis un bouton « Charger plus (N restants) » qui allongeait la liste.
Maintenant : la liste est **découpée en pages de 20 clients**, avec des boutons numérotés.

- **75 clients = 4 pages** : « ‹ 1 2 3 4 › ». La page affichée est en doré.
- Les boutons sont **au-dessus** (sous « 75 client(s) ») **et en dessous** de la liste. Un bouton du bas ramène en haut de la liste.
- Sous les boutons : « Page 2 sur 4 · clients 21–40 sur 75 ».
- **« ‹ »** (page précédente) est grisé à la page 1, **« › »** (page suivante) est grisé à la dernière page.
- Beaucoup de clients (230 = 12 pages) : jamais plus de 7 boutons, avec des « … » : « ‹ 1 2 3 4 5 … 12 › », puis « ‹ 1 … 5 6 7 … 12 › ».
- Une recherche ou un filtre (Intérêt élevé, Hommes, Femmes…) **revient à la page 1**. Si tout tient sur une seule page, aucun bouton.
- Le texte « 75 client(s) » ne change pas.

Les règles de découpe sont dans `src/lib/pagination.ts` (fonctions pures) ; l'écran est `src/screens/admin/AdminCustomersScreen.tsx`.
Aucun script SQL : rien ne change dans la base.

## Tests
- Règles : `node --import ./tests/zara/register.mjs tests/email/pagination.test.ts` (32 vérifications).
- Navigateur : `PARTS=%` (Admin › Clients : 75 clients en 4 pages, boutons du haut et du bas, recherche et filtre qui reviennent à la page 1, téléphone, 230 clients en 12 pages).
