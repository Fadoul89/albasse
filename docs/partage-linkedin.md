# Bouton « LinkedIn » sur les fiches article

Sur chaque fiche article, la ligne **Partager :** a maintenant trois boutons côte à côte : **💬 WhatsApp**, **📘 Facebook** et **💼 LinkedIn**. « Partager : » est écrit au-dessus, pour que les trois boutons tiennent sur une seule ligne, même sur un petit téléphone (360 px de large).

## Ce que fait le bouton LinkedIn
Il ouvre la page de partage de LinkedIn (`https://www.linkedin.com/sharing/share-offsite/?url=…`) dans un **nouvel onglet**, avec le lien de l'article déjà prêt à publier. La fiche de l'article reste affichée dans le premier onglet.
- Sur téléphone, si l'application LinkedIn est installée, le téléphone peut l'ouvrir lui-même pour ce lien ; sinon, c'est le site LinkedIn qui s'ouvre (le client se connecte à son compte s'il ne l'est pas déjà).
- Le bouton est un vrai lien « nouvel onglet » touché dans le geste du client : les navigateurs de téléphone (y compris ceux de Facebook, TikTok, WhatsApp) le laissent passer.
- Dans l'application mobile (sans navigateur), le lien est ouvert avec le système du téléphone.

## Mise en service
Aucun script SQL : seulement la publication du site.

## Tests
- Lien de partage : `node --import ./tests/zara/register.mjs tests/email/linkedin-share.test.ts`.
- Navigateur : `PARTS=N` (boutons côte à côte sur Android, iPhone, petit téléphone et ordinateur ; le clic ouvre un nouvel onglet avec le bon lien ; la fiche reste affichée).
