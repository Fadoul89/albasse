// Contrôle de la connexion à Brevo, en lecture seule : AUCUN e-mail n'est envoyé, rien n'est modifié chez Brevo.
// Le contrôle se fait côté serveur avec la clé gardée dans les Secrets de la fonction (BREVO_API_KEY). Le résultat ne contient JAMAIS la clé,
// ni l'adresse ou le nom du titulaire du compte : seulement des oui / non, le type de forfait, les crédits, le statut de l'expéditeur et, pour
// chaque lecture refusée, le code court et le message de Brevo (la clé en est retirée si elle y figurait).
// Chaque lecture est faite et jugée séparément : une clé Brevo peut être LIMITÉE (c'est le cas de la clé d'Albasse Shopping : le compte, les
// expéditeurs et le domaine sont refusés, le journal des e-mails est lu). Une clé limitée mais reconnue n'est pas une erreur ; ce qui prouve
// qu'elle sait ENVOYER, c'est la confirmation de Brevo (identifiant du message) d'un e-mail de test, pas ce contrôle.
// Écrit sans dépendance à Deno (variables et fetch en paramètres) : testé dans tests/email/brevo-check.test.ts.
export interface CheckDeps {
  env: (name: string) => string | undefined;
  fetchFn: typeof fetch;
  now: () => number;
}

const API = "https://api.brevo.com/v3";

export interface EndpointResult {
  endpoint: string;
  http_status: number; // 0 = pas de réponse (réseau)
  brevo_code?: string;
  message?: string;
}

export interface BrevoCheck {
  ok: boolean;
  reason?: "no_key" | "unauthorized" | "unreachable" | "brevo_error" | "sender_missing" | "sender_inactive";
  checked_at: string;
  key_present: boolean;
  key_format_ok: boolean | null; // la clé commence-t-elle comme une clé Brevo ? (la clé elle-même n'est jamais renvoyée)
  endpoints: EndpointResult[];
  limited_key: boolean; // la clé est reconnue mais certaines lectures lui sont interdites
  report_7d: Record<string, number> | null; // les chiffres de Brevo sur 7 jours (envoyés, livrés, rebonds, plaintes, clics…), s'ils sont lisibles
  account: { http_status: number; plan: { type: string; credits: number | null; credits_type: string | null }[] } | null;
  sender: { email: string; found: boolean | null; active: boolean | null } | null; // found = null : la clé n'a pas le droit de lire les expéditeurs
  domain: { name: string; authenticated: boolean | null; verified: boolean | null } | null;
  events_api: { http_status: number; accessible: boolean } | null;
}

export async function brevoCheck(deps: CheckDeps): Promise<BrevoCheck> {
  const key = deps.env("BREVO_API_KEY");
  const out: BrevoCheck = {
    ok: false,
    checked_at: new Date(deps.now()).toISOString(),
    key_present: !!key,
    key_format_ok: key ? /^xkeysib-[A-Za-z0-9-]{20,}$/.test(key) : null,
    endpoints: [],
    limited_key: false,
    report_7d: null,
    account: null,
    sender: null,
    domain: null,
    events_api: null,
  };
  if (!key) return { ...out, reason: "no_key" };

  // un message de Brevo ne doit jamais renvoyer la clé : on la retire, et on garde peu de texte
  const clean = (v: unknown) => String(v ?? "").split(key).join("***").replace(/\s+/g, " ").trim().slice(0, 160);

  // uniquement des lectures (GET)
  const get = async (endpoint: string, path: string): Promise<{ status: number; body: any }> => {
    let status = 0;
    let body: any = null;
    try {
      const res = await deps.fetchFn(`${API}${path}`, { method: "GET", headers: { "api-key": key, accept: "application/json" } });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      // pas de réponse : status 0, sans le texte de l'erreur
    }
    const r: EndpointResult = { endpoint, http_status: status };
    if (status !== 200) {
      if (body?.code) r.brevo_code = clean(body.code);
      if (body?.message) r.message = clean(body.message);
    }
    out.endpoints.push(r);
    return { status, body };
  };

  const senderEmail = (deps.env("EMAIL_SENDER") || "contact@albasseshopping.com").trim();
  const domainName = senderEmail.split("@")[1] ?? "";
  const account = await get("account", "/account");
  const senders = await get("senders", "/senders");
  const domain = domainName ? await get("senders/domains", `/senders/domains/${encodeURIComponent(domainName)}`) : null;
  const events = await get("smtp/statistics/events", "/smtp/statistics/events?limit=1");
  const report = await get("smtp/statistics/aggregatedReport", "/smtp/statistics/aggregatedReport?days=7");

  const statuses = out.endpoints.map((e) => e.http_status);
  if (statuses.every((s) => s === 0)) return { ...out, reason: "unreachable" };

  out.account = { http_status: account.status, plan: [] };
  if (account.status === 200) {
    out.account.plan = (Array.isArray(account.body?.plan) ? account.body.plan : []).map((p: any) => ({
      type: String(p?.type ?? "inconnu"),
      credits: Number.isFinite(Number(p?.credits)) ? Number(p.credits) : null,
      credits_type: p?.creditsType ? String(p.creditsType) : null,
    }));
  }
  out.events_api = { http_status: events.status, accessible: events.status === 200 };
  if (domain) out.domain = { name: domainName, authenticated: domain.status === 200 ? domain.body?.authenticated === true : null, verified: domain.status === 200 ? domain.body?.verified === true : null };
  if (report.status === 200 && report.body && typeof report.body === "object") {
    const rep: Record<string, number> = {};
    for (const k of ["requests", "delivered", "hardBounces", "softBounces", "blocked", "invalid", "spamReports", "unsubscribed", "clicks", "uniqueClicks"]) {
      const v = Number(report.body[k]);
      if (Number.isFinite(v)) rep[k] = v;
    }
    out.report_7d = rep;
  }

  // la clé est reconnue dès qu'une lecture passe ; sinon elle est refusée ou Brevo est en panne
  const recognized = statuses.some((s) => s === 200);
  if (!recognized) return { ...out, reason: statuses.some((s) => s === 401 || s === 403) ? "unauthorized" : "brevo_error" };
  out.limited_key = statuses.some((s) => s === 401 || s === 403);

  // l'expéditeur n'est jugé que si la clé a le droit de lire les expéditeurs ; sinon il reste « non vérifiable » (found = null)
  if (senders.status === 200) {
    const found = (Array.isArray(senders.body?.senders) ? senders.body.senders : []).find((s: any) => String(s?.email ?? "").toLowerCase() === senderEmail.toLowerCase());
    out.sender = { email: senderEmail, found: !!found, active: found ? found.active === true : null };
    if (!out.sender.found) return { ...out, reason: "sender_missing" };
    if (out.sender.active === false) return { ...out, reason: "sender_inactive" };
  } else {
    out.sender = { email: senderEmail, found: null, active: null };
  }
  return { ...out, ok: true };
}
