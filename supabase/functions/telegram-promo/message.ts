// Telegram aux clients absents depuis 7 jours et rapport quotidien à l'administrateur : des fonctions pures, sans réseau ni base,
// testées dans tests/email/telegram-promo.test.ts. Les articles, les prix et la vente flash viennent de la base ; rien n'est inventé.
export const SITE = "https://www.albasseshopping.com";

export interface PromoProduct {
  id: string;
  name: string;
  slug?: string | null;
  price: number;
  compare_at_price?: number | null;
  images?: string[] | null;
  is_flash_sale?: boolean | null;
  flash_sale_ends_at?: string | null;
  created_at?: string | null;
}

export const MAX_PROMO_PRODUCTS = 4;
// Telegram refuse une légende de plus de 1024 signes : au-delà, le message part sans photo (limite des messages : 4096)
export const CAPTION_LIMIT = 1024;

const isFlashNow = (p: PromoProduct, now: number) => p.is_flash_sale === true && !!p.flash_sale_ends_at && Date.parse(p.flash_sale_ends_at) > now;
const isReduced = (p: PromoProduct) => Number(p.compare_at_price) > Number(p.price) && Number(p.price) > 0;

// Les ventes flash en cours d'abord (la fin la plus proche en premier), puis les articles les plus récents (même choix que les e-mails publicitaires).
export function pickProducts(rows: PromoProduct[], now: number, max = MAX_PROMO_PRODUCTS): { products: PromoProduct[]; flashEndsAt: string | null } {
  const usable = rows.filter((p) => p && p.name && Number(p.price) > 0);
  const flash = usable.filter((p) => isFlashNow(p, now)).sort((a, b) => Date.parse(a.flash_sale_ends_at!) - Date.parse(b.flash_sale_ends_at!));
  const rest = usable.filter((p) => !isFlashNow(p, now)).sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "") || 0);
  const products = [...flash, ...rest].slice(0, max);
  return { products, flashEndsAt: flash.length ? flash[0].flash_sale_ends_at ?? null : null };
}

export const firstName = (full: unknown) => String(full ?? "").trim().split(/\s+/)[0] || "";
const fmt = (n: number) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
const cleanName = (s: string) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t;
};
// « 28 octobre » (jour de N'Djamena)
const dayLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Ndjamena" }).format(new Date(iso));

const productUrl = (p: PromoProduct) => (p.slug ? `${SITE}/produit/${encodeURIComponent(p.slug)}` : SITE);
const photoOf = (p: PromoProduct | undefined) => (p?.images ?? []).find((i) => typeof i === "string" && /^https:\/\//i.test(i)) ?? null;

function productLine(p: PromoProduct, i: number): string {
  const reduced = isReduced(p);
  const off = reduced ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0;
  const price = reduced ? `${fmt(Number(p.price))} (au lieu de ${fmt(Number(p.compare_at_price))}, −${off} %)` : fmt(Number(p.price));
  return `${i + 1}. ${cleanName(p.name)} — ${price}\n${productUrl(p)}`;
}

export const STOP_NOTE = "Pour ne plus recevoir ces messages, écrivez STOP.";

// Le message « vous nous manquez » : texte simple (pas de mise en forme, donc rien à protéger dans les noms d'articles) + la photo du 1er article si elle tient.
export function absentMessage(input: { fullName: unknown; products: PromoProduct[]; flashEndsAt: string | null }): { text: string; photo: string | null } {
  const name = firstName(input.fullName);
  const flash = !!input.flashEndsAt;
  const intro = flash
    ? `🔥 Une vente flash est en cours sur Albasse Shopping, jusqu'au ${dayLabel(input.flashEndsAt!)}. Voici une sélection :`
    : "Voici une sélection d'articles du moment sur Albasse Shopping :";
  const text =
    `Bonjour${name ? ` ${name}` : ""}, vous nous manquez ! 🛍️\n\n${intro}\n\n` +
    input.products.map(productLine).join("\n\n") +
    `\n\n🚚 Livraison partout au Tchad 🇹🇩\n👉 ${SITE}\n\n${STOP_NOTE}`;
  const photo = photoOf(input.products[0]);
  return { text, photo: photo && text.length <= CAPTION_LIMIT ? photo : null };
}

// Ce que Telegram répond quand l'envoi échoue : « blocked » = le client a bloqué le bot, supprimé son compte Telegram ou n'est plus joignable
// (on ne lui écrira plus jamais) ; « failed » = autre erreur (réseau, limite de vitesse…) : on pourra réessayer un autre jour.
export function classifyTelegramError(status: number, description: string): "blocked" | "failed" {
  const d = String(description ?? "").toLowerCase();
  if (status === 403) return "blocked";
  if (/bot was blocked|user is deactivated|chat not found|bot was kicked|can't initiate conversation/.test(d)) return "blocked";
  return "failed";
}

// ---- le rapport quotidien ----------------------------------------------------------------------------------------------------------------

export interface ChannelStats {
  today: number;
  week: number;
  returned: number;
  orders: number;
  failed?: number;
  blocked?: number;
}
export interface PromoReport {
  day: string;
  emails_enabled: boolean;
  telegram_enabled: boolean;
  emails: ChannelStats;
  telegram: ChannelStats;
  linked: { linked: number; consented: number; stopped: number };
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const shortDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
};
const onOff = (b: boolean) => (b ? "🟢 allumé" : "⚪ éteint");

function channelBlock(title: string, c: ChannelStats): string {
  const lines = [`${title} : ${plural(c.today, "envoyé", "envoyés")} aujourd'hui, ${plural(c.week, "envoyé", "envoyés")} sur 7 jours`];
  if (c.week > 0) lines.push(`→ ${plural(c.returned, "client revenu", "clients revenus")} sur le site, ${plural(c.orders, "client a commandé", "clients ont commandé")}`);
  const bad = (c.failed ?? 0) + (c.blocked ?? 0);
  if (bad > 0) lines.push(`⚠️ ${plural(c.failed ?? 0, "échec", "échecs")}, ${plural(c.blocked ?? 0, "bot bloqué", "bots bloqués")} (7 jours)`);
  return lines.join("\n");
}

// Le texte envoyé sur le Telegram des administrateurs, ou null quand il n'y a rien à dire (aucun envoi sur 7 jours, aucun client lié).
export function reportText(r: PromoReport): string | null {
  const quiet = r.emails.week === 0 && r.telegram.week === 0 && (r.telegram.failed ?? 0) + (r.telegram.blocked ?? 0) === 0 && r.linked.linked === 0;
  if (quiet) return null;
  return [
    `📣 Clients absents — rapport du ${shortDay(r.day)}`,
    channelBlock("📧 E-mails publicitaires", r.emails),
    channelBlock("✈️ Telegram", r.telegram),
    `✈️ Clients liés à Telegram : ${r.linked.linked} (${plural(r.linked.consented, "accepte", "acceptent")} les offres, ${plural(r.linked.stopped, "a écrit STOP", "ont écrit STOP")})`,
    `Interrupteurs : e-mails ${onOff(r.emails_enabled)} · Telegram ${onOff(r.telegram_enabled)}`,
    "« Revenu » = client contacté qui a ouvert une visite reconnue sur le site après le message. Un client qui revient sans se connecter n'est pas compté.",
  ].join("\n\n");
}
