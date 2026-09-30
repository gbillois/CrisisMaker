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
  assert.equal(catalog.length, 34);
  for (const name of ['getReferenceFile', 'getExerciseFrame', 'setExerciseFrame', 'updateStorylineMeta', 'buildMainStoryline', 'upsertCells', 'upsertCast', 'planPhaseInjects', 'getPhase', 'updatePlannedInject', 'getScenario', 'createActor', 'updateStimulus', 'deleteStimulus', 'reorderStimuli', 'generateStimulusContent', 'improveStimulusContent', 'analyzeExerciseQuality']) assert.ok(catalog.some(t => t.name === name));
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
  // A read loop is first told to act on what it has, then stopped.
  r = runner(h, [call('getScenario')]); await r.start({ objective: 'Review' }); assert.equal(r.status, 'limit'); assert.equal(r.step, 5);
  assert.ok(r.log.some(entry => /Repeated read of getScenario/.test(entry.message)));
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
  // A protected field sent back unchanged is skipped; a changed one is still refused.
  const post = await execute(h, 'createStimulus', { name: 'Post', actor_id: a.id, channel: 'post_reddit', timestamp_offset_minutes: 5 });
  const link = h.json(`getStimulus('${post.id}').fields.link_url ?? ''`);
  await execute(h, 'updateStimulus', { id: post.id, patch: { fields: { title: 'New title', link_url: link } } });
  assert.equal(h.json(`getStimulus('${post.id}').fields.title`), 'New title');
  await assert.rejects(execute(h, 'updateStimulus', { id: post.id, patch: { fields: { link_url: 'https://evil.example/' } } }), /not editable/);
  h.run(`deleteStimulus('${post.id}')`);
  await assert.rejects(execute(h, 'updateStimulus', { id: s.id, patch: { fields: { has_attachment: 'yes' } } }), /boolean/);
  await assert.rejects(execute(h, 'updateStimulus', { id: s.id, patch: { fields: { body: { code: 'invalid' } } } }), /text/);
  await assert.rejects(execute(h, 'reorderStimuli', { positions: [{ id: s.id, timestamp_offset_minutes: 80 }, { id: 'missing', timestamp_offset_minutes: 90 }] }), /Unknown/);
  await assert.rejects(execute(h, 'setPhases', { phases: [{ name: 'A', purpose: 'x', start_minutes: 0, end_minutes: 50 }, { name: 'B', purpose: 'y', start_minutes: 20, end_minutes: 60 }] }), /overlap/);
  assert.deepEqual(h.json('agentSnapshot()'), before);
});

test('press creation selects publications with template_id and accepts the legacy publication argument safely', async () => {
  const h = harness();
  const journalist = await execute(h, 'createActor', { name: 'Reporter', role: 'journalist' });
  const article = await execute(h, 'createStimulus', { name: 'Public scrutiny', actor_id: journalist.id, channel: 'article_press', template_id: 'lemonde', timestamp_offset_minutes: 60, fields: { headline: 'Une crise sous surveillance' } });
  assert.equal(article.template_id, 'lemonde');
  assert.equal(article.fields.headline, 'Une crise sous surveillance');
  const legacy = await execute(h, 'createStimulus', { name: 'Market reaction', actor_id: journalist.id, channel: 'article_press', timestamp_offset_minutes: 90, fields: { publication: 'Financial Times', headline: 'Board faces public pressure' } });
  assert.equal(legacy.template_id, 'ft');
  assert.equal(Object.hasOwn(legacy.fields, 'publication'), false);
  await assert.rejects(execute(h, 'createStimulus', { name: 'Bad outlet', actor_id: journalist.id, channel: 'article_press', timestamp_offset_minutes: 120, fields: { publication: 'Unknown Daily' } }), /Unknown press publication/);
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
  for (const provider of ['anthropic', 'openai', 'openrouter', 'mistral', 'azure_openai', 'google_gemini', 'ollama', 'local_server']) {
    const h = harness(); const seen = [];
    h.context.fetch = async (url, init) => { seen.push({ url, init, before: init.signal.aborted, after: (h.context.abort.abort(), init.signal.aborted) }); return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(final) }], choices: [{ message: { content: JSON.stringify(final) } }], candidates: [{ content: { parts: [{ text: JSON.stringify(final) }] } }], message: { content: JSON.stringify(final) } }) }; };
    h.run(`Object.assign(appState.scenario.settings, { ai_provider: '${provider}', azure_endpoint: 'https://example.openai.azure.com', azure_api_key: 'TEST-SECRET', azure_deployment: 'model' }); globalThis.abort = new AbortController();`);
    const result = await h.run(`AITextGenerator.generate('agent', 'Return JSON', '{}', true, 2000, { signal: abort.signal, strictJSON: true })`);
    assert.equal(result.type, 'final'); assert.equal(seen.length, 1);
    // A child of the caller's signal (the call's own time limit): cancelling during the call propagates.
    assert.equal(seen[0].before, false); assert.equal(seen[0].after, true);
    assert.ok(!seen[0].init.body.includes('TEST-SECRET'));
  }
});

test('empty actor lists and exercise plan survive the normal project format', () => {
  const h = harness();
  assert.equal(h.run('mergeScenario(migrateScenario(buildProjectFileData())).actors.length'), 0);
  const html = h.run('renderAgentView()'); assert.ok(html.includes('Design the whole exercise')); assert.ok(!html.includes('Challenge my exercise'), 'one challenge: in Check & Challenge'); assert.ok(html.includes('use Check &amp; Challenge') || html.includes('use Check & Challenge')); assert.ok(html.includes('Undo agent changes'));
});

