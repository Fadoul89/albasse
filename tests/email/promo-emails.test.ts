// E-mail publicitaire aux clients absents (supabase/functions/brevo-email/promoEmails.ts) : fonctions pures, aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/promo-emails.test.ts
import { pickProducts, inactiveClientEmail, type PromoProduct } from '../../supabase/functions/brevo-email/promoEmails.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const p = (id: string, extra: Partial<PromoProduct> = {}): PromoProduct => ({ id, name: `Article ${id}`, slug: `article-${id}`, price: 10000, compare_at_price: null, images: ['https://img.example/a.jpg'], is_flash_sale: false, flash_sale_ends_at: null, created_at: iso(NOW - Number(id) * 86_400_000), ...extra });

// choix des articles
{
  const rows = [
    p('1'),
    p('2'),
    p('3', { is_flash_sale: true, flash_sale_ends_at: iso(NOW + 5 * 86_400_000), compare_at_price: 15000 }),
    p('4', { is_flash_sale: true, flash_sale_ends_at: iso(NOW + 2 * 86_400_000) }),
    p('5', { is_flash_sale: true, flash_sale_ends_at: iso(NOW - 3600_000) }), // vente flash terminée
    p('6'),
    p('7'),
    p('8', { price: 0 }), // prix invalide : jamais montré
  ];
  const r = pickProducts(rows, NOW);
  check('4 articles au plus', r.products.length === 4, r.products.map((x) => x.id));
  check('les ventes flash en cours d’abord (la fin la plus proche en premier), puis les plus récents', r.products.map((x) => x.id).join() === '4,3,1,2', r.products.map((x) => x.id));
  check('vente flash terminée : plus traitée comme une vente flash', !r.products.slice(0, 2).some((x) => x.id === '5') && r.flashEndsAt === iso(NOW + 2 * 86_400_000), r.flashEndsAt);
  check('prix à 0 : jamais montré', !pickProducts(rows, NOW, 20).products.some((x) => x.id === '8'));
  const none = pickProducts([p('1'), p('2')], NOW);
  check('sans vente flash : aucune date de fin', none.flashEndsAt === null && none.products.map((x) => x.id).join() === '1,2');
  check('aucun article : liste vide', pickProducts([], NOW).products.length === 0);
}

// contenu de l'e-mail
{
  const prods = [p('1', { name: '  Slip-on   noir ', price: 22500 }), p('2', { price: 15000, compare_at_price: 20000 }), p('3', { slug: null, images: [] })];
  const m = inactiveClientEmail({ fullName: 'Fatimé Ali', products: prods, flashEndsAt: null, unsubscribeUrl: 'https://www.albasseshopping.com/desinscription?t=abc' });
  check('objet avec le prénom, sans fausse urgence', m.subject === 'Fatimé, les articles du moment vous attendent 🛍️' && !/dernier|urgent|plus que/i.test(m.html + m.subject), m.subject);
  check('bonjour + prénom, sélection, livraison partout au Tchad', /Bonjour Fatimé, vous nous manquez/.test(m.html) && /sélection d'articles du moment/.test(m.html) && /Livraison partout au Tchad/.test(m.html));
  check('articles : nom nettoyé, vrai prix, lien vers la fiche', /Slip-on noir/.test(m.html) && /22\s500\sFCFA/.test(m.html) && /albasseshopping\.com\/produit\/article-1/.test(m.html), m.html.slice(0, 200));
  check('prix barré et pourcentage seulement s’il y a un vrai ancien prix (20 000 → 15 000 = −25 %)', /line-through[^>]*>20\s000\sFCFA/.test(m.html) && /−25 %/.test(m.html) && (m.html.match(/line-through/g) ?? []).length === 1);
  check('sans fiche (slug absent) : lien vers le site ; sans photo : pas d’image cassée', /href="https:\/\/www\.albasseshopping\.com"/.test(m.html) && (m.html.match(/<img /g) ?? []).length === 2);
  check('lien « Me désinscrire » et raison de l’envoi', /Me désinscrire des e-mails publicitaires/.test(m.html) && /href="https:\/\/www\.albasseshopping\.com\/desinscription\?t=abc"/.test(m.html) && /avez accepté de recevoir nos promotions/.test(m.html));
  check('pied de page : ne parle pas de commande', !/concerne votre commande/.test(m.html));
}
{
  const m = inactiveClientEmail({ fullName: '', products: [p('1')], flashEndsAt: iso(Date.UTC(2026, 9, 28, 20, 0, 0)), unsubscribeUrl: 'https://x/y' });
  check('vente flash en cours : objet, titre et vraie date de fin (28 octobre)', m.subject === '🔥 Vente flash en cours chez Albasse Shopping' && /Vente flash en cours 🔥/.test(m.html) && /jusqu'au <b>28 octobre<\/b>/.test(m.html), m.subject);
  check('sans prénom : « Bonjour, vous nous manquez ! »', /Bonjour, vous nous manquez/.test(m.html));
}
{
  const m = inactiveClientEmail({ fullName: '<img src=x onerror=alert(1)>', products: [p('1', { name: '<script>alert(1)</script>', images: ['https://x/a.jpg" onerror="alert(1)'] })], flashEndsAt: null, unsubscribeUrl: 'https://x/y?a=1&b="2"' });
  check('texte piégé (nom, article, photo, lien) : tout est échappé', !/<script>/.test(m.html) && !/<img src=x onerror/.test(m.html) && !/onerror="alert/.test(m.html) && /&lt;script&gt;/.test(m.html) && !/b="2"/.test(m.html), m.html.slice(0, 400));
}

console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
