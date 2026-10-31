// Telegram aux clients absents depuis 7 jours + rapport quotidien : le message, le choix des articles, les erreurs de Telegram, les mots STOP / REPRENDRE,
// le texte du rapport et le déroulement complet des envois avec un faux Telegram et une fausse base (aucun réseau).
// Lancer : node --import ./tests/zara/register.mjs tests/email/telegram-promo.test.ts
import { absentMessage, CAPTION_LIMIT, classifyTelegramError, pickProducts, reportText, SITE, STOP_NOTE, type PromoProduct, type PromoReport } from '../../supabase/functions/telegram-promo/message.ts';
import { runAbsent, runReport, type AbsentDeps, type ClaimRow, type TgResult } from '../../supabase/functions/telegram-promo/send.ts';
import { LINKED_TEXT, NOT_LINKED_TEXT, RESUMED_TEXT, STOPPED_TEXT, parseClientCommand } from '../../supabase/functions/telegram-webhook/commands.ts';

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

const NOW = Date.parse('2026-10-26T08:30:00Z');
const hours = (h: number) => new Date(NOW + h * 3600_000).toISOString();
const prod = (over: Partial<PromoProduct> & { id: string; name: string }): PromoProduct => ({ price: 10000, slug: over.id, images: ['https://img.exemple.com/' + over.id + '.jpg'], created_at: hours(-100), ...over });

// ---- les mots du client au bot
for (const w of ['STOP', 'stop', 'Stop.', '/stop', '/STOP', ' stop ', 'Stop!', '/stop@AlbasseShoppingBot', 'Arrêter', 'arreter', 'ARRÊT', 'Désabonner', 'unsubscribe', 'توقف']) check(`« ${w} » arrête les messages`, parseClientCommand(w) === 'stop', parseClientCommand(w));
for (const w of ['REPRENDRE', 'reprendre', 'Reprendre.', '/reprendre', '/reprendre@AlbasseShoppingBot', 'resume']) check(`« ${w} » reprend les messages`, parseClientCommand(w) === 'resume', parseClientCommand(w));
for (const w of ['/start', '/start 123e4567-e89b-12d3-a456-426614174000', 'Bonjour', 'je veux que ça stop', 'stop la livraison svp', 'stopper', 'ok', '', '   ']) check(`« ${w} » n'est ni un arrêt ni une reprise`, parseClientCommand(w) === null, parseClientCommand(w));
check('texte absent : rien', parseClientCommand(undefined) === null && parseClientCommand(null) === null);
check('le message de liaison annonce les offres ET le mot STOP', /offres/.test(LINKED_TEXT) && /STOP/.test(LINKED_TEXT));
check('le message d\'arrêt explique comment reprendre', /REPRENDRE/.test(STOPPED_TEXT));
check('le message de reprise rappelle STOP', /STOP/.test(RESUMED_TEXT));
check('un Telegram non lié est informé (aucun message publicitaire)', /aucun compte/.test(NOT_LINKED_TEXT) && /Lier Telegram/.test(NOT_LINKED_TEXT));

// ---- le choix des articles (même règle que les e-mails)
const flashLate = prod({ id: 'flash-late', name: 'Montre flash tardive', is_flash_sale: true, flash_sale_ends_at: hours(30), price: 15000, compare_at_price: 20000 });
const flashSoon = prod({ id: 'flash-soon', name: 'Parfum flash', is_flash_sale: true, flash_sale_ends_at: hours(5) });
const flashOver = prod({ id: 'flash-over', name: 'Vente flash finie', is_flash_sale: true, flash_sale_ends_at: hours(-2), created_at: hours(-1) });
const recent = prod({ id: 'recent', name: 'Nouveau sac', created_at: hours(-2) });
const older = prod({ id: 'older', name: 'Ancien sac', created_at: hours(-500) });
const free = prod({ id: 'free', name: 'Sans prix', price: 0 });
const pick = pickProducts([older, recent, flashLate, flashOver, flashSoon, free], NOW);
check('les ventes flash en cours d\'abord, la fin la plus proche en premier', pick.products[0].id === 'flash-soon' && pick.products[1].id === 'flash-late', pick.products.map((p) => p.id));
check('une vente flash terminée compte comme un article ordinaire (le plus récent d\'abord)', pick.products[2].id === 'flash-over' && pick.products[3].id === 'recent', pick.products.map((p) => p.id));
check('4 articles au plus, sans article à prix nul', pick.products.length === 4 && !pick.products.some((p) => p.id === 'free'));
check('la fin de la vente flash est retenue', pick.flashEndsAt === hours(5));
check('pas de vente flash : pas de date', pickProducts([recent, older], NOW).flashEndsAt === null);

