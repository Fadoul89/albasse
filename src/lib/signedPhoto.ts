// Photos des articles pour les affiliés (« Mes produits » › 📥 Photos), avec la signature du patron en bas à droite :
// le drapeau du Tchad (dessiné, pas un émoji : identique sur tous les téléphones) + « albasseshopping.com ».
// La mise en page et le nom du fichier sont des fonctions pures (tests/shop/signed-photo.test.ts) ; le dessin se fait
// dans le navigateur (canvas). Les photos du site autorisent cette lecture (Supabase Storage : access-control-allow-origin *).

export const SIGNATURE_TEXT = 'albasseshopping.com';
export const CHAD_FLAG = ['#002664', '#FECB00', '#C60C30'] as const; // bleu, jaune, rouge (bandes verticales)
export const MAX_SIDE = 2048; // une photo plus grande est réduite (fichier plus léger à partager sur WhatsApp / TikTok)

export interface SignatureLayout {
  fontSize: number;
  pill: { x: number; y: number; w: number; h: number; r: number };
  flag: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number };
  border: number;
}

// la taille de la photo enregistrée (même proportion, 2048 px au plus)
export function outputSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

// la place de la signature : en bas à droite, taille selon la largeur (et la hauteur pour une photo très large),
// toujours entière dans la photo. `textWidth(fontSize)` mesure le texte (canvas measureText).
export function signatureLayout(width: number, height: number, textWidth: (fontSize: number) => number): SignatureLayout {
  let fontSize = Math.max(14, Math.round(Math.min(width * 0.038, height * 0.05)));
  for (;;) {
    const pad = Math.round(fontSize * 0.55);
    const flagW = Math.round(fontSize * 1.35);
    const flagH = Math.round(fontSize * 0.9);
    const gap = Math.round(pad * 0.8);
    const w = Math.round(pad + flagW + gap + textWidth(fontSize) + pad);
    const h = Math.round(fontSize + pad * 1.4);
    const margin = Math.round(Math.min(width, height) * 0.03);
    if (w + 2 * margin <= width || fontSize <= 8) {
      const x = Math.max(0, width - w - margin);
      const y = Math.max(0, height - h - margin);
      return {
        fontSize,
        pill: { x, y, w, h, r: h / 2 },
        flag: { x: x + pad, y: y + Math.round((h - flagH) / 2), w: flagW, h: flagH },
        text: { x: x + pad + flagW + gap, y: y + h / 2 },
        border: Math.max(1, Math.round(fontSize * 0.07)),
      };
    }
    fontSize -= 1; // photo étroite : on réduit jusqu'à ce que la signature tienne
  }
}

// « albasse-ensemble-safari-1.jpg » (sans accents ni signes)
export function photoFileName(productName: string, index: number, count: number): string {
  const slug =
    productName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'article';
  return `albasse-${slug}${count > 1 ? `-${index + 1}` : ''}.jpg`;
}

// ── dans le navigateur ─────────────────────────────────────────────────────────────────────────────────────────────

const FONT_FAMILY = 'Manrope_700Bold, Arial, sans-serif'; // la police du site (chargée par expo-font)

async function loadImage(url: string): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  // lecture par fetch : l'image devient locale (blob:), le canvas peut donc l'exporter
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const objectUrl = URL.createObjectURL(await res.blob());
  const img = new Image();
  img.src = objectUrl;
  await img.decode();
  return { img, revoke: () => URL.revokeObjectURL(objectUrl) };
}

// la photo signée, en JPEG
export async function signPhoto(url: string): Promise<Blob> {
  const { img, revoke } = await loadImage(url);
  try {
    const { width, height } = outputSize(img.naturalWidth, img.naturalHeight);
    if (!width || !height) throw new Error('photo vide');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponible');
    ctx.fillStyle = '#ffffff'; // fond blanc pour une photo transparente (PNG)
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    try {
      await document.fonts?.load(`20px ${FONT_FAMILY}`);
    } catch {
      // police absente : Arial
    }
    const font = (size: number) => `${size}px ${FONT_FAMILY}`;
    const L = signatureLayout(width, height, (size) => {
      ctx.font = font(size);
      return ctx.measureText(SIGNATURE_TEXT).width;
    });

    const { x, y, w, h, r } = L.pill;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(7, 36, 105, 0.78)'; // bleu du site
    ctx.fill();
    ctx.lineWidth = L.border;
    ctx.strokeStyle = 'rgba(231, 200, 122, 0.9)'; // or du site
    ctx.stroke();

    CHAD_FLAG.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(L.flag.x + (i * L.flag.w) / 3, L.flag.y, L.flag.w / 3 + 0.5, L.flag.h);
    });

    ctx.font = font(L.fontSize);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIGNATURE_TEXT, L.text.x, L.text.y + L.fontSize * 0.04);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export impossible'))), 'image/jpeg', 0.92),
    );
  } finally {
    revoke();
  }
}

export function saveBlob(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

// toutes les photos d'un article, signées, une par une ; rend le nombre de photos enregistrées
export async function downloadSignedPhotos(productName: string, urls: string[]): Promise<number> {
  let saved = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      saveBlob(await signPhoto(urls[i]), photoFileName(productName, i, urls.length));
      saved++;
    } catch {
      // une photo illisible n'empêche pas les autres
    }
    if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 400)); // le navigateur accepte mieux des téléchargements espacés
  }
  return saved;
}