test('builder agent asks questions, waits for answers, then continues with them', async () => {
  const h = harness();
  const r = runner(h, [{ type: 'question', questions: ['Who plays?', 'What must be tested?'], reason: 'Audience changes the design' }, call('updateExerciseObjectives', { objectives: 'Test isolation' }), final]);
  const promise = r.start({ kind: 'builder', objective: 'Build from context', mode: 'auto' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.status, 'question'); assert.equal(r.active, true);
  assert.deepEqual([...r.question.questions], ['Who plays?', 'What must be tested?']);
  r.answer('Executive committee; isolation decisions.');
  await promise;
  assert.equal(r.status, 'complete');
  assert.ok(r.answers.some(entry => entry.answers === 'Executive committee; isolation decisions.'));
  assert.equal(h.run('appState.scenario.scenario.objectives'), 'Test isolation');
});

test('skipped questions and extra question rounds make the agent proceed on assumptions', async () => {
  const h = harness();
  const question = { type: 'question', questions: ['Anything else?'] };
  const r = runner(h, [question, question, question, final]);
  const promise = r.start({ kind: 'builder', objective: 'Build', mode: 'auto' });
  for (let round = 0; round < 2; round++) {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(r.status, 'question'); r.answer(null);
  }
  await promise;
  assert.equal(r.status, 'complete');
  assert.ok(r.history.some(entry => entry.instruction?.startsWith('No more questions')));
  assert.throws(() => h.run(`agentNormalizeResponse({ type: 'question', questions: [] })`), /Invalid/);
});

test('builder tools set the frame, build the storyline, cells, cast and a per-cell inject plan', async () => {
  const h = harness();
  h.run(`StoryboardHistory.ensure(appState.scenario)`);
  await execute(h, 'setExerciseFrame', { duration_minutes: 180, start_date: '2026-03-02T08:00', end_date: '2026-03-04T18:00', players_count: 12, cells_count: 2 });
  const frame = h.json('agentExerciseFrame()');
  assert.equal(frame.play_duration_minutes, 180); assert.equal(frame.simulated_end, '2026-03-04T18:00'); assert.equal(frame.cells_count, 2);
  await assert.rejects(execute(h, 'setExerciseFrame', { end_date: 'not a date' }), /Invalid end_date/);
  await execute(h, 'buildMainStoryline', {
    title: 'Hospital ransomware', summary: 'Ransomware hits a hospital.', objectives: ['Decide on isolation', 'Notify on time'],
    cast: [{ key: 'soc', label: 'SOC analyst', role: 'internal' }, { key: 'press', label: 'Health reporter', role: 'journalist' }],
    phases: [
      { type: 'trigger', title: 'Alerts', start_minutes: 0, duration_minutes: 60, brief: 'EDR alerts.', objectives: [0], beats: [{ at: 5, channel: 'email_internal', cast: 'soc', title: 'Alert storm' }] },
      { type: 'containment', title: 'Isolate or not', start_minutes: 60, duration_minutes: 60, brief: 'Dilemma.' },
      { type: 'exit', title: 'Exit', start_minutes: 120, duration_minutes: 60, brief: 'Close.', objectives: [1] }
    ]
  });
  const main = h.json('sbMainBlocks(appState.scenario.storyboard).map(b => ({ id: b.id, start: b.start_minutes, end: b.start_minutes + b.duration_minutes, beats: b.beats.length }))');
  assert.equal(main.length, 3); assert.equal(main[2].end, 180); assert.equal(main[0].beats, 1);
  assert.equal(h.run('appState.scenario.scenario.objectives'), 'Decide on isolation\nNotify on time');
  const cells = await execute(h, 'upsertCells', { cells: [{ name: 'Decision cell', description: 'Executive committee', players: [{ name: 'Ann Lee', role: 'CEO' }] }, { name: 'Communication cell' }] });
  await execute(h, 'setExerciseFrame', { attack_path: '1. Phishing\n2. Lateral movement', learning_objectives: 'Follow the crisis procedure' });
  assert.equal(h.run('appState.scenario.scenario.attack_path'), '1. Phishing\n2. Lateral movement');
  assert.equal(h.json('agentExerciseFrame()').learning_objectives, 'Follow the crisis procedure');
  assert.equal(cells.cells.length, 2);
  const decision = h.json(`appState.scenario.cells.find(c => c.name === 'Decision cell')`);
  assert.equal(decision.players[0].role, 'CEO');
  const cast = await execute(h, 'upsertCast', { cast: [{ label: 'Health reporter', role: 'journalist', actor: { name: 'Nora Diaz', title: 'Health reporter', organization: 'Daily Post' } }] });
  assert.ok(cast.cast[0].actor_id);
  assert.equal(h.run(`getActor('${cast.cast[0].actor_id}').name`), 'Nora Diaz');
  const plan = await execute(h, 'planPhaseInjects', { id: main[1].id, replace: true, injects: [
    { at: 10, channel: 'email_internal', cell: decision.id, cast: 'SOC analyst', title: 'Isolation request', intent: 'Forces the isolation decision.' },
    { at: 70, channel: 'article_press', cell: 'Communication cell', cast: cast.cast[0].id, title: 'Reporter calls', intent: 'Media pressure.' }
  ] });
  assert.equal(plan.planned.length, 2);
  assert.equal(plan.planned[0].cell_id, decision.id);
  // at 70 is outside a 60-minute phase from its start, but inside it from the exercise start: converted.
  const reporter = plan.planned.find(item => item.title === 'Reporter calls');
  assert.equal(reporter.at, 10, 'an exercise minute inside the phase is converted to the phase start');
  assert.equal(reporter.exercise_minute, 70);
  assert.equal(reporter.cell_id, h.run(`appState.scenario.cells.find(c => c.name === 'Communication cell').id`));
  // Outside the phase either way: refused with the range, the plan unchanged.
  await assert.rejects(execute(h, 'planPhaseInjects', { id: main[1].id, injects: [{ at: 150, channel: 'email_internal', title: 'Too late' }] }), /outside phase .*0 to 59/);
  assert.equal(h.run(`sbBlock(appState.scenario.storyboard, '${main[1].id}').beats.length`), 2);
  // One phase in full, then one planned inject moved and readdressed without touching the others.
  const phase = await execute(h, 'getPhase', { id: main[1].id });
  assert.equal(phase.planned_injects.length, 2);
  const isolation = phase.planned_injects.find(item => item.title === 'Isolation request');
  const moved = await execute(h, 'updatePlannedInject', { id: main[1].id, inject_id: isolation.id, patch: { at: 40, cell: 'Communication cell', title: 'Isolation request, final' } });
  assert.equal(moved.at, 40); assert.equal(moved.exercise_minute, 100); assert.equal(moved.title, 'Isolation request, final');
  assert.equal(moved.cell_id, h.run(`appState.scenario.cells.find(c => c.name === 'Communication cell').id`));
  assert.equal(h.run(`sbBlock(appState.scenario.storyboard, '${main[1].id}').beats.find(b => b.title === 'Reporter calls').offset_minutes`), 10);
  // An exercise minute in another phase moves it there.
  const across = await execute(h, 'updatePlannedInject', { id: main[1].id, inject_id: isolation.id, patch: { exercise_minute: 5 } });
  assert.equal(across.phase_id, main[0].id); assert.equal(across.at, 5);
  await assert.rejects(execute(h, 'updatePlannedInject', { id: main[0].id, inject_id: isolation.id, patch: { cell: 'No such cell' } }), /Unknown cell/);
  await execute(h, 'updatePlannedInject', { id: main[0].id, inject_id: isolation.id, patch: { exercise_minute: 70, cell: decision.id, title: 'Isolation request' } });
  await assert.rejects(execute(h, 'planPhaseInjects', { id: 'missing', injects: [] }), /Unknown item ID/);
  const context = h.json('AgentContext.build()');
  assert.equal(context.frame.play_duration_minutes, 180);
  // Two preset cells from the frame; Decision cell was updated in place, Communication cell added.
  assert.equal(context.storyboard.cells.length, 3);
  assert.ok(context.storyboard.blocks[1].planned_per_cell[decision.id] >= 1);
});

test('assistant: chat markup, escaping, suggestions and a bounded conversation for the agent', async () => {
  const h = harness();
  h.run('appState.launchScreenOpen = false');
  assert.equal(h.run('renderAssistant().includes("assistant-fab")'), true);
  assert.equal(h.run('renderAssistant().includes("assistant-panel")'), false, 'closed by default');
  h.run(`assistantState().open = true`);
  const empty = h.run('renderAssistant()');
  for (const marker of ['assistant-panel', 'data-assistant-suggest', 'data-assistant-input', 'data-assistant="close"', 'cm-icon']) assert.ok(empty.includes(marker), marker);
  assert.ok(!empty.includes('data-assistant="clear"'), 'nothing to clear yet');
  h.context.chat = [{ role: 'user', text: '<img src=x onerror=alert(1)>' }, { role: 'assistant', text: 'Two cells:\n- Decision\n- IT', changes: 1, actions: ['updateStoryboardBlock: rename'] }];
  h.run('assistantState().messages = chat');
  const thread = h.run('renderAssistant()');
  assert.ok(!thread.includes('<img src=x'), 'user text is escaped');
  assert.ok(thread.includes('<li>Decision</li>') && thread.includes('1 change(s) applied') && thread.includes('data-assistant="clear"'));
  h.context.long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `message ${i} `.repeat(80) }));
  const objective = h.run('assistantObjective(long)');
  assert.ok(objective.length <= 8000 && objective.includes('Latest request from the user:\nmessage 29'));
  assert.ok(h.run(`AGENT_KINDS.includes('assistant') && AgentPrompts.assistant.includes('CrisisMaker Assistant')`));
});

