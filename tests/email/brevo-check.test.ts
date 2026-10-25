// Contrôle de la connexion à Brevo (supabase/functions/brevo-email/brevoCheck.ts), avec un faux Brevo.
// Lancer : node --import ./tests/zara/register.mjs tests/email/brevo-check.test.ts
import { brevoCheck } from '../../supabase/functions/brevo-email/brevoCheck.ts';

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

const KEY = 'xkeysib-' + 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' + '-SecretTest1234';
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

interface Calls { method: string; url: string; keyHeader: string | undefined }
function brevo(routes: Record<string, { status: number; body?: unknown } | 'network'>) {
  const calls: Calls[] = [];
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ method: init?.method ?? 'GET', url, keyHeader: init?.headers?.['api-key'] });
    const path = url.replace('https://api.brevo.com/v3', '').split('?')[0];
    const r = routes[path];
    if (r === 'network') throw new Error('réseau coupé ' + KEY); // une erreur qui contiendrait la clé ne doit rien révéler
    if (!r) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}
const good = {
  '/account': { status: 200, body: { email: 'patron@exemple.com', firstName: 'Prénom', lastName: 'Nom', companyName: 'Société privée', plan: [{ type: 'free', credits: 300, creditsType: 'sendLimit' }] } },
  '/senders': { status: 200, body: { senders: [{ id: 1, name: 'Albasse Shopping', email: 'contact@albasseshopping.com', active: true }] } },
  '/senders/domains/albasseshopping.com': { status: 200, body: { domain_name: 'albasseshopping.com', authenticated: true, verified: true } },
  '/smtp/statistics/events': { status: 200, body: { events: [] } },
  '/smtp/statistics/aggregatedReport': { status: 200, body: { range: '2026-10-18 - 2026-10-25', requests: 58, delivered: 53, hardBounces: 1, softBounces: 0, blocked: 0, invalid: 0, spamReports: 0, unsubscribed: 0, clicks: 4, uniqueClicks: 3 } },
};
const run = (routes: any, env: Record<string, string | undefined> = { BREVO_API_KEY: KEY }) => {
  const b = brevo(routes);
  return brevoCheck({ env: (n) => env[n], fetchFn: b.fetchFn, now: () => NOW }).then((r) => ({ r, calls: b.calls }));
};