// ---- le message
const ad = absentMessage({ fullName: '  Amina   Hassan ', products: pick.products, flashEndsAt: pick.flashEndsAt });
check('le message dit bonjour avec le prénom', ad.text.startsWith('Bonjour Amina, vous nous manquez !'), ad.text.slice(0, 50));
check('vente flash : la date de fin (jour de N\'Djamena) est annoncée', /vente flash est en cours.*jusqu'au 26 octobre/.test(ad.text), ad.text);
check('les 4 articles sont listés avec leur lien', [1, 2, 3, 4].every((n) => ad.text.includes(`${n}. `)) && ad.text.includes(`${SITE}/produit/flash-soon`));
check('prix en FCFA avec espaces', /10 000 FCFA/.test(ad.text), ad.text);
check('remise : ancien prix et pourcentage vrais (15 000 au lieu de 20 000 = −25 %)', /15 000 FCFA \(au lieu de 20 000 FCFA, −25 %\)/.test(ad.text), ad.text);
check('livraison, site et mot STOP', /Livraison partout au Tchad/.test(ad.text) && ad.text.includes(SITE) && ad.text.endsWith(STOP_NOTE));
check('la photo est celle du 1er article', ad.photo === 'https://img.exemple.com/flash-soon.jpg', ad.photo);
const plain = absentMessage({ fullName: null, products: [recent, older], flashEndsAt: null });
check('sans vente flash : « articles du moment », bonjour sans prénom', plain.text.startsWith('Bonjour, vous nous manquez !') && /articles du moment/.test(plain.text) && !/vente flash/.test(plain.text), plain.text);
check('pas de photo si le 1er article n\'en a pas en https', absentMessage({ fullName: 'A', products: [prod({ id: 'x', name: 'X', images: ['http://non-securise/x.jpg', ''] })], flashEndsAt: null }).photo === null);
const longName = 'Article avec un nom vraiment très long '.repeat(6);
const long = absentMessage({ fullName: 'Amina', products: [1, 2, 3, 4].map((n) => prod({ id: `l${n}`, name: longName + n, slug: 'un-slug-assez-long-'.repeat(3) + n })), flashEndsAt: null });
check('les noms trop longs sont coupés à 60 signes', long.text.split('\n').filter((l) => /^\d\. /.test(l)).every((l) => l.split(' — ')[0].length <= 63), long.text);
check('légende de plus de 1024 signes : le message part SANS photo (limite de Telegram)', long.text.length > CAPTION_LIMIT ? long.photo === null : long.photo !== null, long.text.length);
check('un nom avec des signes spéciaux passe tel quel (texte simple, pas de mise en forme à protéger)', absentMessage({ fullName: 'A', products: [prod({ id: 'sp', name: 'Sac *luxe* <b>_x_</b> [1]' })], flashEndsAt: null }).text.includes('Sac *luxe* <b>_x_</b> [1]'));
check('le lien d\'un article encode son identifiant', absentMessage({ fullName: 'A', products: [prod({ id: 'e', name: 'E', slug: 'sac é/#?' })], flashEndsAt: null }).text.includes('/produit/sac%20%C3%A9%2F%23%3F'));
check('article sans identifiant de page : lien du site', absentMessage({ fullName: 'A', products: [prod({ id: 'n', name: 'N', slug: null })], flashEndsAt: null }).text.includes(`${SITE}\n`));

// ---- les erreurs de Telegram
check('403 (bot bloqué) : plus jamais contacté', classifyTelegramError(403, 'Forbidden: bot was blocked by the user') === 'blocked');
check('403 (compte supprimé) : plus jamais contacté', classifyTelegramError(403, 'Forbidden: user is deactivated') === 'blocked');
check('400 « chat not found » : plus jamais contacté', classifyTelegramError(400, 'Bad Request: chat not found') === 'blocked');
check('429 (trop vite) : simple échec, on réessaiera', classifyTelegramError(429, 'Too Many Requests: retry after 5') === 'failed');
check('erreur réseau : simple échec', classifyTelegramError(0, 'réseau : TypeError') === 'failed');
check('400 autre (photo illisible) : simple échec', classifyTelegramError(400, 'Bad Request: wrong file identifier') === 'failed');
check('500 : simple échec', classifyTelegramError(500, '') === 'failed');

// ---- le déroulement des envois (faux Telegram, fausse base)
const NAMES = ['Amina Hassan', 'Brahim Moussa', 'Carine Dillah'];
const claimRow = (n: number): ClaimRow => ({ o_user_id: `u${n}`, o_name: NAMES[n - 1], o_chat_id: 1000 + n });
function world(opts: { rows?: ClaimRow[] | { error: string }; products?: PromoProduct[]; telegram?: (method: string, body: Record<string, unknown>, nth: number) => TgResult }) {
  const sent: { method: string; body: Record<string, unknown> }[] = [];
  const recorded: { id: string; status: string; error: string | null }[] = [];
  let sleeps = 0;
  const deps: AbsentDeps = {
    claim: async () => (opts.rows && 'error' in (opts.rows as object) ? (opts.rows as { error: string }) : { rows: (opts.rows as ClaimRow[]) ?? [] }),
    record: async (id, status, error) => void recorded.push({ id, status, error }),
    loadProducts: async () => opts.products ?? [recent, older],
    telegram: async (method, body) => {
      sent.push({ method, body });
      return opts.telegram ? opts.telegram(method, body, sent.length) : { ok: true, status: 200, description: '' };
    },
    now: () => NOW,
    sleep: async () => void sleeps++,
  };
  return { deps, sent, recorded, sleeps: () => sleeps };
}

{
  const w = world({ rows: [claimRow(1), claimRow(2)] });
  const out = await runAbsent(w.deps);
  check('2 clients : 2 envoyés, notés « envoyé »', out.claimed === 2 && out.sent === 2 && out.failed === 0 && out.blocked === 0 && w.recorded.every((r) => r.status === 'sent' && r.error === null), out);
  check('envoi avec photo et légende, au bon client, avec le bouton du site', w.sent[0].method === 'sendPhoto' && w.sent[0].body.chat_id === 1001 && typeof w.sent[0].body.caption === 'string' && /Bonjour Amina,/.test(String(w.sent[0].body.caption)) && !!w.sent[0].body.reply_markup, w.sent[0]);
  check('chaque client reçoit son propre prénom', /Bonjour Brahim,/.test(String(w.sent[1].body.caption)) && w.sent[1].body.chat_id === 1002);
  check('petite pause entre deux envois (limite de vitesse de Telegram)', w.sleeps() === 2);
}
{
  const w = world({ rows: [claimRow(1)], products: [prod({ id: 'sans-photo', name: 'Sans photo', images: [] })] });
  const out = await runAbsent(w.deps);
  check('article sans photo : message texte seulement', out.sent === 1 && w.sent.length === 1 && w.sent[0].method === 'sendMessage' && typeof w.sent[0].body.text === 'string', w.sent);
}
{
  const w = world({ rows: [claimRow(1)], telegram: (method) => (method === 'sendPhoto' ? { ok: false, status: 400, description: 'Bad Request: wrong file identifier/HTTP URL specified' } : { ok: true, status: 200, description: '' }) });
  const out = await runAbsent(w.deps);
  check('photo refusée : le même texte part sans photo', out.sent === 1 && w.sent.map((s) => s.method).join() === 'sendPhoto,sendMessage' && w.recorded[0].status === 'sent', { out, calls: w.sent.map((s) => s.method) });
}
{
  const w = world({ rows: [claimRow(1), claimRow(2)], telegram: (_m, body) => (body.chat_id === 1001 ? { ok: false, status: 403, description: 'Forbidden: bot was blocked by the user' } : { ok: true, status: 200, description: '' }) });
  const out = await runAbsent(w.deps);
  check('bot bloqué : noté « blocked », pas de deuxième essai, les autres clients reçoivent leur message', out.blocked === 1 && out.sent === 1 && w.recorded[0].status === 'blocked' && w.sent.filter((s) => s.body.chat_id === 1001).length === 1, { out, recorded: w.recorded });
  check('le motif de l\'échec est gardé (code + texte de Telegram)', /^403 Forbidden/.test(String(w.recorded[0].error)), w.recorded[0]);
}
{
  const w = world({ rows: [claimRow(1), claimRow(2), claimRow(3)], telegram: (_m, body) => (body.chat_id === 1001 ? { ok: true, status: 200, description: '' } : { ok: false, status: 429, description: 'Too Many Requests: retry after 12' }) });
  const out = await runAbsent(w.deps);
  check('limite de vitesse : on s\'arrête d\'écrire, les suivants sont notés « failed » (repris un autre jour)', out.sent === 1 && out.failed === 2 && w.recorded[1].status === 'failed' && w.recorded[2].status === 'failed' && /limite de vitesse/.test(String(w.recorded[2].error)), { out, recorded: w.recorded });
  check('limite de vitesse : aucun message de plus après le 429 (pas d\'essai sans photo non plus)', w.sent.length === 2, w.sent.map((s) => `${s.method}:${s.body.chat_id}`));
}
{
  const w = world({ rows: [claimRow(1), claimRow(2)], products: [] });
  const out = await runAbsent(w.deps);
  check('aucun article à montrer : personne ne reçoit de message vide, tous notés « failed »', out.failed === 2 && out.sent === 0 && w.sent.length === 0 && w.recorded.every((r) => r.status === 'failed' && /aucun article/.test(String(r.error))), out);
}
{
  const w = world({ rows: [] });
  const out = await runAbsent(w.deps);
  check('personne à contacter : rien n\'est envoyé, rien n\'est noté', out.claimed === 0 && w.sent.length === 0 && w.recorded.length === 0);
}
{
  const w = world({ rows: { error: 'choix des clients : permission denied' } });
  const out = await runAbsent(w.deps);
  check('erreur de la base : remontée, rien n\'est envoyé', /permission denied/.test(String(out.error)) && w.sent.length === 0);
}
{
  const w = world({ rows: [claimRow(1)], telegram: () => ({ ok: false, status: 0, description: 'réseau : TypeError' }) });
  const out = await runAbsent(w.deps);
  check('panne réseau : « failed », le client sera repris un autre jour', out.failed === 1 && out.sent === 0 && w.recorded[0].status === 'failed');
}

// ---- le rapport
const report = (over: Partial<PromoReport> = {}): PromoReport => ({
  day: '2026-10-26',
  emails_enabled: true,
  telegram_enabled: false,
  emails: { today: 49, week: 99, returned: 1, orders: 0 },
  telegram: { today: 0, week: 0, returned: 0, orders: 0, failed: 0, blocked: 0 },
  linked: { linked: 0, consented: 0, stopped: 0 },
  ...over,
});
const text = reportText(report()) ?? '';
check('le rapport porte la date du jour', /rapport du 26\/10/.test(text), text);
check('e-mails : envoyés aujourd\'hui et sur 7 jours', /E-mails publicitaires : 49 envoyés aujourd'hui, 99 envoyés sur 7 jours/.test(text), text);
check('e-mails : 1 client revenu (singulier), 0 commande', /1 client revenu sur le site, 0 client a commandé/.test(text), text);
check('Telegram sans envoi : pas de ligne de résultats', /Telegram : 0 envoyé aujourd'hui, 0 envoyé sur 7 jours/.test(text) && !/Telegram[^\n]*\n→/.test(text), text);
check('clients liés : 0, personne n\'a écrit STOP', /Clients liés à Telegram : 0 \(0 accepte les offres, 0 a écrit STOP\)/.test(text), text);
check('interrupteurs lus : e-mails allumé, Telegram éteint', /e-mails 🟢 allumé · Telegram ⚪ éteint/.test(text), text);
check('le rapport rappelle ce que « revenu » veut dire', /Un client qui revient sans se connecter n'est pas compté/.test(text));
const rich = reportText(report({ telegram_enabled: true, telegram: { today: 3, week: 12, returned: 4, orders: 2, failed: 1, blocked: 2 }, linked: { linked: 20, consented: 15, stopped: 3 } })) ?? '';
check('Telegram : pluriels et résultats', /3 envoyés aujourd'hui, 12 envoyés sur 7 jours\n→ 4 clients revenus sur le site, 2 clients ont commandé/.test(rich), rich);
check('échecs et bots bloqués signalés', /⚠️ 1 échec, 2 bots bloqués \(7 jours\)/.test(rich), rich);
check('liés : 20, 15 acceptent, 3 STOP', /Clients liés à Telegram : 20 \(15 acceptent les offres, 3 ont écrit STOP\)/.test(rich), rich);
check('rien du tout (aucun envoi, personne de lié) : pas de rapport', reportText(report({ emails: { today: 0, week: 0, returned: 0, orders: 0 } })) === null);
check('des clients liés mais aucun envoi : le rapport part (le patron voit la progression)', (reportText(report({ emails: { today: 0, week: 0, returned: 0, orders: 0 }, linked: { linked: 2, consented: 2, stopped: 0 } }))?.length ?? 0) > 0);
check('un bot bloqué suffit à faire partir le rapport', (reportText(report({ emails: { today: 0, week: 0, returned: 0, orders: 0 }, telegram: { today: 0, week: 0, returned: 0, orders: 0, failed: 0, blocked: 1 } }))?.length ?? 0) > 0);

function reportWorld(data: PromoReport | { error: string }, telegram?: (chat: number) => TgResult) {
  const sent: { chat: number; text: string }[] = [];
  return {
    sent,
    deps: {
      loadReport: async () => ('error' in data ? data : { data }),
      telegram: async (chat: number, t: string) => {
        sent.push({ chat, text: t });
        return telegram ? telegram(chat) : { ok: true, status: 200, description: '' };
      },
    },
  };
}
{
  const w = reportWorld(report());
  const out = await runReport(w.deps, [11, 22], false);
  check('rapport envoyé à chaque administrateur lié', out.ok === true && out.sent === 2 && out.admins === 2 && w.sent.map((s) => s.chat).join() === '11,22' && w.sent[0].text === text, out);
}
{
  const w = reportWorld(report());
  const out = await runReport(w.deps, [11], true);
  check('essai à blanc : le texte est rendu, rien n\'est envoyé', out.dry === true && out.text === text && w.sent.length === 0);
}
{
  const w = reportWorld(report({ emails: { today: 0, week: 0, returned: 0, orders: 0 } }));
  const out = await runReport(w.deps, [11], false);
  check('rien à dire : aucun message', out.skipped === true && w.sent.length === 0);
}
{
  const w = reportWorld({ error: 'données du rapport : vides' });
  const out = await runReport(w.deps, [11], false);
  check('erreur de la base : remontée', /vides/.test(String(out.error)) && w.sent.length === 0);
}
{
  const w = reportWorld(report(), (chat) => (chat === 11 ? { ok: false, status: 403, description: 'blocked' } : { ok: true, status: 200, description: '' }));
  const out = await runReport(w.deps, [11, 22], false);
  check('un administrateur injoignable : l\'autre reçoit quand même le rapport', out.ok === true && out.sent === 1 && out.admins === 2);
}

console.log(`\n${ok} vérifications réussies${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
