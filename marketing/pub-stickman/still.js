// Images fixes de contrôle : les 3 personnages côte à côte (lineup), ou une image à un temps donné.
// Usage : node still.js lineup <sortie.png> | node still.js at <secondes> <sortie.png> [échelle]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [mode, a, b, c] = process.argv.slice(2);
  const scale = Number((mode === 'lineup' ? b : c) || 0.5);
  const out = mode === 'lineup' ? a : b;
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
  page.on('pageerror', (e) => console.error('ERREUR PAGE', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'load' });
  if (scale !== 1) await page.evaluate((s) => { document.documentElement.style.transformOrigin = '0 0'; document.documentElement.style.transform = `scale(${s})`; }, scale);
  await page.evaluate(() => window.ready);
  await page.evaluate(() => document.fonts.ready);
  if (mode === 'lineup') { await page.evaluate(() => window.lineup()); await page.screenshot({ path: out }); }
  else if (mode === 'times') {
    // node still.js times 4.5,12,16 <dossier> [échelle] : une image par temps
    for (const tt of a.split(',').map(Number)) {
      await page.evaluate((ms) => window.seek(ms), tt * 1000);
      await page.screenshot({ path: path.join(out, `t${tt.toFixed(1).replace('.', '_')}.png`) });
    }
  } else { await page.evaluate((ms) => window.seek(ms), Number(a) * 1000); await page.screenshot({ path: out }); }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
