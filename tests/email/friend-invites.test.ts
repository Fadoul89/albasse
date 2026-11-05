// Parrainage « Invite 5 amis, gagne un parfum » : code, lien, progression, textes, lecture de la base, message au gagnant. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/friend-invites.test.ts
import {
  INVITE_GOAL,
  adminStatusLabel,
  countingFriends,
  inviteCodeFromSearch,
  inviteLink,
  inviteShareText,
  inviterGreeting,
  normalizeInviteCode,
  parseOverview,
  parseProgress,
  progressView,
  rewardStatusLabel,
  statusIcon,
  storeInviteValue,
  storedInviteCode,
  whatsappShareUrl,
  winnerMessage,
} from '../../src/lib/friendInvites.ts';

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

// --- le code ----------------------------------------------------------------------------------------------------------------------------------
check('le but est 5 amis', INVITE_GOAL === 5);
check('code valable : 8 lettres et chiffres (sans I, L, O, 0, 1)', normalizeInviteCode('ABCD2345') === 'ABCD2345');
check('code écrit en minuscules, avec espaces ou tirets : remis en forme', normalizeInviteCode(' abcd-2345 ') === 'ABCD2345' && normalizeInviteCode('abcd 2345') === 'ABCD2345');
check('codes refusés : trop court, trop long, lettres interdites, vide, autre type', ['ABC', 'ABCD23456', 'ABCDEFG0', 'ABCDEFGI', 'ABCDEFGL', 'ABCDEFGO', '', null, undefined, 12345678, {}].every((c) => normalizeInviteCode(c) === null));

// --- le lien ----------------------------------------------------------------------------------------------------------------------------------
check('le lien : le site avec ?invite=CODE', inviteLink('ABCD2345') === 'https://www.albasseshopping.com/?invite=ABCD2345');
check('le lien : une adresse de site avec « / » à la fin ne double pas la barre', inviteLink('ABCD2345', 'https://exemple.td/') === 'https://exemple.td/?invite=ABCD2345');
check('lire le code dans l\'adresse : seul, avec d\'autres réglages, en minuscules', inviteCodeFromSearch('?invite=ABCD2345') === 'ABCD2345' && inviteCodeFromSearch('?utm_source=wa&invite=abcd2345&x=1') === 'ABCD2345' && inviteCodeFromSearch('invite=ABCD2345') === 'ABCD2345');
check('lire le code dans l\'adresse : rien, code faux, code coupé, mauvais caractères = rien', [inviteCodeFromSearch(''), inviteCodeFromSearch('?ref=ABCD2345'), inviteCodeFromSearch('?invite=ABC'), inviteCodeFromSearch('?invite=%E0%A4%A'), inviteCodeFromSearch('?invite='), inviteCodeFromSearch(null)].every((x) => x === null));
check('le code « ref » du programme d\'affiliation n\'est PAS pris pour une invitation', inviteCodeFromSearch('?ref=ABCD2345') === null);

// --- le code gardé sur le téléphone (30 jours) ---------------------------------------------------------------------------------------------
const NOW = Date.parse('2026-11-05T10:00:00Z');
const kept = storeInviteValue('ABCD2345', NOW);
check('code gardé 30 jours : relu le lendemain et le 29e jour', storedInviteCode(kept, NOW + 24 * 3600 * 1000) === 'ABCD2345' && storedInviteCode(kept, NOW + 29 * 24 * 3600 * 1000) === 'ABCD2345');
check('code gardé : oublié après 30 jours', storedInviteCode(kept, NOW + 31 * 24 * 3600 * 1000) === null);
check('code gardé : valeur absente, abîmée ou fausse = rien', [storedInviteCode(null, NOW), storedInviteCode('', NOW), storedInviteCode('pas du json', NOW), storedInviteCode('{"code":"ABC","expiresAt":9999999999999}', NOW), storedInviteCode('{"code":"ABCD2345"}', NOW)].every((x) => x === null));

// --- le message pour les amis ---------------------------------------------------------------------------------------------------------------------
const share = inviteShareText('ABCD2345');
check('message : contient le lien, dit de créer le compte puis d\'installer l\'application', share.includes('https://www.albasseshopping.com/?invite=ABCD2345') && /compte/.test(share) && /installe/.test(share));
check('message : ne promet rien à l\'ami (aucun cadeau, aucune réduction, aucun pourcentage)', !/gratuit|cadeau|offert|réduction|remise|%|gagn/i.test(share), share);
check('WhatsApp : lien de partage avec le texte encodé', whatsappShareUrl('a b') === 'https://wa.me/?text=a%20b');

// --- la progression -----------------------------------------------------------------------------------------------------------------------------
const v0 = progressView({ goal: 5, joined: 0, installed: 0 });
check('0 ami : la phrase de départ explique les 2 gestes et le parfum', /Invite 5 amis/.test(v0.headline) && /compte/.test(v0.headline) && /installent/.test(v0.headline) && /parfum gratuit/.test(v0.headline) && v0.barLabel === '0 / 5 amis');
const v3 = progressView({ goal: 5, joined: 5, installed: 3 });
check('3 amis installés sur 5 inscrits : « 3 / 5 », encore 2, 2 amis attendent d\'installer', v3.barLabel === '3 / 5 amis' && v3.toNext === 2 && v3.waitingInstall === 2 && /Encore 2 amis pour gagner un parfum gratuit/.test(v3.headline));
const v4 = progressView({ goal: 5, joined: 4, installed: 4 });
check('4 amis : « Encore 1 ami » (au singulier)', /Encore 1 ami pour/.test(v4.headline) && !/amis pour/.test(v4.headline));
const v5 = progressView({ goal: 5, joined: 5, installed: 5 });
check('5 amis : 1 parfum gagné, la barre repart à 0 / 5, encore 5 pour le suivant', v5.earned === 1 && v5.barLabel === '0 / 5 amis' && v5.toNext === 5 && /un autre parfum/.test(v5.headline));
const v12 = progressView({ goal: 5, joined: 13, installed: 12 });
check('12 amis : 2 parfums gagnés, 2 / 5 pour le 3e', v12.earned === 2 && v12.barLabel === '2 / 5 amis' && v12.toNext === 3 && v12.waitingInstall === 1);
check('un « but » absurde (0, absent) retombe sur 5', progressView({ goal: 0, joined: 6, installed: 6 }).earned === 1);

