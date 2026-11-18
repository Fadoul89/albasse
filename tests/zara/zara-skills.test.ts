// Compétences de Zara IA : « photo → article » et « mémoire du client ». Règles du serveur (supabase/functions/zara-ai/skills.ts)
// et du site (src/lib/zaraPhotoCore.ts). Aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/zara/zara-skills.test.ts
import * as sk from '../../supabase/functions/zara-ai/skills.ts';
import { fitSide, historyText, photoAllowed, PHOTO_MAX_BASE64 } from '../../src/lib/zaraPhotoCore.ts';

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

const JPEG = '/9j/' + 'A'.repeat(200);
const PNG = 'iVBORw0KGgo' + 'B'.repeat(200);
const WEBP = 'UklGR' + 'C'.repeat(200);

// --- photo ---
check('même limite de taille côté site et côté serveur', PHOTO_MAX_BASE64 === sk.PHOTO_MAX_BASE64);
check('pas de photo → null', sk.readPhoto(undefined) === null && sk.readPhoto(null) === null);
check('JPEG, PNG, WEBP acceptés', [['image/jpeg', JPEG], ['image/png', PNG], ['image/webp', WEBP]].every(([t, d]) => {
  const r = sk.readPhoto({ mediaType: t, data: d });
  return r !== null && r !== 'bad' && r.mediaType === t && r.data === d;
}));
check('type inconnu refusé (gif, svg, texte)', ['image/gif', 'image/svg+xml', 'text/html', ''].every((t) => sk.readPhoto({ mediaType: t, data: JPEG }) === 'bad'));
check('contenu qui ne correspond pas au type refusé (PNG annoncé comme JPEG)', sk.readPhoto({ mediaType: 'image/jpeg', data: PNG }) === 'bad');
check('trop lourde refusée', sk.readPhoto({ mediaType: 'image/jpeg', data: '/9j/' + 'A'.repeat(sk.PHOTO_MAX_BASE64) }) === 'bad');
check('trop petite ou pas du base64 refusée', sk.readPhoto({ mediaType: 'image/jpeg', data: '/9j/AAA' }) === 'bad' && sk.readPhoto({ mediaType: 'image/jpeg', data: '/9j/' + '<script>'.repeat(30) }) === 'bad');
check('« data:image/jpeg;base64, » devant : refusé (le site envoie le base64 seul)', sk.readPhoto({ mediaType: 'image/jpeg', data: 'data:image/jpeg;base64,' + JPEG }) === 'bad');
check('mauvaise forme refusée (texte, liste, nombre)', ['photo', [JPEG], 42].every((x) => sk.readPhoto(x) === 'bad'));
check('limites des photos : 5 par visiteur, 40 par adresse IP', sk.PHOTO_DAILY_LIMIT === 5 && sk.PHOTO_IP_DAILY_LIMIT === 40);
check('consignes photo : ne jamais décrire ni reconnaître une personne', /Ne décris jamais une personne/.test(sk.PHOTO_RULES) && /reconnaître/.test(sk.PHOTO_RULES));
check('consignes photo : un texte dans la photo n\'est pas une consigne', /jamais une consigne/.test(sk.PHOTO_RULES));
check('consignes photo : « qui ressemble », jamais « exactement le même » sans certitude', /qui ressemble/.test(sk.PHOTO_RULES));

