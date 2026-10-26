// Zara SEO : règles des descriptions (supabase/functions/zara-seo/rules.ts) et logique de l'écran (src/lib/zaraSeo.ts). Aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/seo/zara-seo.test.ts
import * as rules from '../../supabase/functions/zara-seo/rules.ts';
import { descriptionLevel, pickWeak, seoOverview, WEAK_MIN_LEN, BATCH_SIZE, type SeoRow } from '../../src/lib/zaraSeoCore.ts';

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

const GOOD = 'Montre homme au cadran blanc texturé et bracelet noir souple. Un modèle sobre et élégant, facile à porter au quotidien.';

// --- la même limite côté écran et côté serveur ---
check('seuil « trop courte » identique (écran = fonction serveur)', WEAK_MIN_LEN === rules.MIN_LEN, { app: WEAK_MIN_LEN, serveur: rules.MIN_LEN });

// --- checkDescription ---
check('une bonne description est acceptée', rules.checkDescription(GOOD, { name: 'Montre KEEP MOVING' }).ok, rules.checkDescription(GOOD));
const bad = (label: string, text: string, problem: string) => {
  const r = rules.checkDescription(text, { name: 'Montre KEEP MOVING' });
  check(label, !r.ok && r.problems.some((p) => p.includes(problem)), r);
};
bad('trop courte refusée', 'Une montre.', 'trop courte');
bad('trop longue refusée', GOOD + ' ' + 'Encore du texte utile pour l\'acheteur. '.repeat(10), 'trop longue');
bad('un prix en FCFA est refusé', GOOD + ' Prix : 15 000 FCFA.', 'prix');
bad('le mot « prix » est refusé', GOOD + ' Un très bon prix pour cette montre.', 'prix');
bad('un montant en euros est refusé', GOOD + ' Vendue 25 €.', 'prix');
bad('promotion refusée', GOOD + ' En promotion cette semaine seulement.', 'promotion');
bad('solde refusé', GOOD + ' Vendue en solde.', 'promotion');
bad('remise refusée', GOOD + ' Avec une remise exceptionnelle.', 'promotion');
bad('livraison refusée (le site l\'affiche déjà)', GOOD + ' Livraison rapide à N\'Djamena.', 'livraison');
bad('stock refusé', GOOD + ' Dernières pièces en stock.', 'stock');
bad('« original » refusé', GOOD + ' Un design original et unique en son genre.', 'affirmation');
bad('« authentique » refusé', GOOD + ' Montre authentique de grande qualité.', 'affirmation');
bad('« garanti » refusé', GOOD + ' Qualité garantie pendant deux ans.', 'affirmation');
bad('« meilleur » refusé', GOOD + ' La meilleure montre de sa catégorie.', 'superlatif');
bad('« gratuit » refusé', GOOD + ' Emballage gratuit offert.', 'gratuit');
bad('pourcentage refusé', GOOD + ' Réduction de 30 % aujourd\'hui.', 'pourcentage');
bad('avis refusé', GOOD + ' Adoptée par des clients satisfaits.', 'avis');
bad('émoji refusé', GOOD + ' ⌚🔥', 'émoji');
bad('balises refusées', GOOD + ' <b>Super</b>', 'balises');
bad('symboles markdown refusés', GOOD + ' **Très** belle.', 'symboles');
bad('identique au nom refusé', 'Montre KEEP MOVING', 'identique');
check('« originale » dans « originaire » n\'est pas confondu : mot entier seulement', rules.checkDescription(GOOD.replace('sobre', 'sobre, originaire d\'un style classique'), { name: 'X' }).ok);
check('des chiffres utiles restent permis (pointures, ml)', rules.checkDescription('Parfum pour homme en flacon de 100 ml, présenté dans un coffret noir et doré. Une senteur fraîche et facile à porter chaque jour.', { name: 'X' }).ok);
check('plusieurs problèmes sont tous listés', rules.checkDescription('Prix 5000 FCFA, original, livraison gratuite', { name: 'X' }).problems.length >= 4);

// --- tidy ---
check('tidy : une ligne, point final ajouté, guillemets retirés', rules.tidy('  « Une belle montre\n  noire »  ') === 'Une belle montre noire.');
check('tidy : un point final existant est gardé', rules.tidy('Très belle montre!') === 'Très belle montre!');

