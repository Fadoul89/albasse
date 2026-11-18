// OmniRoute : traduction Claude ↔ format OpenAI (supabase/functions/_shared/omniroute.ts). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/ai/omniroute.test.ts
import { chatUrl, toOpenAI, fromOpenAI } from '../../supabase/functions/_shared/omniroute.ts';

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

// adresse
check('adresse simple', chatUrl('https://r.example.com') === 'https://r.example.com/v1/chat/completions');
check('adresse /v1/', chatUrl(' https://r.example.com/v1/ ') === 'https://r.example.com/v1/chat/completions');
check('adresse complète', chatUrl('https://r.example.com/v1/chat/completions') === 'https://r.example.com/v1/chat/completions');

// demande simple (marketing-ai)
const simple = toOpenAI({ model: 'claude-sonnet-5-5', max_tokens: 100, system: 'SYS', messages: [{ role: 'user', content: 'Bonjour' }], output_config: { effort: 'medium' } }, 'mon-combo');
check('modèle choisi', simple.model === 'mon-combo');
check('system en premier', simple.messages[0].role === 'system' && simple.messages[0].content === 'SYS');
check('message client', simple.messages[1].content === 'Bonjour' && simple.messages.length === 2);
check('pas d\'outils', simple.tools === undefined);
check('output_config non transmis', !('output_config' in simple));

// system en blocs (zara-ai avec prénom)
const blocks = toOpenAI({ model: 'm', max_tokens: 10, system: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }], messages: [{ role: 'user', content: 'x' }] }, 'm');
check('system en blocs joint', blocks.messages[0].content === 'A\n\nB');

// photo (zara-seo)
const photo = toOpenAI({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://img/a.jpg' } }, { type: 'text', text: 'Décris' }] }] }, 'm');
const parts = photo.messages[0].content;
check('photo en image_url', Array.isArray(parts) && parts[0].type === 'image_url' && parts[0].image_url.url === 'https://img/a.jpg');
check('texte après la photo', parts[1].type === 'text' && parts[1].text === 'Décris');
const b64 = toOpenAI({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } }] }] }, 'm');
check('photo base64 en data URL', b64.messages[0].content[0].image_url.url === 'data:image/png;base64,AAA');

// outils (zara-ai) : aller-retour complet
const tools = [{ name: 'search_products', description: 'Cherche', input_schema: { type: 'object', properties: { query: { type: 'string' } } } }];
const r1 = fromOpenAI({ id: 'c1', choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: 'Je cherche', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_products', arguments: '{"query":"montre"}' } }] } }], usage: { prompt_tokens: 5, completion_tokens: 3 } }, 'm');
check('stop tool_use', r1.stop_reason === 'tool_use');
check('texte gardé', r1.content[0].type === 'text' && r1.content[0].text === 'Je cherche');
check('appel d\'outil traduit', r1.content[1].type === 'tool_use' && r1.content[1].id === 'call_1' && r1.content[1].input.query === 'montre');
check('usage traduit', r1.usage.input_tokens === 5 && r1.usage.output_tokens === 3);

const round2 = toOpenAI({
  model: 'm', max_tokens: 10, tools,
  messages: [
    { role: 'user', content: 'une montre' },
    { role: 'assistant', content: r1.content },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '[{"id":"p1"}]' }, { type: 'tool_result', tool_use_id: 'call_2', content: 'Aucun id valide.', is_error: true }] },
  ],
}, 'm');
check('outils en functions', round2.tools[0].type === 'function' && round2.tools[0].function.name === 'search_products' && round2.tools[0].function.parameters.type === 'object');
const a = round2.messages[1];
check('assistant avec tool_calls', a.role === 'assistant' && a.content === 'Je cherche' && a.tool_calls[0].function.arguments === '{"query":"montre"}');
check('résultat → message tool', round2.messages[2].role === 'tool' && round2.messages[2].tool_call_id === 'call_1' && round2.messages[2].content === '[{"id":"p1"}]');
check('erreur d\'outil signalée', round2.messages[3].content === 'Erreur : Aucun id valide.');
check('pas de message client vide', round2.messages.length === 4);

// réponses particulières
check('fin normale', fromOpenAI({ choices: [{ finish_reason: 'stop', message: { content: 'Salut' } }] }, 'm').stop_reason === 'end_turn');
check('coupé → max_tokens', fromOpenAI({ choices: [{ finish_reason: 'length', message: { content: 'Sal' } }] }, 'm').stop_reason === 'max_tokens');
check('filtre → refusal', fromOpenAI({ choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }, 'm').stop_reason === 'refusal');
check('outils malgré finish stop', fromOpenAI({ choices: [{ finish_reason: 'stop', message: { tool_calls: [{ id: 'x', function: { name: 'list_promotions', arguments: '' } }] } }] }, 'm').stop_reason === 'tool_use');
check('arguments illisibles → {}', JSON.stringify(fromOpenAI({ choices: [{ message: { tool_calls: [{ id: 'x', function: { name: 'n', arguments: '{oups' } }] } }] }, 'm').content[0].input) === '{}');
check('texte vide ignoré', fromOpenAI({ choices: [{ finish_reason: 'stop', message: { content: '  ' } }] }, 'm').content.length === 0);
let threw = false;
try { fromOpenAI({ error: { message: 'quota' } }, 'm'); } catch { threw = true; }
check('réponse sans message → erreur (donc secours Claude)', threw);

console.log(`\n${ok} vérifications OK`);
