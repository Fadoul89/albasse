// Tests du cerveau de Zara v3 (sans IA) : francais + arabe, questions une par une, conseil, budget, textes vrais.
// Lecture seule sur le vrai catalogue de la boutique.
import * as b from '../../src/lib/assistantBrain.ts';
import * as m from '../../src/lib/assistantMarketing.ts';
import * as tx from '../../src/lib/assistantText.ts';
import * as l from '../../src/lib/assistantLang.ts';

const KEY = process.env.SUPABASE_ANON_KEY!;
const URL_SB = 'https://xtitsmmccpkelxfjyqyh.supabase.co';
let failures = 0;
function ok(label: string, cond: unknown, extra?: unknown) {
  if (!cond) failures++;
  console.log(cond ? 'OK   ' : 'ECHEC', label, extra === undefined ? '' : '| ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 220));
}
const get = async (q: string) => (await fetch(`${URL_SB}/rest/v1/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })).json();
type P = b.CatalogProduct;

async function main() {
  console.log('== prenoms (francais et arabe)');
  const names: [string, string | null][] = [
    ['Fatimé', 'Fatimé'], ['fatimé', 'Fatimé'], ['  Aïcha  ', 'Aïcha'], ["Je m'appelle Fatimé Ali", 'Fatimé'], ["moi c'est Ali", 'Ali'],
    ['Bonjour, je suis Mahamat', 'Mahamat'], ['Mon nom est Saleh', 'Saleh'], ['Jean-Pierre', 'Jean-Pierre'], ['Mahamat Saleh Idriss', 'Mahamat'],
    ['non', null], ['Passer', null], ['plus tard', null], ['je cherche des chaussures pour homme', null], ['12345', null], ['A', null], ['https://x.com', null], ['', null],
    ['فاطمة', 'فاطمة'], ['اسمي محمد', 'محمد'], ['أنا علي', 'علي'], ['مرحبا اسمي صالح', 'صالح'], ['لا', null], ['تخطي', null], ['لاحقا', null],
  ];
  for (const [input, expected] of names) ok(`« ${input} » -> ${expected}`, b.firstNameFrom(input) === expected, b.firstNameFrom(input));

  console.log('\n== ce que veut le visiteur (francais)');
  const intents: [string, b.Intent][] = [
    ['es-tu un robot ?', 'bot'], ['tu es une vraie personne ?', 'bot'], ["c'est une IA ?", 'bot'],
    ['merci beaucoup', 'thanks'], ['Bonjour', 'greeting'], ['salam', 'greeting'], ['bonjour je cherche des chaussures', 'search'],
    ['comment créer un compte', 'account'], ["je veux m'inscrire", 'account'], ['suivre ma commande', 'orders'], ['mes commandes', 'orders'],
    ['livraison à Moundou', 'delivery'], ['je peux payer comment', 'delivery'], ['airtel money', 'delivery'], ['frais de livraison', 'delivery'],
    ['promotions', 'promo'], ['vos soldes', 'promo'], ['nouveautés', 'new'], ['catégories', 'categories'], ['comment commander', 'order'],
    ['numéro whatsapp', 'contact'], ['horaires', 'contact'], ['adresse de la boutique', 'contact'],
    ['chaussures homme', 'search'], ['montre', 'search'], ['parfum femme', 'search'], ['robe', 'search'], ['sac a main', 'search'], ['rolex', 'search'],
    ['trop cher', 'price'], ["c'est cher", 'price'], ['je peux négocier ?', 'price'],
    ['vous êtes fiables ?', 'trust'], ["c'est une arnaque ?", 'trust'], ["je n'ai pas confiance", 'trust'],
    ['je vais réfléchir', 'later'], ['plus tard', 'later'], ['pas maintenant', 'later'],
    ['idée cadeau', 'gift'], ['un cadeau pour ma femme', 'gift'], ['pour un anniversaire', 'gift'], ['Je veux faire une cadeau a mon marie', 'gift'],
    ['conseil', 'advice'], ['je voudrais un conseil', 'advice'], ["aide-moi à choisir", 'advice'], ['conseille-moi un parfum', 'advice'],
    ['mon budget', 'budget'], ['budget 20000', 'budget'],
    ['commande valable 48h', 'rules'], ['délai de 48 heures', 'rules'], ['les fausses commandes', 'rules'],
    ['infos importantes', 'info'],
    ['emballage cadeau', 'wrap'], ['je veux emballer le colis', 'wrap'], ['vous faites emballage ?', 'wrap'],
    ['je veux retourner un article', 'returns'], ['remboursement', 'returns'], ['conditions de retour', 'returns'], ['échanger la taille', 'returns'], ['article défectueux', 'returns'],
    ['qui êtes-vous', 'about'], ['depuis quand existez-vous', 'about'], ['vous êtes là depuis 2013', 'about'], ['votre histoire', 'about'],
  ];
  for (const [input, expected] of intents) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));

  console.log('\n== ce que veut le visiteur (arabe)');
  const arIntents: [string, b.Intent][] = [
    ['مرحبا', 'greeting'], ['السلام عليكم', 'greeting'], ['شكرا', 'thanks'], ['عروض', 'promo'], ['الجديد', 'new'], ['الفئات', 'categories'],
    ['غالي', 'price'], ['هذا غالي جدا', 'price'], ['هل انتم موثوقون', 'trust'], ['هل يوجد ضمان', 'trust'], ['خايف من النصب', 'trust'],
    ['كم سعر التوصيل', 'delivery'], ['التوصيل الى انجامينا', 'delivery'], ['كيف ادفع', 'delivery'],
    ['اريد هدية لزوجي', 'gift'], ['هدية عيد ميلاد', 'gift'], ['تغليف الهدايا', 'wrap'], ['اريد تغليف', 'wrap'],
    ['شروط الارجاع', 'returns'], ['اريد استبدال المنتج', 'returns'], ['استرجاع', 'returns'], ['منتج معيب', 'returns'],
    ['حسابي', 'account'], ['كيف اسجل', 'account'], ['طلباتي', 'orders'], ['ميزانيتي 20000', 'budget'],
    ['من انتم', 'about'], ['واتساب', 'contact'], ['ساعات العمل', 'contact'], ['انصحني', 'advice'], ['هل انت روبوت', 'bot'], ['لاحقا', 'later'],
    ['عطر رجالي', 'search'], ['حذاء', 'search'],
  ];
  for (const [input, expected] of arIntents) ok(`« ${input} » -> ${expected}`, b.detectIntent(input) === expected, b.detectIntent(input));

  console.log('\n== langue : arabe detecte, chiffres arabes, villes en arabe');
  ok('arabe detecte, francais non', l.hasArabic('مرحبا') && !l.hasArabic('bonjour') && l.hasArabic('parfum عطر') && l.detectLang('عطر') === 'ar' && l.detectLang('parfum') === null);
  ok('chiffres arabes : ٢٠٠٠٠ -> 20000', l.arabicDigits('٢٠٠٠٠') === '20000' && l.arabicDigits('۱۵۰۰۰') === '15000');
  ok('lettres unifiees : هدية = هديه, أحذية = احذيه', l.foldArabic('هدية') === 'هديه' && l.foldArabic('أحذية') === 'احذيه');
  ok('arabe -> francais : « أريد هدية لزوجي » -> cadeau mari', l.arabicToFrench('أريد هدية لزوجي') === 'cadeau mari', l.arabicToFrench('أريد هدية لزوجي'));
  ok('arabe -> francais : « عطر للرجال » -> parfum homme', l.arabicToFrench('عطر للرجال') === 'parfum homme', l.arabicToFrench('عطر للرجال'));
  ok('arabe -> francais : « ساعة رجالية » -> montre homme', l.arabicToFrench('ساعة رجالية') === 'montre homme', l.arabicToFrench('ساعة رجالية'));
  ok('arabe -> francais : « حذاء أسود » -> chaussures noir', l.arabicToFrench('حذاء أسود') === 'chaussures noir', l.arabicToFrench('حذاء أسود'));
  ok('arabe -> francais : les mots latins restent (rolex)', l.arabicToFrench('ساعة rolex') === 'montre rolex', l.arabicToFrench('ساعة rolex'));
  ok('villes en arabe', l.arabicCityToLatin('التوصيل الى مونذو') === 'Moundou' && l.arabicCityToLatin('انجامينا') === "N'Djamena" && l.arabicCityToLatin('ابشي') === 'Abéché' && l.arabicCityToLatin('الى سار') === 'Sarh' && l.arabicCityToLatin('مرحبا') === null);

  console.log('\n== villes, livraison, paiement (vraies villes de la boutique)');
  const rows = await get('cities?select=name,delivery_fee,delivery_agency&is_active=eq.true&order=sort_order,name');
  const cities: b.City[] = rows.map((c: any) => ({ name: c.name, fee: c.delivery_fee, agency: c.delivery_agency }));
  ok('43 villes actives lues', cities.length === 43, cities.length);
  const city = (t: string) => b.matchCity(cities, t)?.name ?? null;
  const cases: [string, string | null][] = [
    ['livraison à Moundou', 'Moundou'], ['ndjamena', "N'Djamena"], ["N'Djaména", "N'Djamena"], ['Ndjamena centre', "N'Djamena"], ['abeche', 'Abéché'], ['je suis à Sarh', 'Sarh'],
    ['Faya', 'Faya-Largeau'], ['bol', 'Bol'], ['kélo', 'Kélo'], ['am timan', 'Am Timan'], ['goz beida', 'Goz Beïda'],
    ['je veux une robe', null], ['comment ça va', null], ['paiement', null], ['bonjour', null], ['chaussures homme noir', null],
    ['التوصيل الى انجامينا', "N'Djamena"], ['هل توصلون الى مونذو', 'Moundou'], ['ابشي', 'Abéché'], ['سار', 'Sarh'], ['عطر', null], ['مرحبا', null],
  ];
  for (const [input, expected] of cases) ok(`ville dans « ${input} » -> ${expected}`, city(input) === expected, city(input));
  const find = (n: string) => cities.find((c) => c.name === n)!;
  const nd = b.cityReply(find("N'Djamena"));
  ok("N'Djamena : livraison gratuite et paiement a la livraison, aucun numero Mobile Money", /gratuite/.test(nd) && /payez à la livraison/.test(nd) && !/Airtel|Moov|60 60|99 22/.test(nd), nd);
  const mo = b.cityReply(find('Moundou'));
  ok("Moundou : 2 500 FCFA par l'agence STTL ou Sud Voyage, paiement a l'avance, Airtel 60 60 51 51 et Moov 99 22 10 17", /2\s?500 FCFA/.test(mo) && /par l'agence STTL ou Sud Voyage/.test(mo) && /à l'avance/.test(mo) && /\n📱 Airtel Money 60 60 51 51\n📲 Moov Money 99 22 10 17$/.test(mo), mo);
  const moAr = b.cityReply(find('Moundou'), 'ar');
  ok('Moundou en arabe : tarif, agence, Airtel et Moov, paiement a l\'avance', /2\s?500 FCFA/.test(moAr) && /STTL ou Sud Voyage/.test(moAr) && /مسبقا/.test(moAr) && /Airtel Money 60 60 51 51/.test(moAr) && /Moov Money 99 22 10 17/.test(moAr), moAr);
  const ndAr = b.cityReply(find("N'Djamena"), 'ar');
  ok("N'Djamena en arabe : gratuit + paiement a la livraison, aucun numero", /مجاني/.test(ndAr) && /عند الاستلام/.test(ndAr) && !/Airtel|Moov/.test(ndAr), ndAr);
  const ab = b.cityReply(find('Abéché'));
  ok("Abeche : par l'agence Abou Aziza", /par l'agence Abou Aziza/.test(ab) && !/STTL/.test(ab), ab);
  const mg = b.cityReply(find('Mongo'));
  ok("Mongo : par l'agence Liberté", /par l'agence Liberté/.test(mg) && !/Abou Aziza/.test(mg), mg);
  const unknownFee = cities.find((c) => c.fee == null)!;
  const uf = b.cityReply(unknownFee);
  ok(`${unknownFee.name} (tarif non fixe) : « a confirmer » + paiement a l'avance`, /à confirmer/.test(uf) && /à l'avance/.test(uf) && /60 60 51 51/.test(uf) && !/STTL/.test(uf), uf);
  ok("toute ville hors N'Djamena : paiement a l'avance avec les deux numeros (fr et ar)", cities.filter((c) => !b.isHomeCity(c.name)).every((c) => ['fr', 'ar'].every((lg) => { const r = b.cityReply(c, lg as l.Lang); return /Airtel Money 60 60 51 51/.test(r) && /Moov Money 99 22 10 17/.test(r); })));
  ok('note de service : 8h30-16h + 48 h (fr)', /de 8h30 à 16h/.test(b.serviceNote(true)) && /valable 48 h\.$/.test(b.serviceNote(true)) && /réglez dans ce délai\.$/.test(b.serviceNote(false)));
  ok('note de service : 8:30-16:00 + 48 heures (ar)', /8:30/.test(b.serviceNote(true, 'ar')) && /16:00/.test(b.serviceNote(true, 'ar')) && /48 ساعة/.test(b.serviceNote(true, 'ar')) && /ادفع خلال هذه المدة/.test(b.serviceNote(false, 'ar')), b.serviceNote(false, 'ar'));
  ok('infos importantes (fr + ar) : horaires, paiement par ville, 48 h', [b.importantInfo('fr'), b.importantInfo('ar')].every((s) => /8.30/.test(s) && /48/.test(s) && /Airtel Money/.test(s)) && /seulement à N'Djamena/.test(b.importantInfo('fr')) && /فقط في إنجامينا/.test(b.importantInfo('ar')));

  console.log('\n== catalogue (vrais produits)');
  const cats = await get('categories?select=id,name,slug');
  const catName = new Map<string, string>(cats.map((c: any) => [c.id, c.name]));
  const catSlug = new Map<string, string>(cats.map((c: any) => [c.id, c.slug]));
  const prods = await get('products?select=id,name,slug,price,compare_at_price,stock,category_id,colors,sizes,description,images,created_at&is_active=eq.true&limit=1000');
  const catalog: P[] = prods.map((p: any) =>
    b.buildProduct({ id: p.id, name: p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price, stock: p.stock, category: catName.get(p.category_id) ?? '', category_slug: catSlug.get(p.category_id) ?? '', colors: p.colors, sizes: p.sizes, description: p.description, image: (p.images ?? [])[0] ?? null, created_at: p.created_at })
  );
  ok('au moins 300 produits actifs lus', catalog.length >= 300, catalog.length);
  const top = (q: string, n = 4) => b.searchCatalog(catalog, q, n);
  const shoes = top('chaussures homme');
  ok('« chaussures homme » : que des chaussures, en stock', shoes.length === 4 && shoes.every((p) => p.category === 'Chaussures' && p.stock > 0), shoes.map((p) => p.name));
  ok('« robe » : des robes', top('robe').slice(0, 3).every((p) => /robe/i.test(p.name)));
  ok('« montre » : des montres', top('montre').every((p) => p.category === 'Montre'));
  ok('mot inconnu -> aucun resultat', top('helicoptere').length === 0 && top('riz').length === 0);
  ok('jamais un produit en rupture', catalog.filter((p) => p.stock <= 0).every((p) => !top(p.name, 6).some((r) => r.id === p.id)));
  const pr = m.parseNeed('عطر رجالي');
  ok('recherche en arabe « عطر رجالي » : des parfums', top(pr.query).length > 0 && top(pr.query).every((p) => p.category === 'Parfum'), [pr.query, top(pr.query).map((p) => p.name)]);
  const promo = b.promotions(catalog, 4);
  ok('promotions : 4 produits en stock, avec photo, plus forte remise d\'abord', promo.length === 4 && promo.every((p) => p.stock > 0 && p.image), promo.map((p) => p.name));
  ok('les produits ont des tailles et des couleurs lues dans la base', catalog.some((p) => p.sizes.length >= 2) && catalog.some((p) => p.colors.length >= 2), [catalog.filter((p) => p.sizes.length >= 2).length, catalog.filter((p) => p.colors.length >= 2).length]);

  console.log('\n== comprendre le besoin : cadeau ? pour qui ? quel article ? precis ou large ?');
  const need = (t: string) => {
    const p = m.parseNeed(t);
    return { gift: p.gift, who: p.who ?? null, slug: p.slug ?? null, rest: p.rest, broad: m.isBroad(p) };
  };
  const needCases: [string, { gift: boolean; who: string | null; slug: string | null; broad: boolean }][] = [
    ['Je veux faire une cadeau a mon marie', { gift: true, who: 'lui', slug: null, broad: true }],
    ['un cadeau pour mon mari', { gift: true, who: 'lui', slug: null, broad: true }],
    ['cadeau pour ma femme', { gift: true, who: 'elle', slug: null, broad: true }],
    ['idée cadeau', { gift: true, who: null, slug: null, broad: true }],
    ['cadeau pour ma fille', { gift: true, who: 'enfant', slug: null, broad: true }],
    ['un parfum pour ma mère', { gift: false, who: 'elle', slug: 'parfum', broad: true }],
    ['cadeau parfum pour lui', { gift: true, who: 'lui', slug: 'parfum', broad: true }],
    ['chaussures', { gift: false, who: null, slug: 'chaussures', broad: true }],
    ['pour homme', { gift: false, who: 'lui', slug: null, broad: true }],
    ['je cherche pour femme', { gift: false, who: 'elle', slug: null, broad: true }],
    ['montre homme', { gift: false, who: 'lui', slug: 'montre', broad: true }],
    ['robe', { gift: false, who: null, slug: 'vetements-pour-femmes', broad: true }],
    ['sac', { gift: false, who: null, slug: 'sacs-et-bagages', broad: true }],
    ['bébé', { gift: false, who: 'enfant', slug: 'bebe-et-maternite', broad: true }],
    ['rolex', { gift: false, who: null, slug: null, broad: false }],
    ['chaussures noires', { gift: false, who: null, slug: 'chaussures', broad: false }],
    ['montre rolex doree', { gift: false, who: null, slug: 'montre', broad: false }],
    ['cadeau rolex', { gift: true, who: null, slug: null, broad: false }],
    ['helicoptere', { gift: false, who: null, slug: null, broad: false }],
    ['اريد هدية لزوجي', { gift: true, who: 'lui', slug: null, broad: true }],
    ['هدية لزوجتي', { gift: true, who: 'elle', slug: null, broad: true }],
    ['عطر', { gift: false, who: null, slug: 'parfum', broad: true }],
    ['عطر للرجال', { gift: false, who: 'lui', slug: 'parfum', broad: true }],
    ['ساعة رجالية', { gift: false, who: 'lui', slug: 'montre', broad: true }],
    ['حذاء للاطفال', { gift: false, who: 'enfant', slug: 'chaussures', broad: true }],
    ['للنساء', { gift: false, who: 'elle', slug: null, broad: true }],
    ['ساعة rolex', { gift: false, who: null, slug: 'montre', broad: false }],
    ['حذاء اسود', { gift: false, who: null, slug: 'chaussures', broad: false }],
  ];
  for (const [input, exp] of needCases) {
    const got = need(input);
    ok(`besoin « ${input} » -> ${exp.gift ? 'cadeau ' : ''}${exp.who ?? '?'} ${exp.slug ?? '?'} ${exp.broad ? '(large : questions)' : '(precis : produits)'}`, got.gift === exp.gift && got.who === exp.who && got.slug === exp.slug && got.broad === exp.broad, got);
  }
  ok('le budget ecrit ne compte pas comme un mot precis : « chaussures homme moins de 20000 » est large', need('chaussures homme moins de 20000').broad && m.parseNeed('chaussures homme moins de 20000').query === 'chaussures homme');
  ok('arabe : la requete de recherche est ramenee au francais', m.parseNeed('أريد هدية لزوجي').query === 'cadeau mari' && m.parseNeed('عطر اقل من 20000').query === 'parfum', [m.parseNeed('أريد هدية لزوجي').query, m.parseNeed('عطر اقل من 20000').query]);

  console.log('\n== les questions, une a la fois');
  const q = (n: m.Need) => m.nextQuestion(n);
  const qCases: [string, m.Need, string][] = [
    ['cadeau, rien de connu', { gift: true }, 'who'],
    ['cadeau pour lui', { gift: true, who: 'lui' }, 'type'],
    ['cadeau pour lui, montre', { gift: true, who: 'lui', slug: 'montre' }, 'budget'],
    ['cadeau pour lui, « je ne sais pas » deja demande', { gift: true, who: 'lui', typeAsked: true }, 'budget'],
    ['cadeau pour lui, montre, budget donne', { gift: true, who: 'lui', slug: 'montre', budget: { min: 0, max: 20000 } }, 'done'],
    ['cadeau, budget donne d\'avance mais pas pour qui', { gift: true, budget: { min: 0, max: 20000 } }, 'who'],
    ['conseil sans rien', { gift: false }, 'type'],
    ['conseil, « je ne sais pas » deja demande', { gift: false, typeAsked: true }, 'budget'],
    ['chaussures (pour qui ?)', { gift: false, slug: 'chaussures' }, 'who'],
    ['chaussures pour lui', { gift: false, slug: 'chaussures', who: 'lui' }, 'budget'],
    ['robe (pas besoin de demander pour qui)', { gift: false, slug: 'vetements-pour-femmes' }, 'budget'],
    ['sac', { gift: false, slug: 'sacs-et-bagages' }, 'budget'],
    ['pour homme (quel article ?)', { gift: false, who: 'lui' }, 'type'],
    ['pour homme, article demande', { gift: false, who: 'lui', typeAsked: true }, 'budget'],
    ['montre pour lui, budget donne', { gift: false, slug: 'montre', who: 'lui', budget: { min: 0, max: null } }, 'done'],
  ];
  for (const [label, n, expected] of qCases) ok(`question suivante : ${label} -> ${expected}`, q(n) === expected, q(n));
  // jamais deux fois la meme question : on simule les reponses pas a pas
  const steps: string[] = [];
  let sim: m.Need = { gift: true };
  for (let i = 0; i < 6 && m.nextQuestion(sim) !== 'done'; i++) {
    const qq = m.nextQuestion(sim);
    steps.push(qq);
    if (qq === 'who') sim = { ...sim, who: 'lui' };
    else if (qq === 'type') sim = { ...sim, slug: 'montre', typeAsked: true };
    else sim = { ...sim, budget: { min: 0, max: null } };
  }
  ok('cadeau : pour qui -> quel article -> budget -> resultat (3 questions, jamais deux fois la meme)', steps.join(',') === 'who,type,budget', steps);
  ok('le budget d\'un besoin survit au stockage (JSON)', JSON.stringify(m.rangeOfNeed({ gift: false, budget: { min: 30000, max: null } })) === JSON.stringify({ min: 30000, max: null }) || m.rangeOfNeed({ gift: false, budget: { min: 30000, max: null } }).max === Infinity);
  ok('un besoin sans budget = pas de limite', m.rangeOfNeed({ gift: false }).max === Infinity && m.budgetOfRange({ min: 0, max: Infinity }).max === null && m.budgetOfRange({ min: 0, max: 5000 }).max === 5000);

  console.log('\n== les boutons de la question « quel article ? »');
  const choose = (who: l.Who | undefined, gift: boolean, lang: l.Lang = 'fr') => m.typeChoices(catalog, who, gift, lang);
  const slugsOf = (c: { slug: string }[]) => c.map((x) => x.slug).join('|');
  ok('cadeau pour lui : montre, parfum, chaussures, lunettes', slugsOf(choose('lui', true)) === 'montre|parfum|chaussures|lunettes', slugsOf(choose('lui', true)));
  ok('cadeau pour elle : parfum, sacs, vetements femmes, cosmetique', slugsOf(choose('elle', true)) === 'parfum|sacs-et-bagages|vetements-pour-femmes|cosmetique', slugsOf(choose('elle', true)));
  ok('cadeau pour un enfant : jouets, bebe', slugsOf(choose('enfant', true)) === 'velos-pour-enfants-jouets-et-jeux|bebe-et-maternite', slugsOf(choose('enfant', true)));
  ok('achat pour lui : chaussures, montre, parfum, vetements, lunettes', slugsOf(choose('lui', false)) === 'chaussures|montre|parfum|vetements|lunettes', slugsOf(choose('lui', false)));
  ok('sans personne : 6 categories, les plus demandees d\'abord', choose(undefined, false).length === 6 && slugsOf(choose(undefined, false)).startsWith('parfum|chaussures|montre|vetements'), slugsOf(choose(undefined, false)));
  ok('boutons en arabe : noms arabes', choose('lui', true, 'ar').map((c) => c.name).join('|') === 'ساعات|عطور|أحذية|نظارات', choose('lui', true, 'ar').map((c) => c.name));
  ok('chaque bouton est une vraie categorie avec des produits en stock', ['lui', 'elle', 'enfant'].every((w) => [true, false].every((g) => choose(w as l.Who, g).every((c) => catalog.some((p) => p.categorySlug === c.slug && p.stock > 0 && p.price > 0)))));
  ok('toutes les categories de la boutique ont un nom arabe', cats.every((c: any) => !!l.CATEGORY_AR[c.slug]), cats.filter((c: any) => !l.CATEGORY_AR[c.slug]).map((c: any) => c.slug));

  console.log('\n== marketing : budget');
  const rng = (t: string) => { const r = m.parseBudget(t); return r ? `${r.min}-${Number.isFinite(r.max) ? r.max : '∞'}` : null; };
  const budgets: [string, string | null][] = [
    ['20 000', '0-20000'], ['moins de 15000', '0-15000'], ['entre 10 000 et 30 000', '10000-30000'], ['20k', '0-20000'], ['plus de 50 mille', '50000-∞'],
    ['2 montres', null], ['je veux 3 chaussures', null], ["j'ai 25.000 fcfa", '0-25000'], ['de 5000 à 8000', '5000-8000'], ['budget illimité', null], ['', null],
    ['اقل من 20000', '0-20000'], ['بين 10000 و 30000', '10000-30000'], ['اكثر من 50000', '50000-∞'], ['٢٠٠٠٠', '0-20000'], ['ميزانيتي 15 الف', '0-15000'], ['عطر اقل من ٢٥٠٠٠', '0-25000'], ['قطعتين', null],
  ];
  for (const [input, expected] of budgets) ok(`budget « ${input} » -> ${expected}`, rng(input) === expected, rng(input));
  const strips: [string, string][] = [
    ['chaussures homme moins de 20000', 'chaussures homme'], ['montre entre 10 000 et 30 000', 'montre'], ['parfum à partir de 50000 fcfa', 'parfum'],
    ['sac à main moins de 15 000 FCFA', 'sac à main'], ['20000', ''], ['budget 20000', ''], ["jusqu'à 20k", ''], ['robe', 'robe'], ['montre homme', 'montre homme'],
    ['عطر اقل من 20000', 'عطر'], ['عطر أقل من ٢٠٠٠٠', 'عطر'], ['ميزانيتي 15000', ''], ['ساعة بين 10000 و 30000', 'ساعة'],
  ];
  for (const [input, expected] of strips) ok(`sans le budget : « ${input} » -> « ${expected} »`, m.stripBudget(input) === expected, m.stripBudget(input));
  const rt = m.decodeRange(m.encodeRange({ min: 30000, max: Infinity }));
  ok("un budget sans plafond survit a l'envoi dans un bouton", !!rt && rt.min === 30000 && rt.max === Infinity && m.decodeRange('0-10000')!.max === 10000 && m.decodeRange('abc') === null);
  ok('budget en toutes lettres (fr)', /^à moins de 10\s?000 FCFA$/.test(tx.texts('fr').rangeText({ min: 0, max: 10000 })) && /^entre 10\s?000 FCFA et 30\s?000 FCFA$/.test(tx.texts('fr').rangeText({ min: 10000, max: 30000 })) && /^à partir de 100\s?000 FCFA$/.test(tx.texts('fr').rangeText({ min: 100000, max: Infinity })));
  ok('budget en toutes lettres (ar)', /^بأقل من 10\s?000 FCFA$/.test(tx.texts('ar').rangeText({ min: 0, max: 10000 })) && /^بين 10\s?000 FCFA و 30\s?000 FCFA$/.test(tx.texts('ar').rangeText({ min: 10000, max: 30000 })) && /^ابتداء من 100\s?000 FCFA$/.test(tx.texts('ar').rangeText({ min: 100000, max: Infinity })), tx.texts('ar').rangeText({ min: 10000, max: 30000 }));
  ok('4 budgets proposes (fr et ar), du plus petit au plus grand', m.budgetOptions('fr').length === 4 && m.budgetOptions('ar').length === 4 && m.BUDGETS.every((x, i) => i === 0 || m.BUDGETS[i - 1].range.max === x.range.min) && m.budgetOptions('ar')[0].label.includes('أقل من') && m.budgetOptions('ar')[3].label.includes('أكثر من'), m.budgetOptions('ar').map((x) => x.label));

  console.log('\n== marketing : selections de produits (vrai catalogue)');
  const sell = (p: P) => p.stock > 0 && p.price > 0;
  const parfum = m.pickInBudget(catalog, { kind: 'category', slug: 'parfum' }, { min: 10000, max: 30000 }, 4);
  ok('parfum entre 10 000 et 30 000 : 4 produits dans le budget, en stock', parfum.items.length === 4 && !parfum.fallback && parfum.items.every((p) => p.category === 'Parfum' && p.price >= 10000 && p.price <= 30000 && sell(p)), parfum.items.map((p) => [p.name, p.price]));
  const shoesMen = m.pickInBudget(catalog, { kind: 'category', slug: 'chaussures', who: 'lui' }, { min: 0, max: 20000 }, 4);
  ok('chaussures pour lui a moins de 20 000 : des chaussures dans le budget, d\'abord celles pour homme', shoesMen.items.length > 0 && !shoesMen.fallback && shoesMen.items.every((p) => p.category === 'Chaussures' && p.price <= 20000), shoesMen.items.map((p) => [p.name, p.price]));
  const menFirst = m.candidatesFor(catalog, { kind: 'category', slug: 'chaussures', who: 'lui' }).slice(0, 4);
  ok('chaussures pour lui : les produits « homme » passent avant', menFirst.every((p) => /homme|men|man|messieur/i.test(`${p.name} ${p.nameTokens.join(' ')} ${p.descTokens.join(' ')} ${p.colorTokens.join(' ')}`)), menFirst.map((p) => p.name));
  const cheap = m.pickInBudget(catalog, { kind: 'category', slug: 'montre' }, { min: 0, max: 100 }, 4);
  ok('budget trop bas : on montre les moins chers (repli)', cheap.fallback && cheap.items.length === 4 && cheap.items.every((p, i) => i === 0 || cheap.items[i - 1].price <= p.price), cheap.items.map((p) => p.price));
  const rich = m.pickInBudget(catalog, { kind: 'category', slug: 'montre' }, { min: 90000000, max: Infinity }, 4);
  ok('budget trop haut : on montre les plus chers (repli)', rich.fallback && rich.items.length === 4 && rich.items.every((p, i) => i === 0 || rich.items[i - 1].price >= p.price), rich.items.map((p) => p.price));
  const noCtx = m.pickInBudget(catalog, null, { min: 0, max: 10000 }, 4);
  ok('budget sans sujet precis : les meilleures remises dans le budget', noCtx.items.length === 4 && noCtx.items.every((p) => p.price <= 10000 && sell(p)), noCtx.items.map((p) => [p.name, p.price]));

  const gifts = (who: l.Who, slug?: string, range = m.ANY_BUDGET) => m.giftPicks(catalog, who, range, 4, slug);
  const elle = gifts('elle');
  ok('cadeau pour elle : 4 produits varies (2 categories ou plus), en stock, avec photo', elle.length === 4 && new Set(elle.map((p) => p.category)).size >= 2 && elle.every((p) => sell(p) && p.image), elle.map((p) => [p.category, p.name]));
  const lui = gifts('lui');
  ok('cadeau pour lui : 4 produits varies', lui.length === 4 && new Set(lui.map((p) => p.category)).size >= 2 && lui.every((p) => ['Montre', 'Parfum', 'Chaussures', 'Lunettes'].includes(p.category)), lui.map((p) => [p.category, p.name]));
  const kid = gifts('enfant');
  ok('cadeau pour un enfant : bebe ou jouets', kid.length >= 1 && kid.every((p) => ['Bébé et Maternité', 'Vélos pour enfants & Jouets et Jeux'].includes(p.category)), kid.map((p) => [p.category, p.name]));
  const luiMontre = gifts('lui', 'montre');
  ok('cadeau pour lui, une montre : 4 montres', luiMontre.length === 4 && luiMontre.every((p) => p.category === 'Montre' && sell(p)), luiMontre.map((p) => p.name));
  const luiParfum = gifts('lui', 'parfum');
  ok('cadeau pour lui, un parfum : des parfums (pour homme d\'abord)', luiParfum.length === 4 && luiParfum.every((p) => p.category === 'Parfum'), luiParfum.map((p) => p.name));
  const elleSac = gifts('elle', 'sacs-et-bagages');
  ok('cadeau pour elle, un sac : des sacs', elleSac.length > 0 && elleSac.every((p) => p.category === 'Sacs et Bagages'), elleSac.map((p) => p.name));
  const luiAutre = gifts('lui', 'sacs-et-bagages');
  ok('cadeau pour lui, une categorie hors liste : quand meme des produits de cette categorie', luiAutre.length > 0 && luiAutre.every((p) => p.category === 'Sacs et Bagages'), luiAutre.map((p) => p.name));
  const giftCheap = gifts('elle', undefined, { min: 0, max: 10000 });
  ok('cadeau pour elle a moins de 10 000 : tout est dans le budget', giftCheap.every((p) => p.price <= 10000), giftCheap.map((p) => p.price));
  ok('pas de doublon dans un cadeau', new Set(elle.map((p) => p.id)).size === elle.length);
  const whoCtx = m.candidatesFor(catalog, { kind: 'who', who: 'lui' }).slice(0, 4);
  ok('« pour lui » sans article : un peu de tout (2 categories ou plus)', whoCtx.length === 4 && new Set(whoCtx.map((p) => p.category)).size >= 2, whoCtx.map((p) => [p.category, p.name]));
  const giftDay = m.pickInBudget(catalog, { kind: 'gift', who: 'lui', slug: 'montre' }, { min: 0, max: 30000 }, 4);
  ok('cadeau pour lui, montre, moins de 30 000 : dans le budget', giftDay.items.length > 0 && giftDay.items.every((p) => p.price <= 30000 && p.category === 'Montre'), giftDay.items.map((p) => [p.name, p.price]));

  console.log('\n== alternatives moins cheres (« c\'est cher »)');
  const shown = m.pickInBudget(catalog, { kind: 'category', slug: 'parfum' }, { min: 30000, max: 100000 }, 4).items;
  const alts = m.cheaperOptions(catalog, { kind: 'category', slug: 'parfum' }, shown.map((p) => p.price), 3);
  const minShown = Math.min(...shown.map((p) => p.price));
  ok('parfums montres 30 000-100 000 : des parfums au moins 10 % moins chers', alts.length > 0 && alts.every((p) => p.category === 'Parfum' && p.price < minShown * 0.9 && sell(p)), [minShown, alts.map((p) => [p.name, p.price])]);
  const cheapest = [...catalog].filter((p) => p.categorySlug === 'parfum' && sell(p)).sort((a, c) => a.price - c.price)[0];
  ok('rien de moins cher que le moins cher de la categorie -> liste vide (Zara le dit honnetement)', m.cheaperOptions(catalog, { kind: 'category', slug: 'parfum' }, [cheapest.price], 3).length === 0 && m.cheaperOptions(catalog, null, [], 3).length === 0);
  ok('sans sujet : alternatives prises dans les promotions', m.cheaperOptions(catalog, null, [90000000], 3).every((p) => !!p.compareAt));

  console.log('\n== produits qui se completent');
  const pair = (slug: string, lang: l.Lang = 'fr') => m.crossSellTarget(catalog, slug, lang);
  ok('a completer : chaussures -> sacs et bagages, montre -> parfum, bebe -> jouets', pair('chaussures')?.name === 'Sacs et Bagages' && pair('montre')?.name === 'Parfum' && pair('bebe-et-maternite')?.name === 'Vélos pour enfants & Jouets et Jeux', [pair('chaussures'), pair('montre'), pair('bebe-et-maternite')]);
  ok('a completer en arabe : montre -> عطور', pair('montre', 'ar')?.name === 'عطور', pair('montre', 'ar'));
  ok('a completer : rien pour une categorie sans suggestion', pair('voiture') === null && pair('inconnue') === null);
  ok('categorie dominante des resultats', m.dominantSlug(top('chaussures homme')) === 'chaussures' && m.dominantSlug([]) === '');

  console.log('\n== raisons vraies (jamais inventees)');
  const base = catalog.find((p) => sell(p))!;
  const fake = (over: Partial<P>): P => ({ ...base, name: 'Rolex dorée', price: 12500, compareAt: 25000, stock: 3, colors: [], sizes: [], ...over });
  const why = (p: P, range = m.ANY_BUDGET, lang: l.Lang = 'fr', cheapest = false) => m.whyReasons(p, range, lang, cheapest);
  const w1 = why(fake({}));
  ok('remise vraie (50 %) + stock bas vrai (3)', w1.length === 2 && /50 % de remise/.test(w1[0]) && /12\s?500 FCFA au lieu de 25\s?000 FCFA/.test(w1[0]) && /plus que 3 en stock/.test(w1[1]), w1);
  ok('produit sans remise, stock normal, une couleur, pas de taille : seulement « en stock » (rien d\'invente)', JSON.stringify(why(fake({ compareAt: null, stock: 40, colors: ['Noir'], sizes: [] }))) === JSON.stringify(['en stock']), why(fake({ compareAt: null, stock: 40, colors: ['Noir'] })));
  ok('petite remise (< 10 %) : pas citee', !why(fake({ compareAt: 13000, stock: 40 })).some((r) => /%/.test(r)));
  ok('couleurs et tailles reelles citees', why(fake({ compareAt: null, stock: 40, colors: ['Noir', 'Blanc', 'Bleu', 'Rouge'], sizes: ['40', '41', '42'] })).join(' ').includes('disponible en Noir, Blanc, Bleu') && why(fake({ compareAt: null, stock: 40, colors: ['Noir', 'Blanc'], sizes: ['40', '41', '42'] })).join(' ').includes('tailles : 40, 41, 42'));
  ok('« dans votre budget » seulement si le prix y est vraiment', why(fake({ compareAt: null, stock: 40 }), { min: 0, max: 20000 }).includes('dans votre budget') && !why(fake({ compareAt: null, stock: 40 }), { min: 0, max: 10000 }).includes('dans votre budget') && !why(fake({ compareAt: null, stock: 40 }), m.ANY_BUDGET).includes('dans votre budget'));
  ok('« le plus abordable » seulement pour les alternatives moins cheres', why(fake({ compareAt: null, stock: 40 }), m.ANY_BUDGET, 'fr', true).includes('le plus abordable de la sélection') && !why(fake({ compareAt: null, stock: 40 })).includes('le plus abordable de la sélection'));
  ok('au plus 3 raisons', why(fake({ stock: 2, colors: ['a', 'b'], sizes: ['1', '2'] }), { min: 0, max: 20000 }).length === 3);
  const advFr = m.whyAdvice(fake({}), m.ANY_BUDGET, 'fr');
  const advAr = m.whyAdvice(fake({}), m.ANY_BUDGET, 'ar');
  ok('conseil en francais : « Mon conseil{nom} : « Rolex dorée » — ... »', /^Mon conseil\{nom\} : « Rolex dorée » — 50 % de remise : 12\s?500 FCFA au lieu de 25\s?000 FCFA · plus que 3 en stock\.$/.test(advFr), advFr);
  ok('conseil en arabe : « نصيحتي{nom}: «Rolex dorée» — ... »', /^نصيحتي\{nom\}: «Rolex dorée» — خصم 50 %/.test(advAr) && /بدل/.test(advAr) && /بقي 3 فقط/.test(advAr), advAr);
  ok('le nom du produit trop long est raccourci', m.whyAdvice(fake({ name: 'A'.repeat(100) }), m.ANY_BUDGET).includes('…'));

  console.log('\n== textes de vente (fr + ar)');
  ok('stock bas (3) : fr et ar', /plus que 3 en stock/.test(m.lowStockLine([fake({ stock: 3 })]) ?? '') && /بقي 3 فقط/.test(m.lowStockLine([fake({ stock: 3 })], 'ar') ?? ''));
  ok('stock a 1', /qu’un en stock/.test(m.lowStockLine([fake({ stock: 1 })]) ?? '') && /قطعة واحدة فقط/.test(m.lowStockLine([fake({ stock: 1 })], 'ar') ?? ''));
  ok('stock normal (10) ou rupture : aucune urgence affichee', m.lowStockLine([fake({ stock: 10 })]) === null && m.lowStockLine([fake({ stock: 0 })]) === null && m.lowStockLine([]) === null && m.lowStockLine([], 'ar') === null);
  ok('la rarete la plus forte est annoncee', /Cartier/.test(m.lowStockLine([fake({ stock: 4, name: 'Rolex dorée' }), fake({ stock: 2, name: 'Cartier' })]) ?? ''));
  const maxPct = m.maxDiscountPct(catalog);
  ok('plus forte remise du catalogue : un entier entre 5 et 90', maxPct !== null && Number.isInteger(maxPct) && maxPct >= 5 && maxPct <= 90, maxPct);
  const pitch = m.productPitch(fake({ stock: 3 }));
  ok('fiche produit regardee (fr) : prix barre, -50 %, stock, « Acheter »', /12\s?500 FCFA au lieu de 25\s?000 FCFA \(-50 %\)/.test(pitch) && /Plus que 3 en stock/.test(pitch) && /« Acheter »/.test(pitch), pitch);
  const pitchAr = m.productPitch(fake({ stock: 3 }), 'ar');
  ok('fiche produit regardee (ar) : prix barre, -50 %, stock, Acheter', /بدل 25\s?000 FCFA \(-50 %\)/.test(pitchAr) && /بقي 3 فقط/.test(pitchAr) && /Acheter/.test(pitchAr), pitchAr);
  ok('fiche sans remise ni rarete : ni « au lieu de » ni « plus que »', !/au lieu de|Plus que|qu’un/.test(m.productPitch(fake({ compareAt: null, stock: 40 }))));
  ok('panier : nombre d\'articles et total (fr et ar)', /2 articles pour 25\s?000 FCFA/.test(m.cartReminder(2, 25000)) && /1 article pour/.test(m.cartReminder(1, 5000)) && /25\s?000 FCFA/.test(m.cartReminder(2, 25000, 'ar')) && /سلتك/.test(m.cartReminder(2, 25000, 'ar')));
  ok("objection de prix (fr) : promotions (jusqu'a -50 %), budget, livraison gratuite a N'Djamena", /jusqu’à -50 %/.test(m.priceReply(50)) && !/jusqu’à/.test(m.priceReply(null)) && /Djamena, la livraison est gratuite/.test(m.priceReply(50)));
  ok('objection de prix (ar)', /حتى -50 %/.test(m.priceReply(50, 'ar')) && /ميزانيتك/.test(m.priceReply(50, 'ar')) && /مجاني/.test(m.priceReply(50, 'ar')));
  const trust = m.trustReply({ address: 'Marché Central', city: "N'Djamena", phone: '+23560605151' });
  ok('confiance (fr) : « première plateforme de vente en ligne du Tchad, depuis 2013 », Service Qualite Garantie, adresse, telephone', /première plateforme de vente en ligne du Tchad, depuis 2013/.test(trust) && /Service, Qualité, Garantie/.test(trust) && /ne payez qu’en recevant/.test(trust) && /Marché Central, N'Djamena/.test(trust) && /\+235 60 60 51 51/.test(trust), trust);
  const trustAr = m.trustReply({ address: 'Marché Central', city: "N'Djamena", phone: '+23560605151' }, 'ar');
  ok('confiance (ar) : أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013', /أول منصة للبيع عبر الإنترنت في تشاد، منذ عام 2013/.test(trustAr) && /خدمة، جودة، ضمان/.test(trustAr) && /\+235 60 60 51 51/.test(trustAr), trustAr);
  ok('confiance sans donnees : le message reste complet', /Service, Qualité, Garantie/.test(m.trustReply({})) && !/📍|📞/.test(m.trustReply({})));
  ok('a propos (fr + ar) : premiere plateforme, depuis 2013 (l\'entreprise, pas l\'assistante)', /première plateforme de vente en ligne du Tchad/.test(m.aboutReply()) && /depuis 2013/.test(m.aboutReply()) && /2013/.test(m.aboutReply('ar')) && /أول منصة/.test(m.aboutReply('ar')) && !/10 ans/.test(m.aboutReply() + m.aboutReply('ar') + trust));
  const ret = m.returnsReply();
  ok('retours (fr) : 72 h, photo ou video, frais a notre charge si article incorrect, echange de taille a la charge du client, garder l\'emballage', /72 h/.test(ret) && /photo ou une vidéo/.test(ret) && /frais de retour sont à notre charge/.test(ret) && /échange possible/.test(ret) && /à votre charge/.test(ret) && /emballage d’origine/.test(ret), ret);
  const retAr = m.returnsReply('ar');
  ok('retours (ar) : 72 heures, photo ou video, echange de taille', /72 ساعة/.test(retAr) && /صورة أو فيديو/.test(retAr) && /الاستبدال/.test(retAr) && /عبوته الأصلية/.test(retAr), retAr);
  ok('numero de telephone formate', m.formatPhone('+23560605151') === '+235 60 60 51 51' && m.formatPhone('60605151') === '+235 60 60 51 51' && m.formatPhone(null) === null);
  ok('emballage cadeau (fr) : 2 000 FCFA par commande, image cadeau, Mes commandes', /2\s?000 FCFA par commande/.test(m.giftWrapReply()) && /image cadeau/.test(m.giftWrapReply()) && /Mes commandes/.test(m.giftWrapReply()));
  ok('emballage cadeau (ar) : 2 000 FCFA par commande, image cadeau', /2\s?000 FCFA/.test(m.giftWrapReply('ar')) && /صورة الهدية/.test(m.giftWrapReply('ar')) && /طلباتي/.test(m.giftWrapReply('ar')), m.giftWrapReply('ar'));
  ok('cadeau : phrase qui propose l\'emballage a 2 000 FCFA (fr + ar)', /emballage cadeau à 2\s?000 FCFA par commande/.test(m.giftWrapPitch()) && /تغليف الهدايا بـ 2\s?000 FCFA/.test(m.giftWrapPitch('ar')));
  ok('« plus tard » : on garde la porte ouverte (favoris), fr et ar', /favoris/.test(m.laterReply()) && /\{nom\}/.test(m.laterReply()) && /مفضلتك/.test(m.laterReply('ar')));
  ok('phrases d\'encouragement : 8 differentes, elles tournent, en fr et en ar', new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => b.encouragement(i))).size === 8 && b.encouragement(8) === b.encouragement(0) && new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => b.encouragement(i, 'ar'))).size === 8);
  ok('phrases d\'encouragement : aucune fausse promesse (pas de « dernier », « plus que », pourcentage)', [0, 1, 2, 3, 4, 5, 6, 7].every((i) => !/dernier|plus que|%/.test(b.encouragement(i))));

  console.log('\n== noms et ponctuation selon la langue');
  ok('{nom} -> « , Ali » en francais et « ، Ali » en arabe', tx.withName('fr', 'Bonjour{nom} !', 'Ali') === 'Bonjour, Ali !' && tx.withName('ar', 'مرحبا{nom}!', 'علي') === 'مرحبا، علي!' && tx.withName('fr', 'Bonjour{nom} !', null) === 'Bonjour !' && tx.withName('ar', 'مرحبا{nom}!', null) === 'مرحبا!');
  ok('nom de categorie selon la langue', tx.categoryLabel('ar', 'parfum', 'Parfum') === 'عطور' && tx.categoryLabel('fr', 'parfum', 'Parfum') === 'Parfum' && tx.categoryLabel('ar', 'inconnue', 'Divers') === 'Divers');
  ok('bienvenue : nom et role seulement (fr et ar)', tx.texts('fr').welcome('Ali') === "Bonjour Ali ! Je suis Zara Kings, l'assistante marketing d'Albasse Shopping." && /^مرحبا علي! أنا زارا كينغز/.test(tx.texts('ar').welcome('علي')), [tx.texts('fr').welcome(null), tx.texts('ar').welcome(null)]);
  ok('chaque langue a son sens d\'ecriture', tx.texts('fr').dir === 'ltr' && tx.texts('ar').dir === 'rtl');
  ok('inconnue -> francais', tx.texts('xx' as l.Lang).dir === 'ltr');

  console.log('\n== textes arabes : tout en arabe (sauf les noms propres et les boutons du site)');
  const ALLOWED = /Albasse|Shopping|Airtel|Moov|Money|FCFA|Acheter|Ajouter|panier|Voir|produit|le\b|au|N'Djamena|Mongo|Rolex|dorée|Test|STTL|Sud|Voyage|Abou|Aziza|Liberté|Abéché|Français|Chrome|Safari|albasseshopping\.com/g;
  const sampleArgs: Record<string, unknown[]> = {
    welcome: ['علي'], teaser: ['علي'], nice: ['علي'], 'card.only': [3], 'chip.withCategory': ['عطور'], promoIntro: [50], foundFor: ['عطر', 'بأقل من 10 000 FCFA'], fallbackFor: ['عطر', 'بأقل من 10 000 FCFA'],
    nothingFor: ['عطر'], askWho: [true], askType: ['lui', true], giftIntro: ['lui'], pairIntro: ['عطور'], rangeText: [{ min: 0, max: 10000 }], lowStock: ['ساعة', 3], pitch: ['ساعة', '10 000 FCFA', 3],
    cartReminder: [2, 25000], priceReply: [50], trust: ['السوق المركزي', '+235 60 60 51 51'], whyAdvice: ['ساعة', ['سبب']], 'why.discount': [50, 12500, 25000], 'why.lowStock': [3],
    'why.colors': ['أسود'], 'why.sizes': ['40'], cityNotFound: ['سار'], cityFee: ['موندو', '2 500 FCFA', null], cityNoFee: ['موندو', null], serviceNote: [true], 'contact.hours': ['8:00'],
    budgetBest: ['بأقل من 10 000 FCFA'], budgetFallback: ['بأقل من 10 000 FCFA'],
    'cart.added': ['ساعة', ' (المقاس 41)', 2, 25000], 'cart.priceChanged': ['ساعة', '10 000 FCFA', '12 000 FCFA'], 'install.iosSteps': [false],
  };
  const leaks: string[] = [];
  let count = 0;
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (path === 'dir') return;
      count++;
      const rest = node.replace(/\{nom\}/g, '').replace(ALLOWED, '').replace(/https?:\/\/\S+/g, '');
      const latin = rest.match(/[A-Za-zÀ-ÿ]{3,}/g);
      if (latin) leaks.push(`${path}: ${latin.join(',')}`);
    } else if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (typeof node === 'function') walk((node as (...a: unknown[]) => unknown)(...(sampleArgs[path] ?? ['علي', 5, true])), `${path}()`);
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(tx.texts('ar'), '');
  ok(`aucun mot francais oublie dans les ${count} textes arabes`, leaks.length === 0, leaks);
  let frCount = 0;
  const frArabic: string[] = [];
  const walkFr = (node: unknown, path: string) => {
    if (typeof node === 'string') { frCount++; if (l.hasArabic(node) && !/العربية|^Français$/.test(node) && path !== 'ui.otherLang' && path !== 'chip.otherLang') frArabic.push(path); }
    else if (Array.isArray(node)) node.forEach((x, i) => walkFr(x, `${path}[${i}]`));
    else if (typeof node === 'function') walkFr((node as (...a: unknown[]) => unknown)(...(sampleArgs[path] ?? ['Ali', 5, true])), `${path}()`);
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walkFr(v, path ? `${path}.${k}` : k);
  };
  const frSample: Record<string, unknown[]> = {
    welcome: ['Ali'], teaser: ['Ali'], nice: ['Ali'], 'card.only': [3], 'chip.withCategory': ['Parfum'], promoIntro: [50], foundFor: ['parfum', 'à moins de 10 000 FCFA'], fallbackFor: ['parfum', 'à moins de 10 000 FCFA'],
    nothingFor: ['parfum'], askWho: [true], askType: ['lui', true], giftIntro: ['lui'], pairIntro: ['Parfum'], rangeText: [{ min: 0, max: 10000 }], lowStock: ['Montre', 3], pitch: ['Montre', '10 000 FCFA', 3],
    cartReminder: [2, 25000], priceReply: [50], trust: ['Marché Central', '+235 60 60 51 51'], whyAdvice: ['Montre', ['raison']], 'why.discount': [50, 12500, 25000], 'why.lowStock': [3],
    'why.colors': ['noir'], 'why.sizes': ['40'], cityNotFound: ['Sarh'], cityFee: ['Moundou', '2 500 FCFA', null], cityNoFee: ['Moundou', null], serviceNote: [true], 'contact.hours': ['8h'],
    budgetBest: ['à moins de 10 000 FCFA'], budgetFallback: ['à moins de 10 000 FCFA'],
  };
  for (const k of Object.keys(sampleArgs)) delete sampleArgs[k];
  Object.assign(sampleArgs, frSample);
  walkFr(tx.texts('fr'), '');
  ok(`aucune lettre arabe dans les ${frCount} textes francais (sauf le bouton de langue)`, frArabic.length === 0, frArabic);
  ok('chaque texte arabe contient bien de l\'arabe (sauf chiffres et noms)', (() => { const bad: string[] = []; const w = (node: unknown, path: string) => { if (typeof node === 'string') { if (node.length > 6 && !l.hasArabic(node)) bad.push(path); } else if (Array.isArray(node)) node.forEach((x, i) => w(x, `${path}[${i}]`)); else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (typeof v !== 'function') w(v, path ? `${path}.${k}` : k); }; w(tx.texts('ar'), ''); return bad.length === 0 ? true : bad; })());
  ok('textes importants : le francais et l\'arabe disent la meme chose (chiffres identiques)', ['info', 'rules', 'howToOrder', 'wrapReply', 'returns'].every((k) => { const nums = (s: string) => (s.replace(/[\s  ]/g, '').match(/\d+/g) ?? []).filter((n) => n !== '00').sort().join(','); const f = nums((tx.texts('fr') as any)[k]); const a = nums((tx.texts('ar') as any)[k]); return f === a; }), ['info', 'rules', 'howToOrder', 'wrapReply', 'returns'].map((k) => [k, (tx.texts('fr') as any)[k].replace(/[\s  ]/g, '').match(/\d+/g)?.sort().join(','), (tx.texts('ar') as any)[k].replace(/[\s  ]/g, '').match(/\d+/g)?.sort().join(',')]));

  console.log('\n' + (failures === 0 ? 'TOUT EST BON' : `${failures} ECHEC(S)`));
  process.exit(failures === 0 ? 0 : 1);
}
main();
