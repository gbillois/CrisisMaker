const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const storage = new Map();
  const context = { console, URL, Blob, TextEncoder, Uint8Array, AbortController, DOMException, setTimeout, clearTimeout,
    setInterval: () => 0, navigator: { language: 'en' }, location: { origin: 'https://example.test' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { getElementById: () => null, querySelectorAll: () => [] }, addEventListener: () => {},
    atob: value => Buffer.from(value, 'base64').toString('binary'), btoa: value => Buffer.from(value, 'binary').toString('base64') };
  context.window = context; context.sessionStorage = context.localStorage;
  vm.createContext(context);
  const files = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script src="(js\/[^\"]+)"/g)].map(m => m[1]);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8').replace('      App.init();', ''), context, { filename: file });
  vm.runInContext(`App.render = () => {}; pushToast = () => {}; sanitizeBody = value => value;
    appState.scenario = emptyScenario({ ai_api_key: 'TEST-SECRET', ai_provider: 'openai' });
    appState.route = 'agent';`, context);
  const run = code => vm.runInContext(code, context);
  return { context, run, storage, json: code => JSON.parse(run(`JSON.stringify(${code})`)) };
}
const final = { type: 'final', summary: 'Reviewed', issues: [], changes: [] };
const call = (tool, args = {}) => ({ type: 'tool_call', tool, arguments: args, reason: 'Test action' });
function runner(h, responses, maxSteps = 40) {
  let i = 0;
  h.context.request = async () => { const response = responses[Math.min(i++, responses.length - 1)]; if (response instanceof Error) throw response; return response; };
  h.run(`globalThis.runner = new AgentRunner({ request, notify: () => {}, maxSteps: ${maxSteps} });`);
  return h.context.runner;
}
async function execute(h, name, args) {
  h.context.args = args;
  return h.run(`(async () => { const tool = createAgentToolRegistry().get('${name}'); ToolValidator.validate(args, tool.inputSchema); return tool.execute(args, {controller: new AbortController(), assertActive() {}}); })()`);
}

test('registry exposes expected operations with strict schemas, no credential or code tools', () => {
  const h = harness();
  const catalog = h.json('[...createAgentToolRegistry().values()].map(({name, description, inputSchema, risk}) => ({name, description, inputSchema, risk}))');
  assert.equal(catalog.length, 21);
  for (const name of ['getScenario', 'createActor', 'updateStimulus', 'deleteStimulus', 'reorderStimuli', 'generateStimulusContent', 'improveStimulusContent', 'analyzeExerciseQuality']) assert.ok(catalog.some(t => t.name === name));
  for (const tool of catalog) { assert.ok(tool.description); assert.equal(tool.inputSchema.additionalProperties, false); }
  assert.ok(!JSON.stringify(catalog).includes('ai_api_key'));
  assert.throws(() => h.run(`ToolValidator.validate(JSON.parse('{"__proto__":{}}'), AgentSchema.object())`), /Invalid/);
  assert.throws(() => h.run(`agentNormalizeResponse({type:'tool_call', tool:'getScenario', arguments:{}, javascript:'alert(1)'})`), /Invalid/);
});

test('invalid tools, invalid args and malformed JSON fail within retry budget without modifying state', async () => {
  for (const response of [call('eval'), call('createActor', { name: 'x', role: 'bogus' }), '{broken', call('updateScenario', { settings: { ai_api_key: 'LEAK' } })]) {
    const h = harness(), before = h.json('agentSnapshot()');
    const r = runner(h, [response]); await r.start({ objective: 'Test' });
    assert.equal(r.status, 'failed'); assert.equal(r.step, 3); assert.deepEqual(h.json('agentSnapshot()'), before);
  }
});

test('completion, MAX_STEPS, repeated-loop detection and bounded history', async () => {
  const h = harness();
  let r = runner(h, [final]); await r.start({ objective: 'Review' }); assert.equal(r.status, 'complete');
  r = runner(h, [call('getScenario')], 2); await r.start({ objective: 'Review' }); assert.equal(r.status, 'limit'); assert.equal(r.step, 2);
  r = runner(h, [call('getScenario')]); await r.start({ objective: 'Review' }); assert.equal(r.status, 'limit'); assert.equal(r.step, 4);
  assert.ok(r.history.length <= 8);
});

