// Page de secours lisible sans JavaScript (public/index.html, bloc <!--albasse-static-start--> … <!--albasse-static-end-->) :
// pendant la fabrication du site, la marque <!--albasse-static-categories--> devient la liste des catégories principales (liens).
// Fonctions pures, sans réseau (tests/seo/static-home.test.js) ; appelées par scripts/generate-sitemap.js.
const MARK = '<!--albasse-static-categories-->';
const MAX_LINKS = 12;

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// les catégories principales (sans parent), dans l'ordre de l'admin, avec un nom et une adresse propres ; 12 au plus
function mainCategories(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((c) => c && !c.parent_id && typeof c.slug === 'string' && SLUG_RE.test(c.slug) && String(c.name || '').trim())
    .sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9) || String(a.name).localeCompare(String(b.name), 'fr'))
    .slice(0, MAX_LINKS);
}

function fillStaticCategories(html, categories) {
  if (!html.includes(MARK)) return html;
  const cats = mainCategories(categories);
  const block = cats.length
    ? `<h2 style="font-size:18px;color:#e7c87a;margin:16px 0 8px">Nos catégories</h2><ul style="margin:0;padding-left:20px">${cats
        .map((c) => `<li><a href="/categorie/${c.slug}" style="color:#f4efe4">${esc(String(c.name).trim())}</a></li>`)
        .join('')}</ul>`
    : '';
  return html.replace(MARK, block);
}

// le site « page unique » : tout le bloc d'Albasse Shopping disparaît
function removeStaticBlock(html) {
  return html.replace(/<!--albasse-static-start-->[\s\S]*?<!--albasse-static-end-->/, '');
}

module.exports = { MARK, MAX_LINKS, mainCategories, fillStaticCategories, removeStaticBlock };
