// Retrouver son compte : règles du nouveau mot de passe, messages d'erreur, message WhatsApp avec le nouveau code. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/password-recovery.test.ts
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  adminResetError,
  changePasswordError,
  loginHow,
  passwordProblem,
  recoveryMessage,
  recoveryPhone,
} from '../../src/lib/passwordRecovery.ts';
import { generateTempPassword, isWeakCode } from '../../src/lib/guestAccount.ts';

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

// ---- le nouveau mot de passe choisi par le client
check('les limites sont 6 et 72 (celles de la base)', MIN_PASSWORD_LENGTH === 6 && MAX_PASSWORD_LENGTH === 72);
check('bon mot de passe, bien répété : aucun problème', passwordProblem('482915', '482915') === null);
check('5 caractères : trop court', /au moins 6/.test(passwordProblem('48291', '48291') ?? ''));
check('vide : trop court', /au moins 6/.test(passwordProblem('', '') ?? ''));
check('73 caractères : trop long', /trop long/.test(passwordProblem('a'.repeat(73), 'a'.repeat(73)) ?? ''));
check('72 caractères : accepté', passwordProblem('a'.repeat(72), 'a'.repeat(72)) === null);
check('deux saisies différentes : refusé', /ne correspondent pas/.test(passwordProblem('482915', '482916') ?? ''));
check('lettres, chiffres et signes : acceptés', passwordProblem('Amina@2026', 'Amina@2026') === null);
check('la longueur est contrôlée avant la répétition', /au moins 6/.test(passwordProblem('123', 'abc') ?? ''));

// ---- ce que répond Supabase quand le changement est refusé
check('même mot de passe : phrase simple', /déjà le vôtre/.test(changePasswordError('New password should be different from the old password.')));
check('connexion trop ancienne : on demande de se reconnecter', /reconnectez-vous/.test(changePasswordError('Password update requires reauthentication')));
check('session absente : on demande de se reconnecter', /reconnectez-vous/.test(changePasswordError('Auth session missing!')));
check('trop faible : phrase simple', /au moins 6/.test(changePasswordError('Password should be at least 6 characters.')));
check('autre message : tel quel', changePasswordError('Erreur réseau') === 'Erreur réseau');

// ---- ce que répond la base au bouton « Nouveau code » (administrateur)
check('script pas encore lancé : on dit lequel', /add-admin-reset-password\.sql/.test(adminResetError('Could not find the function public.admin_set_client_password(new_password, target_user_id) in the schema cache')));
check('pas administrateur', /administrateur/.test(adminResetError('Non autorise')));
check('client introuvable', /introuvable/.test(adminResetError('Client introuvable')));
check('compte administrateur', /ne se change pas ici/.test(adminResetError('Compte administrateur : non autorise ici')));
check('« Compte administrateur » n\'est pas pris pour un simple refus', !/Seul un administrateur peut/.test(adminResetError('Compte administrateur : non autorise ici')));
check('autre message : tel quel', adminResetError('boom') === 'boom');

// ---- comment le client doit se connecter
check('compte créé avec le numéro : « +235 66 12 34 56 »', JSON.stringify(loginHow('23566123456@tel.albasseshopping.com')) === JSON.stringify({ kind: 'phone', value: '+235 66 12 34 56' }), loginHow('23566123456@tel.albasseshopping.com'));
check('ancien compte : son e-mail', JSON.stringify(loginHow(' Amina@Gmail.com ')) === JSON.stringify({ kind: 'email', value: 'Amina@Gmail.com' }), loginHow(' Amina@Gmail.com '));

// ---- le message WhatsApp
const code = '730591';
const m1 = recoveryMessage({ firstName: 'Amina', loginEmail: '23566123456@tel.albasseshopping.com', code });
check('message : prénom, équipe, nouveau code', m1.startsWith("Bonjour Amina, ici l'équipe Albasse Shopping 😊") && m1.includes('Voici votre nouveau code : 730591'), m1);
check('message : dit de se connecter avec le NUMÉRO (pas une adresse fabriquée)', m1.includes('votre numéro +235 66 12 34 56') && !m1.includes('tel.albasseshopping.com'), m1);
check('message : le site et où changer le code', m1.includes('https://www.albasseshopping.com') && m1.includes('« Compte » › « Changer mon mot de passe »'), m1);
const m2 = recoveryMessage({ firstName: '  ', loginEmail: 'amina@gmail.com', code });
check('sans prénom : « Bonjour, » ; ancien compte : on dit l\'e-mail', m2.startsWith("Bonjour, ici l'équipe") && m2.includes('votre e-mail amina@gmail.com'), m2);
check('le code apparaît une seule fois dans le message', m1.split(code).length === 2, m1);

// ---- à qui écrire
check('numéro WhatsApp d\'abord', recoveryPhone({ whatsapp_number: '66 22 22 22', phone: '66111111' }) === '23566222222');
check('sinon le téléphone', recoveryPhone({ whatsapp_number: null, phone: '66111111' }) === '23566111111');
check('numéro WhatsApp invalide : on prend le téléphone', recoveryPhone({ whatsapp_number: '12', phone: '66111111' }) === '23566111111');
check('aucun numéro : rien', recoveryPhone({ whatsapp_number: null, phone: null }) === null);

// ---- le code tiré pour le client est toujours accepté par la base
let allGood = true;
for (let i = 0; i < 2000; i++) {
  const c = generateTempPassword();
  if (!/^\d{6}$/.test(c) || isWeakCode(c) || passwordProblem(c, c) !== null) allGood = false;
}
check('2000 codes tirés : 6 chiffres, jamais faciles, toujours acceptés par la règle', allGood);

console.log(`\n${ok} contrôles réussis`);