// --- lire ce que la base répond ----------------------------------------------------------------------------------------------------------------
const raw = {
  code: 'abcd2345',
  goal: 5,
  joined: '6',
  installed: 4,
  friends: [{ name: 'Fatimé', installed: true }, { name: '  ', installed: false }, { installed: true }, null, 'x'],
  rewards: [{ number: 1, status: 'a_valider' }, { number: 2, status: 'n_importe_quoi' }, { number: 3, status: 'remis' }],
};
const p = parseProgress(raw);
check('progression lue : code remis en forme, nombres, amis (nom vide = « Un ami »)', !!p && p.code === 'ABCD2345' && p.joined === 6 && p.installed === 4 && p.friends.length === 3 && p.friends[1].name === 'Un ami' && p.friends[0].installed && !p.friends[1].installed, p);
check('progression lue : un état de gain inconnu est ignoré', !!p && p.rewards.length === 2 && p.rewards[0].status === 'a_valider' && p.rewards[1].status === 'remis');
check('progression illisible = rien (pas de plantage)', parseProgress(null) === null && parseProgress('x') === null && parseProgress(undefined) === null && parseProgress(42) === null);
const empty = parseProgress({});
check('progression vide : tout à zéro, le but reste 5', !!empty && empty.code === null && empty.goal === 5 && empty.joined === 0 && empty.friends.length === 0 && empty.rewards.length === 0);

// --- les textes des gains ----------------------------------------------------------------------------------------------------------------------
check('gain à valider : « l\'équipe vérifie », jamais « remis »', /vérifie/.test(rewardStatusLabel('a_valider')) && !/remis/.test(rewardStatusLabel('a_valider')));
check('gain validé : l\'équipe écrit sur WhatsApp', /WhatsApp/.test(rewardStatusLabel('valide')));
check('gain remis / refusé : textes clairs', rewardStatusLabel('remis') === 'Parfum remis ✓' && /Non validé/.test(rewardStatusLabel('refuse')));
check('icônes : à valider ⏳, validé ✅, remis 🎁, refusé ⛔', statusIcon('a_valider') === '⏳' && statusIcon('valide') === '✅' && statusIcon('remis') === '🎁' && statusIcon('refuse') === '⛔');
check('« Invité(e) par Amina » ; rien sans prénom', inviterGreeting('Amina') === 'Invité(e) par Amina' && inviterGreeting('  ') === '' && inviterGreeting(null) === '');

// --- administrateur ------------------------------------------------------------------------------------------------------------------------------
const overviewRaw = {
  goal: 5,
  totals: { inviters: 1, joined: 7, installed: 5, to_validate: 1, validated: 0, delivered: 2, refused: 1 },
  rewards: [
    {
      id: 'r1',
      number: 1,
      status: 'a_valider',
      note: null,
      created_at: '2026-11-05T10:00:00Z',
      handled_at: null,
      user: { id: 'u1', name: 'Amina Hassan', phone: '66000001', whatsapp: null },
      friends: [
        { name: 'Fatimé', phone: '66000002', installed: true, banned: false },
        { name: 'Moussa', phone: '66000003', installed: true, banned: false },
        { name: 'Khadija', phone: '66000004', installed: true, banned: true },
        { name: 'Abakar', phone: null, installed: false, banned: false },
      ],
    },
    { id: 'rX', number: 2, status: 'bizarre' },
  ],
  inviters: [{ id: 'u1', name: 'Amina Hassan', phone: '66000001', joined: 7, installed: 5 }],
};
const ov = parseOverview(overviewRaw);
check('tableau administrateur lu : totaux, gains, clients qui invitent', !!ov && ov.totals.toValidate === 1 && ov.totals.delivered === 2 && ov.totals.refused === 1 && ov.rewards.length === 1 && ov.inviters.length === 1 && ov.rewards[0].user.name === 'Amina Hassan', ov);
check('amis d\'un gain : seuls les installés non bannis comptent (2 sur 4)', !!ov && countingFriends(ov.rewards[0].friends) === 2);
check('tableau illisible = rien', parseOverview(null) === null && parseOverview('x') === null);
check('libellés de l\'administrateur', adminStatusLabel('a_valider') === 'À valider' && adminStatusLabel('valide') === 'Validé' && adminStatusLabel('remis') === 'Remis' && adminStatusLabel('refuse') === 'Refusé');
const msg = winnerMessage('Amina Hassan');
check('message au gagnant : salue, annonce le parfum gratuit, demande quel parfum', /Bonjour Amina Hassan,/.test(msg) && /parfum gratuit/.test(msg) && /quel parfum/.test(msg));
check('message au gagnant sans prénom : « Bonjour, »', /^Bonjour, ici/.test(winnerMessage('  ')));

console.log(`\n${ok} contrôles réussis`);
