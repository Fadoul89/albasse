// Les imports « npm:... » de la fonction serveur zara-ai sont remplacés par de faux modules (tests/zara/fakes).
const FAKES = {
  'npm:@anthropic-ai/sdk': new URL('./fakes/anthropic.mjs', import.meta.url).href,
  'npm:@supabase/supabase-js@2': new URL('./fakes/supabase.mjs', import.meta.url).href,
};
export async function resolve(specifier, context, nextResolve) {
  if (FAKES[specifier]) return { url: FAKES[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
