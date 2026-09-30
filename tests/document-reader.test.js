const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

/* The app scripts in a VM, with JSZip (a deferred library in the page). */
function harness() {
  const storage = new Map();
  const context = { console, URL, Blob, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, AbortController, DOMException, setTimeout, clearTimeout,
    setInterval: () => 0, navigator: { language: 'en' }, location: { origin: 'https://example.test' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setImmediate, addEventListener: () => {},
    atob: value => Buffer.from(value, 'base64').toString('binary'), btoa: value => Buffer.from(value, 'binary').toString('base64') };
  context.window = context; context.self = context; context.sessionStorage = context.localStorage;
  vm.createContext(context);
  // JSZip first, without a document (its setImmediate shim would draw on it).
  vm.runInContext(fs.readFileSync('js/lib/jszip.min.js', 'utf8'), context, { filename: 'jszip.min.js' });
  context.document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, activeElement: null };
  const files = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8').replace('      App.init();', ''), context, { filename: file });
  vm.runInContext(`App.render = () => {}; pushToast = () => {}; sanitizeBody = value => value;
    appState.scenario = emptyScenario({ ai_api_key: 'TEST-SECRET', ai_provider: 'openai' });
    appState.route = 'scenario';`, context);
  const run = code => vm.runInContext(code, context);
  return { context, run, json: code => JSON.parse(run(`JSON.stringify(${code})`)) };
}

/* A file as the page gets it from the file input. */
function load(h, path) {
  h.context.fixtureBytes = new Uint8Array(fs.readFileSync(path));
  h.context.fixtureName = path.split('/').pop();
  return h.run(`({ name: fixtureName, size: fixtureBytes.length, type: '', arrayBuffer: async () => fixtureBytes.buffer.slice(fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength) })`);
}

test('xml: entities, CDATA, self-closing tags and attributes', () => {
  const h = harness();
  const tree = h.json(`(() => { const doc = CrisisDocReader.parseXml('<?xml version="1.0"?><a:p x="1 &amp; 2"><a:r><a:t>R&amp;D &lt;ok&gt; &#233;t&#xE9;</a:t></a:r><a:br/><a:t><![CDATA[<raw>]]></a:t></a:p>'); const p = doc.children[0]; return { attr: p.attrs.x, local: p.local, kids: p.children.map(c => c.local), text: p.children[0].children[0].text, cdata: p.children[2].text }; })()`);
  assert.deepEqual(tree, { attr: '1 & 2', local: 'p', kids: ['r', 'br', 't'], text: 'R&D <ok> été', cdata: '<raw>' });
});

test('pptx: slides in order with titles, bullets, tables, notes, chart, SmartArt and hidden slides', async () => {
  const h = harness();
  h.context.file = load(h, 'tests/fixtures/exercise-deck.pptx');
  await h.run(`CrisisDocReader.read(file, file.name).then(doc => { globalThis.doc = doc; })`);
  const doc = h.json('doc');
  assert.equal(doc.kind, 'pptx');
  assert.equal(doc.slides.length, 13);
  assert.equal(doc.meta.title, 'Exercice de crise cyber - Opération Chaîne du froid');
  assert.deepEqual(doc.slides.map(s => s.title).slice(0, 4), ['Opération Chaîne du froid', 'Déroulé de la journée', 'Contexte', 'Objectifs de l’exercice']);
  const objectives = doc.slides[3].blocks[0].paragraphs;
  assert.equal(objectives.length, 4);
  assert.equal(objectives[3].level, 1, 'bullet level kept');
  assert.equal(doc.slides[2].notes, 'Rappeler aux joueurs que la société est fictive.');
  // The chevrons were drawn right to left: the reader follows their positions.
  const phases = doc.slides[5].blocks.map(b => b.paragraphs[0].text);
  assert.deepEqual(phases, ['Phase 1 - Détection', 'Phase 2 - Escalade', 'Phase 3 - Sortie de crise']);
  // A phase cell merged down is repeated on every row it spans.
  const table = doc.slides[6].blocks.find(b => b.kind === 'table').rows;
  assert.deepEqual(table.map(r => r[1]), ['Phase', 'Détection', 'Détection', 'Détection']);
  assert.ok(doc.slides[9].hidden && !doc.slides[8].hidden);
  const chart = doc.slides[10].blocks.find(b => b.kind === 'chart');
  assert.deepEqual(chart.series[0].values, ['5', '9', '4']);
  const diagram = doc.slides[11].blocks.find(b => b.kind === 'diagram');
  assert.deepEqual(diagram.items, ['J-21 : hameçonnage d’un comptable', 'J-3 : exfiltration de 80 Go', 'Jour J 06:40 : chiffrement du WMS'], 'SmartArt nodes, not their connectors');
});

