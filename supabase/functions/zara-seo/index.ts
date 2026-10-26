// Fonction « zara-seo » : Zara regarde la PHOTO de quelques articles et propose leur description (page produit + Google).
// Réservée aux administrateurs connectés (jeton de connexion vérifié, puis profiles.is_admin). Elle ne modifie JAMAIS la base : elle répond
// seulement des PROPOSITIONS ; c'est l'administrateur qui valide, et la publication passe par la fonction SQL zara_apply_seo (add-zara-seo.sql).
//   POST { "ids": ["<uuid>", …] }  (1 à 8 articles par appel)
//   → { ok: true, items: [{ id, name, current, proposal, source: "ia" | "modele", problems: [] }] }
// Les règles (ce que Zara n'écrit jamais, repli avec les seuls faits connus) sont dans rules.ts (testées : tests/seo/zara-seo.test.ts).
// Sans clé ANTHROPIC_API_KEY, ou si le modèle répond mal, la proposition est fabriquée avec les faits connus (source « modele »).
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { proposeDescription, SYSTEM_PROMPT, type SeoFacts } from "./rules.ts";

const MODEL = "claude-sonnet-5-5";
const MAX_IDS = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const { data: profile } = await db.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
    if (!profile?.is_admin) return json({ ok: false, reason: "forbidden" }, 403);

    // 2. les articles demandés
    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.ids) ? [...new Set<string>(body.ids.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x)))] : [];
    if (ids.length === 0 || ids.length > MAX_IDS) return json({ ok: false, reason: "bad_request" }, 400);

    const { data: rows, error } = await db
      .from("products")
      .select("id, name, description, colors, sizes, images, categories(name)")
      .in("id", ids);
    if (error) return json({ ok: false, reason: "database" });

    // 3. le modèle (si la clé existe)
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const client = apiKey ? new Anthropic({ apiKey }) : null;
    const callModel = client
      ? async (text: string, imageUrl: string | null): Promise<string> => {
          const content: Anthropic.ContentBlockParam[] = [];
          if (imageUrl) content.push({ type: "image", source: { type: "url", url: imageUrl } });
          content.push({ type: "text", text });
          const res = await client.messages.create({ model: MODEL, max_tokens: 500, system: SYSTEM_PROMPT, messages: [{ role: "user", content }] });
          return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        }
      : null;

    const items = await Promise.all(
      (rows ?? []).map(async (p: any) => {
        const facts: SeoFacts = {
          name: p.name,
          category: p.categories?.name ?? null,
          colors: p.colors ?? [],
          sizes: p.sizes ?? [],
          description: p.description ?? "",
        };
        const photo = (p.images ?? []).find((u: unknown) => typeof u === "string" && u.startsWith("https://")) ?? null;
        const proposal = await proposeDescription(facts, photo, callModel);
        return { id: p.id as string, name: p.name as string, current: (p.description ?? "") as string, proposal: proposal.description, source: proposal.source, problems: proposal.problems };
      })
    );
    return json({ ok: true, items });
  } catch (e) {
    console.error("zara-seo", e instanceof Error ? e.name : "erreur");
    return json({ ok: false, reason: "error" });
  }
});
