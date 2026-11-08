// Gestion de compte côté équipe : règles de l'écran (src/lib/clientAccount.ts). Aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/client-account.test.ts
import { ACTION_LABEL, buildChanges, canDelete, deleteConfirmWord, editableFields, initialForm, isClosedEmail, loginLabel, logLine, parseInfo, reasonMessage, rpcErrorMessage, type AccountInfo } from '../../src/lib/clientAccount.ts';

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

// --- la réponse de la base
const info = parseInfo({ login_email: '23566123456@tel.albasseshopping.com', login_kind: 'phone', orders: 2, is_admin: false })!;
check('réponse de la base lue : numéro, 2 commandes', info.loginKind === 'phone' && info.orders === 2 && !info.isAdmin);
check('réponse invalide (null, texte, type inconnu, e-mail absent) : null', [null, undefined, 'x', {}, { login_kind: 'robot', login_email: 'a' }, { login_kind: 'phone' }].every((d) => parseInfo(d) === null));
check('nombre de commandes bizarre : 0', parseInfo({ login_email: 'a@b.cc', login_kind: 'email', orders: 'x' })!.orders === 0 && parseInfo({ login_email: 'a@b.cc', login_kind: 'email', orders: -4 })!.orders === 0);
check('compte fermé reconnu par son adresse', isClosedEmail('closed-000123@closed.albasseshopping.com') && !isClosedEmail('amina@gmail.com') && !isClosedEmail(null) && !isClosedEmail('23566123456@tel.albasseshopping.com'));
check('connexion écrite : numéro joli, e-mail, fermé', loginLabel(info) === 'Par numéro de téléphone (+235 66 12 34 56)' && loginLabel({ ...info, loginKind: 'email', loginEmail: 'amina@gmail.com' }) === 'Par e-mail (amina@gmail.com)' && /fermé/.test(loginLabel({ ...info, loginKind: 'closed' })));

// --- les champs
check('compte par numéro : nom, WhatsApp, e-mail de contact, ville, pays, adresse, profession (PAS le téléphone : c\'est la connexion)', editableFields('phone').join(',') === 'full_name,whatsapp_number,email,region,country,address,profession');
check('ancien compte : nom, téléphone, WhatsApp, ville, pays, adresse, profession (PAS l\'e-mail : c\'est la connexion)', editableFields('email').join(',') === 'full_name,phone,whatsapp_number,region,country,address,profession');
check('compte fermé : rien ne se modifie', editableFields('closed').length === 0);
const start = initialForm({ full_name: 'Éric', phone: '66 12 34 56', whatsapp_number: null, email: '23566123456@tel.albasseshopping.com', region: 'N\'Djamena', country: 'Tchad', address: null, profession: 'Chauffeur' });
check('formulaire de départ : l\'adresse tirée du numéro n\'est jamais montrée comme e-mail', start.email === '' && start.full_name === 'Éric' && start.address === '' && start.whatsapp_number === '');
check('formulaire de départ avec un vrai e-mail', initialForm({ email: 'eric@gmail.com' }).email === 'eric@gmail.com');

