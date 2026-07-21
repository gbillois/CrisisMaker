const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const responses = [];
const requests = [];
const context = {
  console,
  appState: null,
  tt: (en) => en,
  fetch: async (...args) => {
    requests.push(args);
    return responses.shift();
  },
  App: { render: () => {} },
  pushToast: () => {},
  URL,
  TextDecoder,
  location: { origin: 'https://crisismaker.example' }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(`const DEFAULT_MODELS = {
  anthropic: ['claude-fallback'],
  openai: ['gpt-fallback'],
  openrouter: ['openrouter/auto'],
  azure_openai: ['gpt-fallback'],
  google_gemini: ['gemini-fallback'],
  mistral: ['mistral-fallback']
};`, context);
vm.runInContext(fs.readFileSync('js/errors.js', 'utf8'), context, { filename: 'js/errors.js' });
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
    data: [
      { id: 'openrouter/auto', architecture: { output_modalities: ['text'] } },
      { id: 'openai/gpt-5', architecture: { output_modalities: ['text'] } },
      { id: 'black-forest-labs/flux', architecture: { output_modalities: ['image'] } }
    ]
  }));
  const openRouter = await vm.runInContext(`fetchAIModels({
    ai_provider: 'openrouter',
    ai_api_key: 'test-key'
  })`, context);
  assert.deepEqual(Array.from(openRouter), ['openai/gpt-5', 'openrouter/auto']);
  assert.equal(requests[requests.length - 1][0], 'https://openrouter.ai/api/v1/models');

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

  context.appState = {
    scenario: {
      settings: { ai_provider: 'anthropic', ai_model: 'claude-test', ai_api_key: 'test-key', language: 'en' },
      client: { name: 'Acme', sector: 'Energy', language: 'en' },
      scenario: { summary: 'Ransomware incident affecting production systems.' },
      actors: []
    }
  };
  responses.push(response({
    content: [{
      text: JSON.stringify({
        channel: 'email_internal',
        template_id: 'outlook',
        timestamp_offset_minutes: 60,
        generation_mode: 'ai_guided',
        fields: { subject: 'Status update', body: '<p>Production is degraded.</p>' }
      })
    }]
  }));
  await vm.runInContext(`AITextGenerator.generateStimulusConfig('create 3 injects', appState.scenario, [], 8000)`, context);
  const [, anthropicOptions] = requests[requests.length - 1];
  assert.equal(JSON.parse(anthropicOptions.body).max_tokens, 8000);
  assert.match(vm.runInContext('AITextGenerator.lastRawResponse', context), /Status update/);

  context.appState.scenario.settings = {
    ...context.appState.scenario.settings,
    ai_provider: 'openrouter',
    ai_model: 'openrouter/auto',
    ai_api_key: 'or-key'
  };
  responses.push(response({ choices: [{ message: { content: '{"ok":true}' } }] }));
  await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 1000)`, context);
  const [openRouterUrl, openRouterOptions] = requests[requests.length - 1];
  const openRouterBody = JSON.parse(openRouterOptions.body);
  assert.equal(openRouterUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(openRouterOptions.headers.Authorization, 'Bearer or-key');
  assert.equal(openRouterOptions.headers['HTTP-Referer'], 'https://crisismaker.example');
  assert.equal(openRouterOptions.headers['X-OpenRouter-Title'], 'CrisisMaker');
  assert.deepEqual(openRouterBody.response_format, { type: 'json_object' });

  console.log('Dynamic AI model catalog tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
