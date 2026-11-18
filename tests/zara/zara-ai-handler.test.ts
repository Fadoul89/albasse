// La fonction serveur zara-ai (supabase/functions/zara-ai/index.ts) en entier, avec un FAUX Claude et une FAUSSE base :
// photo → article, limites des photos, mémoire du client connecté (lecture, écriture, oubli, données privées refusées).
// Aucun réseau, aucune base. Lancer : node --import ./tests/zara/zara-ai-register.mjs tests/zara/zara-ai-handler.test.ts

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600));
    process.exitCode = 1;
  }
};

type Reply = { content: any[]; stop_reason: string };
type World = {
  limits?: Record<string, boolean>; // préfixe de clé (v, ip, pv, pip) → permis ?
  users?: Record<string, { id: string; is_anonymous?: boolean }>; // jeton → compte
  memory?: Record<string, string[]>; // user_id → notes
  memoryMissing?: boolean; // la table zara_memory n'existe pas
  script: (req: any, n: number) => Reply; // ce que répond le faux Claude au n-ième appel
};
let world: World;
const log = { rpc: [] as any[], requests: [] as any[], upserts: [] as any[], deletes: [] as any[] };

const PRODUCTS = [
  { id: 'p1', name: 'Chaussure modèle SPORT', price: 8500, compare_at_price: null, stock: 4, category_id: 'c1', is_active: true, description: 'Chaussure de sport homme', likes_count: 3 },
  { id: 'p2', name: 'Chaussures Homme REVA', price: 8000, compare_at_price: 10000, stock: 2, category_id: 'c1', is_active: true, description: 'Mocassin bleu', likes_count: 1 },
  { id: 'p3', name: 'Parfum NOVA M95', price: 16000, compare_at_price: null, stock: 9, category_id: 'c2', is_active: true, description: 'Parfum homme', likes_count: 0 },
];
const CATS = [{ id: 'c1', name: 'Chaussures' }, { id: 'c2', name: 'Parfums' }];

function query(table: string) {
  const q: any = { table, filters: {} as Record<string, unknown> };
  const result = () => {
    if (table === 'products') return { data: PRODUCTS, error: null };
    if (table === 'categories') return { data: CATS, error: null };
    if (table === 'orders') return { data: [{ items: [{ product_id: 'p1', quantity: 2 }], status: 'delivered' }], error: null };
    if (table === 'zara_memory') {
      if (world.memoryMissing) return { data: null, error: { message: 'relation "zara_memory" does not exist' } };
      const notes = world.memory?.[String(q.filters.user_id)];
      return { data: notes ? { notes } : null, error: null };
    }
    return { data: null, error: { message: 'table inconnue' } };
  };
  q.select = () => q;
  q.eq = (k: string, v: unknown) => ((q.filters[k] = v), q);
  q.neq = () => q;
  q.limit = () => q;
  q.maybeSingle = async () => result();
  q.then = (res: any, rej: any) => Promise.resolve(q.op === 'delete' ? (log.deletes.push({ table, ...q.filters }), { error: null }) : result()).then(res, rej);
  q.upsert = async (row: any) => {
    log.upserts.push({ table, row });
    return { error: null };
  };
  q.delete = () => ((q.op = 'delete'), q);
  return q;
}

(globalThis as any).__zaraFake = {
  db: {
    rpc: async (name: string, args: { p_key: string; p_limit: number }) => {
      log.rpc.push({ name, ...args });
      const prefix = args.p_key.split(':')[0];
      return { data: world.limits?.[prefix] ?? true, error: null };
    },
    auth: {
      getUser: async (token: string) => {
        const user = world.users?.[token];
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } };
      },
    },
    from: (table: string) => query(table),
  },
  anthropic: async (req: any) => {
    log.requests.push(req);
    return world.script(req, log.requests.length);
  },
};
let handler: (req: Request) => Promise<Response>;
(globalThis as any).Deno = {
  serve: (fn: any) => {
    handler = fn;
  },
  env: { get: (k: string) => ({ ANTHROPIC_API_KEY: 'test', SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'test' } as Record<string, string>)[k] },
};
await import('../../supabase/functions/zara-ai/index.ts');

