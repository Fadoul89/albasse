// Zara Intelligence 360 : le moteur d'actions et de permissions (supabase/functions/zara-intel/actions.ts), sans réseau ni base.
// Lancer : node --import ./tests/zara/register.mjs tests/intel/actions.test.ts
import {
  ACTIONS,
  APPROVAL_TTL_MS,
  DAY_MS,
  FORBIDDEN_TYPES,
  PERMISSIONS,
  REASON_LABELS,
  SENSITIVE_TYPES,
  approve,
  cleanState,
  decide,
  hashParams,
  ndjamenaDay,
  registryView,
  specOf,
  stableStringify,
  validateParams,
  type Approval,
  type Context,
  type HistoryEntry,
  type IntelState,
} from '../../supabase/functions/zara-intel/actions.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 500));
    process.exitCode = 1;
  }
};

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0); // 25 octobre 2026, 13 h à N'Djamena
const UID = '3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const UID2 = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const live: IntelState = { mode: 'live', killSwitch: false, grants: PERMISSIONS, preapproved: [], limitOverrides: {} };
const ctx = (over: Partial<Context> = {}): Context => ({ now: NOW, history: [], approvals: [], plannedInRun: {}, ...over });
const hist = (type: string, key: string, status: HistoryEntry['status'], over: Partial<HistoryEntry> = {}): HistoryEntry => ({ type, key, status, at: NOW - 3600_000, simulated: false, ...over });
const req = (type: string, params: unknown = {}, source: 'ai' | 'rule' | 'admin' = 'rule') => ({ type, params, source });
const TODAY = ndjamenaDay(NOW);

// ---------- 1. le registre ----------
{
  const types = ACTIONS.map((a) => a.type);
  check('registre : types uniques, étiquettes en français non vides', new Set(types).size === types.length && ACTIONS.every((a) => a.label.length > 5));
  check('registre : « interdit » <-> approbation « forbidden » <-> limites à 0', ACTIONS.every((a) => (a.risk === 'forbidden') === (a.approval === 'forbidden') && (a.risk === 'forbidden') === (a.limits.perDay === 0 && a.limits.perRun === 0)));
  check('registre : risque élevé = approbation à chaque fois (« always ») et jamais exécuté par le système (« manual »)', ACTIONS.filter((a) => a.risk === 'high').every((a) => a.approval === 'always' && a.executor === 'manual'));
  check('registre : les opérations sensibles demandées sont là (prix, remise exceptionnelle, remboursement, budget publicitaire, règles de fidélité)', ['catalog.price_change', 'promo.exceptional_discount', 'order.refund', 'ads.budget_change', 'loyalty.rules_change'].every((t) => SENSITIVE_TYPES.includes(t)) && SENSITIVE_TYPES.length === 5, SENSITIVE_TYPES);
  check('registre : interdits = permissions, code, règles de sécurité, paramètres financiers, personnes désabonnées, export de données personnelles', ['permissions.change', 'code.modify', 'security.rules_change', 'finance.settings_change', 'contact.unsubscribed', 'data.export_personal'].every((t) => FORBIDDEN_TYPES.includes(t)) && FORBIDDEN_TYPES.length === 6);
  check('registre : l’IA ne peut rien accorder — aucune permission « never » dans la liste accordable, une permission par type non interdit', !PERMISSIONS.includes('never') && ACTIONS.filter((a) => a.risk !== 'forbidden').every((a) => PERMISSIONS.includes(a.permission)));
  check('registre : chaque limite par passage ne dépasse pas la limite journalière', ACTIONS.every((a) => a.limits.perRun <= a.limits.perDay));
  check('registre : envoi de campagne et de fidélité = « configurable » (pré-approuvable), jamais « never » ; préparation = « never » mais risque faible', specOf('marketing.send_campaign')!.approval === 'configurable' && specOf('loyalty.send_message')!.approval === 'configurable' && specOf('marketing.prepare_campaign')!.approval === 'never' && specOf('marketing.prepare_campaign')!.risk === 'low');
  check('registre : les recommandations (réapprovisionner, ajouter un article, revoir une catégorie) ne sont jamais exécutées par le système', ['catalog.suggest_restock', 'catalog.suggest_item', 'catalog.review_category'].every((t) => specOf(t)!.executor === 'manual'));
  check('vue du registre pour l’écran : sans fonctions, avec risque et approbation', registryView().length === ACTIONS.length && registryView().every((v) => typeof v.risk === 'string' && !('key' in v) && !('schema' in v)));
  check('type inconnu ou non texte : pas de fiche', specOf('nimporte.quoi') === null && specOf(undefined as any) === null && specOf('constructor') === null && specOf('__proto__') === null);
}

