// Changer la clé du bot Telegram en l'envoyant au bot (supabase/functions/telegram-webhook/key.ts) : reconnaissance de la clé dans un message,
// et déroulement complet avec un faux Telegram (aucun réseau, aucune base). La clé utilisée ici est FAUSSE.
// Lancer : node --import ./tests/zara/register.mjs tests/email/telegram-key.test.ts
import { extractBotKey, processNewKey, KEY_TEXT, type KeyDeps } from '../../supabase/functions/telegram-webhook/key.ts';

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

const OLD = '1234567890:AAExempleAncienneCleFausse0123456789ab';
const NEW = '1234567890:AAExempleNouvelleCleFausse9876543210zz';
const OTHER_BOT = '5555555555:AAExempleAutreBotCleFausse0123456789yy';
const ADMIN_CHAT = 111;
const URL = 'https://exemple.supabase.co/functions/v1/telegram-webhook';

// --- reconnaître une clé dans un message ---
check('clé seule', extractBotKey(NEW) === NEW);
check('clé avec espaces autour', extractBotKey(`  ${NEW}  `) === NEW);
check('clé coupée par des espaces et retours à la ligne (copier-coller)', extractBotKey(`1234567890:\nAAExempleNouvelleCle Fausse9876543210zz`) === NEW);
check('« /cle » devant', extractBotKey(`/cle ${NEW}`) === NEW);
check('« /cle@NomDuBot » devant', extractBotKey(`/cle@AlbasseShoppingBot ${NEW}`) === NEW);
check('un message normal n\'est pas une clé', extractBotKey('Bonjour, je voudrais une commande') === null);
check('/start n\'est pas une clé', extractBotKey('/start 0c7e6708-fb70-413c-9862-6e041adc963f') === null);
check('numéro seul n\'est pas une clé', extractBotKey('1234567890') === null);
check('clé trop courte refusée', extractBotKey('1234567890:AAshort') === null);
check('caractères interdits refusés', extractBotKey('1234567890:AAExempleNouvelle$CleFausse9876543210zz') === null);
check('texte vide / absent', extractBotKey('') === null && extractBotKey(undefined) === null && extractBotKey(42) === null);

// --- faux serveur : mémorise tous les appels ---
interface Call {
  token: string;
  method: string;
  body?: Record<string, unknown>;
}
function world(opts: { admin?: boolean; current?: string | null; validKeys?: string[]; saveOk?: boolean; secret?: string | null } = {}) {
  const calls: Call[] = [];
  const saved: string[] = [];
  const valid = opts.validKeys ?? [OLD, NEW];
  const current = opts.current === undefined ? OLD : opts.current;
  const deps: KeyDeps = {
    isAdmin: async (chat) => (opts.admin ?? true) && chat === ADMIN_CHAT,
    currentKey: async () => current,
    telegram: async (token, method, body) => {
      calls.push({ token, method, body });
      return { ok: valid.includes(token) };
    },
    saveKey: async (key) => {
      if (opts.saveOk === false) return false;
      saved.push(key);
      return true;
    },
    webhookSecret: async () => (opts.secret === undefined ? 'secret-du-webhook' : opts.secret),
    webhookUrl: URL,
  };
  return { deps, calls, saved };
}
const sent = (calls: Call[]) => calls.filter((c) => c.method === 'sendMessage');

