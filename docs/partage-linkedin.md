# Bouton « LinkedIn » sur les fiches article

Sur chaque fiche article, la ligne **Partager :** a maintenant trois boutons côte à côte : **💬 WhatsApp**, **📘 Facebook** et **💼 LinkedIn**. « Partager : » est écrit au-dessus, pour que les trois boutons tiennent sur une seule ligne, même sur un petit téléphone (360 px de large).

## Ce que fait le bouton LinkedIn
Il ouvre **directement l'application LinkedIn** sur téléphone (comme le bouton Facebook ouvre l'application Facebook), avec le lien de l'article prêt à publier. Sans l'application, la page de partage du site LinkedIn s'ouvre à la place (`https://www.linkedin.com/sharing/share-offsite/?url=…`).
- **Android (Chrome)** : le lien est donné directement à l'application LinkedIn (`com.linkedin.android`). Si elle n'est pas installée, Chrome ouvre tout seul la page de partage du site. La fiche de l'article reste affichée.
- **Dans l'application Albasse (Android)** : on appelle l'application LinkedIn ; si la page est encore là 1,5 s plus tard (LinkedIn ne s'est pas ouvert), la page de partage du site s'ouvre, **une seule fois**.
- **iPhone** : le lien linkedin.com s'ouvre de lui-même dans l'application LinkedIn quand elle est installée (lien universel), sinon sur le site.
- **Ordinateur** : la page de partage dans un nouvel onglet ; la fiche reste affichée.
- Dans l'application mobile native (sans navigateur), le lien est ouvert avec le système du téléphone.
La façon d'ouvrir selon l'appareil est la même que pour Facebook (`src/lib/shareTarget.ts`) ; seul le lien à ouvrir change (`facebookShare.ts`, `linkedinShare.ts`).
**À savoir** : les tests ne peuvent pas ouvrir une vraie application ; ils vérifient le lien exact que le téléphone reçoit. Que l'application LinkedIn affiche tout de suite la fenêtre « Créer une publication » dépend de la version de LinkedIn installée sur le téléphone.

## Mise en service
Aucun script SQL : seulement la publication du site.

## Tests
- Liens de partage (Android, application Albasse, iPhone, ordinateur) : `node --import ./tests/zara/register.mjs tests/email/linkedin-share.test.ts` (11).
- Navigateur : `PARTS=N` (boutons côte à côte sur Android, application Albasse, iPhone, petit téléphone et ordinateur ; le clic envoie le bon lien ; la fiche reste affichée ; Facebook inchangé).
