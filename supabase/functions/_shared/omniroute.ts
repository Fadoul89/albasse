// OmniRoute : passerelle IA « compatible OpenAI » (une seule adresse, plusieurs fournisseurs, bascule automatique).
// Ce fichier ne fait que TRADUIRE : une demande au format Claude (messages, outils, photos) devient une demande
// /v1/chat/completions, et la réponse revient au format Claude. Ainsi zara-ai, marketing-ai et zara-seo gardent leur code.
// Aucun réseau ici (testé : tests/ai/omniroute.test.ts).

type Block = { type: string; [k: string]: any };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
export type ClaudeRequest = {
  model: string;
  max_tokens: number;
  system?: string | { type: string; text: string }[];
  messages: Msg[];
  tools?: { name: string; description?: string; input_schema: unknown }[];
  [k: string]: unknown;
};

/** « https://mon-routeur.fr », « …/v1 » ou « …/v1/ » → « https://mon-routeur.fr/v1/chat/completions » */
export function chatUrl(base: string): string {
  let u = base.trim().replace(/\/+$/, "");
  if (u.endsWith("/chat/completions")) return u;
  if (!/\/v1$/.test(u)) u += "/v1";
  return u + "/chat/completions";
}

function imageUrl(b: Block): string | null {
  const s = b.source ?? {};
  if (s.type === "url" && typeof s.url === "string") return s.url;
  if (s.type === "base64" && typeof s.data === "string") return `data:${s.media_type ?? "image/jpeg"};base64,${s.data}`;
  return null;
}

function resultText(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((x) => (x?.type === "text" ? x.text : "")).join("\n");
  return c == null ? "" : JSON.stringify(c);
}

/** Demande Claude → corps JSON pour OmniRoute (format OpenAI). */
export function toOpenAI(p: ClaudeRequest, model: string) {
  const out: any[] = [];
  const sys = typeof p.system === "string" ? p.system : (p.system ?? []).map((b) => b.text).join("\n\n");
  if (sys) out.push({ role: "system", content: sys });

  for (const m of p.messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const calls = m.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      out.push(calls.length ? { role: "assistant", content: text || null, tool_calls: calls } : { role: "assistant", content: text });
      continue;
    }
    // client : d'abord les résultats d'outils (un message « tool » chacun), puis le texte et les photos
    for (const b of m.content) {
      if (b.type === "tool_result") {
        out.push({ role: "tool", tool_call_id: b.tool_use_id, content: (b.is_error ? "Erreur : " : "") + resultText(b.content) });
      }
    }
    const parts: any[] = [];
    for (const b of m.content) {
      if (b.type === "text") parts.push({ type: "text", text: b.text });
      else if (b.type === "image") {
        const url = imageUrl(b);
        if (url) parts.push({ type: "image_url", image_url: { url } });
      }
    }
    if (parts.length === 1 && parts[0].type === "text") out.push({ role: "user", content: parts[0].text });
    else if (parts.length) out.push({ role: "user", content: parts });
  }

  const body: any = { model, max_tokens: p.max_tokens, messages: out, stream: false };
  if (p.tools?.length) {
    body.tools = p.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description ?? "", parameters: t.input_schema } }));
  }
  return body;
}

const STOP: Record<string, string> = { tool_calls: "tool_use", function_call: "tool_use", length: "max_tokens", content_filter: "refusal" };

/** Réponse OmniRoute (format OpenAI) → message au format Claude (content, stop_reason, usage). */
export function fromOpenAI(r: any, model: string) {
  const choice = r?.choices?.[0];
  if (!choice?.message) throw new Error("omniroute: réponse sans message");
  const msg = choice.message;
  const content: any[] = [];
  const text = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((x: any) => x?.text ?? "").join("") : "";
  if (text.trim()) content.push({ type: "text", text, citations: null });
  for (const c of msg.tool_calls ?? []) {
    let input: unknown = {};
    try {
      input = c.function?.arguments ? JSON.parse(c.function.arguments) : {};
    } catch {
      input = {};
    }
    content.push({ type: "tool_use", id: c.id || `toolu_${content.length}`, name: c.function?.name ?? "", input });
  }
  const hasTools = content.some((b) => b.type === "tool_use");
  const stop_reason = hasTools ? "tool_use" : STOP[choice.finish_reason] ?? "end_turn";
  return {
    id: r.id ?? "omniroute",
    type: "message",
    role: "assistant",
    model: r.model ?? model,
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: r.usage?.prompt_tokens ?? 0, output_tokens: r.usage?.completion_tokens ?? 0 },
  };
}