test('pptx analysis: sections, a chronogram continued over two slides, injects written one per slide', async () => {
  const h = harness();
  h.context.file = load(h, 'tests/fixtures/exercise-deck.pptx');
  await h.run(`CrisisDocReader.read(file, file.name).then(doc => { globalThis.doc = doc; globalThis.analysis = CrisisDocReader.analyze(doc, CHECKER_COLUMN_PATTERNS); })`);
  const analysis = h.json('analysis');
  assert.deepEqual(analysis.sections.context, [3]);
  assert.deepEqual(analysis.sections.objectives, [4]);
  assert.deepEqual(analysis.sections.players, [5, 11]);
  assert.deepEqual(analysis.sections.phases, [6]);
  assert.deepEqual(analysis.sections.chronogram, [7, 8, 9]);
  assert.deepEqual(analysis.sections.incident, [12]);
  assert.deepEqual(analysis.sections.facilitation, [10]);
  assert.deepEqual(analysis.sections.debrief, [13]);
  assert.equal(analysis.defaultView, 'Chronogram (slides 7-8)');
  const chrono = analysis.views['Chronogram (slides 7-8)'];
  assert.deepEqual(chrono.headers, ['Slide', 'Horaire', 'Phase', 'Émetteur', 'Destinataire', 'Canal', 'Contenu']);
  assert.equal(chrono.rows.length, 6, 'the repeated header of slide 8 is not a row');
  assert.deepEqual(chrono.rows[4].slice(0, 4), ['8', 'H+1:30', 'Escalade', 'Client Carrefour']);
  const injects = analysis.views['Injects by slide (1)'];
  assert.deepEqual(injects.rows[0].slice(0, 6), ['9', 'H+1:10', '', '@FoodWatchFR', 'Communication', 'Réseaux sociaux']);
  assert.equal(analysis.chronogramRows, 7);
  // The outline keeps everything; a limit drops the least useful slides first.
  const outline = h.run('CrisisDocReader.outline(doc, analysis)');
  for (const text of ['Slide 3 · Contexte [context]', 'Juridique : notifier la CNIL sous 72 h', '| Cellule décisionnelle | DG, DAF, DRH, Dir. juridique | Décide et arbitre |', '> Jour J 06:40 : chiffrement du WMS', 'Notes: Relance si pas de réaction', '(hidden)', 'Stimuli: Décisionnelle=5']) assert.ok(outline.includes(text), text);
  const short = h.run('CrisisDocReader.outline(doc, analysis, { limit: 1500 })');
  assert.ok(short.length <= 1500);
  assert.ok(short.includes('Frigolog, logisticien du froid'), 'context kept when shortened');
});

