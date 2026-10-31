# Installer l'application après une commande

L'application (raccourci Albasse Shopping sur l'écran d'accueil du téléphone) est importante : le client suit sa commande, retrouve sa facture et reçoit
les ventes flash en un toucher. Après une commande, le client a confiance : c'est le meilleur moment pour la proposer.

## Où elle est proposée

1. **Écran de confirmation de la commande** (commande faite par le formulaire, avec ou sans compte) : une carte
   « 📲 Installez l'application Albasse Shopping », placée **avant** la carte Telegram.
   - Android (Chrome) : le bouton « 📲 Installer l'application » ouvre la boîte d'installation de Chrome ; si Chrome n'est pas encore prêt, un message
     explique quoi faire (patienter, ou les étapes à la main). Après l'installation : « ✅ Application installée » et les notifications sont proposées.
   - iPhone : le bouton « 📲 Voir comment installer » ouvre le tutoriel vidéo (Safari n'a pas de boîte d'installation).
   - Navigateur de TikTok / Facebook / WhatsApp (Android) : Chrome s'ouvre, ou la page « /installer » donne les étapes.
2. **Chat de Zara** : après une commande, Zara pose la question « Avez-vous déjà installé l'application ? » avec le bouton pour l'installer.
   Elle la repose même si la question avait déjà été posée sans réponse ; elle ne la repose pas si le client a déjà installé ou vient de répondre « Plus tard ».

Jamais sur ordinateur, ni dans l'application, ni quand l'application est déjà installée sur le téléphone.

## Ce qui ne change pas
- La fenêtre « 📲 Télécharge l'app Albasse Shopping » (une fois par jour, 2,5 s après l'arrivée), le bandeau du haut et la page « /installer » restent comme avant.

## Statistiques
Chaque toucher sur la carte est compté dans `app_download_clicks` avec la source **`commande`** : `commande|android|navigateur|accepte`
(`source|appareil|navigateur|résultat`). Le total des téléchargements du tableau de bord les compte comme les autres.

## Tests
- Navigateur : `PARTS=+` de `tests/zara/zara-ui.test.js` (carte sur la confirmation : Android sans / avec boîte d'installation, déjà installée, iPhone,
  ordinateur) et `PARTS=O` (chat : question reposée après une commande, pas reposée après « Plus tard »).
