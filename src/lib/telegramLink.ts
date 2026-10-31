// Lier le Telegram d'un client à son compte : le bouton ouvre le bot avec l'identifiant du compte, le bot demande « Démarrer » puis lie le compte
// (fonction serveur telegram-webhook). Lier = recevoir les nouveautés et les offres ; le client écrit STOP au bot pour arrêter.
export const TELEGRAM_BOT = 'AlbasseShoppingBot';

export const telegramLinkUrl = (userId: string) => `https://t.me/${TELEGRAM_BOT}?start=${userId}`;