test('docx and text: a proposal or a brief split into sections at its headings', async () => {
  const h = harness();
  h.context.file = load(h, 'tests/fixtures/exercise-brief.docx');
  await h.run(`CrisisDocReader.read(file, file.name).then(doc => { globalThis.doc = doc; globalThis.analysis = CrisisDocReader.analyze(doc, CHECKER_COLUMN_PATTERNS); })`);
  const doc = h.json('doc');
  assert.equal(doc.kind, 'docx');
  assert.deepEqual(doc.slides.map(s => s.title), ['Cyber crisis exercise proposal', 'Context', 'Exercise objectives', 'Participants', 'Approach and budget']);
  assert.equal(doc.slides[2].blocks[0].paragraphs.length, 3);
  assert.deepEqual(doc.slides[3].blocks[0].rows[2], ['IT crisis cell', 'CIO, CISO, SOC lead']);
  const analysis = h.json('analysis');
  assert.deepEqual(analysis.sections.objectives, [3]);
  assert.deepEqual(analysis.sections.players, [4]);
  assert.equal(analysis.defaultView, 'All sections');
  const text = h.json(`(() => { const d = CrisisDocReader.readText('# Brief\\nHospital group, 6 sites.\\n## Objectives\\n- Decide on isolation\\n  - within 1 hour\\n| Cell | Players |\\n|---|---|\\n| Exec | CEO |', 'brief.md'); return { titles: d.slides.map(s => s.title), bullets: d.slides[1].blocks[0].paragraphs, table: d.slides[1].blocks[1].rows }; })()`);
  assert.deepEqual(text.titles, ['Brief', 'Objectives']);
  assert.deepEqual(text.bullets, [{ text: 'Decide on isolation', level: 0 }, { text: 'within 1 hour', level: 1 }]);
  assert.deepEqual(text.table, [['Cell', 'Players'], ['Exec', 'CEO']]);
});

test('context: a loaded deck feeds the challenge, the agent and the fields of the Context tab', async () => {
  const h = harness();
  h.context.file = load(h, 'tests/fixtures/exercise-deck.pptx');
  await h.run('checkerHandleFile(file)');
  assert.equal(h.run('appState.checkerState.selectedSheet'), 'Chronogram (slides 7-8)');
  assert.equal(h.run('appState.checkerState.columnMapping.timestamp'), 1);
  assert.equal(h.run('appState.checkerState.columnMapping.sender'), 3);
  const view = h.run('renderScenarioView()');
  assert.ok(view.includes('exercise-deck.pptx') && view.includes('13 slides · 7 injects') && view.includes('cx-file-chip'), 'what was found is shown');
  // Views switch without a workbook.
  h.run(`checkerSwitchSheet('All slides')`);
  assert.equal(h.run('appState.checkerState.parsedData.rows.length'), 13);
  h.run(`checkerSwitchSheet('Chronogram (slides 7-8)')`);
  // The challenge reads the whole deck, then the chronogram lines.
  const serialized = h.run('checkerSerializeChronogram().serialized');
  assert.ok(serialized.startsWith('EXERCISE DOCUMENT') && serialized.includes('Tester la mobilisation de la cellule de crise') && serialized.includes('CHRONOGRAM DATA'));
  assert.ok(serialized.includes('[chronogram: table sent as rows below]'), 'the tables are not sent twice');
  // The agent gets an excerpt in its objective and reads the rest with getReferenceFile.
  const objective = h.run('contextAgentObjective(appState.scenario)');
  assert.ok(objective.includes('getReferenceFile') && objective.includes('exercise-deck.pptx') && objective.length <= 7900);
  const page = h.json(`createAgentToolRegistry().get('getReferenceFile').execute({})`);
  assert.equal(page.kind, 'pptx');
  assert.ok(page.text.includes('Chronologie de l’attaque') && page.nextOffset === null);
  assert.equal(h.json(`createAgentToolRegistry().get('getReferenceFile').execute({ part: 'injects' })`).text.includes('Client Carrefour'), true);
  assert.deepEqual(h.json('agentExerciseFrame().reference_file.sections_found.objectives'), [4]);
  // Without AI, the sections found fill the empty fields; typed fields stay.
  h.run(`appState.scenario.scenario.learning_objectives = 'Mine'`);
  const filled = h.json('ContextGeneration.fillFromDocument()');
  assert.ok(filled.includes('Incident timeline') && !filled.includes('Learning objectives'));
  assert.equal(h.run('appState.scenario.scenario.learning_objectives'), 'Mine');
  assert.ok(h.run('appState.scenario.scenario.attack_path').includes('Jour J 06:40'));
  assert.ok(h.run('appState.scenario.storyboard.meta.brief').includes('Frigolog, logisticien du froid'));
});

