#!/usr/bin/env node
// Transfère les images déjà sur Supabase Storage vers Cloudinary, et met à jour leurs URL dans la base
// (products.images, categories.image_url, smart_promotions.image_url, store_settings.left_ad_items /
// right_ad_items / menu_ad_items). Ne supprime RIEN de Supabase Storage : les anciens fichiers restent en place,
// seules les URL enregistrées dans les tables changent. Relançable sans risque (une image déjà sur Cloudinary
// n'est jamais retraitée).
//
// Utilisation :
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   CLOUDINARY_CLOUD_NAME=c3sblcwg \
//   CLOUDINARY_UPLOAD_PRESET=albasse_shopping \
//   node scripts/migrate-images-to-cloudinary.mjs [--dry-run] [--limit=50]
//
// La clé de service (Settings › API › service_role, Supabase) ne doit JAMAIS être commise ni partagée : elle
// passe uniquement en variable d'environnement, pour cette seule exécution.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET ?? process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Variables manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (clé de service, Settings › API).');
  process.exit(1);
}
if (!CLOUD_NAME || !UPLOAD_PRESET) {
  console.error('Variables manquantes : CLOUDINARY_CLOUD_NAME et CLOUDINARY_UPLOAD_PRESET.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const isSupabaseStorageUrl = (u) => typeof u === 'string' && /\/storage\/v1\/object\/public\//.test(u);

// Une URL -> sa nouvelle URL Cloudinary, mise en cache : un même fichier référencé plusieurs fois (rare) n'est
// téléversé qu'une fois.
const cache = new Map();

async function migrateOneUrl(oldUrl) {
  if (cache.has(oldUrl)) return cache.get(oldUrl);
  if (DRY_RUN) {
    cache.set(oldUrl, oldUrl);
    return oldUrl;
  }
  const res = await fetch(oldUrl);
  if (!res.ok) throw new Error(`téléchargement échoué (${res.status}) : ${oldUrl}`);
  const blob = await res.blob();

  const form = new FormData();
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('file', blob, `photo.${blob.type.split('/')[1] ?? 'jpg'}`);
  const up = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  const data = await up.json();
  if (!up.ok) throw new Error(`Cloudinary a refusé ${oldUrl} : ${data?.error?.message ?? up.status}`);

  cache.set(oldUrl, data.secure_url);
  return data.secure_url;
}

async function migrateUrlList(urls) {
  const out = [];
  let changed = false;
  for (const u of urls) {
    if (!isSupabaseStorageUrl(u)) {
      out.push(u);
      continue;
    }
    out.push(await migrateOneUrl(u));
    changed = true;
  }
  return { out, changed };
}

async function migrateAdItems(items) {
  if (!Array.isArray(items)) return { out: items, changed: false };
  let changed = false;
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object' || !isSupabaseStorageUrl(it.image_url)) {
      out.push(it);
      continue;
    }
    out.push({ ...it, image_url: await migrateOneUrl(it.image_url) });
    changed = true;
  }
  return { out, changed };
}

let migrated = 0;
let failed = 0;

async function run() {
  console.log(DRY_RUN ? '--- Simulation (aucun envoi, aucune écriture) ---' : '--- Migration réelle ---');

  // 1. Articles (products.images : tableau de texte)
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, images')
    .not('images', 'is', null);
  if (pErr) throw pErr;
  const productsToDo = (products ?? []).filter((p) => (p.images ?? []).some(isSupabaseStorageUrl)).slice(0, LIMIT);
  console.log(`Articles à migrer : ${productsToDo.length}`);
  for (const p of productsToDo) {
    try {
      const { out, changed } = await migrateUrlList(p.images);
      if (changed && !DRY_RUN) {
        const { error } = await supabase.from('products').update({ images: out }).eq('id', p.id);
        if (error) throw error;
      }
      migrated++;
      console.log(`  ✓ article ${p.id}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ article ${p.id} :`, e.message);
    }
  }

  // 2. Catégories (categories.image_url)
  const { data: categories, error: cErr } = await supabase.from('categories').select('id, image_url').not('image_url', 'is', null);
  if (cErr) throw cErr;
  const categoriesToDo = (categories ?? []).filter((c) => isSupabaseStorageUrl(c.image_url)).slice(0, LIMIT);
  console.log(`Catégories à migrer : ${categoriesToDo.length}`);
  for (const c of categoriesToDo) {
    try {
      const url = await migrateOneUrl(c.image_url);
      if (!DRY_RUN) {
        const { error } = await supabase.from('categories').update({ image_url: url }).eq('id', c.id);
        if (error) throw error;
      }
      migrated++;
      console.log(`  ✓ catégorie ${c.id}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ catégorie ${c.id} :`, e.message);
    }
  }

  // 3. Promotions intelligentes (smart_promotions.image_url)
  const { data: promos, error: promoErr } = await supabase.from('smart_promotions').select('id, image_url').not('image_url', 'is', null);
  if (promoErr) throw promoErr;
  const promosToDo = (promos ?? []).filter((p) => isSupabaseStorageUrl(p.image_url)).slice(0, LIMIT);
  console.log(`Promotions à migrer : ${promosToDo.length}`);
  for (const p of promosToDo) {
    try {
      const url = await migrateOneUrl(p.image_url);
      if (!DRY_RUN) {
        const { error } = await supabase.from('smart_promotions').update({ image_url: url }).eq('id', p.id);
        if (error) throw error;
      }
      migrated++;
      console.log(`  ✓ promotion ${p.id}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ promotion ${p.id} :`, e.message);
    }
  }

  // 4. Publicités (store_settings : left_ad_items, right_ad_items, menu_ad_items)
  const { data: settingsRows, error: sErr } = await supabase
    .from('store_settings')
    .select('id, left_ad_items, right_ad_items, menu_ad_items');
  if (sErr) throw sErr;
  for (const row of settingsRows ?? []) {
    const patch = {};
    for (const col of ['left_ad_items', 'right_ad_items', 'menu_ad_items']) {
      if (!(col in row)) continue; // colonne pas encore créée (ex. menu_ad_items avant add-menu-ad.sql)
      const { out, changed } = await migrateAdItems(row[col]);
      if (changed) patch[col] = out;
    }
    if (Object.keys(patch).length > 0) {
      console.log(`Publicités à migrer (store_settings #${row.id}) : ${Object.keys(patch).join(', ')}`);
      if (!DRY_RUN) {
        const { error } = await supabase.from('store_settings').update(patch).eq('id', row.id);
        if (error) throw error;
      }
      migrated++;
    }
  }

  console.log(`\n${DRY_RUN ? 'Simulation terminée' : 'Migration terminée'} : ${migrated} ligne(s) mises à jour, ${failed} échec(s).`);
  console.log('Les anciens fichiers restent sur Supabase Storage (rien supprimé) : vérifiez le site avant de les retirer.');
  if (failed > 0) process.exitCode = 1;
}

run().catch((e) => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
