import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractBotKey, processNewKey, type KeyDeps } from "./key.ts";
import { LINKED_TEXT, NOT_LINKED_TEXT, RESUMED_TEXT, STOPPED_TEXT, parseClientCommand } from "./commands.ts";

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

// « STOP » / « REPRENDRE » écrit par un client : plus de messages publicitaires / de nouveau (les administrateurs ne sont pas concernés).
// Le même Telegram peut être lié à plusieurs comptes d'une même personne : la demande vaut pour tous.
async function handleClientCommand(chatId: number, command: "stop" | "resume") {
  const { data: profiles } = await supabase.from("profiles").select("id,is_admin").eq("telegram_chat_id", chatId);
  if (!profiles || profiles.length === 0) {
    await sendMessage(chatId, NOT_LINKED_TEXT);
    return;
  }
  const clients = profiles.filter((p) => !p.is_admin);
  if (clients.length === 0) return;
  const now = new Date().toISOString();
  const patch =
    command === "stop"
      ? { stopped_at: now, stop_reason: "STOP", updated_at: now }
      : { promos_ok: true, consented_at: now, stopped_at: null, stop_reason: null, updated_at: now };
  const { error } = await supabase.from("telegram_prefs").upsert(clients.map((p) => ({ user_id: p.id, ...patch })), { onConflict: "user_id" });
  if (error) {
    console.error("préférences Telegram", error.code ?? "erreur");
    await sendMessage(chatId, "Un petit souci est arrivé. Réessayez dans un moment, s'il vous plaît.");
    return;
  }
  await sendMessage(chatId, command === "stop" ? STOPPED_TEXT : RESUMED_TEXT);
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

  // petit journal (jamais le texte du message, seulement sa longueur et le résultat) pour comprendre ce qui arrive quand une clé est envoyée
  const logEvent = async (outcome: string, keyFound: boolean) => {
    try {
      await supabase.from("telegram_key_events").insert({ chat_id: chatId ?? null, text_length: text?.length ?? 0, key_found: keyFound, outcome });
    } catch {
      // le journal ne doit jamais bloquer le bot
    }
  };

  // une clé de bot envoyée par un administrateur dans la conversation privée : changement de clé (voir key.ts)
  const newKey = extractBotKey(text);
  if (newKey && chatId && message?.chat?.type === "private") {
    try {
      await logEvent(await processNewKey(keyDeps, chatId, message?.message_id, newKey), true);
    } catch (e) {
      console.error("changement de clé", e instanceof Error ? e.name : "erreur");
      await logEvent("error", true);
    }
    return new Response("ok");
  }
  // un long message sans clé reconnaissable (clé coupée, mauvais message copié…) : noté pour le diagnostic
  if (chatId && message?.chat?.type === "private" && (text?.length ?? 0) >= 30 && !text?.startsWith("/start")) {
    await logEvent("no-key-in-text", false);
  }

  const command = message?.chat?.type === "private" ? parseClientCommand(text) : null;
  if (command && chatId) {
    await handleClientCommand(chatId, command);
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
        // lier son Telegram = accepter les nouveautés et les offres (le message ci-dessous le dit, avec le mot STOP) ; relier après un STOP les reprend
        const now = new Date().toISOString();
        const { error: prefsError } = await supabase
          .from("telegram_prefs")
          .upsert({ user_id: data.id, promos_ok: true, consented_at: now, stopped_at: null, stop_reason: null, updated_at: now }, { onConflict: "user_id" });
        if (prefsError) console.error("préférences Telegram", prefsError.code ?? "erreur");
        await sendMessage(chatId, LINKED_TEXT);
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
