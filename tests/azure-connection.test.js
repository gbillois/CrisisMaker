const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function harness(endpoint = 'https://example.services.ai.azure.com/openai/v1') {
  const requests = [], replies = [];
  const context = vm.createContext({
    URL, TextDecoder, TextEncoder, console,
    tt: en => en, pushToast: () => {},
    appState: { scenario: { settings: { ai_provider: 'azure_openai', azure_endpoint: endpoint,
      azure_api_key: ' test-key ', azure_deployment: ' custom-deployment ', azure_api_version: '2024-10-21' } } },
    fetch: async (url, init) => {
      requests.push({ url, init });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      assert.ok(reply, 'Unexpected extra request');
      return reply;
    }
  });
  vm.runInContext("const DEFAULT_AZURE_API_VERSION = '2024-10-21';", context);
  for (const file of ['errors', 'ai']) vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), context);
  return { context, requests, replies, run: code => vm.runInContext(code, context) };
}
const jsonResponse = (data = { choices: [{ message: { content: '{"ok":true}' } }] }, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('Azure normalizes SDK URLs and Foundry hosts, preserves legacy API versions', () => {
  const h = harness();
  for (const endpoint of [
    ' https://example.openai.azure.com/openai/v1/ ',
    'https://example.openai.azure.com/openai/v1/openai/v1?api-version=preview#fragment',
    'https://example.openai.azure.com/openai/v1/chat/completions',
    'https://example.services.ai.azure.com/'
  ]) {
    h.context.appState.scenario.settings.azure_endpoint = endpoint;
    const url = h.run('azureChatUrl()');
    assert.equal(new URL(url).pathname, '/openai/v1/chat/completions');
    assert.equal(new URL(url).search, '');
  }
  h.context.appState.scenario.settings.azure_endpoint = 'https://example.cognitiveservices.azure.com/';
  h.context.appState.scenario.settings.azure_api_version = '2025-01-01-preview';
  assert.equal(h.run('azureChatUrl()'), 'https://example.cognitiveservices.azure.com/openai/deployments/custom-deployment/chat/completions?api-version=2025-01-01-preview');
});

test('invalid Azure endpoints fail before credentials are sent in either generation path', async () => {
  for (const endpoint of ['invalid', 'http://example.openai.azure.com', 'https://example.openai.azure.com.evil.test',
    'https://user:pass@example.openai.azure.com', 'https://example.services.ai.azure.com/api/projects/demo',
    'https://example.openai.azure.com/unexpected']) {
    const h = harness(endpoint);
    await assert.rejects(h.run("AITextGenerator.generate('test', 'system', null, true)"));
    await assert.rejects(h.run("AITextGenerator.generateStreaming('test', 'system')"));
    assert.equal(h.requests.length, 0);
  }
});

test('connection test retries browser network failure through the existing cross-origin relay', async () => {
  const h = harness();
  h.replies.push(new TypeError('Failed to fetch'), jsonResponse());
  assert.equal((await h.run('AITextGenerator.testConnection()')).ok, true);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].url, 'https://deckseeder.pages.dev/api/llm');
  const payload = JSON.parse(h.requests[1].init.body);
  assert.equal(payload.provider, 'azure');
  assert.equal(payload.url, 'https://example.services.ai.azure.com/openai/v1/chat/completions');
  assert.equal(payload.headers['api-key'], 'test-key');
  assert.equal(payload.body, h.requests[0].init.body);
  assert.equal(JSON.parse(payload.body).model, 'custom-deployment');
  assert.deepEqual({ ...h.requests[1].init.headers }, { 'Content-Type': 'application/json' });
});

test('streaming uses the same fallback and returns parsed JSON and incremental text', async () => {
  const h = harness();
  h.replies.push(new TypeError('Failed to fetch'), new Response(
    'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"true}"}}]}\n\ndata: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } }
  ));
  h.context.chunks = [];
  const result = await h.run("AITextGenerator.generateStreaming('test', 'system', 'user', chunk => chunks.push(chunk))");
  assert.equal(result.ok, true);
  assert.equal(h.context.chunks.join(''), '{"ok":true}');
  const payload = JSON.parse(h.requests[1].init.body);
  assert.equal(JSON.parse(payload.body).stream, true);
  assert.equal(JSON.parse(payload.body).model, 'custom-deployment');
});

test('Azure HTTP failures retain provider detail and never retry through the relay', async () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    const h = harness();
    h.replies.push(jsonResponse({ error: { message: 'Azure failure detail', code: 'ProviderCode' } }, status));
    await assert.rejects(h.run('AITextGenerator.testConnection()'), error =>
      error.status === status && error.code === 'ProviderCode' && error.message === 'Azure failure detail');
    assert.equal(h.requests.length, 1);
  }
});

test('cancellation propagates without retry and is forwarded to the relay', async () => {
  const h = harness();
  const abort = new Error('Stopped'); abort.name = 'AbortError';
  h.replies.push(abort);
  await assert.rejects(h.run('AITextGenerator.testConnection()'), { name: 'AbortError' });
  assert.equal(h.requests.length, 1);
  const controller = new AbortController();
  h.context.signal = controller.signal;
  h.replies.push(new TypeError('Failed to fetch'), abort);
  await assert.rejects(h.run("AITextGenerator.generate('test', 'system', null, true, 100, {signal})"), { name: 'AbortError' });
  assert.equal(h.requests[2].init.signal, controller.signal);
});

test('unavailable relay reports actionable network guidance and rejects HTML responses', async () => {
  for (const reply of [new TypeError('Failed to fetch'), new Response('<html>Error</html>', { headers: { 'Content-Type': 'text/html' } })]) {
    const h = harness(); h.replies.push(new TypeError('Failed to fetch'), reply);
    await assert.rejects(h.run('AITextGenerator.testConnection()'), error =>
      /relay also failed/.test(error.message) && /VPN\/firewall/.test(error.message) && !error.message.includes('test-key'));
  }
});

test('browser security policy permits Azure Foundry and the fallback relay', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const policy = html.match(/connect-src ([^;]+)/)[1].split(' ');
  assert.ok(policy.includes('https://*.services.ai.azure.com'));
  assert.ok(policy.includes('https://deckseeder.pages.dev'));
});

test('bundled relay allows Azure hosts, filters headers, blocks redirects and unrelated hosts', async () => {
  const calls = [];
  const context = vm.createContext({ URL, Headers, Response, fetch: async (url, init) => {
    calls.push({ url, init }); return jsonResponse();
  } });
  vm.runInContext(fs.readFileSync('functions/api/llm.js', 'utf8').replaceAll('export async function', 'async function'), context);
  for (const host of ['example.openai.azure.com', 'example.services.ai.azure.com', 'example.cognitiveservices.azure.com', 'ollama.com']) {
    context.payload = { url: `https://${host}/`, headers: { 'api-key': 'test-key', cookie: 'private-cookie' } };
    const response = await vm.runInContext('onRequestPost({request: {json: async () => payload}})', context);
    assert.equal(response.status, 200);
    assert.equal(calls.at(-1).init.headers.get('api-key'), 'test-key');
    assert.equal(calls.at(-1).init.headers.get('cookie'), null);
    assert.equal(calls.at(-1).init.redirect, 'error');
  }
  for (const url of ['https://evil.test', 'https://example.openai.azure.com.evil.test', 'http://example.openai.azure.com', 'https://user:pass@example.openai.azure.com']) {
    context.payload = { url };
    assert.equal((await vm.runInContext('onRequestPost({request: {json: async () => payload}})', context)).status, 400);
  }
  assert.equal(calls.length, 4);
});
