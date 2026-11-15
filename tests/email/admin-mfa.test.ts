// Double vérification des administrateurs (src/lib/adminMfa.ts) + garde-fous : chaque fonction serveur réservée aux admins passe par is_admin()
// (la règle de la base, add-admin-mfa.sql) ; la page et l'écran du code sont branchés ; les clients ne sont jamais concernés.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MFA_TEXT, cleanCode, groupSecret, isCompleteCode, mfaErrorText, needsCode, qrDataUrl, unfinishedTotp, verifiedTotp } from '../../src/lib/adminMfa.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

// --- le code ---
check('cleanCode : garde 6 chiffres (espaces, tirets, lettres retirés)', cleanCode(' 482 913 ') === '482913' && cleanCode('48-29-13') === '482913' && cleanCode('12345678') === '123456' && cleanCode('ab1') === '1' && cleanCode(null) === '' && cleanCode(undefined) === '');
check('isCompleteCode : exactement 6 chiffres', isCompleteCode('000000') && isCompleteCode('482913') && !isCompleteCode('48291') && !isCompleteCode('4829133') && !isCompleteCode('48291a'));

// --- quand demander le code ---
check('admin, double vérification activée, code pas encore tapé (aal1 -> aal2) : code demandé', needsCode(true, { currentLevel: 'aal1', nextLevel: 'aal2' }) === true);
check('admin, code déjà tapé (aal2) : rien à demander', needsCode(true, { currentLevel: 'aal2', nextLevel: 'aal2' }) === false);
check('admin sans double vérification (aal1 -> aal1) : rien à demander', needsCode(true, { currentLevel: 'aal1', nextLevel: 'aal1' }) === false);
check('client : JAMAIS de code, même si Supabase disait aal2', needsCode(false, { currentLevel: 'aal1', nextLevel: 'aal2' }) === false && needsCode(undefined, { currentLevel: 'aal1', nextLevel: 'aal2' }) === false);
check('pas de réponse de Supabase : on ne bloque pas l\'écran (la base protège quand même)', needsCode(true, null) === false);

// --- les facteurs ---
const factors = [
  { id: 'a', factor_type: 'totp', status: 'unverified' },
  { id: 'b', factor_type: 'totp', status: 'verified' },
  { id: 'c', factor_type: 'phone', status: 'verified' },
  { id: 'd', factor_type: 'totp', status: 'unverified' },
];
check('verifiedTotp : le téléphone activé (TOTP vérifié), pas un autre type', verifiedTotp(factors)?.id === 'b' && verifiedTotp([{ id: 'c', factor_type: 'phone', status: 'verified' }]) === null && verifiedTotp(null) === null);
check('unfinishedTotp : les mises en route pas terminées, à retirer', unfinishedTotp(factors).map((f) => f.id).join(',') === 'a,d' && unfinishedTotp(undefined).length === 0);
check('groupSecret : par groupes de 4', groupSecret('KJ4EWQ7SABCD12') === 'KJ4E WQ7S ABCD 12' && groupSecret('') === '' && groupSecret(' KJ4E WQ7S ') === 'KJ4E WQ7S');

// --- le QR code ---
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M0 0h1v1H0z"/></svg>';
const fromLib = qrDataUrl('data:image/svg+xml;utf-8,' + svg)!;
check('QR : le dessin collé par supabase-js est ré-encodé (le « # » ne coupe plus l\'adresse)', fromLib.startsWith('data:image/svg+xml;charset=utf-8,%3Csvg') && !fromLib.includes('#') && decodeURIComponent(fromLib.split(',')[1]) === svg, fromLib.slice(0, 80));
check('QR : SVG brut, déjà encodé, base64, vide', qrDataUrl(svg) === fromLib && qrDataUrl('data:image/svg+xml;utf-8,' + encodeURIComponent(svg)) === fromLib && qrDataUrl('data:image/png;base64,AAAA') === 'data:image/png;base64,AAAA' && qrDataUrl('') === null && qrDataUrl(null) === null);