test('assistant run: answers from the data and applies a change through the agent tools', async () => {
  const h = harness();
  const r = runner(h, [call('getExerciseObjectives'), call('updateExerciseObjectives', { objectives: 'Decide on isolation' }), { type: 'final', summary: 'Set the objective.', issues: [], changes: ['Objectives'] }]);
  h.run(`crisisAgentRunner = runner; appState.scenario.settings.ai_provider = 'openai'; appState.scenario.settings.ai_api_key = 'k'; appState.scenario.settings.ai_model = 'm'; isLLMAvailable = () => true`);
  await h.run(`assistantSend('Set the objective to isolation')`);
  const messages = h.json('assistantState().messages');
  assert.equal(messages.length, 2);
  assert.equal(messages[1].text, 'Set the objective.');
  assert.equal(messages[1].changes, 1);
  assert.equal(h.run('appState.scenario.scenario.objectives'), 'Decide on isolation');
  assert.equal(r.kind, 'assistant'); assert.equal(r.mode, 'agent');
});

test('replies cut at the token limit or holding several objects: clear error, first object kept, smaller retry', async () => {
  const h = harness();
  // Several tool calls in one reply: the first complete object is used.
  const two = JSON.stringify(call('getStimulus', { id: 'a' })) + '\n' + JSON.stringify(call('getStimulus', { id: 'b{"}' }));
  assert.equal(h.json(`parseStrictLLMJson(${JSON.stringify(two)})`).arguments.id, 'a');
  assert.throws(() => h.run(`parseStrictLLMJson('{"type":"final","summary":"cut')`), { name: 'SyntaxError' });
  // A reply stopped by the token limit says so, whatever the provider.
  for (const [provider, body] of [['anthropic', { content: [{ type: 'text', text: '{"type":"final","summary":"cu' }], stop_reason: 'max_tokens' }], ['openai', { choices: [{ message: { content: '{"type":"fi' }, finish_reason: 'length' }] }], ['google_gemini', { candidates: [{ content: { parts: [{ text: '{"a' }] }, finishReason: 'MAX_TOKENS' }] }]]) {
    h.run(`appState.scenario.settings.ai_provider = '${provider}'; appState.scenario.settings.ai_model = 'test-model';`);
    h.context.fetch = async () => ({ ok: true, json: async () => body });
    await assert.rejects(h.run(`AITextGenerator.generate('agent', 'system', 'user', true, 8000, { strictJSON: true })`), (error) => error.code === 'truncated' && /cut off/.test(error.message));
  }
  // The agent retries with a smaller step instead of failing.
  h.run(`globalThis.cutOnce = true; globalThis.runner = new AgentRunner({ notify: () => {}, request: async () => { if (cutOnce) { cutOnce = false; throw CrisisError.create('cut', { code: 'truncated' }); } return ${JSON.stringify(JSON.stringify(final))}; } });`);
  const r = h.context.runner;
  await r.start({ objective: 'Translate the first three injects into Japanese' });
  assert.equal(r.status, 'complete');
  assert.ok(r.history.some((entry) => /smaller step/.test(entry.instruction || '')));
});

test('failures say why: the provider reason (secrets and links removed), timeouts retried smaller', async () => {
  const h = harness();
  const refused = h.run(`agentFailureMessage(CrisisError.create('Rate limit reached for model x. See https://platform.example/docs key TEST-SECRET', { status: 429 }))`);
  assert.ok(refused.includes('HTTP 429') && refused.includes('Rate limit reached') && !refused.includes('https://') && !refused.includes('TEST-SECRET'));
  assert.ok(h.run(`agentFailureMessage(new TypeError('Failed to fetch'))`).includes('could not be reached'));
  assert.ok(h.run(`agentFailureMessage(Object.assign(new Error('x'), { code: 'timeout' }))`).includes('took too long'));
  // A step that times out is retried with a smaller step instead of failing the run.
  h.run(`globalThis.slowOnce = true; globalThis.runner = new AgentRunner({ notify: () => {}, request: async () => { if (slowOnce) { slowOnce = false; throw Object.assign(new Error('The AI took too long to answer.'), { code: 'timeout' }); } return ${JSON.stringify(JSON.stringify(final))}; } });`);
  await h.context.runner.start({ objective: 'Translate the first three injects into Japanese' });
  assert.equal(h.context.runner.status, 'complete');
  // A model refusing 8000 output tokens is asked again with 4096.
  h.run(`appState.scenario.settings.ai_provider = 'anthropic'; appState.scenario.settings.ai_model = 'small-model';`);
  const asked = [];
  h.context.fetch = async (url, init) => {
    const body = JSON.parse(init.body); asked.push(body.max_tokens);
    if (body.max_tokens > 4096) return { ok: false, status: 400, statusText: 'Bad Request', clone() { return this; }, text: async () => JSON.stringify({ error: { message: 'max_tokens: 8000 > 4096, the maximum allowed for this model' } }), json: async () => ({ error: { message: 'max_tokens: 8000 > 4096, the maximum allowed for this model' } }) };
    return { ok: true, status: 200, clone() { return this; }, text: async () => JSON.stringify({ content: [{ type: 'text', text: '{"type":"final","summary":"ok","issues":[],"changes":[]}' }], stop_reason: 'end_turn' }), json: async () => ({ content: [{ type: 'text', text: '{"type":"final","summary":"ok","issues":[],"changes":[]}' }], stop_reason: 'end_turn' }) };
  };
  const reply = await h.run(`AITextGenerator.generate('agent', 'system', 'user', true, 8000, { strictJSON: true })`);
  assert.equal(reply.summary, 'ok');
  assert.deepEqual(asked, [8000, 4096]);
});

