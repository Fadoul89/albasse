import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Le code du bot Telegram est gardé dans le coffre-fort Supabase (jamais dans le code).
async function botToken(): Promise<string | null> {
  const { data } = await serviceClient.rpc("zara_report_credentials");
  const t = (data as { token?: unknown } | null)?.token;
  return typeof t === "string" && t.length > 20 ? t : null;
}

async function sendMessage(telegramApi: string, chatId: number, text: string) {
  const res = await fetch(`${telegramApi}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
    }

    const { data: callerProfile, error: callerError } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (callerError || !callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const { title, message } = await req.json();
    if (!title || !message) {
      return new Response(JSON.stringify({ error: "missing title/message" }), { status: 400 });
    }

    const token = await botToken();
    if (!token) {
      return new Response(JSON.stringify({ error: "telegram not configured" }), { status: 500 });
    }
    const telegramApi = `https://api.telegram.org/bot${token}`;

    const { data: recipients, error: recipientsError } = await serviceClient
      .from("profiles")
      .select("telegram_chat_id")
      .eq("is_admin", false)
      .not("telegram_chat_id", "is", null);
    if (recipientsError) throw recipientsError;

    const text = `📣 ${title}\n\n${message}`;
    let sent = 0;
    for (const r of recipients ?? []) {
      const ok = await sendMessage(telegramApi, r.telegram_chat_id as number, text);
      if (ok) sent++;
    }

    return new Response(JSON.stringify({ sent, total: (recipients ?? []).length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
});