// ---------- 2. les paramètres : schéma strict ----------
{
  const s = specOf('catalog.price_change')!.schema;
  check('paramètres valides acceptés (uuid mis en minuscules)', JSON.stringify(validateParams(s, { product_id: UID.toUpperCase(), new_price: 15000 })) === JSON.stringify({ ok: true, params: { product_id: UID, new_price: 15000 } }));
  const bad = (schema: any, input: unknown) => (validateParams(schema, input) as any).errors as string[] | undefined;
  check('champ inconnu refusé (rien de ce que produit un modèle ne passe en plus)', bad(s, { product_id: UID, new_price: 15000, is_admin: true })!.includes('champ_inconnu:is_admin'));
  check('champ manquant refusé', bad(s, { product_id: UID })!.includes('champ_manquant:new_price'));
  check('type faux refusé : prix en texte, décimal, négatif, trop grand, uuid mal formé', ['abc', 12.5, -5, 99_999_999_999].every((p) => bad(s, { product_id: UID, new_price: p })!.includes('champ_invalide:new_price')) && bad(s, { product_id: 'pas-un-uuid', new_price: 1000 })!.includes('champ_invalide:product_id'));
  check('pas un objet : refusé (null, tableau, texte, nombre)', [null, [], 'x', 3, undefined].every((i) => bad(s, i)![0] === 'parametres_pas_un_objet'));
  const t = specOf('admin.notify')!.schema;
  check('texte : espaces coupés, longueur min/max, caractères de contrôle refusés', (validateParams(t, { title: '  Bonjour  ', message: 'Un message', topic: 'sujet' }) as any).params.title === 'Bonjour' && !!bad(t, { title: 'ab', message: 'Un message', topic: 'sujet' }) && !!bad(t, { title: 'x'.repeat(81), message: 'Un message', topic: 'sujet' }) && !!bad(t, { title: 'Titre\u0000x', message: 'Un message', topic: 'sujet' }));
  const d = specOf('report.daily_summary')!.schema;
  check('date : 2026-02-30 et 25/10/2026 refusées, 2026-10-25 acceptée', !!bad(d, { date: '2026-02-30' }) && !!bad(d, { date: '25/10/2026' }) && (validateParams(d, { date: '2026-10-25' }) as any).ok);
  const e = specOf('loyalty.prepare_message')!.schema;
  check('liste fermée : une valeur hors liste est refusée', !!bad(e, { segment: 'vip_secret', date: '2026-10-25' }) && (validateParams(e, { segment: 'or', date: '2026-10-25' }) as any).ok);
  const poisoned = JSON.parse('{"date":"2026-10-25","__proto__":{"admin":true}}');
  check('clé « __proto__ » venue d’un JSON : refusée, sans polluer les objets', !!bad(d, poisoned) && ({} as any).admin === undefined);
  check('champ facultatif absent accepté', (validateParams({ a: { kind: 'string', max: 5, optional: true } }, {}) as any).ok);
}