test('Ollama: reasoning models (qwen3, deepseek…) are asked to answer directly, GLM and gpt-oss to reason briefly, in both call paths', async () => {
  const h = harness();
  h.run(`appState.scenario.settings.ai_provider = 'ollama'; appState.scenario.settings.ai_model = 'qwen3:8b'; appState.scenario.settings.ollama_endpoint = 'http://localhost:11434';`);
  const bodies = [];
  const reply = (data, status = 200) => ({ ok: status < 400, status, statusText: status < 400 ? 'OK' : 'Bad Request', headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => JSON.stringify(data), json: async () => data });
  const final = '{"type":"final","summary":"ok","issues":[],"changes":[]}';
  // A reasoning model: no thinking phase asked, one call.
  h.context.fetch = async (url, init) => { const body = JSON.parse(init.body); bodies.push(body); return reply({ message: { content: final }, done_reason: 'stop' }); };
  assert.equal((await h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 5000, { strictJSON: true })`)).summary, 'ok');
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].think, false);
  // Reasoning written in the answer text until the length limit: once more with a short reasoning kept apart.
  bodies.length = 0;
  h.context.fetch = async (url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    return body.think === 'low' ? reply({ message: { content: final, thinking: 'short' }, done_reason: 'stop' }) : reply({ message: { content: 'Let me think about the phases first…' }, done_reason: 'length' });
  };
  assert.equal((await h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 5000, { strictJSON: true })`)).summary, 'ok');
  assert.deepEqual(bodies.map((body) => body.think), [false, 'low']);
  // GLM and gpt-oss: a short reasoning apart from the answer, from the first call.
  bodies.length = 0;
  h.run(`appState.scenario.settings.ai_model = 'glm-5.3';`);
  h.context.fetch = async (url, init) => { const body = JSON.parse(init.body); bodies.push(body); return reply({ message: { content: final }, done_reason: 'stop' }); };
  assert.equal((await h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 5000, { strictJSON: true })`)).summary, 'ok');
  assert.deepEqual(bodies.map((body) => body.think), ['low']);
  h.run(`appState.scenario.settings.ai_model = 'qwen3:8b';`);
  // A model without the switch: called again without it.
  bodies.length = 0;
  h.context.fetch = async (url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    return 'think' in body ? reply({ error: '"llama3.2" does not support thinking' }, 400) : reply({ message: { content: final }, done_reason: 'stop' });
  };
  assert.equal((await h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 5000, { strictJSON: true })`)).summary, 'ok');
  assert.equal(bodies.length, 2);
  assert.ok(!('think' in bodies[1]));
  // Thinks anyway and runs out of room: once more with more room, then a clear message.
  bodies.length = 0;
  h.context.fetch = async (url, init) => { bodies.push(JSON.parse(init.body)); return reply({ message: { content: '', thinking: 'Only thoughts' }, done_reason: 'length' }); };
  await assert.rejects(h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 5000, { strictJSON: true })`), (error) => /only returned its reasoning/.test(error.message));
  assert.equal(bodies.length, 2);
  assert.ok(bodies[1].options.num_predict > bodies[0].options.num_predict);
  // An error in the body is reported as is, not as an empty answer.
  h.context.fetch = async () => reply({ error: 'model "glm-5" not found' });
  await assert.rejects(h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 5000, { strictJSON: true })`), (error) => /not found/.test(error.message));
  // Streaming (Check & Challenge): no thinking phase asked; an answer left in the reasoning is used.
  h.context.TextDecoder = TextDecoder;
  bodies.length = 0;
  const stream = (lines) => {
    const chunks = lines.map((line) => new TextEncoder().encode(`${JSON.stringify(line)}\n`));
    return { ok: true, status: 200, headers: { get: () => 'application/x-ndjson' }, body: { getReader: () => ({ read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true }), cancel() {} }) } };
  };
  h.context.fetch = async (url, init) => { bodies.push(JSON.parse(init.body)); return stream([{ message: { content: '', thinking: 'Reasoning… {"summary":"from thoughts"}' } }, { done: true, done_reason: 'stop', message: { content: '' } }]); };
  assert.equal((await h.run(`AITextGenerator.generateStreaming('checker_analysis', 'system', 'user', null, 4000)`)).summary, 'from thoughts');
  assert.equal(bodies[0].think, false);
  h.context.fetch = async () => stream([{ message: { content: '' } }, { done: true, done_reason: 'stop', message: { content: '' } }]);
  await assert.rejects(h.run(`AITextGenerator.generateStreaming('checker_analysis', 'system', 'user', null, 4000)`), (error) => /Empty Ollama response/.test(error.message));
});

test('reliability: transient errors are retried, keys never reach the technical log, reasoning and cut-off replies are explained', async () => {
  const h = harness();
  h.run(`llmRetryDelay = () => 0; Object.assign(appState.scenario.settings, { ai_provider: 'openai', ai_api_key: 'sk-proj-SECRETSECRETSECRET', ai_model: 'gpt-test' }); CrisisTechLog.clear();`);
  const reply = (data, status = 200, headers = {}) => ({ ok: status < 400, status, statusText: '', headers: { get: (name) => headers[name.toLowerCase()] || null }, clone() { return this; }, text: async () => JSON.stringify(data), json: async () => data });
  const answers = [reply({ error: { message: 'Rate limit reached', code: 'rate_limit' } }, 429, { 'retry-after': '1' }), reply({ error: { message: 'Overloaded' } }, 503), reply({ choices: [{ message: { content: '<think>{"draft":1} maybe</think>{"summary":"ok"}' }, finish_reason: 'stop' }] })];
  let calls = 0;
  h.context.fetch = async () => answers[calls++];
  const result = await h.run(`AITextGenerator.generate('scenario_builder', 'system', 'user', true, 2000, {})`);
  assert.equal(result.summary, 'ok', 'reasoning stripped before parsing');
  assert.equal(calls, 3, '429 and 503 retried');
  const log = h.run('CrisisTechLog.text()');
  assert.equal((log.match(/FAILED/g) || []).length, 2);
  assert.ok(/attempt=3/.test(log) && /status=429/.test(log) && !log.includes('SECRETSECRET'), 'attempts logged, key masked');
  // Never retried: an exhausted quota, a bad key.
  calls = 0;
  h.context.fetch = async () => { calls++; return reply({ error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } }, 429); };
  await assert.rejects(h.run(`AITextGenerator.generate('x', 's', 'u', true, 2000, {})`), (error) => error.status === 429);
  assert.equal(calls, 1);
  // An empty reply cut at the length limit says so.
  h.context.fetch = async () => reply({ choices: [{ message: { content: '' }, finish_reason: 'length' }] });
  await assert.rejects(h.run(`AITextGenerator.generate('x', 's', 'u', true, 2000, {})`), (error) => error.code === 'truncated');
  h.context.fetch = async () => reply({ choices: [{ message: { content: null, refusal: 'I cannot help with that' }, finish_reason: 'stop' }] });
  await assert.rejects(h.run(`AITextGenerator.generate('x', 's', 'u', true, 2000, {})`), (error) => /declined/.test(error.message));
  // A time limit that cancels the request itself.
  h.context.fetch = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(h.run(`AITextGenerator.generate('x', 's', 'u', true, 2000, { timeoutMs: 30 })`), (error) => error.code === 'timeout' && /stopped/.test(error.message));
  // Wrapped errors keep what the provider said.
  const wrapped = h.run(`(() => { const e = CrisisError.wrap(CrisisError.create('Bad gateway', { provider: 'openai', model: 'gpt-test', status: 502, detail: 'upstream' }), { operation: 'Write inject' }); return [e.status, e.provider, e.model, e.detail].join('|'); })()`);
  assert.equal(wrapped, '502|openai|gpt-test|upstream');
});