(async () => {
  // 1. un administrateur envoie la nouvelle clé : tout se passe bien
  {
    const w = world();
    const out = await processNewKey(w.deps, ADMIN_CHAT, 77, NEW);
    check('nouvelle clé : résultat « saved »', out === 'saved', out);
    check('nouvelle clé : elle est enregistrée une seule fois', w.saved.length === 1 && w.saved[0] === NEW, w.saved);
    const methods = w.calls.map((c) => `${c.token === NEW ? 'nouvelle' : 'autre'}:${c.method}`);
    check('ordre : vérifier la clé, remettre le lien, effacer, confirmer', JSON.stringify(methods) === JSON.stringify(['nouvelle:getMe', 'nouvelle:setWebhook', 'nouvelle:deleteMessage', 'nouvelle:sendMessage']), methods);
    const hook = w.calls.find((c) => c.method === 'setWebhook');
    check('le lien est remis avec la même adresse et le mot de passe du coffre-fort', hook?.body?.url === URL && hook?.body?.secret_token === 'secret-du-webhook', hook?.body);
    const del = w.calls.find((c) => c.method === 'deleteMessage');
    check('le message qui contient la clé est effacé', del?.body?.chat_id === ADMIN_CHAT && del?.body?.message_id === 77, del?.body);
    check('la confirmation est envoyée à l\'administrateur', sent(w.calls)[0]?.body?.text === KEY_TEXT.saved && sent(w.calls)[0]?.body?.chat_id === ADMIN_CHAT);
    check('la clé n\'est jamais écrite dans le texte d\'un message envoyé', !JSON.stringify(sent(w.calls).map((c) => c.body)).includes(NEW));
  }

  // 2. quelqu'un qui n'est pas administrateur : rien du tout
  {
    const w = world({ admin: false });
    const out = await processNewKey(w.deps, ADMIN_CHAT, 5, NEW);
    check('pas administrateur : ignoré', out === 'ignored' && w.calls.length === 0 && w.saved.length === 0, { out, calls: w.calls.length });
    const w2 = world();
    const out2 = await processNewKey(w2.deps, 999, 5, NEW);
    check('conversation d\'un autre compte : ignoré', out2 === 'ignored' && w2.calls.length === 0 && w2.saved.length === 0);
  }

  // 3. clé refusée par Telegram (fausse ou déjà révoquée) : rien n'est changé, l'ancienne clé répond
  {
    const w = world({ validKeys: [OLD] });
    const out = await processNewKey(w.deps, ADMIN_CHAT, 5, NEW);
    check('clé refusée par Telegram : « refused », rien d\'enregistré', out === 'refused' && w.saved.length === 0, { out, saved: w.saved });
    check('on répond avec la clé enregistrée', sent(w.calls).length === 1 && sent(w.calls)[0].token === OLD && sent(w.calls)[0].body?.text === KEY_TEXT.refused);
    check('le lien n\'est pas touché', !w.calls.some((c) => c.method === 'setWebhook'));
    const w2 = world({ validKeys: [], current: null });
    const out2 = await processNewKey(w2.deps, ADMIN_CHAT, 5, NEW);
    check('aucune clé en coffre-fort : pas de réponse possible, pas d\'erreur', out2 === 'refused' && sent(w2.calls).length === 0);
  }

  // 4. l'administrateur renvoie l'ANCIENNE clé (pas encore révoquée)
  {
    const w = world();
    const out = await processNewKey(w.deps, ADMIN_CHAT, 9, OLD);
    check('ancienne clé : « same », rien d\'enregistré', out === 'same' && w.saved.length === 0, { out, saved: w.saved });
    check('ancienne clé : message effacé et explication envoyée', w.calls.some((c) => c.method === 'deleteMessage') && sent(w.calls)[0]?.body?.text === KEY_TEXT.same);
    check('ancienne clé : le lien n\'est pas touché', !w.calls.some((c) => c.method === 'setWebhook'));
  }

  // 5. le coffre-fort refuse (clé d'un autre bot)
  {
    const w = world({ validKeys: [OLD, OTHER_BOT], saveOk: false });
    const out = await processNewKey(w.deps, ADMIN_CHAT, 4, OTHER_BOT);
    check('autre bot : « not-saved », lien non touché', out === 'not-saved' && !w.calls.some((c) => c.method === 'setWebhook'), out);
    check('autre bot : réponse avec la clé enregistrée', sent(w.calls)[0]?.token === OLD && sent(w.calls)[0]?.body?.text === KEY_TEXT.notSaved);
  }

  // 6. pas de numéro de message (cas rare) et pas de mot de passe de lien : la clé est quand même enregistrée
  {
    const w = world({ secret: null });
    const out = await processNewKey(w.deps, ADMIN_CHAT, undefined, NEW);
    check('sans numéro de message : pas d\'effacement, mais enregistrée', out === 'saved' && w.saved.length === 1 && !w.calls.some((c) => c.method === 'deleteMessage'));
    check('sans mot de passe du lien : le lien n\'est pas remis', !w.calls.some((c) => c.method === 'setWebhook'));
  }

  console.log(`\n${ok} vérifications réussies${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
})();
