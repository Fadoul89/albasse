// Notification d'un article vers les navigateurs abonnés (Web Push), envoyée par la base quand l'admin crée une notification produit
// (déclencheur push_notify_product_notification, fix-push-trigger-vault.sql).
// Accès : seulement avec le secret partagé (en-tête « x-webhook-secret »), relu dans le coffre-fort Supabase (push_webhook_secret).
// La clé privée VAPID est aussi dans le coffre-fort (vapid_private_key). La clé PUBLIQUE ci-dessous est faite pour être publique
// (le site l'utilise pour abonner les navigateurs). AUCUN secret n'est écrit dans ce fichier.
// « dry_run: true » : vérifie l'accès et les clés, compte les abonnés, sans rien envoyer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = "BBpjkKFREyGMSEb3sFj--PHJa4NiR9n-9PxTxUHtJ8QVtcuCcJibGsP0ic9uVFn7HxPuqR8gsXzzeT2FL_qQEPs";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let vapidReady = false;
async function setupVapid(): Promise<boolean> {
  if (vapidReady) return true;
  const { data: privateKey } = await supabase.rpc("vapid_private_key");
  if (typeof privateKey !== "string" || !privateKey) return false;
  webpush.setVapidDetails("mailto:contact@albasseshopping.com", VAPID_PUBLIC_KEY, privateKey);
  vapidReady = true;
  return true;
}

Deno.serve(async (req: Request) => {
  try {
    const given = req.headers.get("x-webhook-secret") ?? "";
    const { data: secret } = await supabase.rpc("push_webhook_secret");
    if (!given || typeof secret !== "string" || !secret || !safeEqual(given, secret)) return new Response("Unauthorized", { status: 401 });

    if (!(await setupVapid())) return json({ error: "clé VAPID absente du coffre-fort" }, 500);

    const { title, message, product_id, dry_run } = await req.json();

    // Page ouverte quand le client touche la notification : la fiche du produit concerné. Sans produit connu, l'accueil.
    // La photo du produit est affichée sous le texte (Android).
    let url: string | undefined;
    let image: string | undefined;
    if (typeof product_id === "string" && product_id) {
      const { data: product } = await supabase.from("products").select("slug,images").eq("id", product_id).maybeSingle();
      if (product?.slug) url = `/produit/${encodeURIComponent(product.slug)}`;
      const photo = product?.images?.[0];
      if (typeof photo === "string" && photo.startsWith("https://")) image = photo;
    }

    const { data: subs, error } = await supabase.from("web_push_subscriptions").select("id,endpoint,p256dh,auth");
    if (error) return json({ error: error.message }, 500);
    if (dry_run === true) return json({ ok: true, dry_run: true, total: subs?.length ?? 0, url: url ?? null });

    const payload = JSON.stringify({ title, message, url, image });
    const results = await Promise.allSettled(
      (subs ?? []).map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload).catch(async (err) => {
          // Abonnement expiré ou invalide : on le retire silencieusement.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("web_push_subscriptions").delete().eq("id", s.id);
          }
          throw err;
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return json({ sent, total: subs?.length ?? 0, url: url ?? null, image: image ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
