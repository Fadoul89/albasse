// E-mails aux clients avec Brevo. Pour l'instant : un e-mail de test envoyé à l'administrateur (action « test »), pour vérifier la chaîne
// complète (clé Brevo, domaine, expéditeur) avant d'envoyer quoi que ce soit aux clients.
// Secrets (Supabase › Edge Functions › Secrets) : BREVO_API_KEY (obligatoire), EMAIL_SENDER (adresse du domaine acceptée par Brevo,
// par défaut contact@albasseshopping.com) et EMAIL_SENDER_NAME (par défaut « Albasse Shopping »). La clé n'est jamais renvoyée à l'application.
// L'appelant doit être connecté et administrateur (profiles.is_admin), sinon la fonction refuse.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// les comptes créés avec un numéro de téléphone ont une fausse adresse (numéro@tel.albasseshopping.com) : on n'y écrit jamais
const FAKE_DOMAIN = "@tel.albasseshopping.com";
const realEmail = (v: unknown): string | null => {
  const e = typeof v === "string" ? v.trim() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.toLowerCase().endsWith(FAKE_DOMAIN) ? e : null;
};
const mask = (e: string) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2");
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Mise en page commune des e-mails de la boutique (réutilisée pour les e-mails de commande, de relance, etc.)
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1d2433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#062266;padding:18px 24px;color:#e8c46c;font-size:20px;font-weight:bold">Albasse Shopping</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:20px;color:#062266">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#f4f4f7;font-size:12px;color:#6b7280">Albasse Shopping, N'Djamena, Tchad · albasseshopping.com</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // seul un administrateur connecté peut utiliser cette fonction
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

  const sender = { email: Deno.env.get("EMAIL_SENDER") || "contact@albasseshopping.com", name: Deno.env.get("EMAIL_SENDER_NAME") || "Albasse Shopping" };
  const name = String(me.full_name ?? "").trim() || "Administrateur";
  const html = layout(
    "Test des e-mails Albasse Shopping ✅",
    `<p style="font-size:15px;line-height:22px">Bonjour ${escapeHtml(name)},</p>
<p style="font-size:15px;line-height:22px">Si vous lisez ce message, l'envoi d'e-mails par Brevo fonctionne : la clé, le domaine albasseshopping.com et l'expéditeur sont bons.</p>
<p style="font-size:15px;line-height:22px">Aucun e-mail n'est envoyé aux clients tant que vous ne l'avez pas activé.</p>`
  );

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender, to: [{ email: to, name }], subject: "Test : e-mails d'Albasse Shopping", htmlContent: html }),
    });
    if (!res.ok) {
      const raw = await res.text();
      let detail = raw.slice(0, 200);
      try {
        detail = String(JSON.parse(raw).message ?? detail);
      } catch {
        // texte brut
      }
      console.error("brevo-email: Brevo a refusé l'envoi", res.status, detail);
      return json({ ok: false, reason: "brevo", status: res.status, detail });
    }
    return json({ ok: true, to: mask(to) });
  } catch (e) {
    console.error("brevo-email: erreur réseau", e instanceof Error ? e.message : e);
    return json({ ok: false, reason: "error" });
  }
});
