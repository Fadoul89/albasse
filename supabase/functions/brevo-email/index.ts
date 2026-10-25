// E-mails aux clients avec Brevo.
//  1. Test (administrateur connecté) : un e-mail de test envoyé à l'adresse de l'administrateur lui-même.
//  2. Envoi automatique des e-mails de commande (« commande reçue », « commande livrée ») : appelé chaque minute par la base (pg_cron) avec un
//     secret partagé (en-tête x-cron-secret, gardé dans le coffre-fort Supabase). Seulement si l'interrupteur de l'admin est allumé
//     (store_settings.order_emails_enabled), jamais plus de EMAIL_DAILY_CAP e-mails par jour (150 par défaut), jamais à une fausse adresse.
// Secrets (Supabase › Edge Functions › Secrets) : BREVO_API_KEY (obligatoire), EMAIL_SENDER (adresse du domaine acceptée par Brevo, par défaut
// contact@albasseshopping.com), EMAIL_SENDER_NAME (« Albasse Shopping ») et EMAIL_DAILY_CAP. La clé n'est jamais renvoyée à l'application.
// La fonction se contrôle elle-même (jeton d'administrateur ou secret partagé) : le contrôle de la passerelle est donc coupé.
import { createClient } from "npm:@supabase/supabase-js@2";
import { drain, sendBrevo } from "./drain.ts";
import { escapeHtml, layout, mask, realEmail } from "./orderEmails.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const deps = (service: unknown) => ({ service, env: (n: string) => Deno.env.get(n), fetchFn: fetch, now: () => Date.now() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // 1) appel de la base (chaque minute) : secret partagé, lu dans le coffre-fort par une fonction réservée au service
  const cron = req.headers.get("x-cron-secret");
  if (cron) {
    const { data: secret } = await service.rpc("email_cron_secret");
    if (!secret || cron !== secret) return json({ ok: false, reason: "auth" }, 401);
    try {
      return json(await drain(deps(service)));
    } catch (e) {
      console.error("brevo-email: erreur d'envoi automatique", e instanceof Error ? e.message : e);
      return json({ ok: false, reason: "error" });
    }
  }

  // 2) e-mail de test : seul un administrateur connecté
  const auth = req.headers.get("authorization") ?? "";
  const { data: userData, error: userErr } = await service.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (userErr || !userData?.user) return json({ ok: false, reason: "auth" }, 401);
  const { data: me } = await service.from("profiles").select("is_admin,email,full_name").eq("id", userData.user.id).maybeSingle();
  if (!me?.is_admin) return json({ ok: false, reason: "forbidden" }, 403);

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  if (body.action !== "test") return json({ ok: false, reason: "bad_request" }, 400);

  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) return json({ ok: false, reason: "no_key" });

  // le test part vers l'adresse de l'administrateur lui-même, jamais vers une adresse donnée par l'application
  const to = realEmail(me.email) ?? realEmail(userData.user.email);
  if (!to) return json({ ok: false, reason: "no_email" });

  const name = String(me.full_name ?? "").trim() || "Administrateur";
  const html = layout(
    "Test des e-mails Albasse Shopping ✅",
    `<p style="font-size:15px;line-height:22px">Bonjour ${escapeHtml(name)},</p>
<p style="font-size:15px;line-height:22px">Si vous lisez ce message, l'envoi d'e-mails par Brevo fonctionne : la clé, le domaine albasseshopping.com et l'expéditeur sont bons.</p>
<p style="font-size:15px;line-height:22px">Aucun e-mail n'est envoyé aux clients tant que vous ne l'avez pas activé.</p>`
  );
  const res = await sendBrevo(deps(service), key, { to, name, subject: "Test : e-mails d'Albasse Shopping", html });
  if (!res.ok) return json({ ok: false, reason: res.status ? "brevo" : "error", status: res.status, detail: res.detail });
  return json({ ok: true, to: mask(to) });
});
