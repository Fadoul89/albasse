// Notification envoyée par l'administrateur à tous les téléphones de l'application Android (Expo Push).
// Réservée à un administrateur connecté : jeton vérifié, profiles.is_admin, puis la règle de la base is_admin()
// (qui exige le code de Google Authenticator si l'admin a activé la double vérification, add-admin-mfa.sql).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Double vérification des admins (add-admin-mfa.sql) : c'est la base qui décide si ce jeton a les droits d'admin
// (admin ET, s'il a activé la double vérification, code de Google Authenticator tapé). Même règle que tout le site.
async function adminAllowed(jwt: string): Promise<boolean> {
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc("is_admin");
  return !error && data === true;
}

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
    if (callerError || !callerProfile?.is_admin || !(await adminAllowed(jwt))) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const { title, message } = await req.json();
    if (!title || !message) {
      return new Response(JSON.stringify({ error: "missing title/message" }), { status: 400 });
    }

    const { data: tokens, error: tokensError } = await serviceClient
      .from("app_push_tokens")
      .select("expo_push_token");
    if (tokensError) throw tokensError;

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

    return new Response(JSON.stringify({ sent, total: pushMessages.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
});
