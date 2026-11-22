// Photos signées des affiliés (src/lib/signedPhoto.ts) : taille, place de la signature, nom du fichier. Fonctions pures, aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/shop/signed-photo.test.ts
import { outputSize, signatureLayout, photoFileName, SIGNATURE_TEXT, CHAD_FLAG } from '../../src/lib/signedPhoto.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) { ok++; console.log('OK   ', label); } else { console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail)); process.exitCode = 1; }
};
// mesure approchée du texte : 0,58 × taille par caractère (Manrope gras)
const measure = (size: number) => SIGNATURE_TEXT.length * size * 0.58;
const inside = (L: ReturnType<typeof signatureLayout>, w: number, h: number) => L.pill.x >= 0 && L.pill.y >= 0 && L.pill.x + L.pill.w <= w && L.pill.y + L.pill.h <= h;

check('la signature : « albasseshopping.com » et le drapeau du Tchad (bleu, jaune, rouge)', SIGNATURE_TEXT === 'albasseshopping.com' && CHAD_FLAG.join() === '#002664,#FECB00,#C60C30');
check('photo de 1080 × 1350 : gardée telle quelle', JSON.stringify(outputSize(1080, 1350)) === JSON.stringify({ width: 1080, height: 1350 }));
check('photo de 4000 × 3000 : réduite à 2048 × 1536 (même proportion)', JSON.stringify(outputSize(4000, 3000)) === JSON.stringify({ width: 2048, height: 1536 }));
check('photo vide : 0 × 0', JSON.stringify(outputSize(0, 100)) === JSON.stringify({ width: 0, height: 0 }) && outputSize(NaN, 5).width === 0);

const L = signatureLayout(1080, 1350, measure);
check('photo de 1080 × 1350 : signature en bas à droite, à 3 % du bord', Math.abs(1080 - (L.pill.x + L.pill.w) - 32) <= 1 && Math.abs(1350 - (L.pill.y + L.pill.h) - 32) <= 1, L.pill);
check('taille du texte : 3,8 % de la largeur (41 px), lisible sans cacher l\'article', L.fontSize === 41 && L.pill.w < 1080 * 0.6, L);
check('le drapeau à gauche du texte, centré dans la pastille', L.flag.x > L.pill.x && L.flag.x + L.flag.w < L.text.x && Math.abs((L.flag.y + L.flag.h / 2) - (L.pill.y + L.pill.h / 2)) <= 1);
check('le drapeau a la forme d\'un drapeau (3 : 2)', Math.abs(L.flag.w / L.flag.h - 1.5) < 0.05, L.flag);
check('le texte tient dans la pastille', L.text.x + measure(L.fontSize) <= L.pill.x + L.pill.w);
check('toujours entière dans la photo (carrée, paysage, portrait, très étroite, petite)', [[1080, 1080], [1920, 1080], [720, 1600], [300, 1200], [200, 200], [2048, 400], [4000, 300]].every(([w, h]) => inside(signatureLayout(w, h, measure), w, h)));
check('photo petite (300 px) : taille minimale 14 px ; très étroite (180 px) : texte réduit pour tenir en entier', signatureLayout(300, 1200, measure).fontSize === 14 && signatureLayout(180, 800, measure).fontSize < 14 && inside(signatureLayout(180, 800, measure), 180, 800));
check('photo très large et basse (2048 × 400) : texte selon la hauteur, pas énorme', signatureLayout(2048, 400, measure).fontSize === 20);

check('nom du fichier : albasse-ensemble-safari-1.jpg / -2.jpg', photoFileName('Ensemble safari ', 0, 2) === 'albasse-ensemble-safari-1.jpg' && photoFileName('Ensemble safari ', 1, 2) === 'albasse-ensemble-safari-2.jpg');
check('une seule photo : sans numéro', photoFileName('Miroir LED lumineux', 0, 1) === 'albasse-miroir-led-lumineux.jpg');
check('accents, émojis et signes retirés', photoFileName('Polo + chaussures 🇹🇩 Élégance', 0, 1) === 'albasse-polo-chaussures-elegance.jpg', photoFileName('Polo + chaussures 🇹🇩 Élégance', 0, 1));
check('nom vide ou que des signes : albasse-article.jpg', photoFileName('', 0, 1) === 'albasse-article.jpg' && photoFileName('✨✨', 0, 1) === 'albasse-article.jpg');
check('nom très long : coupé (40 caractères au plus)', photoFileName('a'.repeat(80), 0, 1) === `albasse-${'a'.repeat(40)}.jpg`);

console.log(process.exitCode ? '\nIL Y A DES ECHECS' : `\nTOUS LES CONTROLES REUSSIS (${ok})`);