test('reliability: a streamed reply cut at its length limit is reported as such; CJK text counts more tokens', async () => {
  const h = harness();
  h.context.TextDecoder = TextDecoder;
  h.run(`Object.assign(appState.scenario.settings, { ai_provider: 'openai', ai_api_key: 'TEST', ai_model: 'gpt-test' })`);
  const sse = (events) => {
    const chunks = events.map((event) => new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true }), cancel() {} }) } };
  };
  h.context.fetch = async () => sse([{ choices: [{ delta: { content: '{"summary":"half' } }] }, { choices: [{ delta: {}, finish_reason: 'length' }] }]);
  await assert.rejects(h.run(`AITextGenerator.generateStreaming('checker_analysis', 's', 'u', null, 1000)`), (error) => error.code === 'truncated');
  assert.ok(h.run(`llmEstimateTokens('日本語のテキスト'.repeat(100))`) > h.run(`llmEstimateTokens('English text'.repeat(67))`) * 2);
});

test('reliability: phases are planned in requests sized by the injects asked for', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); Object.assign(appState.scenario.settings, { ai_provider: 'openai', ai_api_key: 'TEST', ai_model: 'gpt-test' });`);
  h.run(`sbMainBlocks(sbStoryboard()).forEach((block) => { block.beats = []; block.narrative = 'x'; block.stimuli_target = 20; block.locked = false; })`);
  const budgets = [];
  h.run(`AITextGenerator.generate = async (channel, system, user, quiet, maxTokens) => { budgetsSeen.push({ maxTokens, targets: JSON.parse(user).target.length }); return { blocks: [] }; }`);
  h.context.budgetsSeen = budgets;
  const ids = h.json('sbMainBlocks(sbStoryboard()).map((block) => block.id)');
  await h.run(`SbAI.deepen(${JSON.stringify(ids)}, 3)`).catch((error) => assert.match(error.message, /did not return/));
  assert.ok(budgets.length >= Math.ceil(ids.length * 20 / 30), 'about 30 injects per request');
  assert.ok(budgets.every((entry) => entry.targets * 20 <= 30 || entry.targets === 1));
  assert.ok(budgets.every((entry) => entry.maxTokens >= 1200 + 180 * 20 * entry.targets || entry.maxTokens === 16000));
});

test('almost-JSON from a model is repaired as a last resort: raw line breaks, quotes in HTML, trailing commas', () => {
  const h = harness();
  h.context.broken = '{"subject":"Backup catalogues deleted","body":"<p class="lead">First line\nSecond line</p>",}';
  assert.equal(h.run('parseLLMJson(broken).body'), '<p class="lead">First line\nSecond line</p>');
  assert.equal(h.run('parseStrictLLMJson(broken).subject'), 'Backup catalogues deleted');
  h.context.quoted = '```json\n{"text":"The CEO said "no payment" this morning","time":"09:40"}\n```';
  assert.equal(h.run('parseLLMJson(quoted).text'), 'The CEO said "no payment" this morning');
  assert.throws(() => h.run('parseLLMJson("{\\"a\\": [1, 2")'), /malformed|not valid/i);
});

test('an inject created for AI writing carries no demo content of its template: sender from its actor, simulated date', async () => {
  const h = harness();
  h.run(`appState.scenario.scenario.start_date = '2026-11-27T08:00'; appState.scenario.client.name = 'Maison Aubray';`);
  const actorId = h.run(`addActor({ name: 'Nadia Belkacem', role: 'internal', title: 'SOC duty analyst', organization: 'Maison Aubray' }, false).id`);
  for (const channel of ['email_internal', 'email_external', 'sms_notification', 'internal_memo', 'breaking_news_tv', 'email_authority']) {
    const created = await execute(h, 'createStimulus', { name: `Test ${channel}`, actor_id: actorId, timestamp_offset_minutes: 45, channel });
    const fields = h.json(`getStimulus('${created.id}').fields`);
    assert.doesNotMatch(JSON.stringify(fields), /StonaWave|Sophie Delacroix|PharmLeaks|MediChem|Jean-Luc Moreau|CVE-2026/i, channel);
    if ('from_name' in fields) assert.match(fields.from_name, /Nadia Belkacem/);
    if ('sender' in fields) assert.equal(fields.sender, 'Nadia Belkacem');
    if ('time' in fields) assert.equal(fields.time, '08:45');
    // Numeric dates show the simulated clock; a date in another style ("March 15, 2026") is left to the AI.
    if ('date' in fields) assert.ok(['27/11/2026 08:45', ''].includes(fields.date), `${channel} date ${fields.date}`);
    if (['email_internal', 'email_external', 'internal_memo'].includes(channel)) assert.equal(fields.date, '27/11/2026 08:45');
  }
});

test('planned injects: the channel fits the sender (no internal email from a regulator, a bank or the press)', async () => {
  const h = harness();
  await execute(h, 'buildMainStoryline', { phases: [{ type: 'trigger', title: 'Detection', start_minutes: 0, duration_minutes: 60, brief: 'Alerts.' }] });
  await execute(h, 'upsertCast', { cast: [{ label: 'CNIL desk', role: 'authority' }, { label: 'Acquiring bank', role: 'partner' }, { label: 'SOC analyst', role: 'internal' }] });
  const block = h.json('sbMainBlocks(appState.scenario.storyboard)[0]');
  const plan = await execute(h, 'planPhaseInjects', { id: block.id, replace: true, injects: [
    { at: 1, channel: 'email_internal', cast: 'CNIL desk', title: 'Breach notification follow-up' },
    { at: 2, channel: 'internal_memo', cast: 'Acquiring bank', title: 'Fraud pattern' },
    { at: 3, channel: 'email_authority', cast: 'SOC analyst', title: 'SOC escalation' },
    { at: 4, channel: 'sms_notification', cast: 'Acquiring bank', title: 'Call me back' }
  ] });
  const byTitle = Object.fromEntries(plan.planned.map(item => [item.title, item.channel]));
  assert.equal(byTitle['Breach notification follow-up'], 'email_authority');
  assert.equal(byTitle['Fraud pattern'], 'email_external');
  assert.equal(byTitle['SOC escalation'], 'email_internal');
  assert.equal(byTitle['Call me back'], 'sms_notification');
});

test('main events: set per phase from the incident timeline, at from the phase start or converted from the exercise start', async () => {
  const h = harness();
  await execute(h, 'buildMainStoryline', { phases: [{ type: 'trigger', title: 'Detection', start_minutes: 0, duration_minutes: 60, brief: 'Alerts.' }, { type: 'crisis_cell', title: 'Ransom', start_minutes: 60, duration_minutes: 60, brief: 'Demand.' }] });
  const blocks = h.json('sbMainBlocks(appState.scenario.storyboard).map(b => b.id)');
  const [start, duration] = h.json(`(b => [b.start_minutes, b.duration_minutes])(sbBlock(appState.scenario.storyboard, '${blocks[1]}'))`);
  // An exercise minute inside the phase (beyond its duration from its start) is converted; a small one is from the phase start.
  const set = await execute(h, 'setMainEvents', { id: blocks[1], replace: true, events: [{ at: start + duration - 5, text: 'Ransom email to the CEO' }, { at: 10, text: 'Sample published on the leak site' }] });
  assert.equal(JSON.stringify(set.key_events.map(e => [e.at, e.exercise_minute])), JSON.stringify([[10, start + 10], [duration - 5, start + duration - 5]]));
  // Set twice: not duplicated.
  const again = await execute(h, 'setMainEvents', { id: blocks[1], events: [{ at: 10, text: 'Sample published on the leak site' }] });
  assert.equal(again.key_events.length, 2);
  const brief = h.run(`sbGenerationBrief(appState.scenario, sbBlock(appState.scenario.storyboard, '${blocks[1]}'), null)`);
  assert.match(brief, /Main events still to come.*Sample published/);
  await assert.rejects(execute(h, 'setMainEvents', { id: blocks[0], events: [{ at: 5000, text: 'Too late' }] }), /outside phase/);
});

test('agent replies: harmless slips are fixed before the strict check, tool arguments are still validated', () => {
  const h = harness();
  const call = h.json(`agentNormalizeResponse({ type: 'tool_call', tool: 'getStimulus', id: 'stimulus_1', arguments: {}, reason: 'x'.repeat(900) }, createAgentToolRegistry())`);
  assert.equal(call.arguments.id, 'stimulus_1'); assert.ok(!('id' in call)); assert.equal(call.reason.length, 500);
  assert.equal(h.json(`agentNormalizeResponse({ type: 'tool_call', tool: 'getScenario', args: {} })`).tool, 'getScenario');
  const final = h.json(`agentNormalizeResponse({ type: 'final', summary: 'Done' })`);
  assert.equal(final.issues.length, 0); assert.equal(final.changes.length, 0);
  assert.equal(h.json(`agentNormalizeResponse({ type: 'question', questions: 'Who plays?' })`).questions[0], 'Who plays?');
  // A key no tool declares is still refused.
  assert.throws(() => h.run(`agentNormalizeResponse({ type: 'tool_call', tool: 'getScenario', arguments: {}, javascript: 'alert(1)' }, createAgentToolRegistry())`), /Invalid/);
});

test('main events with a clock time are placed at that simulated time; the frame lists the incident timeline in play', async () => {
  const h = harness();
  h.run(`appState.scenario.scenario.start_date = '2026-11-27T08:00'; appState.scenario.scenario.attack_path = 'D-24: phishing\\nD-day 05:50: hypervisors encrypted\\nD-day 09:30: the attacker emails the CEO\\nD-day 10:15: sample on the leak site';`);
  await execute(h, 'setExerciseFrame', { duration_minutes: 180 });
  assert.equal(h.run(`sbTextClockMinute('09:30 – ransom email', '2026-11-27T08:00', 180)`), 90);
  assert.equal(h.run(`sbTextClockMinute('D-day 10:15: leak', '2026-11-27T08:00', 180)`), 135);
  assert.equal(h.run(`sbTextClockMinute('D-24: phishing', '2026-11-27T08:00', 180)`), null);
  assert.equal(h.run(`sbTextClockMinute('05:50 encryption', '2026-11-27T08:00', 180)`), null);
  const frame = h.json('agentExerciseFrame()');
  assert.equal(JSON.stringify(frame.incident_timeline_in_play.map(item => item.exercise_minute)), JSON.stringify([90, 135]));
  await execute(h, 'buildMainStoryline', { phases: [
    { type: 'trigger', title: 'Opening', start_minutes: 0, duration_minutes: 60, brief: 'x' },
    { type: 'crisis_cell', title: 'Ransom', start_minutes: 60, duration_minutes: 60, brief: 'x' },
    { type: 'twist', title: 'Leak', start_minutes: 120, duration_minutes: 60, brief: 'x' }
  ] });
  const blocks = h.json('sbMainBlocks(appState.scenario.storyboard).map(b => ({ id: b.id, start: b.start_minutes }))');
  // Before any main event, the consistency check lists the incident timeline events in play.
  assert.match(JSON.stringify(h.json('agentConsistencyCheck()')), /incident timeline event at H\+1:30 .*not a main event yet/);
  // The text's clock wins over a wrong at; an event whose time is in another phase goes to that phase.
  const set = await execute(h, 'setMainEvents', { id: blocks[1].id, events: [{ at: 5, text: '09:30 - The attacker emails the CEO' }] });
  assert.equal(set.key_events[0].exercise_minute, 90);
  const moved = await execute(h, 'setMainEvents', { id: blocks[1].id, events: [{ at: 20, text: '10:15 - Sample on the leak site' }] });
  assert.match(JSON.stringify(moved.moved_to_their_phase), /Leak/);
  assert.equal(h.json(`sbBlock(appState.scenario.storyboard, '${blocks[2].id}').events[0].offset_minutes`), 15);
  assert.equal(h.json(`sbBlock(appState.scenario.storyboard, '${blocks[1].id}').events.length`), 1);
  // GLM slips: a stray empty "id" next to "arguments" and extra keys in an event are dropped;
  // exercise_minute places an event that has no at.
  const registry = h.run('createAgentToolRegistry()');
  h.context.registry = registry;
  const normalized = h.json(`agentNormalizeResponse({ type: 'tool_call', tool: 'setMainEvents', id: '', arguments: { id: '${blocks[2].id}', events: [{ exercise_minute: 150, text: 'Press calls about the leak', importance: 'high' }] } }, registry)`);
  assert.equal(normalized.id, undefined);
  assert.equal(JSON.stringify(Object.keys(normalized.arguments.events[0]).sort()), JSON.stringify(['exercise_minute', 'text']));
  h.run(`ToolValidator.validate(${JSON.stringify(normalized.arguments)}, registry.get('setMainEvents').inputSchema)`);
  const placed = await execute(h, 'setMainEvents', normalized.arguments);
  assert.equal(placed.key_events.find(event => /Press calls/.test(event.text)).exercise_minute, 150);
  const early = await execute(h, 'setMainEvents', { id: blocks[2].id, events: [{ exercise_minute: 30, text: 'Too early' }] });
  assert.match(JSON.stringify(early.moved_to_their_phase), /Opening/);
  await assert.rejects(execute(h, 'setMainEvents', { id: blocks[2].id, events: [{ text: 'No time' }] }), /has no time/);
  // A main event moved by hand away from its time is flagged.
  h.run(`sbBlock(appState.scenario.storyboard, '${blocks[1].id}').events[0].offset_minutes = 10`);
  assert.ok(h.json('sbExerciseChecks(appState.scenario)').some(issue => issue.code === 'event_time'));
});

test('consistency check: players and cells against the Context frame, default cell names against the learning objectives', async () => {
  const h = harness();
  h.run(`appState.scenario.exercise = { players_count: 15, cells_count: 4 }; appState.scenario.scenario.learning_objectives = 'Legal, compliance & business cell: meet the GDPR deadline.';`);
  h.run(`appState.scenario.cells = [{ id: 'cell_a', name: 'Decision cell', color: '#222222', description: '', players: [{ name: '', role: 'CEO', email: '' }, { name: '', role: 'CFO', email: '' }] }]`);
  const issues = h.json('agentConsistencyCheck()').issues || h.json('agentConsistencyCheck()');
  const text = JSON.stringify(issues);
  assert.match(text, /2 players are listed but the exercise expects 15/);
  assert.match(text, /1 cells exist but the exercise expects 4/);
  assert.match(text, /Decision cell.{0,3} still have their default names/);
});

test('AI field values: plain text keeps its characters, HTML is sanitized, entities left by older versions are decoded', async () => {
  const h = harness();
  const actorId = h.run(`addActor({ name: 'Nadia', role: 'internal' }, false).id`);
  h.run(`sanitizeBody = value => 'SANITIZED:' + value`); // the harness stubs the DOM sanitizer: check the routing
  const created = await execute(h, 'createStimulus', { name: 'T', actor_id: actorId, timestamp_offset_minutes: 5, channel: 'email_internal', fields: { to: 'IT & Cyber Cell <soc@example.com>', subject: 'Checks & balances', body: '<p>Hi</p><img src=x onerror=alert(1)>' } });
  const fields = h.json(`getStimulus('${created.id}').fields`);
  assert.equal(fields.subject, 'Checks & balances');
  assert.match(fields.body, /^SANITIZED:/);
  const merged = h.json(`mergeScenario({ ...appState.scenario, stimuli: [{ ...getStimulus('${created.id}'), fields: { ...getStimulus('${created.id}').fields, to: 'IT &amp; Cyber Cell' } }] }).stimuli[0].fields.to`);
  assert.equal(merged, 'IT & Cyber Cell');
});

test('cast: a staff actor cannot also play the attacker; each kind of sender gets its own actor', async () => {
  const h = harness();
  await execute(h, 'upsertCast', { cast: [{ label: 'SOC analyst', role: 'internal', actor: { name: 'Théo Renaud', title: 'SOC analyst' } }] });
  // A clash does not fail the call: the role gets its own actor and the note says so.
  const clash = await execute(h, 'upsertCast', { cast: [{ label: 'Ransomware group', role: 'attacker', actor: { name: 'Théo Renaud' } }] });
  assert.match(clash.cast[0].note, /got its own actor/);
  assert.equal(clash.cast[0].actor_name, 'Ransomware group');
  assert.equal(h.json(`appState.scenario.actors.filter(a => a.name === 'Théo Renaud').length`), 1);
  // Two staff roles may share a person; a new attacker gets its own actor.
  await execute(h, 'upsertCast', { cast: [{ label: 'On-call manager', role: 'internal', actor: { name: 'Théo Renaud' } }, { label: 'Ransomware group', role: 'attacker', actor: { name: 'VEIL-9' } }] });
  const roles = h.json(`appState.scenario.storyboard.cast.map(c => [c.label, getActor(c.actor_id)?.name])`);
  assert.equal(JSON.stringify(roles.find(r => r[0] === 'Ransomware group')), JSON.stringify(['Ransomware group', 'VEIL-9']));
});

test('a build that ends before changing anything is sent back once to do the work', async () => {
  const h = harness();
  let r = runner(h, [final, call('updateExerciseObjectives', { objectives: 'Decide on isolation' }), final]);
  await r.start({ kind: 'builder', objective: 'Build the framing' });
  assert.equal(r.status, 'complete'); assert.equal(r.changed, 1);
  assert.ok(r.log.some(entry => /ended before changing anything/.test(entry.message)));
  // Only once: a second empty final ends the run; an assistant question is never sent back.
  r = runner(h, [final]); await r.start({ kind: 'builder', objective: 'Build' });
  assert.equal(r.status, 'complete'); assert.equal(r.step, 2);
  r = runner(h, [final]); await r.start({ kind: 'assistant', objective: 'Which cell?' });
  assert.equal(r.status, 'complete'); assert.equal(r.step, 1);
});

test('framing: a final answer with phases lacking main events is sent back, twice at most', async () => {
  const h = harness();
  const gaps = h.json('agentFramingGaps(appState.scenario)');
  assert.ok(gaps.length);
  const r = runner(h, [call('updateExerciseObjectives', { objectives: 'Decide on isolation' }), final, final, final]);
  await r.start({ kind: 'builder', objective: 'Build the framing', scope: 'framing' });
  assert.equal(r.status, 'complete'); assert.equal(r.step, 4);
  assert.ok(r.log.some(entry => /framing is not complete|stopped before building the phases/.test(entry.message)));
});

test('validation errors name the reason, so the model can correct its next call', () => {
  const h = harness();
  const reason = (args) => h.run(`(() => { try { ToolValidator.validate(${JSON.stringify(args)}, createAgentToolRegistry().get('upsertCast').inputSchema); return ''; } catch (error) { return error.message; } })()`);
  assert.match(reason({ cast: [{ role: 'attacker' }] }), /arguments\.cast\[0\]: missing required field "label"/);
  assert.match(reason({ cast: [{ label: 'X', role: 'pirate' }] }), /cast\[0\]\.role: expected one of .*attacker/);
  assert.match(reason({ cast: [{ label: 'X', mood: 'calm' }] }), /unknown field "mood"/);
});

test('nudges and closing phase: planned by the agent tools, reported by the consistency check until fixed', async () => {
  const h = harness();
  assert.match(h.run('AgentPrompts.builder'), /closing phase/);
  assert.match(h.run('AgentPrompts.builder'), /at least one nudge per cell/);
  assert.match(h.run('AgentPrompts.protocol'), /A nudge \(nudge=true\)/);
  h.run(`StoryboardHistory.ensure(appState.scenario)`);
  await execute(h, 'buildMainStoryline', { cast: [{ key: 'ceo', label: 'CEO', role: 'internal' }], phases: [
    { type: 'trigger', title: 'Alerts', start_minutes: 0, duration_minutes: 60, brief: 'EDR alerts.' },
    { type: 'custom', title: 'Strategic review', start_minutes: 60, duration_minutes: 60, brief: 'Hot wash.' }
  ] });
  h.run(`appState.scenario.cells = [{ id: 'cell_a', name: 'Decision cell', color: '#222222', description: '', players: [] }, { id: 'cell_b', name: 'IT cell', color: '#333333', description: '', players: [] }]`);
  const issues = () => JSON.stringify(h.json('agentConsistencyCheck()').issues);
  assert.match(issues(), /does not end with a closing phase.*updateStoryboardBlock/);
  // A framing without planned injects is not pushed to plan injects.
  assert.doesNotMatch(issues(), /no nudge inject/);
  const [first, last] = h.json('sbMainBlocks(appState.scenario.storyboard).map(b => b.id)');
  const plan = await execute(h, 'planPhaseInjects', { id: first, injects: [
    { at: 10, channel: 'email_internal', cell: 'cell_a', cast: 'CEO', title: 'Isolation request' },
    { at: 40, channel: 'email_internal', cell: 'cell_a', cast: 'CEO', title: 'CEO asks for the decision now', nudge: true },
    { at: 20, channel: 'email_internal', cell: 'cell_b', cast: 'CEO', title: 'Status please' }
  ] });
  assert.equal(plan.planned.find(item => item.title === 'CEO asks for the decision now').nudge, true);
  assert.equal(plan.planned.find(item => item.title === 'Isolation request').nudge, undefined);
  assert.match(issues(), /Cell \\"IT cell\\" has no nudge inject/);
  assert.doesNotMatch(issues(), /Cell \\"Decision cell\\" has no nudge inject/);
  const status = (await execute(h, 'getPhase', { id: first })).planned_injects.find(item => item.title === 'Status please');
  assert.equal((await execute(h, 'updatePlannedInject', { id: first, inject_id: status.id, patch: { nudge: true } })).nudge, true);
  assert.doesNotMatch(issues(), /no nudge inject/);
  assert.ok(!h.json('sbExerciseChecks(appState.scenario)').some(issue => issue.code === 'cell_no_nudge'));
  await execute(h, 'updatePlannedInject', { id: first, inject_id: status.id, patch: { nudge: false } });
  assert.equal(h.run(`sbBlock(appState.scenario.storyboard, '${first}').beats.find(b => b.id === '${status.id}').kind`), undefined);
  assert.match(issues(), /Cell \\"IT cell\\" has no nudge inject/);
  // The last phase becomes the closing phase without rebuilding the storyline.
  await execute(h, 'updateStoryboardBlock', { id: last, patch: { type: 'exit' } });
  assert.doesNotMatch(issues(), /closing phase/);
  await assert.rejects(execute(h, 'updateStoryboardBlock', { id: last, patch: { type: 'bogus' } }), /Invalid/);
});

test('validation errors say what to correct, so the model can fix its retry', () => {
  const h = harness();
  assert.throws(() => h.run(`agentNormalizeResponse({ type: 'tool_call', tool: 'getScenario', arguments: {}, javascript: 'alert(1)' }, createAgentToolRegistry())`), /(unexpected key|unknown field) "javascript"/);
  assert.throws(() => h.run(`ToolValidator.validate([{}], AgentSchema.object())`), /not an array/);
  assert.throws(() => h.run(`ToolValidator.validate({}, AgentSchema.object({ id: AgentSchema.id }, ['id']))`), /missing (required field )?"id"/);
});

test('a reply without its type is read from its keys', () => {
  const h = harness();
  assert.equal(h.run(`agentNormalizeResponse({ summary: 'Done', issues: [], changes: [] }).type`), 'final');
  assert.equal(h.run(`agentNormalizeResponse({ tool: 'getScenario', arguments: {} }).type`), 'tool_call');
  assert.equal(h.run(`agentNormalizeResponse({ questions: ['Which cell?'] }).type`), 'question');
});

test('reliability: a success status with a cut, non-JSON body is retried', async () => {
  const h = harness();
  h.run(`llmRetryDelay = () => 0; Object.assign(appState.scenario.settings, { ai_provider: 'openrouter', ai_api_key: 'sk-or-v1-SECRETSECRET', ai_model: 'anthropic/claude-sonnet-5.5' });`);
  const cut = { ok: true, status: 200, statusText: '', headers: { get: () => null }, clone() { return this; }, text: async () => '{"choices":[{"mess', json: async () => { throw new SyntaxError('cut'); } };
  const good = { ok: true, status: 200, statusText: '', headers: { get: () => null }, clone() { return this; }, text: async () => JSON.stringify({ choices: [{ message: { content: '{"summary":"ok"}' }, finish_reason: 'stop' }] }), json: async () => ({ choices: [{ message: { content: '{"summary":"ok"}' }, finish_reason: 'stop' }] }) };
  let calls = 0;
  h.context.fetch = async () => (calls++ ? good : cut);
  const result = await h.run(`AITextGenerator.generate('agent', 'system', 'user', true, 2000, {})`);
  assert.equal(result.summary, 'ok');
  assert.equal(calls, 2);
});

test('stage 1 framing: a final before the phases are built is sent back, twice at most', async () => {
  const h = harness();
  let requests = 0;
  const r = runner(h, [final]);
  const request = h.context.request; h.context.request = async (...args) => { requests++; return request(...args); };
  h.run('runner.request = request');
  await r.start({ kind: 'builder', mode: 'agent', objective: 'Frame', scope: 'framing' });
  assert.equal(r.status, 'complete');
  assert.equal(requests, 3, 'two refusals, then the final is accepted');
  assert.ok(r.log.some((entry) => /stopped before building the phases/.test(entry.message)));
});

test('several calls in one reply: the first one runs', () => {
  const h = harness();
  assert.equal(h.run(`agentNormalizeResponse([{ type: 'tool_call', tool: 'getScenario', arguments: {} }, { type: 'final', summary: 'x' }]).tool`), 'getScenario');
  assert.equal(h.run(`agentNormalizeResponse({ tool_calls: [{ name: 'getStoryboard', arguments: {} }] }).tool`), 'getStoryboard');
  assert.throws(() => h.run(`agentNormalizeResponse({ type: 'plan', steps: [] })`), /must be "tool_call", "question" or "final"/);
});

test('tool arguments alone are not read as a final answer', () => {
  const h = harness();
  assert.throws(() => h.run(`agentNormalizeResponse({ summary: 'Scenario summary', type_label: 'ransomware', start_date: '2026-11-27T08:00' })`), /must be "tool_call"/);
});

test('a Claude reply with its native <invoke> syntax first: the agent object is read, not a parameter', () => {
  const h = harness();
  const reply = '<invoke name="setMainEvents">\n<parameter name="events">[{"at": 5, "text": "Ransom note"}]</parameter>\n</invoke>\n\nCorrection: here is the valid JSON object.\n\n{"type":"tool_call","tool":"setMainEvents","arguments":{"id":"b1","events":[{"at":5,"text":"Ransom note"}]},"reason":"Set events"}';
  h.context.reply = reply;
  assert.equal(h.run('parseStrictLLMJson(reply).tool'), 'setMainEvents');
});

test('a special token leaked into a JSON reply is dropped by the repair', () => {
  const h = harness();
  assert.equal(h.run(`JSON.stringify(repairLLMJson('{"ok":<|OPENAI|>true,"message":"valid connection"}'))`), '{"ok":true,"message":"valid connection"}');
  assert.equal(h.run(`repairLLMJson('{"text":"a <|b|> c"}').text`), 'a  c');
});

test('stage 1 framing: three reads in a row bring the list of what is still missing', async () => {
  const h = harness();
  const r = runner(h, [call('getStoryboard', {}), call('getScenario', {}), call('getExerciseFrame', {}), final, final, final]);
  await r.start({ kind: 'builder', mode: 'auto', objective: 'Frame', scope: 'framing' });
  assert.ok(r.log.some((entry) => /Reading again and again/.test(entry.message)));
});