test('state edits reuse constructors/history and persist objectives/phases through export/import and undo', async () => {
  const h = harness();
  const a = await execute(h, 'createActor', { name: 'CISO', role: 'internal' });
  const s = await execute(h, 'createStimulus', { name: 'Isolation decision', actor_id: a.id, channel: 'email_internal', timestamp_offset_minutes: 30, fields: { subject: 'Disconnect?', body: '<p>Decide whether to isolate.</p>' } });
  assert.equal(h.run('appState.scenario.stimuli[0].history.length'), 1);
  await execute(h, 'updateStimulus', { id: s.id, patch: { fields: { body: '<p>Isolation stops payments. Decide by T+40.</p>' } } });
  assert.equal(h.run('appState.scenario.stimuli[0].history.length'), 2);
  await execute(h, 'setPhases', { phases: [{ name: 'Escalation', purpose: 'Containment decisions', start_minutes: 0, end_minutes: 90 }] });
  const before = h.json('agentSnapshot()');
  const r = runner(h, [call('updateExerciseObjectives', { objectives: 'Test isolation and recovery decisions' }), final]);
  await r.start({ objective: 'Improve objectives' });
  assert.equal(r.changed, 1);
  assert.ok(h.run(`mergeScenario(migrateScenario(buildProjectFileData())).scenario.objectives.includes('isolation')`));
  assert.equal(h.run('mergeScenario(migrateScenario(buildProjectFileData())).scenario.phases[0].name'), 'Escalation');
  assert.ok(!h.storage.get('crisismaker_agent_checkpoint_v1').includes('TEST-SECRET'));
  assert.equal(r.undo(), true);
  const after = h.json('agentSnapshot()'); delete after.updated_at; delete before.updated_at;
  assert.deepEqual(after, before); assert.equal(h.run('appState.scenario.settings.ai_api_key'), 'TEST-SECRET');
});

test('validation rejects missing actors, invalid content fields, overlapping phases and partial batch schedules atomically', async () => {
  const h = harness();
  await assert.rejects(execute(h, 'createStimulus', { name: 'Bad', actor_id: 'missing', channel: 'email_internal', timestamp_offset_minutes: 0 }), /Unknown/);
  const a = await execute(h, 'createActor', { name: 'CEO', role: 'internal' });
  const s = await execute(h, 'createStimulus', { name: 'Decision', actor_id: a.id, channel: 'email_internal', timestamp_offset_minutes: 0 });
  const before = h.json('agentSnapshot()');
  await assert.rejects(execute(h, 'updateStimulus', { id: s.id, patch: { fields: { javascript: 'alert(1)' } } }), /not editable/);
  await assert.rejects(execute(h, 'updateStimulus', { id: s.id, patch: { fields: { has_attachment: 'yes' } } }), /boolean/);
  await assert.rejects(execute(h, 'updateStimulus', { id: s.id, patch: { fields: { body: { code: 'invalid' } } } }), /text/);
  await assert.rejects(execute(h, 'reorderStimuli', { positions: [{ id: s.id, timestamp_offset_minutes: 80 }, { id: 'missing', timestamp_offset_minutes: 90 }] }), /Unknown/);
  await assert.rejects(execute(h, 'setPhases', { phases: [{ name: 'A', purpose: 'x', start_minutes: 0, end_minutes: 50 }, { name: 'B', purpose: 'y', start_minutes: 20, end_minutes: 60 }] }), /overlap/);
  assert.deepEqual(h.json('agentSnapshot()'), before);
});

test('Assist approval/rejection and Agent broad-change approval show concrete proposed arguments', async () => {
  for (const mode of ['assist', 'agent']) {
    const h = harness(), r = runner(h, [call('updateScenario', { name: 'Approved name' }), final]);
    const promise = r.start({ objective: 'Rename', mode });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(r.status, 'approval'); assert.equal(r.pending.arguments.name, 'Approved name'); assert.equal(h.run('appState.scenario.name'), '');
    r.approve(mode === 'agent'); await promise;
    assert.equal(h.run('appState.scenario.name'), mode === 'agent' ? 'Approved name' : '');
    assert.equal(r.status, 'complete');
  }
});

test('Auto-build executes broad changes but deletion still waits for approval', async () => {
  const h = harness(), a = await execute(h, 'createActor', { name: 'CEO', role: 'internal' });
  const s = await execute(h, 'createStimulus', { name: 'Decision', actor_id: a.id, channel: 'email_internal', timestamp_offset_minutes: 0 });
  const r = runner(h, [call('updateScenario', { name: 'New exercise' }), call('deleteStimulus', { id: s.id }), final]);
  const promise = r.start({ objective: 'Build', mode: 'auto' }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.run('appState.scenario.name'), 'New exercise'); assert.equal(r.status, 'approval');
  r.approve(true); await promise; assert.equal(h.run('appState.scenario.stimuli.length'), 0);
});

