// Fausse base en mémoire pour les essais des e-mails de campagne : seulement ce que utilisent marketingRun.ts et drain.ts
// (select, insert, update, upsert, delete, eq, neq, gt, gte, lt, lte, in, is, not, order, limit, range, maybeSingle, single, count).
// Elle imite aussi trois règles de la vraie base : identifiants automatiques, doublons refusés (unicité) et le verrou « live » de
// marketing_ai_guard (add-marketing-intelligence.sql) : une écriture que la vraie base refuserait est refusée ici aussi.
export type Row = Record<string, any>;
export interface FakeOptions {
  now: () => number;
  missing?: string[]; // tables qui n'existent pas (script SQL pas encore lancé)
  unique?: Record<string, string[]>; // table -> colonnes qui ne peuvent pas être en double
  guard?: (table: string, before: Row, after: Row) => string | null; // refuse une mise à jour (comme un déclencheur de la base)
}

let counter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

export function fakeDb(tables: Record<string, Row[]>, opts: FakeOptions) {
  const log: { table: string; op: string; rows: number }[] = [];
  const from = (table: string) => {
    const st: any = { op: 'select', filters: [] as ((r: Row) => boolean)[], payload: null, selOpts: null, orderBy: null, asc: true, lim: null, rng: null, single: false, returning: false, upsertOpts: null };
    const add = (f: (r: Row) => boolean) => (st.filters.push(f), api);
    const api: any = {
      select: (_c?: string, o?: any) => {
        if (st.op === 'select') st.selOpts = o ?? null;
        else st.returning = true;
        return api;
      },
      insert: (rows: Row | Row[]) => ((st.op = 'insert'), (st.payload = Array.isArray(rows) ? rows : [rows]), api),
      upsert: (rows: Row | Row[], o?: any) => ((st.op = 'upsert'), (st.payload = Array.isArray(rows) ? rows : [rows]), (st.upsertOpts = o ?? null), api),
      update: (payload: Row) => ((st.op = 'update'), (st.payload = payload), api),
      delete: () => ((st.op = 'delete'), api),
      eq: (k: string, v: unknown) => add((r) => r[k] === v),
      neq: (k: string, v: unknown) => add((r) => r[k] != null && r[k] !== v),
      gt: (k: string, v: any) => add((r) => r[k] != null && r[k] > v),
      gte: (k: string, v: any) => add((r) => r[k] != null && r[k] >= v),
      lt: (k: string, v: any) => add((r) => r[k] != null && r[k] < v),
      lte: (k: string, v: any) => add((r) => r[k] != null && r[k] <= v),
      in: (k: string, vs: unknown[]) => add((r) => vs.includes(r[k])),
      like: (k: string, pattern: string) => add((r) => typeof r[k] === 'string' && new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(r[k])),
      is: (k: string, v: unknown) => add((r) => (v === null ? r[k] == null : r[k] === v)),
      not: (k: string, op: string, v: unknown) => add((r) => (op === 'is' && v === null ? r[k] != null : true)),
      order: (k: string, o?: { ascending?: boolean }) => ((st.orderBy = k), (st.asc = o?.ascending !== false), api),
      limit: (n: number) => ((st.lim = n), api),
      range: (a: number, b: number) => ((st.rng = [a, b]), api),
      maybeSingle: () => ((st.single = true), api),
      single: () => ((st.single = true), api),
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    const err = (message: string, code = 'XX000') => ({ data: null, error: { message, code }, count: null });
    const run = () => {
      if (opts.missing?.includes(table)) return err(`relation "${table}" does not exist`, '42P01');
      const rows = (tables[table] ??= []);
      const copies = (list: Row[]) => list.map((r) => ({ ...r }));
      const matching = () => rows.filter((r) => st.filters.every((f: (r: Row) => boolean) => f(r)));
      const finish = (list: Row[]) => {
        const out = copies(list);
        return st.single ? { data: out[0] ?? null, error: null, count: null } : { data: out, error: null, count: null };
      };
      if (st.op === 'insert' || st.op === 'upsert') {
        const added: Row[] = [];
        for (const p of st.payload as Row[]) {
          const row: Row = { ...p };
          if (!('id' in row) && table !== 'email_prefs' && table !== 'marketing_ai_settings') row.id = uuid();
          if (table === 'email_prefs' && !row.token) row.token = uuid();
          if (!row.created_at && table !== 'email_prefs') row.created_at = new Date(opts.now()).toISOString();
          if (table === 'email_outbox') Object.assign(row, { status: row.status ?? 'pending', attempts: 0, click_count: 0, updated_at: row.created_at });
          const cols = opts.unique?.[table];
          if (cols && rows.some((r) => cols.every((c) => r[c] === row[c]))) {
            if (st.op === 'upsert' && st.upsertOpts?.ignoreDuplicates) continue;
            return err(`duplicate key on ${table}`, '23505');
          }
          rows.push(row);
          added.push(row);
        }
        log.push({ table, op: st.op, rows: added.length });
        return st.returning ? finish(added) : { data: null, error: null, count: null };
      }
      if (st.op === 'update') {
        const hit = matching();
        const nexts = hit.map((r) => ({ ...r, ...st.payload }));
        for (let i = 0; i < hit.length; i++) {
          const refusal = opts.guard?.(table, hit[i], nexts[i]);
          if (refusal) return err(refusal, 'P0001');
        }
        hit.forEach((r, i) => Object.assign(r, nexts[i]));
        log.push({ table, op: 'update', rows: hit.length });
        return st.returning ? finish(hit) : { data: null, error: null, count: null };
      }
      if (st.op === 'delete') {
        const hit = matching();
        tables[table] = rows.filter((r) => !hit.includes(r));
        log.push({ table, op: 'delete', rows: hit.length });
        return { data: null, error: null, count: null };
      }
      let list = matching();
      if (st.orderBy) list = [...list].sort((a, b) => (String(a[st.orderBy]).localeCompare(String(b[st.orderBy])) || 0) * (st.asc ? 1 : -1));
      if (st.selOpts?.count) return { data: null, error: null, count: list.length };
      if (st.rng) list = list.slice(st.rng[0], st.rng[1] + 1);
      if (st.lim != null) list = list.slice(0, st.lim);
      return finish(list);
    };
    return api;
  };
  return { service: { from }, tables, log };
}

// Le verrou « live » de la base (même règles que marketing_ai_guard dans add-marketing-intelligence.sql)
export function liveGuard(now: () => number) {
  const HOUR = 3600_000;
  return (table: string, before: Row, after: Row): string | null => {
    if (table !== 'marketing_ai_settings') return null;
    const t = (v: unknown) => (v ? Date.parse(String(v)) : null);
    if (after.mode === 'live') {
      const n = now();
      const brevo = t(after.brevo_checked_at);
      const sim = t(after.last_simulation_at);
      const test = t(after.test_email_at);
      if (
        !after.validated_at ||
        after.brevo_ok !== true ||
        brevo === null ||
        brevo < n - 24 * HOUR ||
        sim === null ||
        sim < n - 48 * HOUR ||
        (after.last_simulation_blocking ?? 1) > 0 ||
        test === null ||
        !after.test_email_message_id ||
        test < n - 30 * 24 * HOUR
      )
        return 'marketing_ai: passage en live refusé (contrôles ou validation manquants)';
    } else if (before.mode === 'live') {
      after.validated_at = null;
      after.validated_by = null;
    }
    return null;
  };
}
