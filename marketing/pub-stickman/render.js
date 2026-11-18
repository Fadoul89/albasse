// Rend la vidéo image par image : ouvre index.html dans Chromium, place le temps avec window.seek(ms), photographie chaque image.
// Usage : NODE_PATH=/opt/node-tools/node_modules node render.js <dossier des images> [fps] [échelle] [début s] [fin s]
//   échelle 1 = 1080×1920 (final) ; 0.5 = aperçu rapide 540×960.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [outDir, fpsArg, scaleArg, fromArg, toArg] = process.argv.slice(2);
  const fps = Number(fpsArg || 30);
  const scale = Number(scaleArg || 1);
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('ERREUR PAGE', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'load' });
  if (scale !== 1) await page.evaluate((s) => { document.documentElement.style.transformOrigin = '0 0'; document.documentElement.style.transform = `scale(${s})`; }, scale);
  await page.evaluate(() => window.ready);
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.TL.duration);
  const from = Number(fromArg || 0), to = Math.min(duration, Number(toArg || duration));
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
  const t0 = Date.now();
  for (let i = n0; i < n1; i++) {
    await page.evaluate((ms) => window.seek(ms), (i / fps) * 1000);
    await page.screenshot({ path: path.join(outDir, `f${String(i - n0).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if ((i - n0) % 150 === 0) console.log(`image ${i - n0}/${n1 - n0}  (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  console.log(`fini : ${n1 - n0} images en ${Math.round((Date.now() - t0) / 1000)} s, durée ${(to - from).toFixed(2)} s`);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