// ---------- 3. interdit, éteint, arrêt d’urgence ----------
{
  const allSources = ['ai', 'rule', 'admin'] as const;
  const everyForbidden = FORBIDDEN_TYPES.every((t) => allSources.every((src) => {
    const dd = decide(req(t, {}, src), { ...live, preapproved: [t], grants: [...PERMISSIONS, 'never'] }, ctx({ approvals: [{ key: `${t}:${TODAY}`, paramsHash: hashParams({}), approvedAt: NOW, approvedBy: 'x', expiresAt: NOW + DAY_MS }] }));
    return dd.kind === 'deny' && dd.reasons[0] === 'interdit';
  }));
  check('INTERDIT : refusé quelle que soit la source (IA, règle, administrateur), même « pré-approuvé », même avec une permission « never » ou une approbation forgée', everyForbidden);
  check('type inconnu : refusé', decide(req('hack.everything'), live, ctx()).reasons[0] === 'type_inconnu' && decide(req(undefined as any), live, ctx()).kind === 'deny');
  const off = decide(req('analysis.run_radar'), { ...live, mode: 'off' }, ctx());
  check('mode éteint : tout est refusé, même l’analyse', off.kind === 'deny' && off.reasons[0] === 'mode_eteint');
  const stop = { ...live, killSwitch: true };
  check('ARRÊT D’URGENCE : tout ce qui a un effet est refusé (rapport, notification, campagne, recommandation, envoi)', ['report.daily_summary', 'admin.notify', 'marketing.prepare_campaign', 'marketing.send_campaign', 'catalog.suggest_restock', 'loyalty.send_message'].every((t) => decide(req(t, {}), stop, ctx()).reasons[0] === 'arret_urgence'));
  check('arrêt d’urgence : seule l’analyse en lecture continue (elle ne touche à rien)', decide(req('analysis.run_radar'), stop, ctx()).kind === 'allow');
  check('arrêt d’urgence : même un type sensible déjà approuvé est refusé', decide(req('catalog.price_change', { product_id: UID, new_price: 9000 }), stop, ctx({ approvals: [{ key: `catalog.price_change:${UID}:9000:${TODAY}`, paramsHash: hashParams({ product_id: UID, new_price: 9000 }), approvedAt: NOW, approvedBy: 'a', expiresAt: NOW + 1000 }] })).reasons[0] === 'arret_urgence');
}

// ---------- 4. permissions ----------
{
  const noGrant = { ...live, grants: [] as string[] };
  const dd = decide(req('report.daily_summary', { date: TODAY }), noGrant, ctx());
  check('permission non accordée : refusé, avec l’identifiant et l’empreinte déjà calculés', dd.kind === 'deny' && dd.reasons[0] === 'permission_manquante' && dd.key === `report.daily_summary:${TODAY}` && !!dd.paramsHash);
  check('une permission accordée n’ouvre que ses propres actions', decide(req('report.daily_summary', { date: TODAY }), { ...live, grants: ['intel.report'] }, ctx()).kind === 'allow' && decide(req('marketing.prepare_campaign', { date: TODAY }), { ...live, grants: ['intel.report'] }, ctx()).reasons[0] === 'permission_manquante');
  check('paramètres invalides : refusés avec la liste des champs', (() => { const x = decide(req('marketing.send_campaign', { run_id: 'oops', extra: 1 }), live, ctx()); return x.kind === 'deny' && x.reasons[0] === 'parametres_invalides' && x.reasons.includes('champ_invalide:run_id') && x.reasons.includes('champ_inconnu:extra'); })());
}

// ---------- 5. autorisé, simulation, recommandation ----------
{
  const ok1 = decide(req('report.daily_summary', { date: TODAY }), live, ctx());
  check('action faible risque, permise : « allow », réelle (simulated = false)', ok1.kind === 'allow' && ok1.simulated === false && ok1.executor === 'internal' && ok1.group === 'report');
  const sim = decide(req('report.daily_summary', { date: TODAY }), { ...live, mode: 'simulation' }, ctx());
  check('mode simulation : le verdict est donné mais « simulated » = vrai (rien ne doit être exécuté)', sim.kind === 'allow' && sim.simulated === true);
  check('simulation : l’analyse en lecture s’exécute quand même (simulated = false), elle ne touche à rien', decide(req('analysis.run_radar'), { ...live, mode: 'simulation' }, ctx()).simulated === false);
  const rec = decide(req('catalog.suggest_restock', { product_id: UID }), live, ctx());
  check('recommandation (« manual ») : permise mais marquée « recommandation seulement » : le système ne l’exécute pas', rec.kind === 'allow' && rec.executor === 'manual' && rec.reasons.includes('recommandation_seulement'));
}

