// Changer la clé du bot Telegram sans écrire de SQL : l'administrateur envoie la NOUVELLE clé (celle que BotFather donne après « Revoke current token »)
// dans la conversation avec le bot ; le bot la range dans le coffre-fort Supabase, remet le lien (webhook) et efface le message.
// Ce fichier ne touche ni au réseau ni à la base (tout passe par `deps`) : il est donc testable (tests/email/telegram-key.test.ts).

export const BOT_KEY_RE = /^[0-9]{6,12}:[A-Za-z0-9_-]{30,}$/;
// une clé au milieu d'un texte (message de BotFather collé en entier) : numéro du bot, « : », puis 30 caractères ou plus, sans lettre collée autour
const KEY_IN_TEXT_RE = /(?<![A-Za-z0-9_-])[0-9]{6,12}:[A-Za-z0-9_-]{30,}(?![A-Za-z0-9_-])/g;

// « 8795982983:AAF… », avec ou sans « /cle » devant ; espaces et retours à la ligne (venus du copier-coller) ignorés.
// Si le message de BotFather est collé en entier, on prend la clé qu'il contient (seulement s'il n'y en a qu'une).
export function extractBotKey(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const candidate = text.replace(/^\s*\/cle(?:@[A-Za-z0-9_]+)?/i, "").replace(/\s+/g, "");
  if (BOT_KEY_RE.test(candidate)) return candidate;
  const found = new Set(text.match(KEY_IN_TEXT_RE) ?? []);
  return found.size === 1 ? [...found][0] : null;
}

export interface KeyDeps {
  isAdmin(chatId: number): Promise<boolean>;
  currentKey(): Promise<string | null>;
  // appel à l'API Telegram avec la clé donnée ; répond le JSON de Telegram, ou null si le réseau a échoué
  telegram(token: string, method: string, body?: Record<string, unknown>): Promise<{ ok?: boolean } | null>;
  saveKey(key: string): Promise<boolean>;
  webhookSecret(): Promise<string | null>;
  webhookUrl: string;
}

export type KeyOutcome = "ignored" | "refused" | "same" | "not-saved" | "saved";

export const KEY_TEXT = {
  refused: "❌ Telegram refuse cette clé.\nDans BotFather : touchez « Revoke current token », puis copiez le NOUVEAU message et envoyez-le ici.",
  same: "⚠️ C'est la même clé que celle déjà enregistrée (l'ancienne).\nDans BotFather : touchez « Revoke current token », puis copiez la NOUVELLE clé et envoyez-la ici.",
  notSaved: "❌ La clé n'a pas pu être enregistrée (ce n'est pas la clé du bot Albasse Shopping ?). Rien n'a été changé.",
  saved: "✅ Nouvelle clé enregistrée.\nLes alertes (commandes, factures, rapport du lundi) utilisent la nouvelle clé. Votre message avec la clé a été effacé.",
};

export async function processNewKey(deps: KeyDeps, chatId: number, messageId: number | undefined, key: string): Promise<KeyOutcome> {
  // seul un administrateur lié à Telegram peut changer la clé ; aux autres le bot ne répond rien
  if (!(await deps.isAdmin(chatId))) return "ignored";

  const current = await deps.currentKey();
  const reply = async (token: string | null, text: string) => {
    if (token) await deps.telegram(token, "sendMessage", { chat_id: chatId, text });
  };
  const erase = async (token: string | null) => {
    if (token && messageId) await deps.telegram(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
  };

  // la clé doit être acceptée par Telegram (sinon : clé fausse ou déjà révoquée)
  const me = await deps.telegram(key, "getMe");
  if (!me?.ok) {
    await reply(current, KEY_TEXT.refused);
    return "refused";
  }

  // la même clé que celle du coffre-fort : l'ancienne n'a pas été révoquée
  if (key === current) {
    await erase(current);
    await reply(current, KEY_TEXT.same);
    return "same";
  }

  // le coffre-fort refuse la clé d'un autre bot (même numéro de bot obligatoire)
  if (!(await deps.saveKey(key))) {
    await erase(key);
    await reply(current, KEY_TEXT.notSaved);
    return "not-saved";
  }

  // le lien (webhook) est remis avec la nouvelle clé, puis le message qui contient la clé est effacé
  const secret = await deps.webhookSecret();
  if (secret) await deps.telegram(key, "setWebhook", { url: deps.webhookUrl, secret_token: secret });
  await erase(key);
  await reply(key, KEY_TEXT.saved);
  return "saved";
}
