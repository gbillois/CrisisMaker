const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

/* The AI local server (CoPro Desktop's Local API, LM Studio, llama.cpp, vLLM, Ollama's /v1):
   OpenAI Chat Completions at a base URL the user types, key optional, always called directly. */
function harness(settings = {}) {
  const requests = [], replies = [];
  const context = vm.createContext({
    URL, TextDecoder, TextEncoder, console, AbortController, DOMException, setTimeout, clearTimeout,
    tt: en => en, pushToast: () => {}, App: { render: () => {} },
    location: { origin: 'https://gbillois.github.io' },
    appState: { scenario: { settings: { ai_provider: 'local_server', ai_model: 'gpt-5.5', ai_api_key: '',
      local_server_url: 'http://127.0.0.1:11434/v1/', ...settings } } },
    fetch: async (url, init = {}) => {
      requests.push({ url, init });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      assert.ok(reply, 'Unexpected extra request');
      return reply;
    }
  });
  vm.runInContext(`const DEFAULT_MODELS = { openai: ['gpt-fallback'], local_server: [] };
    const DEFAULT_AZURE_API_VERSION = '2024-10-21';
    const DEFAULT_LOCAL_SERVER_URL = 'http://127.0.0.1:11434/v1';`, context);
  for (const file of ['errors', 'tech-log', 'ai']) vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), context, { filename: `js/${file}.js` });
  return { context, requests, replies, run: code => vm.runInContext(code, context) };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const chat = content => json({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] });
const headers = request => ({ ...request.init.headers });

test('model list comes from {base}/models, with the key header only when a key is set', async () => {
  const h = harness();
  h.replies.push(json({ object: 'list', data: [{ id: 'gpt-5.5', object: 'model' }, { id: 'claude-sonnet-5', object: 'model' }] }));
  const models = await h.run('fetchAIModels(appState.scenario.settings)');
  assert.deepEqual(Array.from(models), ['claude-sonnet-5', 'gpt-5.5']);
  assert.equal(h.requests[0].url, 'http://127.0.0.1:11434/v1/models');
  assert.equal(headers(h.requests[0]).Authorization, undefined);

  h.context.appState.scenario.settings.ai_api_key = ' local-key ';
  h.replies.push(json({ object: 'list', data: [{ id: 'gpt-5.5' }] }));
  await h.run('fetchAIModels(appState.scenario.settings)');
  assert.equal(headers(h.requests[1]).Authorization, 'Bearer local-key');

  // A URL typed without /v1 is used as typed: no guess.
  h.context.appState.scenario.settings.local_server_url = 'http://localhost:1234';
  h.replies.push(json({ data: [{ id: 'qwen3-8b' }] }));
  await h.run('fetchAIModels(appState.scenario.settings)');
  assert.equal(h.requests[2].url, 'http://localhost:1234/models');
  assert.ok(h.requests.every(request => !String(request.url).includes('deckseeder')));
});

test('refreshing the list loads models without a key and picks the first when none is set', async () => {
  const h = harness({ ai_model: '' });
  h.context.appState.aiModelCatalog = h.run('makeDefaultAIModelCatalog()');
  h.replies.push(json({ object: 'list', data: [{ id: 'gpt-5.5' }, { id: 'gpt-5-mini' }] }));
  await h.run('refreshAIModelCatalog(true)');
  assert.equal(h.context.appState.aiModelCatalog.status, 'success');
  assert.equal(h.context.appState.scenario.settings.ai_model, 'gpt-5-mini');

  // A list that cannot be loaded keeps the model already chosen, and is an error, not a missing key.
  h.context.appState.scenario.settings.ai_model = 'gpt-5.5';
  h.replies.push(new TypeError('Failed to fetch'));
  await h.run('refreshAIModelCatalog(true)');
  assert.equal(h.context.appState.aiModelCatalog.status, 'error');
  assert.equal(h.context.appState.scenario.settings.ai_model, 'gpt-5.5');
  assert.ok(Array.from(h.run('availableAIModels()')).includes('gpt-5.5'));
});