// ---------- 6. limites ----------
{
  const spec = specOf('admin.notify')!; // 5 par passage, 10 par jour
  const p = (n: number) => ({ title: 'Titre', message: 'Un message', topic: `sujet-${n}` });
  check('limite par passage : la 6e notification du même passage est refusée', decide(req('admin.notify', p(6)), live, ctx({ plannedInRun: { 'admin.notify': 5 } })).reasons[0] === 'limite_par_passage' && decide(req('admin.notify', p(5)), live, ctx({ plannedInRun: { 'admin.notify': 4 } })).kind === 'allow');
  const ten = Array.from({ length: 10 }, (_, i) => hist('admin.notify', `admin.notify:s${i}:${TODAY}`, 'done'));
  check('limite journalière : 10 en 24 h, la 11e est refusée', decide(req('admin.notify', p(99)), live, ctx({ history: ten })).reasons[0] === 'limite_journaliere' && spec.limits.perDay === 10);
  const old = Array.from({ length: 10 }, (_, i) => hist('admin.notify', `k${i}`, 'done', { at: NOW - 25 * 3600_000 }));
  check('les actions de plus de 24 h ne comptent plus', decide(req('admin.notify', p(99)), live, ctx({ history: old })).kind === 'allow');
  const refused = Array.from({ length: 10 }, (_, i) => hist('admin.notify', `k${i}`, 'refused'));
  check('un refus ou un blocage n’a rien consommé : ne compte pas', decide(req('admin.notify', p(99)), live, ctx({ history: refused })).kind === 'allow');
  const failed = Array.from({ length: 10 }, (_, i) => hist('admin.notify', `k${i}`, 'failed'));
  check('un échec compte (pas de boucle de réessais sans fin)', decide(req('admin.notify', p(99)), live, ctx({ history: failed })).reasons[0] === 'limite_journaliere');
  const lowered = { ...live, limitOverrides: { 'admin.notify': { perDay: 2 } } };
  check('l’administrateur peut BAISSER une limite (2 par jour)', decide(req('admin.notify', p(1)), lowered, ctx({ history: [hist('admin.notify', 'a', 'done'), hist('admin.notify', 'b', 'done')] })).reasons[0] === 'limite_journaliere');
  const raised = { ...live, limitOverrides: { 'admin.notify': { perDay: 1000, perRun: 1000 } } };
  check('…mais jamais la RELEVER au-dessus du maximum du registre', decide(req('admin.notify', p(1)), raised, ctx({ history: ten })).reasons[0] === 'limite_journaliere' && decide(req('admin.notify', p(1)), raised, ctx({ plannedInRun: { 'admin.notify': 5 } })).reasons[0] === 'limite_par_passage');
  check('une limite à 0 désactive le type', decide(req('admin.notify', p(1)), { ...live, limitOverrides: { 'admin.notify': { perDay: 0 } } }, ctx()).reasons[0] === 'limite_journaliere');
  const simHist = Array.from({ length: 10 }, (_, i) => hist('admin.notify', `k${i}`, 'done', { simulated: true }));
  check('les actions simulées ne consomment pas le budget des vraies actions (et inversement)', decide(req('admin.notify', p(99)), live, ctx({ history: simHist })).kind === 'allow' && decide(req('admin.notify', p(99)), { ...live, mode: 'simulation' }, ctx({ history: simHist })).reasons[0] === 'limite_journaliere');
}

// ---------- 7. doublons (idempotence) ----------
{
  const k = `report.daily_summary:${TODAY}`;
  const first = decide(req('report.daily_summary', { date: TODAY }), live, ctx());
  check('identifiant unique : « type:date » (jour de N’Djamena)', first.key === k);
  for (const status of ['proposed', 'pending_approval', 'approved', 'running', 'done'] as const) {
    check(`doublon : la même action déjà « ${status} » n’est pas refaite`, decide(req('report.daily_summary', { date: TODAY }), live, ctx({ history: [hist('report.daily_summary', k, status)] })).kind === 'duplicate');
  }
  const rk = `catalog.suggest_restock:${UID}:${TODAY}`;
  check('une action refusée, bloquée ou échouée peut être redemandée (dans les limites)', (['refused', 'blocked', 'failed'] as const).every((s) => decide(req('catalog.suggest_restock', { product_id: UID }), live, ctx({ history: [hist('catalog.suggest_restock', rk, s)] })).kind === 'allow'));
  check('…mais un échec compte dans la limite du jour (un report.daily_summary échoué ne peut pas être refait : 1 par jour)', decide(req('report.daily_summary', { date: TODAY }), live, ctx({ history: [hist('report.daily_summary', k, 'failed')] })).reasons[0] === 'limite_journaliere');
  check('une version simulée ne bloque pas la vraie, et inversement', decide(req('report.daily_summary', { date: TODAY }), live, ctx({ history: [hist('report.daily_summary', k, 'done', { simulated: true })] })).kind === 'allow' && decide(req('report.daily_summary', { date: TODAY }), { ...live, mode: 'simulation' }, ctx({ history: [hist('report.daily_summary', k, 'done', { simulated: false })] })).kind === 'allow' && decide(req('report.daily_summary', { date: TODAY }), { ...live, mode: 'simulation' }, ctx({ history: [hist('report.daily_summary', k, 'done', { simulated: true })] })).kind === 'duplicate');
  check('d’autres paramètres = une autre action (autre article : permis ; autre date du même rapport : limite d’un par jour)', decide(req('catalog.suggest_restock', { product_id: UID2 }), live, ctx({ history: [hist('catalog.suggest_restock', rk, 'done')] })).kind === 'allow' && decide(req('report.daily_summary', { date: '2026-10-24' }), live, ctx({ history: [hist('report.daily_summary', k, 'done')] })).reasons[0] === 'limite_journaliere');
  const late = Date.UTC(2026, 9, 25, 23, 30, 0); // 00 h 30 le 26 à N'Djamena
  check('le « jour » est celui de N’Djamena (23 h 30 UTC = 00 h 30 le lendemain)', ndjamenaDay(late) === '2026-10-26' && decide(req('analysis.run_radar'), live, ctx({ now: late })).key === 'analysis.run_radar:2026-10-26');
  check('doublon : la clé d’un remboursement est la commande (un seul remboursement par commande, quel que soit le jour)', specOf('order.refund')!.key({ order_id: UID, reason: 'x' }, '2026-10-25') === specOf('order.refund')!.key({ order_id: UID, reason: 'autre' }, '2026-10-30'));
}

