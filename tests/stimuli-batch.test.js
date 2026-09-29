const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

/* Bulk creation of injects from the Injects library prompt (mocked AI, no provider call). */
function harness() {
  const storage = new Map();
  const context = { console, URL, Blob, TextEncoder, Uint8Array, AbortController, DOMException, setTimeout, clearTimeout,
    setInterval: () => 0, navigator: { language: 'en' }, location: { origin: 'https://example.test' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, activeElement: null }, addEventListener: () => {},
    atob: value => Buffer.from(value, 'base64').toString('binary'), btoa: value => Buffer.from(value, 'binary').toString('base64') };
  context.window = context; context.sessionStorage = context.localStorage;
  vm.createContext(context);
  const files = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8').replace('      App.init();', ''), context, { filename: file });
  vm.runInContext(`App.render = () => {}; pushToast = () => {}; sanitizeBody = value => value; window.confirm = () => true;
    appState.scenario = emptyScenario({ ai_api_key: 'TEST-SECRET', ai_provider: 'openai' });
    (() => {
      const project = appState.scenario; const sb = project.storyboard; const main = sbMainTrack(sb).id;
      sb.duration_minutes = 180;
      project.cells = [sbMakeCell('decision', { id: 'cell_dec', name: 'Decision cell' }), sbMakeCell('communication', { id: 'cell_com', name: 'Communication cell' })];
      sb.blocks.push(sbMakeBlock('trigger', { id: 'p1', title: 'Detection', track_id: main, start_minutes: 0, duration_minutes: 60, brief: 'Alerts pile up' }, sb));
      sb.blocks.push(sbMakeBlock('containment', { id: 'p2', title: 'Containment', track_id: main, start_minutes: 60, duration_minutes: 120, brief: 'Isolation decision' }, sb));
      project.actors = [{ id: 'actor_ciso', name: 'Alice Martin', role: 'internal', organization: 'Acme', title: 'CISO', language: 'en' }];
    })();`, context);
  const run = code => vm.runInContext(code, context);
  return { context, run, json: code => JSON.parse(run(`JSON.stringify(${code})`)) };
}

/* Answers each call with `count` injects built by `make(index, callNumber)`. */
function mockAI(h, make) {
  h.context.makeInject = make;
  h.context.aiCalls = [];
  h.run(`AITextGenerator.generate = async (channel, system, user) => {
    aiCalls.push({ channel, system, user });
    const count = Number((user.match(/exactly (\\d+) inject objects/) || [])[1]) || 1;
    const offset = aiCalls.length === 1 ? 0 : aiCalls.slice(0, -1).reduce((sum, call) => sum + (Number((call.user.match(/exactly (\\d+) inject objects/) || [])[1]) || 1), 0);
    return { stimuli: Array.from({ length: count }, (_, index) => makeInject(offset + index, aiCalls.length)) };
  };`);
}

async function runBatch(h, text, options = {}) {
  h.context.batchOptions = options;
  await h.run(`(async () => {
    const state = appState.llmState.stimuli_batch;
    Object.assign(state, { text: ${JSON.stringify(text)} }, batchOptions);
    await generateStimuliBatch(state);
  })()`);
}

test('bulk creation: a large request is written in chunks, each told what the batch already holds', async () => {
  const h = harness();
  mockAI(h, (index) => ({ channel: 'email_internal', template_id: 'outlook', actor_id: 'Alice Martin', cell: 'Decision cell', name: `Inject ${index + 1}`, timestamp_offset_minutes: index * 10, generation_prompt: `Intent ${index + 1}`, fields: { subject: `Subject ${index + 1}`, body: '<p>Body</p>' } }));
  await runBatch(h, 'Create 10 injects for the decision cell');
  const calls = h.json('aiCalls.map(c => ({ channel: c.channel, user: c.user }))');
  assert.equal(calls.length, 2);
  assert.match(calls[0].user, /exactly 8 inject objects/);
  assert.match(calls[1].user, /exactly 2 inject objects/);
  assert.match(calls[1].user, /Injects already created for it/);
  assert.match(calls[1].user, /Inject 8/);
  const stimuli = h.json('appState.scenario.stimuli.map(s => ({ name: s.name, cell: s.cell_id, actor: s.actor_id, subject: s.fields.subject, intent: s.generation_prompt }))');
  assert.equal(stimuli.length, 10);
  assert.ok(stimuli.every(s => s.cell === 'cell_dec' && s.actor === 'actor_ciso'));
  assert.equal(stimuli[9].name, 'Inject 10');
  assert.equal(stimuli[0].intent, 'Intent 1');
  assert.equal(h.json('appState.llmState.stimuli_batch.lastFilledCount'), 10);
});