test('generation goes straight to {base}/chat/completions in JSON mode, without tools or key', async () => {
  const h = harness();
  h.replies.push(chat('{"ok":true}'));
  const result = await h.run("AITextGenerator.generate('test', 'system', 'user', true, 1000)");
  assert.equal(result.ok, true);
  assert.equal(h.requests.length, 1);
  const [request] = h.requests;
  assert.equal(request.url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(headers(request), { 'Content-Type': 'application/json' });
  const body = JSON.parse(request.init.body);
  assert.equal(body.model, 'gpt-5.5');
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.deepEqual(body.messages.map(message => message.role), ['system', 'user']);
  assert.equal(body.tools, undefined);
  assert.equal(body.tool_choice, undefined);
  assert.equal(body.stream, undefined);

  h.context.appState.scenario.settings.ai_api_key = 'local-key';
  h.replies.push(chat('{"ok":true}'));
  await h.run("AITextGenerator.generate('test', 'system', null, true, 1000, { strictJSON: true })");
  assert.equal(headers(h.requests[1]).Authorization, 'Bearer local-key');
  assert.equal(headers(h.requests[1])['HTTP-Referer'], undefined);
});

test('the connection test needs no key', async () => {
  const h = harness();
  h.replies.push(chat('{"ok": true, "message": "valid connection"}'));
  assert.equal((await h.run('AITextGenerator.testConnection()')).ok, true);
  assert.equal(h.requests[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
});

test('streaming reads SSE deltas, skips keepalive comments and stops at [DONE]', async () => {
  const h = harness();
  h.replies.push(new Response(
    ': keepalive\n\n' +
    'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\n' +
    ': keepalive\n\n' +
    'data: {"choices":[{"delta":{"content":"true}"},"finish_reason":"stop"}]}\n\n' +
    'data: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } }
  ));
  h.context.chunks = [];
  const result = await h.run("AITextGenerator.generateStreaming('test', 'system', 'user', chunk => chunks.push(chunk))");
  assert.equal(result.ok, true);
  assert.equal(h.context.chunks.join(''), '{"ok":true}');
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
  const body = JSON.parse(h.requests[0].init.body);
  assert.equal(body.stream, true);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.tools, undefined);
});

test('an unreachable server says where and what to check, at once and never through the relay', async () => {
  for (const code of ["AITextGenerator.generate('test', 'system', 'user', true, 1000)",
    "AITextGenerator.generateStreaming('test', 'system', 'user')",
    'fetchAIModels(appState.scenario.settings)']) {
    const h = harness();
    h.replies.push(new TypeError('Failed to fetch'));
    await assert.rejects(h.run(code), error =>
      error.message.includes('not reachable at http://127.0.0.1:11434/v1.')
      && error.message.includes('Settings > Local API')
      && error.message.includes('(https://gbillois.github.io;')
      && error.message.includes('the address is null'));
    assert.equal(h.requests.length, 1, code);
  }
});

test('server errors keep their message and status, without the relay', async () => {
  const h = harness();
  h.replies.push(json({ error: { message: 'Not signed in to Microsoft 365.' } }, 401));
  await assert.rejects(h.run("AITextGenerator.generate('test', 'system', 'user', true, 1000)"), error =>
    error.status === 401 && error.message === 'Not signed in to Microsoft 365.' && error.provider === 'local_server');
  assert.equal(h.requests.length, 1);
});

test('an invalid server URL fails before any request', async () => {
  const h = harness({ local_server_url: 'localhost:11434' });
  await assert.rejects(h.run("AITextGenerator.generate('test', 'system', 'user', true, 1000)"), /Invalid local server URL/);
  await assert.rejects(h.run('fetchAIModels(appState.scenario.settings)'), /Invalid local server URL/);
  assert.equal(h.requests.length, 0);
});

/* The whole app, as the browser loads it (index.html order). */
function app() {
  const storage = new Map();
  const context = { console, URL, Blob, TextEncoder, Uint8Array, AbortController, DOMException, setTimeout, clearTimeout,
    setInterval: () => 0, navigator: { language: 'en' }, location: { origin: 'null' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { getElementById: () => null, querySelectorAll: () => [] }, addEventListener: () => {},
    atob: value => Buffer.from(value, 'base64').toString('binary'), btoa: value => Buffer.from(value, 'binary').toString('base64') };
  context.window = context; context.sessionStorage = context.localStorage;
  vm.createContext(context);
  const files = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8').replace('      App.init();', ''), context, { filename: file });
  vm.runInContext(`App.render = () => {}; pushToast = () => {};
    appState.scenario = emptyScenario({ ai_provider: 'local_server', ai_model: 'gpt-5.5', ai_api_key: '' });`, context);
  return { context, storage, run: code => vm.runInContext(code, context) };
}

test('the provider counts as configured with a URL and a model, no key', () => {
  const h = app();
  assert.equal(h.run('appState.scenario.settings.local_server_url'), 'http://127.0.0.1:11434/v1');
  assert.equal(h.run('isLLMAvailable()'), true);
  h.run("appState.scenario.settings.ai_model = ''");
  assert.equal(h.run('isLLMAvailable()'), false);
  h.run("appState.scenario.settings.ai_model = 'gpt-5.5'; appState.scenario.settings.local_server_url = ''");
  assert.equal(h.run('isLLMAvailable()'), false);
});

test('settings keep the provider and its URL, and the key the same way as other keys', () => {
  const h = app();
  h.run(`const s = { ai_provider: 'local_server', ai_model: 'gpt-5.5' }; normalizeProviderSettingsInPlace(s); globalThis.normalized = s;`);
  assert.equal(h.run('normalized.ai_provider'), 'local_server');
  assert.equal(h.run('normalized.local_server_url'), 'http://127.0.0.1:11434/v1');
  h.run(`persistProviderSettings({ ...appState.scenario.settings, local_server_url: 'http://127.0.0.1:11500/v1', ai_api_key: 'local-key' })`);
  assert.equal(h.storage.get('crisismaker_local_server_url'), 'http://127.0.0.1:11500/v1');
  assert.equal(h.storage.get('crisismaker_api_key'), 'local-key');
  assert.equal(h.run('loadProviderSettings().local_server_url'), 'http://127.0.0.1:11500/v1');
});

test('the settings view offers "AI local server" with Server URL, an optional API key and the model list', () => {
  const h = app();
  h.run('appState.scenario.settings.confidentiality_acknowledged = true');
  const html = h.run('renderSettingsView()');
  assert.match(html, /<option value="local_server" selected>AI local server<\/option>/);
  assert.match(html, /Server URL\s*<input type="url" data-bind="settings.local_server_url" value="http:\/\/127.0.0.1:11434\/v1"/);
  assert.match(html, /API key[\s\S]*?data-bind="settings.ai_api_key"[^>]*placeholder="Optional"/);
  assert.match(html, /data-bind="settings.ai_model"[\s\S]*?<option value="gpt-5.5" selected>/);
  assert.match(html, /data-action="refresh-ai-models"/);
  assert.match(html, /allowed web pages: null/);
});

test('Video Debrief receives the local server settings', () => {
  const h = app();
  h.run("appState.scenario.settings.local_server_url = 'http://127.0.0.1:11500/v1/'");
  const settings = JSON.parse(h.run('JSON.stringify(videoDebriefAISettings())'));
  assert.equal(settings.provider, 'local_server');
  assert.equal(settings.supported, true);
  assert.equal(settings.baseUrl, 'http://127.0.0.1:11500/v1');
  assert.equal(settings.proxyUrl, '');
  const source = fs.readFileSync('video-debrief/index.html', 'utf8');
  assert.match(source, /<option value="local_server">AI local server<\/option>/);
  assert.match(source, /provider === 'local_server' \? baseUrl \+ '\/chat\/completions'/);
});