// tout va bien
{
  const { r, calls } = await run(good);
  check('connexion bonne : ok, forfait et crédits lus, expéditeur actif, domaine authentifié, journal d’événements accessible, clé non limitée', r.ok && !r.limited_key && r.account?.plan[0].type === 'free' && r.account.plan[0].credits === 300 && r.sender?.found === true && r.sender.active === true && r.domain?.authenticated === true && r.events_api?.accessible === true, r);
  check('chiffres de Brevo sur 7 jours lus (envoyés 58, livrés 53, 1 rebond dur, 4 clics) : la confirmation vient de Brevo', r.report_7d?.requests === 58 && r.report_7d.delivered === 53 && r.report_7d.hardBounces === 1 && r.report_7d.clicks === 4, r.report_7d);
  check('uniquement des lectures (GET), jamais d’envoi d’e-mail', calls.length === 5 && calls.every((c) => c.method === 'GET') && !calls.some((c) => /smtp\/email/.test(c.url)), calls.map((c) => c.method + c.url));
  check('la clé part en en-tête seulement, jamais dans l’adresse appelée', calls.every((c) => c.keyHeader === KEY && !c.url.includes(KEY)));
  const text = JSON.stringify(r);
  check('le résultat ne contient JAMAIS la clé (ni un morceau), ni l’adresse, ni le nom du titulaire', !text.includes(KEY) && !text.includes('a1b2c3d4') && !text.includes('SecretTest') && !text.includes('patron@exemple.com') && !text.includes('Société privée') && !text.includes('Prénom'), text);
  check('format de la clé reconnu sans la montrer', r.key_present === true && r.key_format_ok === true);
}
// clé absente
{
  const { r, calls } = await run(good, {});
  check('clé absente : « no_key », aucun appel réseau', !r.ok && r.reason === 'no_key' && r.key_present === false && calls.length === 0);
}
// clé refusée partout
{
  const refused = { status: 401, body: { code: 'unauthorized', message: 'Key not found' } };
  const { r } = await run({ '/account': refused, '/senders': refused, '/senders/domains/albasseshopping.com': refused, '/smtp/statistics/events': refused, '/smtp/statistics/aggregatedReport': refused });
  check('clé refusée (401) : « unauthorized », pas ok, le code et le message de Brevo sont rapportés', !r.ok && r.reason === 'unauthorized' && r.account?.http_status === 401 && r.endpoints.every((e) => e.http_status === 401 && e.brevo_code === 'unauthorized' && e.message === 'Key not found'), r);
}
// un message de Brevo qui contiendrait la clé : elle est retirée
{
  const leaky = { status: 401, body: { code: 'unauthorized', message: 'La clé ' + KEY + ' est inconnue' } };
  const { r } = await run({ '/account': leaky, '/senders': leaky, '/senders/domains/albasseshopping.com': leaky, '/smtp/statistics/events': leaky, '/smtp/statistics/aggregatedReport': leaky });
  check('message de Brevo contenant la clé : elle est remplacée par *** dans le résultat', !JSON.stringify(r).includes(KEY) && !JSON.stringify(r).includes('SecretTest') && JSON.stringify(r).includes('***'), r.endpoints[0]);
}
// réseau coupé : l'erreur ne révèle pas la clé
{
  const { r } = await run({ '/account': 'network', '/senders': 'network', '/senders/domains/albasseshopping.com': 'network', '/smtp/statistics/events': 'network', '/smtp/statistics/aggregatedReport': 'network' });
  check('réseau coupé : « unreachable », rien de la clé dans le résultat', !r.ok && r.reason === 'unreachable' && !JSON.stringify(r).includes(KEY) && r.endpoints.every((e) => e.http_status === 0), r);
}
// Brevo en panne partout (500)
{
  const down = { status: 500 };
  const { r } = await run({ '/account': down, '/senders': down, '/senders/domains/albasseshopping.com': down, '/smtp/statistics/events': down, '/smtp/statistics/aggregatedReport': down });
  check('erreur 500 de Brevo partout : « brevo_error », pas ok', !r.ok && r.reason === 'brevo_error');
}
// le cas réel d'Albasse Shopping : clé LIMITÉE. Brevo refuse le compte, les expéditeurs et le domaine (403) mais laisse lire le journal des e-mails
{
  const denied = { status: 403, body: { code: 'permission_denied', message: 'api key is not authorized for resource "account"' } };
  const { r } = await run({ '/account': denied, '/senders': denied, '/senders/domains/albasseshopping.com': denied, '/smtp/statistics/events': good['/smtp/statistics/events'], '/smtp/statistics/aggregatedReport': good['/smtp/statistics/aggregatedReport'] });
  check('clé limitée (compte, expéditeurs, domaine refusés ; journal lu) : reconnue (ok), marquée « limited_key », refus rapportés avec le code et le message de Brevo', r.ok && r.limited_key && r.endpoints[0].brevo_code === 'permission_denied' && /not authorized/.test(r.endpoints[0].message ?? '') && r.endpoints[3].http_status === 200 && r.events_api?.accessible === true, r);
  check('clé limitée : l’expéditeur reste « non vérifiable » (found = null), jamais présenté comme bon', r.sender?.found === null && r.sender?.active === null && r.domain?.authenticated === null, r.sender);
  check('clé limitée : les chiffres de Brevo sur 7 jours sont quand même lus', r.report_7d?.delivered === 53, r.report_7d);
}
// expéditeur absent ou inactif
{
  const noSender = await run({ ...good, '/senders': { status: 200, body: { senders: [{ email: 'autre@exemple.com', active: true }] } } });
  check('expéditeur absent de Brevo : pas ok (« sender_missing »)', !noSender.r.ok && noSender.r.reason === 'sender_missing' && noSender.r.sender?.found === false);
  const off = await run({ ...good, '/senders': { status: 200, body: { senders: [{ email: 'Contact@AlbasseShopping.com', active: false }] } } });
  check('expéditeur inactif (majuscules ignorées) : pas ok (« sender_inactive »)', !off.r.ok && off.r.reason === 'sender_inactive' && off.r.sender?.found === true && off.r.sender.active === false);
  const custom = await run({ ...good, '/senders': { status: 200, body: { senders: [{ email: 'ventes@albasseshopping.com', active: true }] } }, '/senders/domains/albasseshopping.com': { status: 200, body: { authenticated: false, verified: true } } }, { BREVO_API_KEY: KEY, EMAIL_SENDER: 'ventes@albasseshopping.com' });
  check('expéditeur choisi par EMAIL_SENDER : c’est lui qui est vérifié ; domaine non authentifié signalé', custom.r.ok && custom.r.sender?.email === 'ventes@albasseshopping.com' && custom.r.domain?.authenticated === false, custom.r);
}
// journal d'événements non autorisé ou domaine inconnu : signalé, sans bloquer
{
  const { r } = await run({ ...good, '/smtp/statistics/events': { status: 403 }, '/senders/domains/albasseshopping.com': { status: 404 } });
  check('journal d’événements refusé et domaine inconnu : signalés (accessible=false, authenticated=null) sans casser le contrôle', r.ok && r.events_api?.accessible === false && r.events_api.http_status === 403 && r.domain?.authenticated === null, r);
}

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
