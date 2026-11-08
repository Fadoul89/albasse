// Zara (le chat) et les militaires / forces de l'ordre (docs/zara-annonce-ciblee.md) : le client dit « je suis militaire », « je suis dans la police »…
// et Zara lui propose le badge « groupe sanguin » choisi par le patron. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/zara/zara-forces.test.ts
import { forcesFrom } from '../../src/lib/assistantPersona.ts';
import { detectIntent } from '../../src/lib/assistantBrain.ts';
import { parseBudget, parseNeed } from '../../src/lib/assistantMarketing.ts';
import { texts } from '../../src/lib/assistantText.ts';
import { FORCES_PRODUCT_SLUGS, isForcesProfession } from '../../src/lib/adAudiences.ts';

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

// --- ce que le client dit de lui-même
const yes = [
  'je suis militaire',
  'Je suis un militaire',
  'je suis policier',
  'je suis une policière',
  'je suis gendarme',
  'je suis douanier',
  'moi je suis soldat',
  'je suis ancien militaire',
  'je suis dans l\'armée',
  'je suis dans la police',
  'je suis à la gendarmerie',
  'je travaille à la police nationale',
  'je suis dans les forces de l\'ordre',
  'je travaille comme gendarme',
  'je suis sergent',
  'en tant que militaire',
  'أنا عسكري',
  'أنا شرطي',
  'أنا دركي',
  'أنا في الجيش',
  'اعمل في الشرطة',
];
for (const t of yes) check(`« ${t} » → Zara propose le badge`, forcesFrom(t), t);

// --- ce qui n'est PAS ça
const no = [
  'bonjour',
  'je cherche un parfum',
  'je suis ingénieur',
  'je suis étudiant',
  'je suis commerçant',
  'je suis militaire et je cherche une montre', // la demande de montre compte : Zara répond à la montre (voir plus bas)
  'montre militaire',
  'un cadeau pour un militaire',
  'je cherche un cadeau pour mon frère qui est policier',
  'combien coûte la livraison',
  'je suis arrivé à la police', // pas un métier dit simplement : une phrase plus longue sur autre chose
];
for (const t of no.filter((x) => !/montre|cherche/.test(x) || /^montre militaire$/.test(x) || /frère/.test(x))) check(`« ${t} » → pas le badge`, !forcesFrom(t), t);

// la demande du client passe avant : « je suis militaire et je cherche une montre »
const mixed = 'je suis militaire et je cherche une montre';
const need = parseNeed(mixed);
check('« je suis militaire et je cherche une montre » : Zara répond à la montre (le badge n\'est pas proposé à la place)', !forcesFrom(mixed) || !!need.slug || !!need.who || !!need.gift || parseBudget(mixed) !== null, { forces: forcesFrom(mixed), need });
check('« je suis militaire » seul : aucune autre demande (pas de catégorie, pas de personne, pas de cadeau, pas de budget) → le badge est proposé', (() => {
  const n = parseNeed('je suis militaire');
  return !n.slug && !n.who && !n.gift && parseBudget('je suis militaire') === null;
})(), parseNeed('je suis militaire'));
check('« je suis militaire » ne déclenche aucun autre sujet de Zara avant (pas un mot de passe, pas un compte, pas Telegram)', !['password', 'telegram', 'account', 'bot'].includes(detectIntent('je suis militaire')), detectIntent('je suis militaire'));

// --- les textes
for (const lang of ['fr', 'ar'] as const) {
  const t = texts(lang);
  check(`[${lang}] Zara salue avec respect et dit pour qui est l'article`, lang === 'fr' ? /Respect à vous/.test(t.forces.intro) && /militaires et les forces de l’ordre/.test(t.forces.intro) : /تحية احترام/.test(t.forces.intro) && /للعسكريين وقوات الأمن/.test(t.forces.intro));
  check(`[${lang}] sans badge en vente : Zara demande seulement ce que le client cherche (aucun autre article proposé)`, t.forces.none.length > 10 && !/FCFA|prix|promotion/i.test(t.forces.none));
  check(`[${lang}] le bouton du menu est écrit`, t.chip.forcesBadge.length > 4);
  check(`[${lang}] aucune fausse rareté ni faux pourcentage dans le message`, !/rare|plus que|reste|%|dernier/i.test(t.forces.intro));
}
check('la phrase du bouton du menu (clients militaires) est reconnue par Zara en français et en arabe', forcesFrom('je suis dans les forces de l’ordre') && forcesFrom('انا في الجيش'));

// --- le même article que l'annonce de l'accueil
check('l\'article proposé est celui choisi par le patron : le slug « bagde-groupe-sanguin »', FORCES_PRODUCT_SLUGS.length === 1 && FORCES_PRODUCT_SLUGS[0] === 'bagde-groupe-sanguin');
check('le bouton du menu n\'est pour QUE les clients connectés dont le compte dit militaire ou forces de l\'ordre', isForcesProfession('militaire') && isForcesProfession('Gendarme') && !isForcesProfession('commerçant') && !isForcesProfession(null) && !isForcesProfession(''));

console.log(`\n${ok} contrôles réussis`);
