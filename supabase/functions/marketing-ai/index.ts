// Assistant marketing (admin seulement) : écrit des publicités Facebook, TikTok, WhatsApp et Google avec Claude Sonnet 5.5.
// Les faits (nom, prix, remise, stock) viennent de la base, jamais du texte envoyé par l'application.
// L'appelant doit être connecté et administrateur (profiles.is_admin), sinon la fonction refuse.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

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
- Donne directement les textes, sans longue introduction.`;

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
  if (!me?.is_admin) return json({ ok: false, reason: "forbidden" }, 403);

  let body: { channel?: unknown; productId?: unknown; goal?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  const channel = typeof body.channel === "string" && CHANNELS[body.channel] ? body.channel : "";
  if (!channel) return json({ ok: false, reason: "bad_request" }, 400);
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 120) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

  // les faits de l'article viennent de la base
  let facts = "Aucun article précis : écris une publicité générale pour la boutique.";
  if (typeof body.productId === "string" && /^[0-9a-f-]{36}$/i.test(body.productId)) {
    const { data: p } = await service
      .from("products")
      .select("name,price,compare_at_price,stock,description,is_flash_sale,flash_sale_ends_at")
      .eq("id", body.productId)
      .maybeSingle();
    if (p) {
      const remise = p.compare_at_price && p.compare_at_price > p.price ? `, ancien prix ${p.compare_at_price} FCFA (remise ${Math.round((1 - p.price / p.compare_at_price) * 100)} %)` : "";
      const flash = p.is_flash_sale && p.flash_sale_ends_at ? `. Vente flash jusqu'au ${new Date(p.flash_sale_ends_at).toLocaleDateString("fr-FR", { timeZone: "Africa/Ndjamena" })}` : "";
      facts = `Article : ${String(p.name).replace(/\s+/g, " ").trim()}. Prix ${p.price} FCFA${remise}. Stock ${p.stock}${p.stock > 0 && p.stock <= 3 ? " (stock faible)" : ""}${flash}. Description : ${String(p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 400)}`;
    }
  }

  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ ok: false, reason: "no_key" });
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Écris ${CHANNELS[channel]}.\nFaits : ${facts}\nObjectif : ${goal || "faire vendre l'article"}\nPrécisions de l'administrateur : ${note || "aucune"}`,
        },
      ],
      output_config: { effort: "medium" },
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) return json({ ok: false, reason: "empty" });
    return json({ ok: true, text });
  } catch (e) {
    console.error("marketing-ai:", e instanceof Error ? e.message : String(e));
    return json({ ok: false, reason: "error" });
  }
});
