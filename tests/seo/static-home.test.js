// Page de secours lisible sans JavaScript (scripts/static-home.js) : liens des catégories ajoutés à la fabrication, bloc retiré du site « page unique ».
// Aucun réseau. Lancer : node tests/seo/static-home.test.js
const fs = require('fs');
const path = require('path');
const { MARK, fillStaticCategories, mainCategories, removeStaticBlock } = require('../../scripts/static-home.js');

let ok = 0;
const check = (label, cond, detail) => {
  if (cond) { ok++; console.log('OK   ', label); } else { console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail)); process.exitCode = 1; }
};
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
const cats = [
  { slug: 'chaussures', name: 'Chaussures', parent_id: null, sort_order: 2 },
  { slug: 'montre-accessoires', name: 'MONTRE & ACCESSOIRES', parent_id: null, sort_order: 1 },
  { slug: 'sandal', name: 'Sandal', parent_id: 'x', sort_order: 0 }, // sous-catégorie : pas dans la liste
  { slug: 'Mauvaise Adresse', name: 'Cassée', parent_id: null }, // adresse invalide : ignorée
  { slug: 'sans-nom', name: '  ', parent_id: null }, // sans nom : ignorée
  { slug: 'parfum', name: 'Parfum <b>', parent_id: null }, // sans ordre : à la fin
];
check('catégories principales seulement, dans l\'ordre de l\'admin, sans adresse cassée ni nom vide', mainCategories(cats).map((c) => c.slug).join() === 'montre-accessoires,chaussures,parfum');
check('12 catégories au plus', mainCategories(Array.from({ length: 30 }, (_, i) => ({ slug: `c${i}`, name: `C${i}`, sort_order: i }))).length === 12);
const filled = fillStaticCategories(html, cats);
check('la marque devient « Nos catégories » avec leurs liens (nom protégé : pas de balise)', !filled.includes(MARK) && /Nos catégories/.test(filled) && filled.includes('href="/categorie/montre-accessoires"') && filled.includes('MONTRE &amp; ACCESSOIRES') && filled.includes('Parfum &lt;b&gt;') && !filled.includes('/categorie/sandal'));
check('le reste de la page ne change pas', filled.replace(/<h2[\s\S]*?<\/ul>/, MARK) === html);
const none = fillStaticCategories(html, null);
check('base indisponible : la marque disparaît, rien d\'autre (pas de titre « Nos catégories » vide)', !none.includes(MARK) && !/Nos catégories/.test(none) && none.includes('<h1'));
check('relancé sur une page déjà remplie : rien ne change', fillStaticCategories(filled, cats) === filled);
const neutral = removeStaticBlock(filled);
check('site « page unique » : tout le bloc d\'Albasse Shopping est retiré, le reste de la page reste', !/albasse-static|Albasse Shopping : boutique|Nos catégories/.test(neutral) && /<div id="root"><\/div>/.test(neutral) && neutral.includes('</body>'));
console.log(`\n${ok} contrôles réussis`);
