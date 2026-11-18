// Faux module « npm:@anthropic-ai/sdk » pour tester supabase/functions/zara-ai/index.ts sans réseau (voir zara-ai-handler.test.ts).
export default class Anthropic {
  constructor() {
    this.messages = { create: async (req) => globalThis.__zaraFake.anthropic(structuredClone(req)) };
  }
}
