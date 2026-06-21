const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const responses = [];
const context = {
  console,
  appState: null,
  tt: (en) => en,
  fetch: async () => responses.shift(),
  App: { render: () => {} },
  URL,
  TextDecoder
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(`const DEFAULT_MODELS = {
  anthropic: ['claude-fallback'],
  openai: ['gpt-fallback'],
  azure_openai: ['gpt-fallback'],
  google_gemini: ['gemini-fallback'],
  mistral: ['mistral-fallback']
};`, context);
vm.runInContext(fs.readFileSync('js/ai.js', 'utf8'), context, { filename: 'js/ai.js' });

function response(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

async function run() {
  responses.push(response({
    data: [
      { id: 'gpt-4o' },
      { id: 'gpt-4o-mini' },
      { id: 'gpt-4o-realtime-preview' },
      { id: 'text-embedding-3-small' },
      { id: 'o4-mini' }
    ]
  }));
  const openAI = await vm.runInContext(`fetchAIModels({
    ai_provider: 'openai',
    ai_api_key: 'test-key'
  })`, context);
  assert.deepEqual(Array.from(openAI), ['gpt-4o', 'gpt-4o-mini', 'o4-mini']);

  responses.push(response({
    models: [
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
    ]
  }));
  const gemini = await vm.runInContext(`fetchAIModels({
    ai_provider: 'google_gemini',
    ai_api_key: 'test-key'
  })`, context);
  assert.deepEqual(Array.from(gemini), ['gemini-2.5-pro']);

  responses.push(response({
    data: [
      { id: 'mistral-large-latest', capabilities: { completion_chat: true } },
      { id: 'mistral-embed', capabilities: { completion_chat: false } },
      { id: 'voxtral-mini-transcribe', capabilities: { completion_chat: false } }
    ]
  }));
  const mistral = await vm.runInContext(`fetchAIModels({
    ai_provider: 'mistral',
    ai_api_key: 'test-key'
  })`, context);
  assert.deepEqual(Array.from(mistral), ['mistral-large-latest']);

  context.appState = {
    scenario: { settings: { ai_provider: 'anthropic', ai_model: 'claude-custom', ai_api_key: '' } },
    aiModelCatalog: {
      provider: 'anthropic',
      status: 'success',
      models: ['claude-api-model'],
      error: '',
      loadedAt: null,
      requestId: 1
    }
  };
  const available = vm.runInContext('availableAIModels()', context);
  assert.deepEqual(Array.from(available), ['claude-custom', 'claude-api-model']);

  context.appState.aiModelCatalog = vm.runInContext('makeDefaultAIModelCatalog()', context);
  await vm.runInContext('refreshAIModelCatalog()', context);
  assert.equal(context.appState.aiModelCatalog.status, 'missing-key');
  assert.match(context.appState.aiModelCatalog.error, /API key/);

  console.log('Dynamic AI model catalog tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
