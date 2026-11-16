// Notification d'un article vers l'application Android (Expo Push), envoyée par la base quand l'admin crée une notification produit
// (déclencheur push_notify_product_notification, fix-push-trigger-vault.sql).
// Accès : seulement avec le secret partagé (en-tête « x-webhook-secret »), relu dans le coffre-fort Supabase (push_webhook_secret).
// AUCUN secret n'est écrit dans ce fichier. « dry_run: true » : vérifie l'accès et compte les téléphones, sans rien envoyer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// comparaison à temps constant (ne révèle pas la longueur commune)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  try {
    const given = req.headers.get("x-webhook-secret") ?? "";
    const { data: secret } = await service.rpc("push_webhook_secret");
    if (!given || typeof secret !== "string" || !secret || !safeEqual(given, secret)) return new Response("forbidden", { status: 401 });

    const { title, message, dry_run } = await req.json();

    const { data: tokens, error: tokensError } = await service.from("app_push_tokens").select("expo_push_token");
    if (tokensError) throw tokensError;
    if (dry_run === true) return json({ ok: true, dry_run: true, total: tokens?.length ?? 0 });

    if (!title || !message) return json({ error: "missing title/message" }, 400);

    const pushMessages = (tokens ?? []).map((t) => ({
      to: t.expo_push_token as string,
      title,
      body: message,
      sound: "default",
      priority: "high",
      channelId: "default",
    }));

    let sent = 0;
    for (const batch of chunk(pushMessages, CHUNK_SIZE)) {
      const res = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }
    return json({ sent, total: pushMessages.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