// --- messages ---
check('erreur « code invalide » -> message clair (30 secondes)', /Code incorrect/.test(mfaErrorText('Invalid TOTP code entered')) && /30 secondes/.test(mfaErrorText('invalid code')));
check('erreur « trop d\'essais » -> attendre', /Trop d’essais/.test(mfaErrorText('Too many requests')) && /Trop d’essais/.test(mfaErrorText('rate limit exceeded')));
check('erreur « expiré », « réseau », inconnue', /expiré/.test(mfaErrorText('challenge expired')) && /internet/.test(mfaErrorText('Failed to fetch')) && /Réessayez/.test(mfaErrorText('xyz')) && /Réessayez/.test(mfaErrorText(undefined)));
check('textes : Google Authenticator, 6 chiffres, 30 secondes, téléphone perdu', /Google Authenticator/.test(MFA_TEXT.gateBody) && /6 chiffres/.test(MFA_TEXT.gateBody) && /30 secondes/.test(MFA_TEXT.intro) && /Supabase/.test(MFA_TEXT.lostPhoneHelp) && /clients/i.test(MFA_TEXT.activeHelp));

// --- garde-fou : toute fonction serveur qui vérifie un admin par jeton passe aussi par la base (is_admin) ---
const root = new URL('../../', import.meta.url).pathname;
const fnDir = join(root, 'supabase/functions');
const adminByJwt: string[] = [];
const missing: string[] = [];
for (const name of readdirSync(fnDir)) {
  const file = join(fnDir, name, 'index.ts');
  if (!existsSync(file)) continue;
  const src = readFileSync(file, 'utf8');
  // vérifie l'admin d'un utilisateur connecté (jeton) en lisant profiles.is_admin
  if (/getUser\(/.test(src) && /select\(\s*["'`][^"'`]*is_admin/.test(src)) {
    adminByJwt.push(name);
    if (!/async function adminAllowed\(/.test(src) || !/rpc\("is_admin"\)/.test(src) || (src.match(/adminAllowed\(/g) ?? []).length < 2) missing.push(name);
  }
}
check(`fonctions serveur admin (jeton) : toutes passent par is_admin() de la base (${adminByJwt.join(', ')})`, adminByJwt.length >= 7 && missing.length === 0, { adminByJwt, missing });

// --- la règle de la base ---
const sql = readFileSync(join(root, 'add-admin-mfa.sql'), 'utf8');
check('add-admin-mfa.sql : aal2 exigé seulement si un facteur VÉRIFIÉ existe, security definer, search_path fixe', /auth\.jwt\(\)\s*->>\s*'aal'/.test(sql) && /'aal2'/.test(sql) && /auth\.mfa_factors/.test(sql) && /status = 'verified'/.test(sql) && /security definer/.test(sql) && /set search_path = public/.test(sql));

// --- branchements dans le site ---
const nav = readFileSync(join(root, 'src/navigation/RootNavigator.tsx'), 'utf8');
check('navigation : page admin/securite + écran du code seulement pour un admin connecté', /AdminSecurity: 'admin\/securite'/.test(nav) && /const mfaGate = isAuthenticated && isAdmin && mfaStatus === 'code';/.test(nav) && /\{mfaGate && <AdminMfaGate \/>\}/.test(nav) && /!signUpFirst && !SINGLE && !mfaGate/.test(nav));
const menu = readFileSync(join(root, 'src/constants/adminMenu.ts'), 'utf8');
check('menu admin : « Double vérification » dans Paramètres', /label: 'Double vérification', route: 'AdminSecurity'/.test(menu));
const store = readFileSync(join(root, 'src/store/mfaStore.ts'), 'utf8');
check('le code est vérifié par Supabase (challengeAndVerify), jamais par le site', /challengeAndVerify/.test(store) && !/totp\.secret|otpauth/.test(store));

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