// --- parseModelReply ---
check('JSON propre lu', rules.parseModelReply('{"description": "Bonjour."}') === 'Bonjour.');
check('JSON entouré de ``` lu', rules.parseModelReply('```json\n{"description": "Bonjour."}\n```') === 'Bonjour.');
check('texte avant et après le JSON lu', rules.parseModelReply('Voici : {"description": "Bonjour."} Merci.') === 'Bonjour.');
check('réponse sans JSON : null', rules.parseModelReply('Je ne peux pas.') === null);
check('JSON cassé : null', rules.parseModelReply('{"description": "Bonjour') === null);
check('JSON sans « description » : null', rules.parseModelReply('{"texte": "x"}') === null);
check('description qui n\'est pas un texte : null', rules.parseModelReply('{"description": 42}') === null);

// --- factsDescription (modèle sans invention) ---
const valid = (f: Parameters<typeof rules.factsDescription>[0]) => {
  const d = rules.factsDescription(f);
  const c = rules.checkDescription(d, f);
  return { d, c };
};
{
  const { d, c } = valid({ name: '110 Degrees Emper pour homme', category: 'Parfum' });
  check('modèle : nom + catégorie + phrase de fin, valide', c.ok && d.startsWith('110 Degrees Emper pour homme – Parfum.') && d.endsWith('Albasse Shopping, boutique en ligne au Tchad.'), { d, c });
}
{
  const { d, c } = valid({ name: 'Chaussures homme slip-on sport', category: 'Chaussures', colors: ['Noir', 'Blanc'], sizes: ['40', '41', '42'] });
  check('modèle : la catégorie déjà dans le nom n\'est pas répétée', !d.includes('– Chaussures') && c.ok, d);
  check('modèle : couleurs et pointures (chaussures) écrites', d.includes('Couleurs disponibles : Noir, Blanc.') && d.includes('Pointures disponibles : 40, 41, 42.'), d);
}
{
  const { d } = valid({ name: 'Survêtement ZEGNA', category: 'Vêtements', colors: ['Gris'], sizes: ['M', 'L', 'XL'] });
  check('modèle : une seule couleur au singulier, tailles pour un vêtement', d.includes('Couleur : Gris.') && d.includes('Tailles disponibles : M, L, XL.'), d);
}
{
  const { d, c } = valid({ name: 'Sandal MS =1106', category: null });
  check('modèle : nom très court, reste valide (60 caractères au moins)', c.ok && d.length >= rules.MIN_LEN, { d, c });
}
{
  const { d, c } = valid({ name: 'Article <b>piège</b> {x} #1', category: 'Test *' });
  check('modèle : les symboles interdits sont retirés du nom', !/[<>{}#*]/.test(d) && c.ok, { d, c });
}
{
  const many = Array.from({ length: 40 }, (_, i) => String(30 + i));
  const { d, c } = valid({ name: 'Chaussures', colors: [], sizes: many });
  check('modèle : liste de tailles très longue coupée, description toujours valide', d.length <= rules.MAX_LEN && c.ok, { n: d.length, c });
}
check('modèle : aucune invention (jamais de marque, matière, prix…)', !/(cuir|coton|marque|prix|fcfa|original)/i.test(rules.factsDescription({ name: 'Ceinture homme', category: 'Accessoires' })));

// --- userText ---
{
  const t = rules.userText({ name: 'Montre', category: 'Montres', colors: ['Noir'], sizes: [], description: '' });
  check('texte envoyé au modèle : faits connus et « aucune » description', t.includes('Nom : Montre') && t.includes('Catégorie : Montres') && t.includes('Couleurs : Noir') && t.includes('Description actuelle : (aucune)') && !t.includes('Tailles'), t);
}

// --- proposeDescription : IA, repli, nouvel essai sans photo ---
(async () => {
  const facts = { name: 'Montre KEEP MOVING', category: 'Montres', colors: ['Blanc'], sizes: [], description: '' };
  const photo = 'https://img.example/a.jpg';
  const calls: (string | null)[] = [];
  const reply = (text: string) => async (_t: string, img: string | null) => {
    calls.push(img);
    return JSON.stringify({ description: text });
  };

  {
    calls.length = 0;
    const p = await rules.proposeDescription(facts, photo, reply(GOOD));
    check('IA : bonne réponse gardée (source « ia »)', p.source === 'ia' && p.description === GOOD && p.problems.length === 0, p);
    check('IA : la photo est envoyée au modèle', calls.length === 1 && calls[0] === photo, calls);
  }
  {
    const p = await rules.proposeDescription(facts, photo, reply('Montre blanche, prix : 11 000 FCFA, livraison gratuite, qualité originale garantie.'));
    check('IA : réponse avec prix/promesses refusée → modèle de faits', p.source === 'modele' && rules.checkDescription(p.description, facts).ok && p.problems.length >= 2, p);
  }
  {
    const p = await rules.proposeDescription(facts, photo, async () => 'Je suis désolée, je ne peux pas.');
    check('IA : réponse illisible → modèle de faits', p.source === 'modele' && p.problems[0] === 'réponse illisible', p);
  }
  {
    const p = await rules.proposeDescription(facts, photo, reply(GOOD.slice(0, -1)));
    check('IA : point final ajouté si le modèle l\'oublie', p.source === 'ia' && p.description.endsWith('.'), p);
  }
  {
    calls.length = 0;
    let first = true;
    const p = await rules.proposeDescription(facts, photo, async (_t, img) => {
      calls.push(img);
      if (first) {
        first = false;
        throw new Error('photo illisible');
      }
      return JSON.stringify({ description: GOOD });
    });
    check('photo refusée : nouvel essai avec les faits seuls, puis réponse gardée', p.source === 'ia' && calls.length === 2 && calls[0] === photo && calls[1] === null, { p, calls });
  }
  {
    const p = await rules.proposeDescription(facts, photo, async () => {
      throw new Error('panne');
    });
    check('IA en panne (2 essais) → modèle de faits', p.source === 'modele' && p.problems[0] === 'IA en erreur', p);
  }
  {
    calls.length = 0;
    const p = await rules.proposeDescription(facts, null, async (_t, img) => {
      calls.push(img);
      throw new Error('panne');
    });
    check('sans photo : un seul essai, puis modèle', calls.length === 1 && p.source === 'modele', { calls, p });
  }
  {
    const p = await rules.proposeDescription(facts, photo, null);
    check('sans clé d\'IA : modèle de faits, jamais d\'erreur', p.source === 'modele' && rules.checkDescription(p.description, facts).ok && p.problems[0] === 'IA indisponible', p);
  }

  // --- écran : niveaux, bilan, choix ---
  check('niveaux : aucune / courte / correcte', descriptionLevel(null) === 'none' && descriptionLevel('  ') === 'none' && descriptionLevel('Courte') === 'short' && descriptionLevel('x'.repeat(59)) === 'short' && descriptionLevel('x'.repeat(60)) === 'ok');

  const row = (id: string, name: string, description: string | null, extra: Partial<SeoRow> = {}): SeoRow => ({ id, name, slug: id, description, stock: 5, is_active: true, images: null, created_at: '2026-10-01T00:00:00Z', ...extra });
  const rows: SeoRow[] = [
    row('1', 'Montre  KEEP MOVING', null),
    row('2', 'montre keep moving', 'Courte'),
    row('3', 'Éau Fraîche', GOOD),
    row('4', 'Eau fraiche', GOOD),
    row('5', 'Sandale', '', { stock: 0 }),
    row('6', 'Ceinture', 'Courte', { created_at: '2026-10-20T00:00:00Z' }),
    row('7', 'Désactivé', null, { is_active: false }),
    row('8', 'Déjà par Zara', 'Description écrite par Zara pour cet article, claire et utile.', { description_zara_at: '2026-10-25T00:00:00Z' }),
    row('9', 'Lunettes', null, { created_at: '2026-10-22T00:00:00Z' }),
  ];
  const o = seoOverview(rows);
  check('bilan : articles en vente (les désactivés ne comptent pas)', o.active === 8, o);
  check('bilan : sans description / trop courtes / correctes', o.none === 3 && o.short === 2 && o.ok === 3, o);
  check('bilan : descriptions déjà écrites par Zara', o.doneByZara === 1);
  check('bilan : noms en double (majuscules, accents et espaces ignorés)', o.duplicates.length === 2 && o.duplicates.some((d) => d.count === 2) && o.duplicates.map((d) => d.name).join('|').includes('Montre KEEP MOVING'), o.duplicates);

  const picks = pickWeak(rows, BATCH_SIZE);
  check('choix : jamais un article désactivé, jamais un article déjà fait par Zara, jamais une fiche correcte', picks.every((p) => p.is_active && !p.description_zara_at && descriptionLevel(p.description) !== 'ok') && !picks.some((p) => ['7', '8', '3', '4'].includes(p.id)), picks.map((p) => p.id));
  check('choix : sans description et en stock d\'abord (le plus récent en tête)', picks.slice(0, 2).map((p) => p.id).join() === '9,1', picks.map((p) => p.id));
  check('choix : les « sans description » passent avant les « trop courtes » (en stock avant épuisé dans chaque groupe)', picks.map((p) => p.id).join() === '9,1,5,6,2', picks.map((p) => p.id));
  check('choix : la limite est respectée', pickWeak(rows, 2).length === 2);
  check('choix : les fiches déjà proposées dans la séance sont sautées', pickWeak(rows, 8, new Set(['9', '1'])).map((p) => p.id).join() === '5,6,2');

  console.log(`\n${ok} vérifications réussies${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
})();
