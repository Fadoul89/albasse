// Fonction « admin-client-account » : changer la connexion, fermer ou supprimer le compte d'un client (Admin › Clients › « Gérer le compte »).
// Réservée aux administrateurs connectés (jeton vérifié, puis profiles.is_admin). Jamais sur un compte administrateur ni sur soi-même.
//   POST { "action": "change_login" | "close" | "delete", "userId": "<uuid>", "value": "<nouveau numéro ou e-mail>", "reason": "…", "confirm": "FERMER" | "AS-000123" }
//   → { ok: true, detail } ou { ok: false, reason } (refus normaux : réponse 200 avec la raison ; erreurs de connexion : 401 / 403)
// Les étapes sont dans logic.ts et les règles dans rules.ts (testées : tests/account/admin-client-account.test.ts). Docs : docs/gestion-de-compte.md.
import { createClient } from "npm:@supabase/supabase-js@2";
import { run, type Deps } from "./logic.ts";
import { parseRequest } from "./rules.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // 1. administrateur connecté seulement
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ ok: false, reason: "unauthenticated" }, 401);
    const { data: userData, error: userError } = await db.auth.getUser(jwt);
    if (userError || !userData.user) return json({ ok: false, reason: "unauthenticated" }, 401);
    const { data: me } = await db.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
    if (!me?.is_admin) return json({ ok: false, reason: "forbidden" }, 403);

    // 2. la demande
    const parsed = parseRequest(await req.json().catch(() => null));
    if (!parsed.ok) return json({ ok: false, reason: parsed.reason }, 400);

    // 3. les vrais accès
    const deps: Deps = {
      async getTarget(id) {
        const { data } = await db.from("profiles").select("id, email, is_admin, client_number, phone, whatsapp_number").eq("id", id).maybeSingle();
        if (data) return data as never;
        // colonne du numéro client pas encore là (script pas lancé) : on relit sans elle
        const { data: bare } = await db.from("profiles").select("id, email, is_admin, phone, whatsapp_number").eq("id", id).maybeSingle();
        return bare ? ({ ...bare, client_number: null } as never) : null;
      },
      async getLoginEmail(id) {
        const { data } = await db.auth.admin.getUserById(id);
        return data?.user?.email ?? null;
      },
      async ordersCount(id) {
        const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", id);
        return count ?? 0;
      },
      async updateAuth(id, attrs) {
        const { error } = await db.auth.admin.updateUserById(id, attrs);
        return error ? { message: error.message } : null;
      },
      async deleteAuth(id) {
        const { error } = await db.auth.admin.deleteUser(id);
        return error ? { message: error.message } : null;
      },
      async updateProfile(id, patch) {
        const { error } = await db.from("profiles").update(patch).eq("id", id);
        return error ? { message: error.message } : null;
      },
      async addSanction(userId, reason, adminId) {
        await db.from("customer_sanctions").insert({ user_id: userId, action: "ban", reason, admin_id: adminId });
      },
      async log(entry) {
        await db.from("client_account_log").insert(entry);
      },
    };
    const result = await run(deps, userData.user.id, parsed.req);
    return json(result);
  } catch {
    return json({ ok: false, reason: "server_error" }, 500);
  }
});