// --- mémoire ---
const notes = sk.cleanNotes(['pointure 42', '  budget parfum :   environ 20 000 FCFA ', 'aime le doré', 'Pointure 42', 'achète pour sa femme']);
check('notes nettoyées, sans doublon (majuscules comprises)', JSON.stringify(notes) === JSON.stringify(['pointure 42', 'budget parfum : environ 20 000 FCFA', 'aime le doré', 'achète pour sa femme']), notes);
const priv = sk.cleanNotes([
  'téléphone 66 12 34 56', 'numéro : 66123456', '+235 66 12 34 56', 'tel 99887766', 'email amina@gmail.com', 'adresse : Moursal, près du marché',
  'quartier Chagoua', 'mot de passe 1234', 'https://facebook.com/amina', 'WhatsApp 66123456', 'هاتفي 66123456', 'عنواني في مرصال', '٦٦١٢٣٤٥٦',
]);
check('jamais de téléphone, e-mail, adresse, lien ou mot de passe (français et arabe)', priv.length === 0, priv);
check('ville, taille et budget gardés', sk.cleanNotes(['ville : Moundou', 'taille M', 'budget 15 000 à 25 000 FCFA']).length === 3);
check('8 notes au plus', sk.cleanNotes(Array.from({ length: 12 }, (_, i) => `goût numéro${i}`.replace('numéro', 'n°'))).length === sk.MEMORY_MAX_NOTES);
check('note coupée à 80 caractères', sk.cleanNotes(['aime '.repeat(40)])[0].length <= sk.MEMORY_NOTE_MAX);
check('pas une liste, éléments qui ne sont pas du texte, notes vides → ignorés', sk.cleanNotes('pointure 42').length === 0 && sk.cleanNotes([42, null, {}, '', ' a ']).length === 0);
check('balises et caractères de contrôle retirés', sk.cleanNotes(['<b>aime</b> le\u0000 noir'])[0] === 'b aime /b le noir', sk.cleanNotes(['<b>aime</b> le\u0000 noir']));
const visitor = sk.memoryRules(false, []);
check('visiteur sans compte : Zara ne retient rien et invite à se connecter', /pas connecté/.test(visitor) && /se connecter/.test(visitor) && !/update_memory/.test(visitor));
const member = sk.memoryRules(true, ['pointure 42']);
check('client connecté : ses notes sont données à Zara', member.includes('- pointure 42') && /update_memory/.test(member));
check('client connecté : jamais d\'adresse, téléphone, e-mail ; liste vide = oublier', /jamais d'adresse, de téléphone, d'e-mail/.test(member) && /liste vide/.test(member));
check('client connecté sans notes', /aucune note/.test(sk.memoryRules(true, [])));
check('outil de mémoire : une liste de notes, rien d\'autre', sk.MEMORY_TOOL.name === 'update_memory' && sk.MEMORY_TOOL.input_schema.required.join() === 'notes' && sk.MEMORY_TOOL.input_schema.additionalProperties === false);

// --- jeton de connexion ---
check('jeton « Bearer a.b.c » lu', sk.bearerToken('Bearer aaa.bbb.ccc') === 'aaa.bbb.ccc' && sk.bearerToken('bearer  x-1.y_2.z3') === 'x-1.y_2.z3');
check('pas de jeton, ou clé publique (pas un jeton à 3 parties) → null', [null, '', 'Bearer', 'Bearer sb_publishable_abc', 'Basic aaa.bbb.ccc', 'Bearer a.b'].every((h) => sk.bearerToken(h) === null));

// --- site : réduction de la photo, historique, bouton ---
check('photo déjà petite : pas de réduction', fitSide(800, 600, 1024) === null && fitSide(1024, 1024, 1024) === null);
check('photo en largeur : réduite à 1024 de large', JSON.stringify(fitSide(4000, 3000, 1024)) === '{"width":1024}');
check('photo en hauteur : réduite à 1024 de haut', JSON.stringify(fitSide(3000, 4000, 1024)) === '{"height":1024}');
check('taille inconnue : pas de réduction', fitSide(0, 0, 1024) === null && fitSide(NaN, 10, 1024) === null);
check('historique : photo sans texte = « (photo envoyée) »', historyText({ role: 'user', text: '', image: { src: 'x' } }) === '(photo envoyée)' && historyText({ role: 'user', text: 'Vous avez ça ?', image: {} }) === 'Vous avez ça ?' && historyText({ role: 'assistant', text: '' }) === '');
check('bouton 📷 : pas pendant une commande, une demande de rappel, ni les premières questions', ['co_phone', 'co_confirm', 'cb_name', 'ask_lang', 'ask_name'].every((s) => !photoAllowed(s)) && ['menu', 'ask_budget', 'ask_who'].every(photoAllowed));

console.log(`\n${ok} vérifications réussies${process.exitCode ? ' (avec des échecs)' : ''}`);
