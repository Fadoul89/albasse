// Assistant marketing (admin seulement) : écrit des publicités Facebook, TikTok, WhatsApp et Google avec Claude Sonnet 5.5.
// Les faits (nom, prix, remise, stock, visites des 30 derniers jours) viennent de la base, jamais du texte envoyé par l'application.
// L'appelant doit être connecté et administrateur (profiles.is_admin), sinon la fonction refuse.
// Psychologie de la vente (levers.ts) : { action: "facts", productId } renvoie les vrais chiffres et les leviers VRAIS de l'article ;
// { channel, productId, goal, lever } écrit le texte avec ce levier (« auto » = les 2 meilleurs leviers vrais), puis contrôle le texte.
import type Anthropic from "npm:@anthropic-ai/sdk";
import { aiReady, createMessage } from "../_shared/llm.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chooseLevers, computeFacts, falseClaims, leverAvailability, leverInstructions, LEVERS, LEVERS_SYSTEM, type Facts, type ProductRow } from "./levers.ts";

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

const MODEL = "claude-sonnet-5-5";
const CHANNELS: Record<string, string> = {
  facebook: "une publication Facebook : 2 versions, 3 à 5 lignes chacune, une accroche forte, 2 émojis au plus, un appel à l'action clair",
  tiktok: "un script TikTok de 15 à 20 secondes : l'accroche des 2 premières secondes, puis 3 ou 4 phrases à dire, puis l'appel à l'action",
  whatsapp: "un message WhatsApp court et amical (3 lignes au plus) à envoyer à un client, en commençant par « Bonjour {prénom}, »",
  google: "une annonce Google : 3 titres de 30 caractères au plus et 2 descriptions de 80 caractères au plus (compte les caractères)",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `Tu es l'assistant marketing d'Albasse Shopping, boutique en ligne au Tchad (N'Djamena). Tu écris pour l'administrateur, en français simple.
Règles :
- Utilise UNIQUEMENT les faits fournis (nom, prix, remise, stock). N'invente jamais un prix, une remise, une garantie, un avis ou un délai.
- Prix en FCFA. Mentionne le paiement à la livraison à N'Djamena quand c'est pertinent, et la livraison de 8h30 à 16h.
- Ton chaleureux, honnête, sans fausse urgence ni pression.
- Donne directement les textes, sans longue introduction.
${LEVERS_SYSTEM}`;

// Les vrais chiffres d'un article : la fiche, et sa ligne dans les visites des 30 derniers jours (fonction assistant_product_views)
// deno-lint-ignore no-explicit-any
async function loadFacts(service: any, productId: string | null): Promise<{ facts: Facts; product: (ProductRow & { description?: string | null }) | null }> {
  if (!productId) return { facts: computeFacts(null, 0, null), product: null };
  const { data: p } = await service.from("products").select("*").eq("id", productId).maybeSingle();
  if (!p) return { facts: computeFacts(null, 0, null), product: null };
  let views = 0;
  let rank: number | null = null;
  const { data: rows, error } = await service.rpc("assistant_product_views", { p_days: 30 });
  if (!error && Array.isArray(rows)) {
    const i = rows.findIndex((r: { product_id?: string }) => r && r.product_id === productId);
    if (i >= 0) {
      views = Number(rows[i].visitors) || 0;
      rank = i + 1;
    }
  }
  return { facts: computeFacts(p as ProductRow, views, rank), product: p };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // seul un administrateur connecté peut utiliser cette fonction
  const { data: userData, error: userErr } = await service.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (userErr || !userData?.user) return json({ ok: false, reason: "auth" }, 401);
  const { data: me } = await service.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
  if (!me?.is_admin || !(await adminAllowed(auth.replace(/^Bearer\s+/i, "")))) return json({ ok: false, reason: "forbidden" }, 403);

  let body: { action?: unknown; channel?: unknown; productId?: unknown; goal?: unknown; note?: unknown; lever?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  const productId = typeof body.productId === "string" && /^[0-9a-f-]{36}$/i.test(body.productId) ? body.productId : null;
  // les vrais chiffres et les leviers vrais de l'article (pour l'écran, avant d'écrire)
  if (body.action === "facts") {
    const { facts } = await loadFacts(service, productId);
    return json({ ok: true, facts, levers: leverAvailability(facts) });
  }
  const channel = typeof body.channel === "string" && CHANNELS[body.channel] ? body.channel : "";
  if (!channel) return json({ ok: false, reason: "bad_request" }, 400);
  const lever = typeof body.lever === "string" && (LEVERS as readonly string[]).includes(body.lever) ? body.lever : "auto";
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 120) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

  // les faits de l'article viennent de la base ; l'ancien prix n'est cité que pendant une vraie promotion (comme sur le site)
  const { facts: f, product: p } = await loadFacts(service, productId);
  const levers = chooseLevers(f, lever);
  if (!levers) return json({ ok: false, reason: "lever" }, 400); // levier pas vrai pour cet article : refusé
  let facts = "Aucun article précis : écris une publicité générale pour la boutique.";
  if (p) {
    const remise = f.oldPrice ? `, ancien prix ${f.oldPrice} FCFA (remise ${f.pct} %, le client économise ${f.saving} FCFA)` : "";
    facts = `Article : ${String(p.name).replace(/\s+/g, " ").trim()}. Prix ${f.price ?? p.price} FCFA${remise}. Stock ${f.stock ?? "?"}. Description : ${String(p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 400)}`;
  }
  if (!aiReady()) return json({ ok: false, reason: "no_key" });
  try {
    const res = await createMessage({
      model: MODEL,
      // 2 versions (une par levier) + la réflexion de l'IA : assez de place pour ne jamais couper le texte
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Écris ${CHANNELS[channel]}.\nFaits : ${facts}\n${leverInstructions(f, levers)}\nObjectif : ${goal || "faire vendre l'article"}\nPrécisions de l'administrateur : ${note || "aucune"}`,
        },
      ],
      output_config: { effort: "medium" },
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text || res.stop_reason === "refusal") return json({ ok: false, reason: "empty" });
    // contrôle : ce qui ne colle pas aux vrais chiffres est signalé à l'administrateur (le texte est montré quand même)
    return json({ ok: true, text, levers, warnings: falseClaims(text, f) });
  } catch (e) {
    console.error("marketing-ai:", e instanceof Error ? e.message : String(e));
    return json({ ok: false, reason: "error" });
  }
});