test('bulk creation: the prompt carries the cells and phases, and the imposed cell and phase win', async () => {
  const h = harness();
  mockAI(h, (index) => ({ channel: 'post_twitter', actor_id: null, cell: 'Decision cell', timestamp_offset_minutes: index === 0 ? 5 : 500, fields: { text: 'Outrage' } }));
  await runBatch(h, 'Create 2 injects', { cellId: 'cell_com', phaseId: 'p2' });
  const system = h.run('aiCalls[0].system');
  assert.match(system, /EXERCISE STRUCTURE/);
  assert.match(system, /Communication cell/);
  assert.match(system, /"title":"Containment"/);
  assert.match(system, /IMPOSED: every inject is addressed to the cell "Communication cell"/);
  assert.match(system, /IMPOSED: every inject belongs to the phase "Containment": timestamp_offset_minutes between 60 and 179/);
  const stimuli = h.json('appState.scenario.stimuli.map(s => ({ cell: s.cell_id, at: s.timestamp_offset_minutes }))');
  assert.deepEqual(stimuli, [{ cell: 'cell_com', at: 60 }, { cell: 'cell_com', at: 179 }]);
});

test('bulk creation: recipients by name, several or all cells, and new senders join the cast once', async () => {
  const h = harness();
  const cells = ['Decision cell + Communication cell', 'all', 'communication CELL', 'Unknown cell'];
  mockAI(h, (index) => ({ channel: 'article_press', template_id: 'nyt', actor_id: null, new_actor: { name: 'Dana Reed', role: 'journalist', organization: 'Daily Wire', title: 'Reporter' }, cell: cells[index], timestamp_offset_minutes: 30, fields: { headline: 'Breach' } }));
  await runBatch(h, 'Create 4 injects from the press');
  const stimuli = h.json('appState.scenario.stimuli.map(s => s.cell_id || "")');
  assert.deepEqual(stimuli, ['cell_dec+cell_com', 'all', 'cell_com', '']);
  const actors = h.json('appState.scenario.actors.map(a => ({ name: a.name, role: a.role }))');
  assert.deepEqual(actors, [{ name: 'Alice Martin', role: 'internal' }, { name: 'Dana Reed', role: 'journalist' }]);
  assert.ok(h.json('appState.scenario.stimuli.every(s => s.actor_id === appState.scenario.actors[1].id)'));
});

test('bulk creation: one undo step, and "Remove them" takes out the injects and the senders it added', async () => {
  const h = harness();
  mockAI(h, (index) => ({ channel: 'email_external', actor_id: index ? 'Alice Martin' : 'Bob Stone', cell: 'Decision cell', timestamp_offset_minutes: 15, fields: { subject: 'Hello' } }));
  await runBatch(h, 'Create 3 injects');
  assert.equal(h.json('appState.scenario.stimuli.length'), 3);
  assert.equal(h.json('appState.scenario.actors.length'), 2);
  assert.equal(h.run('StoryboardHistory.lastLabel()'), 'Create injects in bulk');
  h.run('StoryboardHistory.undo()');
  assert.equal(h.json('appState.scenario.stimuli.length'), 0);
  assert.equal(h.json('appState.scenario.actors.length'), 1);
  h.run('StoryboardHistory.redo()');
  assert.equal(h.json('appState.scenario.stimuli.length'), 3);
  h.run('removeLastStimuliBatch()');
  assert.equal(h.json('appState.scenario.stimuli.length'), 0);
  assert.deepEqual(h.json('appState.scenario.actors.map(a => a.name)'), ['Alice Martin']);
  assert.equal(h.json('appState.llmState.stimuli_batch.lastBatch'), null);
});

test('bulk creation: injects written before a failure stay, and the request count is capped at 60', async () => {
  const h = harness();
  h.context.aiCalls = [];
  h.run(`AITextGenerator.generate = async (channel, system, user) => {
    aiCalls.push(user);
    if (aiCalls.length > 1) throw new Error('rate limit');
    return { stimuli: Array.from({ length: 8 }, (_, i) => ({ channel: 'sms_notification', cell: 'all', timestamp_offset_minutes: i, fields: { text: 'Alert' } })) };
  };`);
  await assert.rejects(runBatch(h, 'Create 200 injects'), /rate limit/);
  assert.match(h.run('aiCalls[0]'), /exactly 8 inject objects/);
  assert.equal(h.json('appState.scenario.stimuli.length'), 8);
  assert.equal(h.json('appState.llmState.stimuli_batch.lastBatch.stimulusIds.length'), 8);
  assert.equal(h.json('requestedStimulusCount("Crée 25 stimuli pour la cellule")'), 25);
});