// ---------- 8. approbation ----------
{
  const params = { product_id: UID, new_price: 9000 };
  const d1 = decide(req('catalog.price_change', params, 'ai'), live, ctx());
  check('modification de prix proposée par l’IA : « needs_approval » (jamais exécutée seule)', d1.kind === 'needs_approval' && d1.reasons.includes('approbation_requise') && d1.risk === 'high' && d1.executor === 'manual');
  check('l’IA ne peut pas s’approuver elle-même : pas de fonction d’approbation sans administrateur', (approve(d1, { id: 'zara-ia', isAdmin: false }, NOW) as any).reason === 'not_admin' && (approve(d1, { id: '', isAdmin: true }, NOW) as any).reason === 'not_admin' && (approve(d1, undefined as any, NOW) as any).reason === 'not_admin');
  const a = approve(d1, { id: 'admin-1', isAdmin: true }, NOW) as { ok: true; approval: Approval };
  check('un administrateur peut approuver : approbation liée à l’identifiant ET aux paramètres, valable 24 h', a.ok && a.approval.key === d1.key && a.approval.paramsHash === d1.paramsHash && a.approval.expiresAt === NOW + APPROVAL_TTL_MS && a.approval.approvedBy === 'admin-1');
  const d2 = decide(req('catalog.price_change', params, 'ai'), live, ctx({ approvals: [a.approval] }));
  check('après approbation : « allow » (recommandation à appliquer par l’administrateur : le système ne change jamais un prix)', d2.kind === 'allow' && d2.executor === 'manual');
  check('approbation pour un autre prix : ne vaut pas (empreinte différente)', decide(req('catalog.price_change', { product_id: UID, new_price: 1000 }), live, ctx({ approvals: [a.approval] })).kind === 'needs_approval');
  check('approbation pour un autre article : ne vaut pas', decide(req('catalog.price_change', { product_id: UID2, new_price: 9000 }), live, ctx({ approvals: [a.approval] })).kind === 'needs_approval');
  check('approbation d’une action datée : ne passe pas au lendemain (l’identifiant contient le jour) — il faut la redemander', (() => { const later = NOW + 25 * 3600_000; const x = decide(req('catalog.price_change', params), live, ctx({ now: later, approvals: [a.approval] })); return x.kind === 'needs_approval' && x.key !== a.approval.key; })());
  const refundParams = { order_id: UID, reason: 'colis jamais reçu' };
  const refundD = decide(req('order.refund', refundParams, 'ai'), live, ctx());
  const refundA = (approve(refundD, { id: 'admin-1', isAdmin: true }, NOW) as { ok: true; approval: Approval }).approval;
  check('approbation expirée (25 h plus tard, action non datée) : à redemander, avec le motif « expirée »', (() => { const later = NOW + 25 * 3600_000; const x = decide(req('order.refund', refundParams), live, ctx({ now: later, approvals: [refundA] })); return x.kind === 'needs_approval' && x.reasons[0] === 'approbation_expiree'; })());
  check('approbation encore valable à 23 h : permise', decide(req('order.refund', refundParams), live, ctx({ now: NOW + 23 * 3600_000, approvals: [refundA] })).kind === 'allow');
  check('on ne peut approuver ni un doublon, ni un refus, ni une action déjà permise, ni un interdit', ['duplicate', 'deny', 'allow'].every((kind) => (approve({ ...d1, kind: kind as any }, { id: 'a', isAdmin: true }, NOW) as any).reason === 'not_pending') && (approve(decide(req('code.modify'), live, ctx()), { id: 'a', isAdmin: true }, NOW) as any).ok === false);
  check('une approbation ne contourne ni le doublon ni les limites', decide(req('catalog.price_change', params), live, ctx({ approvals: [a.approval], history: [hist('catalog.price_change', d1.key!, 'done')] })).kind === 'duplicate' && decide(req('catalog.price_change', params), live, ctx({ approvals: [a.approval], plannedInRun: { 'catalog.price_change': 3 } })).reasons[0] === 'limite_par_passage');
  check('une approbation ne contourne ni l’arrêt d’urgence ni l’absence de permission', decide(req('catalog.price_change', params), { ...live, grants: [] }, ctx({ approvals: [a.approval] })).reasons[0] === 'permission_manquante');
  for (const t of SENSITIVE_TYPES) {
    const spec = specOf(t)!;
    const p: Record<string, unknown> = {};
    for (const [f, def] of Object.entries(spec.schema)) p[f] = def.kind === 'uuid' ? UID : def.kind === 'int' ? Math.max(def.min, 1) : def.kind === 'enum' ? def.values[0] : def.kind === 'date' ? TODAY : 'texte valable';
    const x = decide(req(t, p, 'ai'), { ...live, preapproved: [t] }, ctx());
    check(`sensible « ${t} » : approbation exigée MÊME si l’administrateur l’a listée comme pré-approuvée`, x.kind === 'needs_approval', x);
  }
}