test('Stop cancels an unresolved request and approval without applying late results', async () => {
  const h = harness(); let resolveRequest;
  h.context.request = () => new Promise(resolve => { resolveRequest = resolve; });
  h.run('globalThis.runner = new AgentRunner({request, notify: () => {}})'); const r = h.context.runner;
  const pending = r.start({ objective: 'Test' }); r.stop(); await pending;
  assert.equal(r.status, 'stopped'); assert.equal(r.busy, false);
  resolveRequest(call('updateExerciseObjectives', { objectives: 'Late' })); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.run('appState.scenario.scenario.objectives'), undefined);
  const r2 = runner(h, [call('updateScenario', { name: 'Late' })]); const p2 = r2.start({ objective: 'Test' });
  await new Promise(resolve => setImmediate(resolve)); r2.stop(); await p2; assert.equal(h.run('appState.scenario.name'), '');
});

test('late content generation cannot write after cancellation or a later run', async () => {
  const h = harness(), a = await execute(h, 'createActor', { name: 'CEO', role: 'internal' });
  const s = await execute(h, 'createStimulus', { name: 'Decision', actor_id: a.id, channel: 'email_internal', timestamp_offset_minutes: 0 });
  let resolveGeneration;
  h.context.generate = () => new Promise(resolve => { resolveGeneration = resolve; });
  h.run('AITextGenerator.generateForStimulus = generate');
  const r = runner(h, [call('generateStimulusContent', { id: s.id, instructions: 'Improve' }), final]);
  const p = r.start({ objective: 'Test' }); await new Promise(resolve => setImmediate(resolve)); r.stop(); await p;
  r.request = async () => final; await r.start({ objective: 'Review' });
  const before = h.json('appState.scenario.stimuli');
  resolveGeneration({ subject: 'Late mutation' }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.json('appState.scenario.stimuli'), before);
});

test('provider failure retains valid edits, rolls back failing tools, redacts credentials and allows undo', async () => {
  const h = harness(), r = runner(h, [call('updateExerciseObjectives', { objectives: 'Valid change' }), new Error('Authorization: TEST-SECRET')]);
  await r.start({ objective: 'TEST-SECRET' }); assert.equal(r.status, 'failed');
  assert.equal(h.run('appState.scenario.scenario.objectives'), 'Valid change');
  assert.ok(!JSON.stringify(r.log).includes('TEST-SECRET')); assert.equal(r.undo(), true);
  assert.equal(h.run('appState.scenario.scenario.objectives'), undefined);
  assert.ok(!h.run('JSON.stringify(AgentContext.build())').includes('TEST-SECRET'));
  const r2 = runner(h, [call('updateExerciseObjectives', { objectives: 'Broken' })]);
  r2.registry.get('updateExerciseObjectives').execute = () => { h.run("appState.scenario.name = 'CORRUPTED'"); throw new Error('Failure'); };
  await r2.start({ objective: 'Test' }); assert.equal(h.run('appState.scenario.name'), '');
});

test('checkpoint can be recovered after reload and cannot undo into another project', async () => {
  const h = harness(), r = runner(h, [call('updateExerciseObjectives', { objectives: 'Changed' }), final]);
  await r.start({ objective: 'Test' });
  h.run('globalThis.reloaded = new AgentRunner({notify: () => {}}); reloaded.loadCheckpoint()');
  assert.equal(h.context.reloaded.undo(), true); assert.equal(h.run('appState.scenario.scenario.objectives'), undefined);
  await r.start({ objective: 'Again' }); h.run("appState.scenario.id = 'different'"); assert.equal(r.undo(), false);
});

test('all existing providers normalize the same structured response and forward cancellation', async () => {
  for (const provider of ['anthropic', 'openai', 'openrouter', 'mistral', 'azure_openai', 'google_gemini', 'ollama']) {
    const h = harness(); const seen = [];
    h.context.fetch = async (url, init) => { seen.push({ url, init }); return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(final) }], choices: [{ message: { content: JSON.stringify(final) } }], candidates: [{ content: { parts: [{ text: JSON.stringify(final) }] } }], message: { content: JSON.stringify(final) } }) }; };
    h.run(`Object.assign(appState.scenario.settings, { ai_provider: '${provider}', azure_endpoint: 'https://example.openai.azure.com', azure_api_key: 'TEST-SECRET', azure_deployment: 'model' }); globalThis.abort = new AbortController();`);
    const result = await h.run(`AITextGenerator.generate('agent', 'Return JSON', '{}', true, 2000, { signal: abort.signal, strictJSON: true })`);
    assert.equal(result.type, 'final'); assert.equal(seen.length, 1); assert.equal(seen[0].init.signal, h.context.abort.signal);
    assert.ok(!seen[0].init.body.includes('TEST-SECRET'));
  }
});

test('empty actor lists and exercise plan survive the normal project format', () => {
  const h = harness();
  assert.equal(h.run('mergeScenario(migrateScenario(buildProjectFileData())).actors.length'), 0);
  const html = h.run('renderAgentView()'); assert.ok(html.includes('Build my exercise')); assert.ok(html.includes('Challenge my exercise')); assert.ok(html.includes('Undo agent changes'));
});
