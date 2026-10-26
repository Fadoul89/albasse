// Fonction « zara-report-poster » : le rapport de Zara de la semaine, dessiné en affiche (2 photos) et envoyé sur le Telegram des administrateurs.
//
// Appelée chaque lundi à 8 h (heure de N'Djamena) par la base (add-zara-weekly-poster.sql), avec le secret partagé de la base dans l'en-tête
// « x-cron-secret » (le même que pour « brevo-email », gardé dans le coffre-fort Supabase). Personne d'autre ne peut la déclencher.
//   POST { "action": "weekly" }             : dessine et envoie les photos (si le dessin échoue : le texte, comme avant)
//   POST { "action": "weekly", "dry": true } : dessine seulement et répond avec la taille des images (rien n'est envoyé)
// Les chiffres viennent de la fonction SQL zara_weekly_report_data ; le code du bot Telegram est lu dans le coffre-fort par zara_report_credentials :
// rien n'est écrit en clair ici.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { posterPages, dayLabel, shortDate, cleanText, type PosterPage, type ReportData } from "./poster.ts";

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// --- polices et photos ------------------------------------------------------------------------------------------------------------------

const FONT_URLS = {
  manrope600: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/manrope@0.4.2/600SemiBold/Manrope_600SemiBold.ttf",
  manrope700: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/manrope@0.4.2/700Bold/Manrope_700Bold.ttf",
  fraunces700: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/fraunces@0.4.1/700Bold/Fraunces_700Bold.ttf",
};
const AVATAR_URLS = [
  "https://www.albasseshopping.com/assets/assets/assistante-avatar.24ec07a87972f61ee974944c5b16f342.jpg",
  "https://www.albasseshopping.com/zara-avatar.jpg",
];

let fontCache: { name: string; data: ArrayBuffer; weight: number; style: "normal" }[] | null = null;

async function getBytes(url: string, ms = 10000): Promise<{ buf: ArrayBuffer; type: string } | null> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return { buf: await res.arrayBuffer(), type: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() };
  } catch {
    return null;
  }
}

async function loadFonts() {
  if (fontCache) return fontCache;
  const [m6, m7, f7] = await Promise.all([getBytes(FONT_URLS.manrope600), getBytes(FONT_URLS.manrope700), getBytes(FONT_URLS.fraunces700)]);
  if (!m6 || !m7 || !f7) throw new Error("polices introuvables");
  fontCache = [
    { name: "Manrope", data: m6.buf, weight: 600, style: "normal" },
    { name: "Manrope", data: m7.buf, weight: 700, style: "normal" },
    { name: "Fraunces", data: f7.buf, weight: 700, style: "normal" },
  ];
  return fontCache;
}

function dataUri(buf: ArrayBuffer, type: string): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

// photo en JPEG ou PNG de moins de 2 Mo ; sinon rien (l'affiche montre alors un carré de couleur)
async function loadPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  const got = await getBytes(url, 8000);
  if (!got || !/^image\/(jpeg|png)$/.test(got.type) || got.buf.byteLength > 2_000_000) return null;
  return dataUri(got.buf, got.type);
}

async function loadAvatar(): Promise<string | null> {
  for (const url of AVATAR_URLS) {
    const photo = await loadPhoto(url);
    if (photo) return photo;
  }
  return null;
}

// --- dessin -------------------------------------------------------------------------------------------------------------------------------

async function renderPages(pages: PosterPage[]): Promise<Uint8Array[]> {
  const { ImageResponse } = await import("https://deno.land/x/og_edge@0.0.6/mod.ts");
  const fonts = await loadFonts();
  const out: Uint8Array[] = [];
  for (const p of pages) {
    const res = new ImageResponse(p.tree as never, { width: p.width, height: p.height, fonts });
    out.push(new Uint8Array(await res.arrayBuffer()));
  }
  return out;
}

// --- Telegram -------------------------------------------------------------------------------------------------------------------------------

const caption = (d: ReportData) => `📊 Rapport de Zara — semaine du ${shortDate(d.d0)} au ${shortDate(d.d1)}`;