// ---------- 9. pré-approbation (marketing et fidélité) ----------
{
  const p = { run_id: UID };
  const need = decide(req('marketing.send_campaign', p), live, ctx());
  check('envoi de campagne sans pré-approbation : approbation nécessaire', need.kind === 'needs_approval' && need.risk === 'medium');
  const pre = decide(req('marketing.send_campaign', p), { ...live, preapproved: ['marketing.send_campaign'] }, ctx());
  check('envoi de campagne pré-approuvé par l’administrateur : permis, motif noté', pre.kind === 'allow' && pre.reasons.includes('pre_approuvee'));
  check('pré-approuvé mais limite atteinte (1 par jour) : refusé quand même', decide(req('marketing.send_campaign', { run_id: UID2 }), { ...live, preapproved: ['marketing.send_campaign'] }, ctx({ history: [hist('marketing.send_campaign', `marketing.send_campaign:${UID}`, 'done')] })).reasons[0] === 'limite_journaliere');
  check('pré-approuvé mais la permission « envoyer » n’est pas accordée : refusé', decide(req('marketing.send_campaign', p), { ...live, preapproved: ['marketing.send_campaign'], grants: ['intel.marketing.prepare'] }, ctx()).reasons[0] === 'permission_manquante');
  check('préparer la campagne (simulation) est automatique ; l’envoyer ne l’est pas', decide(req('marketing.prepare_campaign', { date: TODAY }), live, ctx()).kind === 'allow' && need.kind !== 'allow');
}