async function ask(w: World, body: Record<string, unknown>, token?: string) {
  world = w;
  log.rpc = [];
  log.requests = [];
  log.upserts = [];
  log.deletes = [];
  const res = await handler(
    new Request('http://x/zara-ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as any };
}

const text = (t: string): Reply => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
const tool = (name: string, input: unknown, id = 'tu1'): Reply => ({ content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' });
const JPEG = '/9j/' + 'A'.repeat(400);
const systemOf = (req: any) => (Array.isArray(req.system) ? req.system.map((b: any) => b.text).join('\n') : String(req.system));
const toolNames = (req: any) => (req.tools ?? []).map((t: any) => t.name).sort().join(',');

// 1. Photo d'un visiteur : la photo arrive à Claude, Zara cherche puis montre des articles
{
  const r = await ask(
    {
      script: (req, n) =>
        n === 1 ? tool('search_products', { query: 'chaussure sport homme' }) : n === 2 ? tool('show_products', { product_ids: ['p1', 'p2', 'inconnu'] }, 'tu2') : text('Je vois des chaussures de sport. Voici ce qui ressemble :'),
    },
    { photo: { mediaType: 'image/jpeg', data: JPEG }, visitorId: 'v1', history: [{ role: 'user', text: '(photo envoyée)' }] },
  );
  const first = log.requests[0];
  const last = first.messages[first.messages.length - 1];
  check('photo : réponse ok avec les articles montrés (id inconnu ignoré)', r.json.ok && r.json.productIds.join() === 'p1,p2', r.json);
  check('photo : l\'image part à Claude (base64 JPEG) avec le message par défaut', Array.isArray(last.content) && last.content[0].type === 'image' && last.content[0].source.data === JPEG && last.content[0].source.media_type === 'image/jpeg' && /photo/.test(last.content[1].text), last);
  check('photo : limites photo (pv, pip) puis messages (v, ip) comptées', ['pv:v1', 'pip:1.2.3.4', 'v:v1', 'ip:1.2.3.4'].every((k) => log.rpc.some((c) => c.p_key === k)) && log.rpc.find((c) => c.p_key === 'pv:v1').p_limit === 5);
  check('photo : consignes photo données à Zara', /Photo → article/.test(systemOf(first)) && /Ne décris jamais une personne/.test(systemOf(first)));
  check('visiteur : pas d\'outil de mémoire, réponse memory = null', toolNames(first) === 'list_promotions,search_products,show_products' && r.json.memory === null && /pas connecté/.test(systemOf(first)));
}

// 2. Limite des 5 photos atteinte : Claude n'est pas appelé
{
  const r = await ask({ limits: { pv: false }, script: () => text('ne doit pas être appelé') }, { photo: { mediaType: 'image/jpeg', data: JPEG }, visitorId: 'v1' });
  check('6e photo du jour : refusée (photo_limit), Claude pas appelé', r.json.ok === false && r.json.reason === 'photo_limit' && log.requests.length === 0, r.json);
}

// 3. Photo invalide, ou rien du tout
{
  const bad = await ask({ script: () => text('x') }, { photo: { mediaType: 'image/gif', data: JPEG }, visitorId: 'v1' });
  check('photo d\'un type refusé : 400 bad_photo, rien n\'est compté', bad.status === 400 && bad.json.reason === 'bad_photo' && log.rpc.length === 0);
  const empty = await ask({ script: () => text('x') }, { visitorId: 'v1' });
  check('ni texte ni photo : 400', empty.status === 400 && empty.json.reason === 'bad_request');
  const textOnly = await ask({ script: () => text('Bonjour !') }, { message: 'bonjour', visitorId: 'v1' });
  check('message écrit sans photo : comme avant (pas de limite photo comptée)', textOnly.json.ok && !log.rpc.some((c) => c.p_key.startsWith('p')) && typeof log.requests[0].messages.at(-1).content === 'string');
}

// 4. Client connecté : Zara lit sa mémoire, puis note la pointure (le téléphone est refusé)
{
  const r = await ask(
    {
      users: { 'aaa.bbb.ccc': { id: 'u1' } },
      memory: { u1: ['budget parfum : environ 20 000 FCFA'] },
      script: (req, n) =>
        n === 1
          ? tool('update_memory', { notes: ['budget parfum : environ 20 000 FCFA', 'pointure 42', 'téléphone 66 12 34 56'] })
          : text('Noté : pointure 42. Voici des modèles pour homme.'),
    },
    { message: 'Je fais du 42, mon numéro est 66 12 34 56', visitorId: 'v2' },
    'aaa.bbb.ccc',
  );
  const first = log.requests[0];
  check('connecté : ses notes sont dans les consignes, outil update_memory donné', systemOf(first).includes('- budget parfum : environ 20 000 FCFA') && toolNames(first).includes('update_memory'));
  check('connecté : la mémoire est enregistrée sans le téléphone', log.upserts.length === 1 && JSON.stringify(log.upserts[0].row.notes) === JSON.stringify(['budget parfum : environ 20 000 FCFA', 'pointure 42']) && log.upserts[0].row.user_id === 'u1', log.upserts);
  check('connecté : la réponse donne la nouvelle mémoire au site', JSON.stringify(r.json.memory) === JSON.stringify(['budget parfum : environ 20 000 FCFA', 'pointure 42']), r.json);
}

// 5. « Oublie tout » : la ligne est effacée
{
  const r = await ask(
    { users: { 'aaa.bbb.ccc': { id: 'u1' } }, memory: { u1: ['pointure 42'] }, script: (req, n) => (n === 1 ? tool('update_memory', { notes: [] }) : text('C\'est oublié.')) },
    { message: 'oublie tout ce que tu sais sur moi', visitorId: 'v2' },
    'aaa.bbb.ccc',
  );
  check('oubli demandé : la ligne zara_memory du client est effacée', log.deletes.length === 1 && log.deletes[0].user_id === 'u1' && log.upserts.length === 0 && JSON.stringify(r.json.memory) === '[]', { deletes: log.deletes, json: r.json });
}

// 6. Seulement des données privées : rien ne change (ce n'est pas un oubli)
{
  const r = await ask(
    { users: { 'aaa.bbb.ccc': { id: 'u1' } }, memory: { u1: ['pointure 42'] }, script: (req, n) => (n === 1 ? tool('update_memory', { notes: ['adresse : Moursal'] }) : text('D\'accord.')) },
    { message: 'j\'habite à Moursal', visitorId: 'v2' },
    'aaa.bbb.ccc',
  );
  const toolResult = log.requests[1].messages.at(-1).content[0];
  check('seulement des données privées : mémoire inchangée (ni écrite ni effacée)', log.upserts.length === 0 && log.deletes.length === 0 && JSON.stringify(r.json.memory) === '["pointure 42"]', r.json);
  check('… et Zara est prévenue que les notes sont refusées', toolResult.is_error === true && /refusées/.test(toolResult.content));
}

// 7. Jeton invalide, compte anonyme, ou table pas installée : pas de mémoire
{
  const bad = await ask({ users: {}, script: () => text('Bonjour') }, { message: 'bonjour', visitorId: 'v3' }, 'xxx.yyy.zzz');
  check('jeton invalide : traité comme un visiteur', bad.json.ok && bad.json.memory === null && !toolNames(log.requests[0]).includes('update_memory'));
  const anon = await ask({ users: { 'aaa.bbb.ccc': { id: 'u9', is_anonymous: true } }, script: () => text('Bonjour') }, { message: 'bonjour', visitorId: 'v3' }, 'aaa.bbb.ccc');
  check('compte anonyme : pas de mémoire', anon.json.memory === null);
  const missing = await ask({ users: { 'aaa.bbb.ccc': { id: 'u1' } }, memoryMissing: true, script: () => text('Bonjour') }, { message: 'bonjour', visitorId: 'v3' }, 'aaa.bbb.ccc');
  check('table zara_memory pas installée : Zara marche comme avant, sans mémoire', missing.json.ok && missing.json.memory === null && !toolNames(log.requests[0]).includes('update_memory'));
}

// 8. Un visiteur qui essaie l'outil de mémoire quand même : refusé
{
  const r = await ask({ script: (req, n) => (n === 1 ? tool('update_memory', { notes: ['pointure 42'] }) : text('Je ne peux pas retenir.')) }, { message: 'souviens-toi de ma pointure', visitorId: 'v4' });
  const toolResult = log.requests[1].messages.at(-1).content[0];
  check('visiteur : update_memory refusé, rien n\'est écrit', toolResult.is_error === true && log.upserts.length === 0 && r.json.memory === null);
}

console.log(`\n${ok} vérifications réussies${process.exitCode ? ' (avec des échecs)' : ''}`);