test('context generation: the AI reading fills empty fields, cells with their players, and Update sees what changed', async () => {
  const h = harness();
  h.run(`appState.scenario.name = 'Kept name'; appState.scenario.storyboard.meta.brief = 'Test the isolation decision.'`);
  h.run(`AITextGenerator.generate = async (channel, system, user) => { globalThis.aiCall = { channel, system, user }; return {
    exercise_name: 'Operation Cold Chain', client_name: 'Frigolog', sector: 'retail', language: 'fr', duration_minutes: 180, simulated_start: '2026-03-12T09:00',
    cells: [{ name: 'Cellule décisionnelle', players: [{ name: '', role: 'DG' }, { name: 'Anne Roy', role: 'DAF' }] }, { name: 'Cellule IT', players: ['RSSI'] }],
    players_count: null, learning_objectives: 'Direction : arbitrer l’arrêt du WMS', incident_timeline: 'J-21 : hameçonnage', context: 'Frigolog, logisticien du froid.', missing: ['Date of the exercise'] }; }`);
  const filled = await h.run('ContextGeneration.readSources(appState.scenario)');
  const call = h.json('aiCall');
  assert.equal(call.channel, 'context_generation');
  assert.ok(call.user.includes('DESIGNER NOTES:\nTest the isolation decision.'));
  const project = h.json(`(() => { const p = appState.scenario; return { name: p.name, client: p.client.name, sector: p.client.sector, language: p.client.language, inject: p.settings.inject_language, duration: p.storyboard.duration_minutes, start: p.scenario.start_date, cells: p.cells.map(c => ({ name: c.name, players: c.players.map(x => [x.name, x.role]) })), players: p.exercise.players_count, cellsCount: p.exercise.cells_count, brief: p.storyboard.meta.brief, lo: p.scenario.learning_objectives }; })()`);
  assert.equal(project.name, 'Kept name', 'what the designer typed stays');
  assert.equal(project.client, 'Frigolog');
  assert.equal(project.sector, 'Retail');
  assert.equal(project.language, 'fr');
  assert.equal(project.inject, 'fr');
  assert.equal(project.duration, 180);
  assert.equal(project.start, '2026-03-12T09:00');
  assert.deepEqual(project.cells, [{ name: 'Cellule décisionnelle', players: [['', 'DG'], ['Anne Roy', 'DAF']] }, { name: 'Cellule IT', players: [['', 'RSSI']] }]);
  assert.equal(project.players, 3);
  assert.equal(project.cellsCount, 2);
  assert.ok(project.brief.startsWith('Test the isolation decision.') && project.brief.includes('Frigolog, logisticien du froid.'), 'notes first, then the document context');
  assert.ok(filled.includes('Client') && filled.includes('2 cells'));
  assert.deepEqual(h.json('ContextGeneration.missing'), ['Date of the exercise']);
  // Update: the fields changed since the generation.
  assert.equal(h.json('cgChanges(appState.scenario)'), null, 'never generated');
  h.run('cgRemember(appState.scenario)');
  assert.deepEqual(h.json('cgChanges(appState.scenario)'), []);
  h.run(`appState.scenario.scenario.learning_objectives += '\\nCommunication : tenir les médias'; appState.scenario.client.name = 'Frigolog SA'`);
  assert.deepEqual(h.json('cgChanges(appState.scenario).map(c => [c.key, c.after])'), [['client', 'Frigolog SA'], ['learning_objectives', 'Direction : arbitrer l’arrêt du WMS\nCommunication : tenir les médias']]);
  assert.ok(/Generate the exercise first[\s\S]*data-cx-update disabled/.test(h.run('renderScenarioView()')), 'nothing to update before a storyline');
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace'); cgRemember(appState.scenario); appState.scenario.client.name = 'Frigolog Group'`);
  const view = h.run('renderScenarioView()');
  assert.ok(view.includes('Changed since the last generation: Client.') && view.includes('cx-update-row has-changes'));
});
