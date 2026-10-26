import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractBotKey, processNewKey, type KeyDeps } from "./key.ts";

// Aucun secret n'est écrit dans ce fichier : la clé du bot Telegram et le mot de passe du lien (webhook) sont lus dans le coffre-fort Supabase
// par le serveur (fonctions zara_report_credentials et telegram_webhook_secret, réservées à service_role).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// relue à chaque message (jamais gardée en mémoire) : quand la clé change dans le coffre-fort, le changement est pris en compte tout de suite
async function botToken(): Promise<string | null> {
  const { data } = await supabase.rpc("zara_report_credentials");
  const token = data?.token;
  return typeof token === "string" && token.length > 20 ? token : null;
}

// appel à l'API Telegram ; on ne journalise jamais l'adresse (elle contient la clé)
async function telegram(token: string, method: string, body?: Record<string, unknown>): Promise<{ ok?: boolean } | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json().catch(() => null);
  } catch (e) {
    console.error("telegram", method, e instanceof Error ? e.name : "erreur");
    return null;
  }
}

async function sendMessage(chatId: number, text: string) {
  const token = await botToken();
  if (!token) {
    console.error("clé du bot Telegram introuvable dans le coffre-fort");
    return;
  }
  await telegram(token, "sendMessage", { chat_id: chatId, text });
}

const keyDeps: KeyDeps = {
  isAdmin: async (chatId) => {
    const { data } = await supabase.from("profiles").select("id").eq("telegram_chat_id", chatId).eq("is_admin", true).limit(1).maybeSingle();
    return !!data;
  },
  currentKey: botToken,
  telegram,
  saveKey: async (key) => {
    const { data, error } = await supabase.rpc("set_telegram_bot_token", { p_token: key });
    return !error && data === true;
  },
  webhookSecret: async () => {
    const { data } = await supabase.rpc("telegram_webhook_secret");
    return typeof data === "string" ? data : null;
  },
  webhookUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`,
};

Deno.serve(async (req: Request) => {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const { data: secret } = await supabase.rpc("telegram_webhook_secret");
  if (!secretHeader || typeof secret !== "string" || !safeEqual(secretHeader, secret)) {
    return new Response("forbidden", { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId: number | undefined = message?.chat?.id;

  // une clé de bot envoyée par un administrateur dans la conversation privée : changement de clé (voir key.ts)
  const newKey = extractBotKey(text);
  if (newKey && chatId && message?.chat?.type === "private") {
    try {
      await processNewKey(keyDeps, chatId, message?.message_id, newKey);
    } catch (e) {
      console.error("changement de clé", e instanceof Error ? e.name : "erreur");
    }
    return new Response("ok");
  }

  if (text && chatId && text.startsWith("/start")) {
    const parts = text.trim().split(/\s+/);
    const payload = parts[1];

    if (payload && UUID_RE.test(payload)) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: chatId })
        .eq("id", payload)
        .select("id")
        .maybeSingle();

      if (!error && data) {
        await sendMessage(
          chatId,
          "✅ Votre compte Albasse Shopping est maintenant lié à Telegram.\nVous recevrez ici les messages de la boutique."
        );
      } else {
        await sendMessage(
          chatId,
          "Lien invalide ou expiré. Réessayez depuis votre profil dans l'app ou le site Albasse Shopping."
        );
      }
    } else {
      await sendMessage(
        chatId,
        "👋 Bienvenue sur le bot Albasse Shopping ! Pour lier votre compte, utilisez le bouton \"Lier Telegram\" depuis votre profil dans l'app ou le site."
      );
    }
  }

  return new Response("ok");
});