async function telegram(token: string, method: string, body: BodyInit, headers?: HeadersInit): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body, headers });
  if (!res.ok) console.error("telegram", method, res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

async function sendPhotos(token: string, chatId: number, pngs: Uint8Array[], text: string): Promise<boolean> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (pngs.length === 1) {
    form.append("caption", text);
    form.append("photo", new Blob([pngs[0]], { type: "image/png" }), "rapport-zara.png");
    return telegram(token, "sendPhoto", form);
  }
  form.append("media", JSON.stringify(pngs.map((_, i) => ({ type: "photo", media: `attach://page${i + 1}`, ...(i === 0 ? { caption: text } : {}) }))));
  pngs.forEach((png, i) => form.append(`page${i + 1}`, new Blob([png], { type: "image/png" }), `rapport-zara-${i + 1}.png`));
  return telegram(token, "sendMediaGroup", form);
}

// le rapport en texte (comme avant) : si le dessin échoue, l'équipe reçoit quand même le rapport
function reportText(d: ReportData): string {
  const top = d.products.length > 0 ? d.products.map((p, i) => `${i + 1}. ${cleanText(p.name) || "Article"} — ${p.views} vues`).join("\n") : "Aucune visite";
  const words = d.searches.length > 0 ? d.searches.slice(0, 3).map((s) => `« ${cleanText(s.q)} » (${s.n})`).join(", ") : "Aucune recherche";
  const days = d.days.length > 0 ? d.days.map((x) => `${dayLabel(x.day)} : ${x.names.map((n) => cleanText(n)).filter(Boolean).join(", ")}`).join("\n") : "—";
  return `${caption(d)}\n\n🏆 Articles les plus regardés de la semaine :\n${top}\n\n🔎 Mots les plus cherchés de la semaine :\n${words}\n\n📅 Top 3 par jour :\n${days}`;
}

// --- service -------------------------------------------------------------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ error: "méthode refusée" }, 405);

    // seule la base (planificateur) peut déclencher l'envoi : secret partagé relu dans le coffre-fort
    const given = req.headers.get("x-cron-secret") ?? "";
    const { data: secret } = await service.rpc("email_cron_secret");
    if (!given || typeof secret !== "string" || !safeEqual(given, secret)) return json({ error: "non autorisé" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.action !== "weekly") return json({ error: "action inconnue" }, 400);
    const dry = body?.dry === true;

    const { data: report, error: reportError } = await service.rpc("zara_weekly_report_data");
    if (reportError || !report) return json({ error: `données du rapport : ${reportError?.message ?? "vides"}` }, 500);
    const data = report as ReportData;

    // dessin ; en cas d'échec on garde la raison et on enverra le texte
    let pngs: Uint8Array[] = [];
    let drawError: string | null = null;
    try {
      const [avatar, ...images] = await Promise.all([loadAvatar(), ...data.products.slice(0, 3).map((p) => loadPhoto(p.image))]);
      pngs = await renderPages(posterPages(data, { avatar, images }));
    } catch (e) {
      drawError = e instanceof Error ? e.message : String(e);
      console.error("dessin", drawError);
    }

    if (dry) return json({ ok: drawError === null, dry: true, pages: pngs.map((p) => p.byteLength), error: drawError });

    const { data: creds, error: credsError } = await service.rpc("zara_report_credentials");
    const token = creds?.token as string | undefined;
    const chats = ((creds?.chat_ids ?? []) as number[]).filter((c) => Number.isFinite(c));
    if (credsError || !token || chats.length === 0) return json({ error: `Telegram : ${credsError?.message ?? "bot ou administrateur non lié"}` }, 500);

    let sent = 0;
    for (const chat of chats) {
      let ok = false;
      if (pngs.length > 0) ok = await sendPhotos(token, chat, pngs, caption(data)).catch(() => false);
      if (!ok) ok = await telegram(token, "sendMessage", JSON.stringify({ chat_id: chat, text: reportText(data) }), { "Content-Type": "application/json" }).catch(() => false);
      if (ok) sent++;
    }
    return json({ ok: sent > 0, sent, admins: chats.length, pages: pngs.map((p) => p.byteLength), fallbackText: pngs.length === 0, error: drawError });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
