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
  TextEncoder,
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
  mistral: ['mistral-fallback'],
  ollama: ['llama3.2']
};
const DEFAULT_AZURE_API_VERSION = '2024-10-21';`, context);
vm.runInContext(fs.readFileSync('js/errors.js', 'utf8'), context, { filename: 'js/errors.js' });
vm.runInContext(fs.readFileSync('js/ai.js', 'utf8'), context, { filename: 'js/ai.js' });

function response(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

function streamResponse(lines, ok = true, status = 200) {
  const chunks = lines.map((line) => new TextEncoder().encode(line));
  return {
    ok,
    status,
    body: {
      getReader: () => ({
        read: async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true }
      })
    }
  };
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

  responses.push(response({
    models: [{ name: 'llama3.2:latest' }, { model: 'qwen3:8b' }]
  }));
  const ollamaLocal = await vm.runInContext(`fetchAIModels({
    ai_provider: 'ollama',
    ai_api_key: '',
    ollama_endpoint: 'http://localhost:11434/'
  })`, context);
  assert.deepEqual(Array.from(ollamaLocal), ['llama3.2:latest', 'qwen3:8b']);
  const [ollamaLocalModelsUrl, ollamaLocalModelsOptions] = requests[requests.length - 1];
  assert.equal(ollamaLocalModelsUrl, 'http://localhost:11434/api/tags');
  assert.equal(ollamaLocalModelsOptions.headers.Authorization, undefined);

  responses.push(response({ models: [{ name: 'gpt-oss:120b' }] }));
  const ollamaCloud = await vm.runInContext(`fetchAIModels({
    ai_provider: 'ollama',
    ai_api_key: 'ollama-cloud-key',
    ollama_mode: 'cloud',
    ollama_endpoint: 'http://localhost:11434'
  })`, context);
  assert.deepEqual(Array.from(ollamaCloud), ['gpt-oss:120b']);
  const [ollamaCloudModelsUrl, ollamaCloudModelsOptions] = requests[requests.length - 1];
  const ollamaCloudModelsProxyBody = JSON.parse(ollamaCloudModelsOptions.body);
  assert.equal(ollamaCloudModelsUrl, 'https://deckseeder.pages.dev/api/llm');
  assert.equal(ollamaCloudModelsProxyBody.url, 'https://ollama.com/api/tags');
  assert.equal(ollamaCloudModelsProxyBody.method, 'GET');
  assert.equal(ollamaCloudModelsProxyBody.headers.Authorization, 'Bearer ollama-cloud-key');

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
      type: 'text',
      text: JSON.stringify({
        stimuli: [1, 2, 3].map((index) => ({
          channel: 'email_internal',
          template_id: 'outlook',
          timestamp_offset_minutes: index * 60,
          generation_mode: 'ai_guided',
          fields: { subject: `Status update ${index}`, body: '<p>Production is degraded.</p>' }
        }))
      })
    }]
  }));
  await vm.runInContext(`AITextGenerator.generateStimulusConfig('create 3 injects', appState.scenario, [], 8000)`, context);
  const [, anthropicOptions] = requests[requests.length - 1];
  const anthropicBody = JSON.parse(anthropicOptions.body);
  assert.equal(anthropicBody.max_tokens, 8000);
  assert.match(anthropicBody.system, /top-level "stimuli" array/);
  assert.match(anthropicBody.system, /exactly 3 objects/);
  assert.match(anthropicBody.messages[0].content, /REQUIRED OUTPUT COUNT: exactly 3/);
  assert.match(vm.runInContext('AITextGenerator.lastRawResponse', context), /Status update/);

  responses.push(response({ content: [{ type: 'text', text: JSON.stringify({ stimuli: [{ channel: 'email_internal', fields: {} }] }) }] }));
  responses.push(response({ content: [{ type: 'text', text: JSON.stringify({ stimuli: [
    { channel: 'email_internal', fields: { subject: 'First' } },
    { channel: 'email_external', fields: { subject: 'Second' } }
  ] }) }] }));
  const correctedBatch = await vm.runInContext(`AITextGenerator.generateStimulusConfig('create 2 injects', appState.scenario, [], 8000)`, context);
  assert.equal(correctedBatch.stimuli.length, 2);
  const retryBody = JSON.parse(requests[requests.length - 1][1].body);
  assert.match(retryBody.messages[0].content, /CORRECTION REQUIRED/);
  assert.match(retryBody.messages[0].content, /exactly 2/);

  // Models with thinking enabled by default (e.g. Claude Sonnet 5) return a leading
  // thinking block with empty text before the actual text block. Regression test for
  // the silent-failure bug where content[0].text (the thinking block) was used directly.
  responses.push(response({
    content: [
      { type: 'thinking', text: '' },
      { type: 'text', text: JSON.stringify({ ok: true, via: 'thinking-model' }) }
    ]
  }));
  const thinkingModelResult = await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 2000)`, context);
  assert.equal(thinkingModelResult.ok, true);
  assert.equal(thinkingModelResult.via, 'thinking-model');

  // When no text block is present at all (e.g. the thinking budget consumed the whole
  // response), Anthropic must now raise an explicit error instead of silently parsing '{}'.
  responses.push(response({ content: [{ type: 'thinking', text: '' }], stop_reason: 'max_tokens' }));
  await assert.rejects(
    vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 2000)`, context),
    /no readable text/
  );

  // A safety refusal (stop_reason "refusal") must also surface as an explicit error.
  responses.push(response({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } }));
  await assert.rejects(
    vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 2000)`, context),
    /declined to answer/
  );

  const editPrompts = vm.runInContext(`LLMConfigPrompts.stimulus(
    'Update the body with the latest status',
    appState.scenario,
    [{ id: 'journalist-1', name: 'Alex Smith', role: 'journalist', organization: 'Daily News', language: 'en' }],
    {
      channel: 'article_press', template_id: 'nyt', actor_id: 'journalist-1',
      timestamp_offset_minutes: 60, fields: { headline: 'Existing headline', body: '<p>Existing body</p>' }
    }
  )`, context);
  assert.match(editPrompts.systemPrompt, /channel and template_id are immutable/);
  assert.match(editPrompts.systemPrompt, /channel exactly "article_press"/);
  assert.match(editPrompts.systemPrompt, /template_id exactly "nyt"/);
  assert.match(editPrompts.systemPrompt, /Existing headline/);
  assert.match(editPrompts.userPrompt, /^UPDATE REQUEST:/);

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

  // Azure OpenAI: by default the client must call the classic per-deployment endpoint with a
  // dated api-version, because that endpoint accepts direct browser requests (CORS) while
  // Azure's newer unified "v1" API does not. A user who explicitly opts into "preview" or
  // "latest" (e.g. because their resource requires the v1 API, behind their own proxy) must
  // get the v1 endpoint instead, with the deployment name passed as "model" in the body. A
  // user-provided dated version must still route to the classic per-deployment endpoint.
  context.appState.scenario.settings = {
    ...context.appState.scenario.settings,
    ai_provider: 'azure_openai',
    azure_endpoint: 'https://example.openai.azure.com',
    azure_api_key: 'azure-key',
    azure_deployment: 'gpt-5-deployment',
    azure_api_version: ''
  };
  responses.push(response({ choices: [{ message: { content: '{"ok":true}' } }] }));
  await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 1000)`, context);
  const [azureDefaultUrl, azureDefaultOptions] = requests[requests.length - 1];
  assert.equal(azureDefaultUrl, 'https://example.openai.azure.com/openai/deployments/gpt-5-deployment/chat/completions?api-version=2024-10-21');
  assert.equal(JSON.parse(azureDefaultOptions.body).model, undefined);

  context.appState.scenario.settings.azure_api_version = '2025-01-01-preview';
  responses.push(response({ choices: [{ message: { content: '{"ok":true}' } }] }));
  await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 1000)`, context);
  const [azureCustomUrl, azureCustomOptions] = requests[requests.length - 1];
  assert.equal(azureCustomUrl, 'https://example.openai.azure.com/openai/deployments/gpt-5-deployment/chat/completions?api-version=2025-01-01-preview');
  assert.equal(JSON.parse(azureCustomOptions.body).model, undefined);

  context.appState.scenario.settings.azure_api_version = 'preview';
  responses.push(response({ choices: [{ message: { content: '{"ok":true}' } }] }));
  await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 1000)`, context);
  const [azureV1Url, azureV1Options] = requests[requests.length - 1];
  assert.equal(azureV1Url, 'https://example.openai.azure.com/openai/v1/chat/completions?api-version=preview');
  assert.equal(JSON.parse(azureV1Options.body).model, 'gpt-5-deployment');

  context.appState.scenario.settings = {
    ...context.appState.scenario.settings,
    ai_provider: 'ollama',
    ai_model: 'gpt-oss:120b',
    ai_api_key: 'ollama-cloud-key',
    ollama_mode: 'cloud',
    ollama_endpoint: 'http://localhost:11434/'
  };
  responses.push(response({ message: { content: '{"ok":true}' }, done: true }));
  await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 1234)`, context);
  const [ollamaUrl, ollamaOptions] = requests[requests.length - 1];
  const ollamaProxyBody = JSON.parse(ollamaOptions.body);
  const ollamaBody = JSON.parse(ollamaProxyBody.body);
  assert.equal(ollamaUrl, 'https://deckseeder.pages.dev/api/llm');
  assert.equal(ollamaProxyBody.url, 'https://ollama.com/api/chat');
  assert.equal(ollamaProxyBody.headers.Authorization, 'Bearer ollama-cloud-key');
  assert.equal(ollamaBody.model, 'gpt-oss:120b');
  assert.equal(ollamaBody.format, undefined);
  assert.equal(ollamaBody.options.num_predict, 1234);
  assert.equal(ollamaBody.stream, false);

  responses.push(streamResponse([
    JSON.stringify({ message: { content: '{"ok":' } }) + '\n',
    JSON.stringify({ message: { content: 'true}' }, done: true }) + '\n'
  ]));
  const ollamaStreamed = await vm.runInContext(`AITextGenerator.generateStreaming('test', 'system', 'user', null, 512)`, context);
  assert.equal(ollamaStreamed.ok, true);
  const [ollamaStreamUrl, ollamaStreamOptions] = requests[requests.length - 1];
  const ollamaStreamProxyBody = JSON.parse(ollamaStreamOptions.body);
  const ollamaStreamBody = JSON.parse(ollamaStreamProxyBody.body);
  assert.equal(ollamaStreamUrl, 'https://deckseeder.pages.dev/api/llm');
  assert.equal(ollamaStreamProxyBody.url, 'https://ollama.com/api/chat');
  assert.equal(ollamaStreamBody.options.num_predict, 512);
  assert.equal(ollamaStreamBody.format, undefined);
  assert.equal(ollamaStreamBody.stream, true);

  context.appState.scenario.settings = {
    ...context.appState.scenario.settings,
    ai_model: 'llama3.2',
    ai_api_key: '',
    ollama_mode: 'local',
    ollama_endpoint: 'http://localhost:11434/'
  };
  responses.push(response({ message: { content: '{"ok":true}' }, done: true }));
  await vm.runInContext(`AITextGenerator.generate('test', 'system', 'user', true, 256)`, context);
  const [ollamaLocalUrl, ollamaLocalOptions] = requests[requests.length - 1];
  const ollamaLocalBody = JSON.parse(ollamaLocalOptions.body);
  assert.equal(ollamaLocalUrl, 'http://localhost:11434/api/chat');
  assert.equal(ollamaLocalBody.format, 'json');
  assert.equal(ollamaLocalBody.options.num_predict, 256);

  console.log('Dynamic AI model catalog tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
