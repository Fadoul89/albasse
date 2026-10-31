// Mots que le client peut écrire au bot : STOP (plus de messages publicitaires) et REPRENDRE (les recevoir de nouveau), et les textes des réponses.
// Fonctions pures, sans réseau ni base, testées dans tests/email/telegram-promo.test.ts.

const STOP_WORDS = new Set(["stop", "stoppe", "arret", "arreter", "arretez", "desabonner", "desabonnement", "unsubscribe", "cancel", "توقف", "ايقاف", "إيقاف"]);
const RESUME_WORDS = new Set(["reprendre", "reprise", "resume", "reabonner", "استئناف"]);

// « STOP », « /stop », « Stop. », « /stop@AlbasseShoppingBot », « Arrêter » → "stop" ; « REPRENDRE » → "resume" ; tout le reste → null
// (une phrase qui contient seulement le mot « stop » n'est PAS un arrêt ; « /start » n'est pas une reprise)
export function parseClientCommand(text: string | undefined | null): "stop" | "resume" | null {
  if (!text) return null;
  const word = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/@[a-z0-9_]+$/i, "")
    .replace(/[\s.!?؟،,;:]+$/g, "");
  if (STOP_WORDS.has(word)) return "stop";
  if (RESUME_WORDS.has(word)) return "resume";
  return null;
}

export const LINKED_TEXT =
  "✅ Votre compte Albasse Shopping est maintenant lié à Telegram.\n\nVous recevrez ici vos nouveautés, nos offres et les messages de la boutique.\nPour ne plus recevoir nos offres, écrivez STOP à tout moment.";
export const STOPPED_TEXT = "✅ C'est noté : vous ne recevrez plus nos messages publicitaires ici.\nPour les recevoir de nouveau, écrivez REPRENDRE.";
export const RESUMED_TEXT = "✅ Merci ! Vous recevrez de nouveau nos nouveautés et nos offres.\nÉcrivez STOP quand vous voulez arrêter.";
export const NOT_LINKED_TEXT = "Ce Telegram n'est lié à aucun compte Albasse Shopping : vous ne recevez aucun message publicitaire.\nPour lier votre compte, utilisez le bouton « Lier Telegram » dans votre profil sur albasseshopping.com.";
