// Faux module « npm:@supabase/supabase-js@2 » : la fausse base est fournie par le test (globalThis.__zaraFake.db).
export function createClient() {
  return globalThis.__zaraFake.db;
}