// ---------- 10. les réglages venant de la base sont nettoyés ----------
{
  const c = cleanState({ mode: 'live', kill_switch: false, permissions: ['intel.report', 'intel.hack', 'never', 7], preapproved: ['marketing.send_campaign', 'catalog.price_change', 'code.modify', 'inconnu'], limits: { 'admin.notify': { perDay: 3, perRun: 'beaucoup' }, 'code.modify': { perDay: 5 }, inconnu: { perDay: 1 }, 'report.daily_summary': { perDay: -4 } } });
  check('réglages : permissions inconnues ou « never » ignorées', JSON.stringify(c.grants) === JSON.stringify(['intel.report']));
  check('réglages : seuls les types « configurable » peuvent être pré-approuvés (pas un prix, pas un interdit)', JSON.stringify(c.preapproved) === JSON.stringify(['marketing.send_campaign']));
  check('réglages : limites invalides, négatives ou sur un interdit ignorées', JSON.stringify(c.limitOverrides) === JSON.stringify({ 'admin.notify': { perDay: 3 }, 'report.daily_summary': {} }), c.limitOverrides);
  check('réglages illisibles : mode ÉTEINT et arrêt d’urgence ACTIF par défaut', cleanState({}).mode === 'off' && cleanState({}).killSwitch === true && cleanState({ mode: 'turbo', kill_switch: null }).mode === 'off' && cleanState({ mode: 'turbo', kill_switch: null }).killSwitch === true && cleanState({ mode: 'live', kill_switch: 'false' as any }).killSwitch === true);
  check('seul « kill_switch: false » (booléen) lève l’arrêt d’urgence', cleanState({ mode: 'simulation', kill_switch: false }).killSwitch === false && cleanState({ mode: 'simulation', kill_switch: true }).killSwitch === true);
  check('réglages : mode « simulation » et « live » reconnus', cleanState({ mode: 'simulation' }).mode === 'simulation' && cleanState({ mode: 'live' }).mode === 'live');
}

// ---------- 11. pureté et indépendance du modèle ----------
{
  const deepFreeze = <T>(o: T): T => {
    if (o && typeof o === 'object') {
      Object.freeze(o);
      for (const v of Object.values(o as object)) deepFreeze(v);
    }
    return o;
  };
  const state = deepFreeze({ ...live, grants: [...PERMISSIONS], preapproved: ['marketing.send_campaign'], limitOverrides: { 'admin.notify': { perDay: 3 } } });
  const context = deepFreeze(ctx({ history: [hist('admin.notify', 'x', 'done')], approvals: [] }));
  const request = deepFreeze(req('marketing.send_campaign', { run_id: UID }, 'ai'));
  let threw = false;
  let a1: unknown;
  let a2: unknown;
  try {
    a1 = decide(request, state, context);
    a2 = decide(request, state, context);
  } catch {
    threw = true;
  }
  check('décider ne modifie rien (état, historique, requête gelés : aucune écriture) et donne le même résultat à chaque fois', !threw && JSON.stringify(a1) === JSON.stringify(a2));
  const same = (['ai', 'rule', 'admin'] as const).map((s) => JSON.stringify(decide(req('catalog.price_change', { product_id: UID, new_price: 9000 }, s), live, ctx())));
  check('la décision ne dépend pas de la source : l’IA n’a pas plus (ni moins) de droits que l’administrateur par ce canal', new Set(same).size === 1);
  check('une demande de l’IA qui tente d’élargir ses droits dans les paramètres est refusée (champ inconnu), jamais interprétée', decide(req('analysis.run_radar', { grants: ['intel.sensitive'], mode: 'live' }, 'ai'), live, ctx()).reasons[0] === 'parametres_invalides');
  check('empreinte stable (ordre des champs sans effet) et sensible à toute valeur', hashParams({ a: 1, b: 2 }) === hashParams({ b: 2, a: 1 }) && hashParams({ a: 1, b: 2 }) !== hashParams({ a: 1, b: 3 }) && stableStringify({ b: [1, { z: 1, a: 2 }], a: null }) === '{"a":null,"b":[1,{"a":2,"z":1}]}');
  check('la décision est complète pour le journal : type, groupe, risque, exécuteur, identifiant, empreinte, étiquette', (() => { const x = decide(req('catalog.suggest_restock', { product_id: UID }), live, ctx()); return x.type === 'catalog.suggest_restock' && x.group === 'catalog' && x.risk === 'low' && x.executor === 'manual' && !!x.key && !!x.paramsHash && x.label.length > 5; })());
  const codes = ['type_inconnu', 'interdit', 'mode_eteint', 'arret_urgence', 'parametres_invalides', 'permission_manquante', 'doublon', 'limite_par_passage', 'limite_journaliere', 'approbation_requise', 'approbation_expiree', 'pre_approuvee', 'recommandation_seulement'];
  check('toutes les raisons possibles ont une phrase en français, et le tableau ne contient rien d’autre', codes.every((r) => (REASON_LABELS[r] ?? '').length > 10) && Object.keys(REASON_LABELS).length === codes.length, Object.keys(REASON_LABELS));
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