const ch = (patch: Partial<typeof start>, kind: 'phone' | 'email' | 'closed' = 'phone') => buildChanges(start, { ...start, ...patch }, kind);
check('rien changé : « Rien n\'a changé. »', ch({}).problem === 'Rien n’a changé.' && Object.keys(ch({}).changes).length === 0);
check('seuls les champs changés partent (ville)', JSON.stringify(ch({ region: ' Moundou ' }).changes) === JSON.stringify({ region: 'Moundou' }) && ch({ region: 'Moundou' }).problem === null);
check('plusieurs champs : tous ceux qui ont changé', Object.keys(ch({ full_name: 'Éric Moussa Ali', address: 'Farcha', profession: '' }).changes).join(',') === 'full_name,address,profession');
check('un champ vidé est envoyé vide (la base l\'efface)', ch({ profession: '' }).changes.profession === '' && ch({ profession: '' }).problem === null);
check('nom trop court ou vide : refusé', ch({ full_name: 'A' }).problem === 'Le nom doit avoir entre 2 et 80 caractères.' && ch({ full_name: '   ' }).problem === 'Le nom doit avoir entre 2 et 80 caractères.');
check('e-mail faux refusé, vrai accepté, vide accepté', ch({ email: 'pas un mail' }).problem === 'Cette adresse e-mail n’est pas valable.' && ch({ email: 'eric@gmail.com' }).problem === null && buildChanges({ ...start, email: 'a@b.cc' }, { ...start, email: '' }, 'phone').problem === null);
check('WhatsApp faux refusé, vrai accepté', /WhatsApp : ce numéro n’est pas valable/.test(ch({ whatsapp_number: 'abc' }).problem ?? '') && ch({ whatsapp_number: '+235 66 99 88 77' }).problem === null);
check('texte trop long refusé (adresse 201 caractères)', /Adresse : 200 caractères au plus/.test(ch({ address: 'x'.repeat(201) }).problem ?? ''));
check('le téléphone d\'un compte « numéro » n\'est jamais envoyé, même changé dans le formulaire', ch({ phone: '66 00 00 00' }).problem === 'Rien n’a changé.');
check('l\'e-mail d\'un ancien compte n\'est jamais envoyé, même changé', buildChanges({ ...start, email: 'amina@gmail.com' }, { ...start, email: 'autre@gmail.com' }, 'email').problem === 'Rien n’a changé.');
check('ancien compte : le téléphone de contact change', JSON.stringify(ch({ phone: '66 00 00 00' }, 'email').changes) === JSON.stringify({ phone: '66 00 00 00' }));
check('compte fermé : rien ne part', ch({ full_name: 'Autre nom' }, 'closed').problem === 'Rien n’a changé.');

// --- supprimer
const withOrders: AccountInfo = { ...info, orders: 3 };
check('supprimer : refusé avec des commandes, avec la raison (au pluriel)', !canDelete(withOrders).ok && /3 commandes/.test(canDelete(withOrders).why ?? '') && /fermez le compte/.test(canDelete(withOrders).why ?? ''));
check('supprimer : une seule commande (singulier)', /1 commande :/.test(canDelete({ ...info, orders: 1 }).why ?? ''));
check('supprimer : permis sans commande', canDelete({ ...info, orders: 0 }).ok && canDelete({ ...info, orders: 0 }).why === null);
check('supprimer : jamais un compte administrateur', !canDelete({ ...info, orders: 0, isAdmin: true }).ok);
check('mot à taper : AS-000123, sinon 8 caractères de l\'identifiant', deleteConfirmWord(123, 'bbbbbbbb-0000') === 'AS-000123' && deleteConfirmWord(undefined, 'bbbbbbbb-0000') === 'bbbbbbbb');

// --- les phrases
const all = ['bad_phone', 'bad_email', 'same_login', 'login_taken', 'closed', 'already_closed', 'is_admin', 'not_found', 'bad_confirm', 'has_orders', 'auth_error', 'forbidden', 'unauthenticated', 'bad_request', 'server_error', 'not_installed'];
check('chaque raison de la fonction a une phrase en français', all.every((r) => /[a-zé]/.test(reasonMessage(r)) && !/_/.test(reasonMessage(r))));
check('raison inconnue : phrase générale', reasonMessage('???') === 'Impossible pour le moment : réessayez dans un moment.');
check('base : script pas lancé, pas administrateur, client introuvable, autre message gardé',
  /add-client-account-admin\.sql n’est pas encore lancé/.test(rpcErrorMessage('Could not find the function public.admin_client_account_info(p_target) in the schema cache'))
  && rpcErrorMessage('Non autorise') === 'Seul un administrateur peut faire cela.' && rpcErrorMessage('Client introuvable') === 'Ce client est introuvable.' && rpcErrorMessage('Nom trop court') === 'Nom trop court');
check('journal : « ✏️ Fiche modifiée · fiche modifiée : nom, ville »', logLine('edit', 'fiche modifiée : nom, ville') === '✏️ Fiche modifiée · fiche modifiée : nom, ville' && logLine('close', '') === '🔒 Compte fermé' && Object.keys(ACTION_LABEL).length === 4);

console.log(`\n${ok} contrôles réussis`);
