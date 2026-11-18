// Point d'entrée unique de l'IA pour zara-ai, marketing-ai et zara-seo.
// 1. Si OMNIROUTE_URL et OMNIROUTE_API_KEY sont dans les secrets Supabase : la demande passe par OmniRoute
//    (modèle OMNIROUTE_MODEL, sinon le modèle demandé par la fonction).
// 2. Si OmniRoute ne répond pas (panne, délai, erreur) et que ANTHROPIC_API_KEY existe : Claude directement, en secours.
// 3. Sans OmniRoute : Claude directement, comme avant.
import Anthropic from "npm:@anthropic-ai/sdk";
import { chatUrl, fromOpenAI, toOpenAI, type ClaudeRequest } from "./omniroute.ts";

const OMNI_TIMEOUT_MS = 60_000;

function omni() {
  const url = Deno.env.get("OMNIROUTE_URL")?.trim();
  const key = Deno.env.get("OMNIROUTE_API_KEY")?.trim();
  return url && key ? { url: chatUrl(url), key, model: Deno.env.get("OMNIROUTE_MODEL")?.trim() || "" } : null;
}

// la clé Claude, sans espace ni retour à la ligne autour (une clé copiée sur téléphone en emporte souvent un : Anthropic la refuserait)
const anthropicKeyOf = () => Deno.env.get("ANTHROPIC_API_KEY")?.trim() || "";

/** true si au moins une voie (OmniRoute ou Claude) est configurée. */
export function aiReady(): boolean {
  return omni() !== null || !!anthropicKeyOf();
}

async function viaOmniRoute(cfg: { url: string; key: string; model: string }, params: ClaudeRequest): Promise<Anthropic.Message> {
  const model = cfg.model || params.model;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify(toOpenAI(params, model)),
    signal: AbortSignal.timeout(OMNI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`omniroute: HTTP ${res.status}`);
  return fromOpenAI(await res.json(), model) as unknown as Anthropic.Message;
}

export async function createMessage(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  const cfg = omni();
  const anthropicKey = anthropicKeyOf();
  if (cfg) {
    try {
      return await viaOmniRoute(cfg, params as unknown as ClaudeRequest);
    } catch (e) {
      if (!anthropicKey) throw e;
      console.error("llm: OmniRoute indisponible, secours Claude :", e instanceof Error ? e.message : String(e));
    }
  }
  if (!anthropicKey) throw new Error("llm: aucune clé IA");
  return await new Anthropic({ apiKey: anthropicKey }).messages.create(params);
}
