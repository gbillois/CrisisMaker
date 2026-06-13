const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
const context = {
  console,
  localStorage,
  navigator: { language: 'en' },
  window: {},
  document: { getElementById: () => null },
  URL,
  Blob,
  TextEncoder,
  Uint8Array,
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  appState: null,
  pushToast: () => {},
  downloadBlob: () => {},
  normalizeProviderSettingsInPlace: () => {},
  makeDefaultLLMState: () => ({
    scenario: { text: '' }, actors: { text: '' }, stimulus: { text: '' },
    stimuli_batch: { text: '' }, debrief: { text: '' }
  }),
  App: { render: () => {} }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

for (const file of [
  'js/data.js',
  'js/config.js',
  'js/debrief-renderer.js',
  'js/debrief-editor-source.js',
  'js/debrief.js',
  'js/persistence.js'
]) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const result = vm.runInContext(`(() => {
  const scenario = defaultScenario();
  scenario.debrief.meta.title = 'Saved custom debrief';
  scenario.debrief.kindLabels.intrusion = 'Custom intrusion';
  scenario.debrief.theme.preset = 'wavestone';
  scenario.debrief.layout.mapSide = 'left';
  scenario.debrief.map.mode = 'region';
  scenario.debrief.phases[0].range = 'Custom prelude range';
  scenario.debrief.phases[0].color = '#123456';
  scenario.debrief.events[1].title = 'Custom story step';
  scenario.debrief.events[1].t = 0.12345;
  scenario.debrief.events[1].coords = [12.34, 56.78];
  scenario.debrief.events[1].artifacts = ['Custom evidence'];
  appState = {
    scenario,
    llmState: {
      scenario: { text: '' }, actors: { text: '' }, stimulus: { text: '' },
      stimuli_batch: { text: '' }, debrief: { text: 'custom debrief prompt' }
    }
  };

  const project = buildProjectFileData();
  const loaded = mergeScenario(migrateScenario(JSON.parse(JSON.stringify(project))));
  saveLocal(false);
  const locallySaved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const imported = JSON.parse(JSON.stringify(project));
  imported.debrief.meta.title = 'Loaded through project import';
  applyLoadedScenario(imported);
  const appliedLoad = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const legacy = mergeScenario(migrateScenario({
    name: 'Legacy project', client: { name: 'Other' }, scenario: { type: 'Crisis' },
    actors: [], stimuli: [], settings: {}
  }));
  return { project, loaded, locallySaved, appliedLoad, legacy };
})()`, context);

for (const project of [result.project, result.loaded, result.locallySaved]) {
  assert.equal(project.debrief.meta.title, 'Saved custom debrief');
  assert.equal(project.debrief.events[1].title, 'Custom story step');
  assert.equal(project.debrief.events[1].t, 0.12345);
  assert.deepEqual(Array.from(project.debrief.events[1].coords), [12.34, 56.78]);
  assert.deepEqual(Array.from(project.debrief.events[1].artifacts), ['Custom evidence']);
  assert.equal(project.debrief.kindLabels.intrusion, 'Custom intrusion');
  assert.equal(project.debrief.theme.preset, 'wavestone');
  assert.equal(project.debrief.layout.mapSide, 'left');
  assert.equal(project.debrief.map.mode, 'region');
  assert.equal(project.debrief.phases[0].range, 'Custom prelude range');
  assert.equal(project.debrief.phases[0].color, '#123456');
}
assert.equal(result.project.llm_prompts.debrief, 'custom debrief prompt');
assert.equal(result.locallySaved.llm_prompts.debrief, 'custom debrief prompt');
assert.equal(result.appliedLoad.debrief.meta.title, 'Loaded through project import');
assert.equal(result.appliedLoad.debrief.events[1].t, 0.12345);
assert.ok(result.legacy.debrief.events.length > 0);
assert.equal(result.project.settings.ai_api_key, '');
assert.equal(result.project.settings.azure_api_key, '');
assert.equal(result.project.settings.azure_speech_key, '');

const editorFrame = { srcdoc: '' };
context.document.getElementById = (id) => id === 'debrief-editor-frame' ? editorFrame : null;
context.appState = { scenario: result.project };
vm.runInContext('mountDebriefEditor()', context);
assert.match(editorFrame.srcdoc, /<title>Crisis Debriefer — Timeline Generator<\/title>/);
assert.match(editorFrame.srcdoc, /window\.CRISISMAKER_INITIAL_CONFIG = /);
assert.match(editorFrame.srcdoc, /Saved custom debrief/);
assert.equal(editorFrame.src, undefined);

console.log('Debrief project persistence round-trip passed.');
