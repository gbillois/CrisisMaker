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

test('duration: stated, as a schedule, as a phrase, or estimated from the latest time', async () => {
  const h = harness();
  const found = (text) => h.json(`CrisisDocReader.findDuration(CrisisDocReader.readText(${JSON.stringify(`# A\n${text}`)}, 'a.md'))`);
  assert.deepEqual(found('Durée : 2h30 de jeu'), { minutes: 150, where: 1, text: 'Durée : 2h30 de jeu', estimated: false });
  assert.equal(found('Play time: 90 min').minutes, 90);
  assert.equal(found('Dauer der Übung: 4 Stunden').minutes, 240);
  assert.equal(found('L’exercice se déroulera de 9h00 à 12h30.').minutes, 210, 'a schedule, not "9 h"');
  assert.equal(found('We propose a 3-hour exercise with two cells.').minutes, 180);
  assert.deepEqual(found('- Phase 1 H+0:00\n- Phase 3 H+2:45'), { minutes: 165, where: 1, text: 'Phase 3 H+2:45', estimated: true });
  assert.equal(found('Budget: 12 days, 2024'), null);
  h.context.file = load(h, 'tests/fixtures/exercise-deck.pptx');
  await h.run(`CrisisDocReader.read(file, file.name).then(doc => { globalThis.doc = doc; })`);
  assert.deepEqual(h.json('CrisisDocReader.findDuration(doc)'), { minutes: 180, where: 2, text: '09:00 Début de l’exercice (durée 3 h)', estimated: false });
});

test('essential points: listed before loading, checked once a file is loaded, the duration usable in one click', async () => {
  const h = harness();
  let view = h.run('renderScenarioView()');
  assert.ok(view.includes('For a complete generation, the document should state the points below. Whatever is missing, the AI creates using its best judgment.') && view.includes('Exercise duration') && view.includes('essential'));
  assert.ok(view.indexOf('Exercise duration') < view.indexOf('Incident timeline'), 'the duration first');
  h.context.file = load(h, 'tests/fixtures/exercise-deck.pptx');
  await h.run('checkerHandleFile(file)');
  const items = h.json('cgSourceChecklist().map(i => [i.key, i.status, i.where || ""])');
  assert.deepEqual(items, [['duration', 'found', 'slide 2'], ['context', 'found', 'slide 3'], ['objectives', 'found', 'slide 4'], ['players', 'found', 'slides 5, 11'], ['phases', 'found', 'slide 6'], ['incident', 'found', 'slide 12'], ['injects', 'found', '7 found']]);
  view = h.run('renderScenarioView()');
  assert.ok(view.includes('What the file holds: 7 of the 7 essential points') && view.includes('data-cx-use-duration="180"'));
  // Without AI, filling from the file sets the stated duration on a new exercise.
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 300);
  assert.ok(h.json('ContextGeneration.fillFromDocument()').includes('Duration'));
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 180);
  assert.ok(!h.run('renderScenarioView()').includes('data-cx-use-duration'), 'nothing to offer once the durations match');
  // A brief without duration: flagged, with what to write.
  h.run('checkerClearFile()');
  h.context.file = load(h, 'tests/fixtures/exercise-brief.docx');
  await h.run('checkerHandleFile(file)');
  assert.deepEqual(h.json('cgSourceChecklist().map(i => [i.key, i.status])'), [['duration', 'found'], ['context', 'found'], ['objectives', 'found'], ['players', 'found'], ['phases', 'missing'], ['incident', 'missing'], ['injects', 'missing']]);
  h.run('checkerClearFile()');
  h.context.textFile = { name: 'notes.md', size: 10, type: '', arrayBuffer: async () => new TextEncoder().encode('# Objectives\n- Decide fast').buffer };
  await h.run('checkerHandleFile(textFile)');
  assert.equal(h.json('cgSourceChecklist()[0].status'), 'missing');
  assert.ok(h.run('renderScenarioView()').includes('Not found: write it in the document, or set the duration in the Context below.'));
});

test('open points: the creation waits for the answers to what the sources leave open', async () => {
  const h = harness();
  h.run(`appState.scenario.storyboard.meta.brief = 'Board-level exercise.';
    AITextGenerator.generate = async () => ({ context: '', understanding: ['Board exercise at Northwind', 'Four cells'], missing: ['Which competitor is targeted', 'Timing of the three sequences', '  '] });
    globalThis.framings = []; BuildFlow.framing = async (options) => { framings.push({ options, brief: appState.scenario.storyboard.meta.brief }); return false; };
    window.confirm = () => true;`);
  assert.equal(await h.run('ContextGeneration.generate()'), false);
  assert.equal(h.json('framings').length, 0, 'nothing is created yet');
  assert.deepEqual(h.json('ContextGeneration.pending.missing'), ['Which competitor is targeted', 'Timing of the three sequences']);
  let view = h.run('renderScenarioView()');
  assert.ok(view.includes('2 point(s) missing from your sources') && view.includes('data-cx-open-answer="1"') && /data-cx-generate disabled/.test(view));
  assert.ok(view.includes('What the AI understood') && view.includes('<li>Four cells</li>') && view.includes('data-cx-open-corrections'), 'what was understood, to correct');
  assert.ok(view.indexOf('data-cx-generate') < view.indexOf('cx-open-points') && view.indexOf('cx-open-points') < view.indexOf('data-sc-players'), 'under the generation button, above the fields');
  // One answer typed, the other left to the AI.
  h.run(`ContextGeneration.pending.answers[0] = 'Contoso'; ContextGeneration.pending.corrections = 'Three cells, not four.'`);
  await h.run('ContextGeneration.resume()');
  const call = h.json('framings[0]');
  assert.ok(call.brief.startsWith('Board-level exercise.'));
  assert.ok(call.brief.includes('Corrections by the designer (they override the sources):\nThree cells, not four.'));
  assert.ok(call.brief.includes('Decisions on the points missing from the sources:\n- Which competitor is targeted → Contoso'));
  assert.ok(call.brief.includes('Left to the AI (make a reasonable assumption and say it):\n- Timing of the three sequences'));
  assert.equal(h.run('ContextGeneration.pending'), null);
  assert.ok(!h.run('renderScenarioView()').includes('cx-open-points'));
  // Nothing typed: every open point is left to the AI (there is no separate skip button).
  await h.run('ContextGeneration.generate()');
  assert.ok(!h.run('renderScenarioView()').includes('data-cx-open-skip'));
  await h.run('ContextGeneration.resume()');
  assert.equal(h.json('framings[1]').brief.split('Left to the AI').length, 3, 'both points left to the AI this time');
});

test('check before the creation: always when asked before big changes, only for open points when built automatically', async () => {
  const h = harness();
  h.run(`appState.scenario.storyboard.meta.brief = 'Exercise.';
    AITextGenerator.generate = async () => ({ understanding: ['A ransomware exercise'], missing: [] });
    globalThis.framings = 0; BuildFlow.framing = async () => { framings++; return false; };`);
  await h.run('ContextGeneration.generate()');
  assert.equal(h.run('framings'), 0);
  const view = h.run('renderScenarioView()');
  assert.ok(view.includes('Check before the creation') && !view.includes('data-cx-open-skip') && !view.includes('missing from your sources'), 'nothing open: only the check');
  await h.run('ContextGeneration.resume()');
  assert.equal(h.run('framings'), 1);
  assert.equal(h.run('appState.scenario.storyboard.meta.brief'), 'Exercise.', 'nothing to add');
  h.run(`tabUI('context').mode = 'auto'`);
  await h.run('ContextGeneration.generate()');
  assert.equal(h.run('framings'), 2, 'built automatically: no pause');
  assert.equal(h.run('ContextGeneration.pending'), null);
});

test('duration: every way of writing it, and the exercise told apart from the day', () => {
  const h = harness();
  const cases = {
    'Durée : 45 minutes': 45, 'Durée : 45 min': 45, 'Durée : 45mn': 45, 'Durée : 0h45': 45, 'Durée : 0:45': 45, "Durée : 45'": 45,
    'Durée : 1h30': 90, 'Durée : 1 h 30 min': 90, 'Durée 1,5 h': 90, 'Duration: 1.5 hours': 90, 'Durée : 2 heures': 120, 'Dauer: 90 Minuten': 90, 'Dauer: 3 Stunden': 180,
    'Exercice de 45 minutes avec le COMEX': 45, 'A 45-minute tabletop exercise': 45, 'We propose a 3-hour exercise.': 180, 'Exercice (0:45) puis RETEX': 45,
    'L’exercice se déroulera de 9h00 à 9h45.': 45, 'Durée de la journée 3 h ; exercice de 45 min': 45
  };
  for (const [text, minutes] of Object.entries(cases)) assert.equal(h.run(`CrisisDocReader.findDuration(CrisisDocReader.readText(${JSON.stringify(`# A\n${text}`)}, 'a.md'))?.minutes`), minutes, text);
  for (const [value, minutes] of [[45, 45], ['45', 45], ['0:45', 45], ['0h45', 45], ['45 min', 45], ['1,5 h', 90], ['', null], ['soon', null]]) assert.equal(h.run(`cgMinutes(${JSON.stringify(value)})`), minutes, String(value));
});

test('duration: the one read replaces the default only, is checked before the creation, and fits the library scenario', async () => {
  const h = harness();
  // A storyline already there (a previous generation): the duration read still applies over the default.
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace'); appState.scenario.storyboard.duration_minutes = SB_DEFAULT_DURATION;
    appState.scenario.storyboard.meta.brief = 'Board exercise.';
    AITextGenerator.generate = async () => ({ duration_minutes: '0:45', understanding: ['A 45-minute board exercise'], missing: [] });
    globalThis.realFraming = BuildFlow.framing;
    globalThis.framings = []; BuildFlow.framing = async () => { framings.push(appState.scenario.storyboard.duration_minutes); return false; }; window.confirm = () => true;`);
  await h.run('ContextGeneration.generate()');
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 45);
  assert.ok(h.run('sbStoryboardEnd(appState.scenario.storyboard)') <= 45, 'the phases already there are fitted');
  let view = h.run('renderScenarioView()');
  assert.ok(view.includes('data-cx-open-duration value="0:45"') && view.includes('Worked out by the AI from your sources: check it.'));
  assert.ok(view.indexOf('data-cx-open-duration') < view.indexOf('What the AI understood'), 'the duration first');
  // The designer corrects it in the check: it frames the creation.
  h.run(`ContextGeneration.pending.duration = '1:00'`);
  await h.run('ContextGeneration.resume()');
  assert.deepEqual(h.json('framings'), [60]);
  // A duration the designer set stays.
  h.run(`appState.scenario.storyboard.duration_minutes = 120`);
  await h.run('ContextGeneration.generate()');
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 120);
  assert.ok(h.run('renderScenarioView()').includes('data-cx-open-duration value="2:00"'));
  h.run('ContextGeneration.pending = null');
  // A library scenario (written for 3 hours) is fitted to the duration of the Context.
  const fitted = await h.run(`(async () => {
    const project = appState.scenario;
    project.storyboard = sbEmptyStoryboard(); project.storyboard.duration_minutes = 45; project.storyboard.meta.library_id = sbBuiltinTemplates()[0].id;
    SbAI.instantiateTemplate = async (template) => JSON.parse(JSON.stringify(template));
    globalThis.startCrisisAgent = async () => {};
    BuildFlow.framing = realFraming; await BuildFlow.framing({ openStoryline: false });
    return JSON.stringify({ duration: project.storyboard.duration_minutes, end: sbStoryboardEnd(project.storyboard), phases: sbMainBlocks(project.storyboard).length });
  })()`);
  const result = JSON.parse(fitted);
  assert.equal(result.duration, 45);
  assert.ok(result.end <= 45 && result.phases > 0, JSON.stringify(result));
});

test('shorter duration: Force duration fits the phases, Cancel keeps them, and Update is flagged', () => {
  const h = harness();
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace'); cgRemember(appState.scenario)`);
  const before = h.json('sbMainBlocks(appState.scenario.storyboard).map(b => [b.title, b.duration_minutes])');
  assert.equal(h.run('sbStoryboardEnd(appState.scenario.storyboard)'), 180);
  // Longer than the phases: set at once.
  assert.equal(h.run('cgSetDuration(240)'), 'set');
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 240);
  // Shorter: nothing changes until the designer chooses.
  assert.equal(h.run('cgSetDuration(45)'), 'conflict');
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 240);
  let view = h.run('renderScenarioView()');
  assert.ok(view.includes('The phases end at 3 h, after the new duration of 45 min.') && view.includes('data-cx-duration-force') && view.includes('data-cx-duration-cancel'));
  assert.ok(view.indexOf('data-sc-duration') < view.indexOf('data-cx-duration-force') && view.indexOf('data-cx-duration-force') < view.indexOf('data-cx-update'), 'under the duration field');
  h.run(`tabUI('context').durationConflict = null`);
  assert.deepEqual(h.json('sbMainBlocks(appState.scenario.storyboard).map(b => [b.title, b.duration_minutes])'), before, 'Cancel keeps the phases');
  // Force: every phase fitted, contiguous, in order, injects and events inside their phase.
  h.run('cgSetDuration(45); cgForceDuration()');
  const blocks = h.json('sbMainBlocks(appState.scenario.storyboard).map(b => ({ title: b.title, start: b.start_minutes, duration: b.duration_minutes, beats: b.beats.map(x => x.offset_minutes), events: (b.events || []).map(e => e.offset_minutes) }))');
  assert.deepEqual(blocks.map(b => b.title), before.map(b => b[0]));
  assert.equal(blocks[0].start, 0);
  blocks.forEach((b, i) => {
    assert.ok(b.duration >= 5);
    if (i) assert.equal(b.start, blocks[i - 1].start + blocks[i - 1].duration, 'contiguous');
    assert.ok([...b.beats, ...b.events].every(at => at >= 0 && at < b.duration), 'inside the phase');
  });
  assert.equal(blocks[blocks.length - 1].start + blocks[blocks.length - 1].duration, 45);
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 45);
  view = h.run('renderScenarioView()');
  assert.ok(view.includes('Duration forced to 45 min: Update to carry it into the injects.') && view.includes('cx-update-row has-changes'));
  // Too many phases for the duration: refused, nothing changes.
  assert.equal(h.run('sbFitStoryboardToDuration(appState.scenario.storyboard, 30)'), sbFits(blocks.length, 30));
});

function sbFits(phases, minutes) { return phases * 5 <= minutes; }


test('pptx drawn with free shapes: running header dropped, titles found, a table of sequences rebuilt', async () => {
  const h = harness();
  h.context.file = load(h, 'tests/fixtures/exercise-shapes.pptx');
  await h.run(`CrisisDocReader.read(file, file.name).then(doc => { globalThis.doc = doc; globalThis.analysis = CrisisDocReader.analyze(doc, CHECKER_COLUMN_PATTERNS); })`);
  const doc = h.json('doc');
  assert.deepEqual(doc.slides.map(s => s.title), ['Contexte et objectifs', 'Liste des participants', 'Proposition d’un scénario d’exercice en 3 séquences', 'Proposition de contexte'], 'the largest text at the top, not the running header');
  assert.ok(!JSON.stringify(doc.slides).includes('Exercice de crise COMEX'), 'the running header is dropped');
  const table = doc.slides[2].blocks.find(b => b.kind === 'table');
  assert.deepEqual(table.rows[0], ['Brief', 'Séquence 1', 'Séquence 2', 'Séquence 3']);
  assert.deepEqual(table.rows.map(r => r[0]), ['Brief', 'Récap', 'Décisions', 'Stimuli']);
  assert.equal(table.rows[3][2], 'Preuves reliant les attaques à l’outil IA\nArticle évoquant une IA hors de contrôle', 'each stimulus stays with its sequence');
  const analysis = h.json('analysis');
  assert.deepEqual(analysis.sections.phases, [3]);
  assert.deepEqual(analysis.sections.chronogram, [3], 'the Stimuli row');
  assert.deepEqual(analysis.sections.incident, [4], 'the "Chemin d’attaque" subheading');
  assert.equal(analysis.listedStimuli, 6, 'the lines of the Stimuli row');
  assert.equal(h.run('CrisisDocReader.findDuration(doc).minutes'), 45);
});

test('framing from a source with its own phases and stimuli: exactly its phases, its stimuli planned as injects', async () => {
  const h = harness();
  h.context.file = load(h, 'tests/fixtures/exercise-shapes.pptx');
  await h.run('checkerHandleFile(file)');
  const objective = h.run('bfFramingObjective(appState.scenario)');
  assert.ok(objective.includes('The source file defines the phases: build exactly those'));
  assert.ok(objective.includes('plan now (planPhaseInjects), in their phase, only the stimuli the source file lists'));
  assert.ok(!objective.includes('Do NOT plan or write injects'));
  assert.ok(h.run('AgentPrompts.builder').includes('never as a main event'));
  // Three phases from the source, the last one not a closing phase, each with its planned injects: complete.
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace');
    const blocks = sbMainBlocks(appState.scenario.storyboard);
    appState.scenario.storyboard.blocks = blocks.slice(0, 3).map(b => ({ ...b, type: 'escalation', events: [] }));
    appState.scenario.cells[0] = appState.scenario.cells[0] || sbMakeCell('decision'); appState.scenario.cells[0].players.push(sbNormalizePlayer({ role: 'CEO' }));`);
  const gaps = h.json('agentFramingGaps(appState.scenario)');
  assert.ok(!gaps.some(g => /closing/.test(g)), JSON.stringify(gaps));
  assert.ok(!gaps.some(g => /no main events/.test(g)) || h.json('sbMainBlocks(appState.scenario.storyboard).some(b => !b.beats.length)'));
  // Without a source file, the closing phase is still required.
  h.run('checkerClearFile()');
  assert.ok(h.json('agentFramingGaps(appState.scenario)').some(g => /closing/.test(g)));
  assert.ok(h.run('bfFramingObjective(appState.scenario)').includes('Do NOT plan or write injects'));
});

test('injects per phase: set in the phase editor; a phase left at 0 gets a target, raised to what the source lists', async () => {
  const h = harness();
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace');`);
  const editor = h.run('renderPhaseEditor(appState.scenario.storyboard, sbMainBlocks(appState.scenario.storyboard)[0])');
  assert.ok(/data-sb-field="stimuli_target" value="\d+"/.test(editor) && editor.includes('planned'), 'the number of injects is editable in the phase editor');
  // Three phases without any inject wanted nor planned (a framing).
  h.run(`const blocks = sbMainBlocks(appState.scenario.storyboard).slice(0, 3); appState.scenario.storyboard.blocks = blocks.map((b, i) => ({ ...b, start_minutes: i * 15, duration_minutes: 15, beats: [], stimuli_target: 0 })); appState.scenario.storyboard.duration_minutes = 45;`);
  assert.equal(h.run('sbFillInjectTargets(appState.scenario).length'), 3);
  const cells = h.run('appState.scenario.cells.length');
  assert.deepEqual(h.json('sbMainBlocks(appState.scenario.storyboard).map(b => b.stimuli_target)'), Array(3).fill(Math.max(Math.min(Math.max(1, cells), 4), Math.round(15 * Math.max(1, cells) / 20))));
  // A source listing 6 stimuli over 3 phases: at least 2 each (here with one cell).
  h.context.file = load(h, 'tests/fixtures/exercise-shapes.pptx');
  await h.run('checkerHandleFile(file)');
  h.run(`appState.scenario.cells = [sbMakeCell('decision')]; sbMainBlocks(appState.scenario.storyboard).forEach(b => { b.stimuli_target = 0; }); sbFillInjectTargets(appState.scenario)`);
  assert.deepEqual(h.json('sbMainBlocks(appState.scenario.storyboard).map(b => b.stimuli_target)'), [2, 2, 2]);
  // A target set by the designer stays.
  h.run(`sbMainBlocks(appState.scenario.storyboard)[0].stimuli_target = 7; sbFillInjectTargets(appState.scenario)`);
  assert.equal(h.run('sbMainBlocks(appState.scenario.storyboard)[0].stimuli_target'), 7);
});

test('creation report: what really exists, item by item, only for what was ticked', () => {
  const h = harness();
  let report = h.json(`cgCreationReport(appState.scenario, { cells: true, phases: true, stimuli: true, evaluation: true })`);
  assert.deepEqual(report.map(i => [i.key, i.ok]), [['cells', false], ['phases', false], ['stimuli', false], ['evaluation', false]]);
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace'); appState.scenario.cells = [sbMakeCell('decision')]; appState.scenario.cells[0].players.push(sbNormalizePlayer({ role: 'CEO' }));`);
  report = h.json(`cgCreationReport(appState.scenario, { cells: true, phases: true })`);
  assert.deepEqual(report.map(i => [i.key, i.ok]), [['cells', true], ['phases', true]]);
  assert.ok(/1 cell\(s\), 1 player\(s\), \d+ role\(s\)/.test(report[0].detail));
  // The five boxes, ticked by default, above the AI generation button.
  const view = h.run('renderScenarioView()');
  assert.equal((view.match(/data-cx-create="[a-z]+" checked/g) || []).length, 5);
  assert.ok(view.indexOf('data-cx-create="evaluation"') < view.indexOf('data-cx-generate'));
});

test('example deck: offered next to the upload, fictitious, and read with every essential point', async () => {
  const h = harness();
  const view = h.run('renderScenarioView()');
  assert.ok(view.includes('data-cx-example-download') && view.includes('data-cx-example-load'));
  assert.ok(view.indexOf('checker-dropzone') < view.indexOf('data-cx-example-load') && view.indexOf('data-cx-example-load') < view.indexOf('Generic scenario'), 'next to the upload zone');
  await h.run('checkerHandleFile(cgExampleDeckFile())');
  assert.equal(h.run('appState.checkerState.file.name'), 'example-crisis-exercise-deck.pptx');
  const doc = h.json('appState.checkerState.parsedData.doc');
  const text = JSON.stringify(doc);
  assert.ok(!text.includes('@'), 'no e-mail address');
  assert.ok(text.includes('fictitious company'));
  assert.ok(!/[éèàç’]/.test(text), 'entirely in English');
  assert.equal(doc.slides.length, 7);
  assert.ok(doc.slides.every((slide) => slide.title), 'every slide has its title');
  assert.deepEqual(h.json('cgSourceChecklist().map(i => [i.key, i.status])'), [['duration', 'found'], ['context', 'found'], ['objectives', 'found'], ['players', 'found'], ['phases', 'found'], ['incident', 'found'], ['injects', 'found']]);
  assert.equal(h.run('cgSourceDuration().minutes'), 45);
  const analysis = h.json('appState.checkerState.parsedData.analysis');
  // No chronogram: the AI writes the stimuli from the key events; the Stimuli row gives ideas.
  assert.equal(analysis.chronogramRows, 0);
  assert.equal(analysis.listedStimuli, 14);
  const sequences = doc.slides[5].blocks.find((block) => block.kind === 'table');
  assert.deepEqual(sequences.rows[0], ['Brief', 'Sequence 1', 'Sequence 2', 'Sequence 3']);
  assert.deepEqual(sequences.rows.map((row) => row[0]), ['Brief', 'Time', 'Key event', 'Presentation', 'Questions', 'Expected decisions', 'Stimuli']);
  // The 14 stimulus ideas of the table: about 5 per sequence.
  h.run(`sbApplyTemplate(sbBuiltinTemplates()[0], 'replace'); appState.scenario.storyboard.blocks = sbMainBlocks(appState.scenario.storyboard).slice(0, 3).map((b, i) => ({ ...b, start_minutes: i * 15, duration_minutes: 15, beats: [], stimuli_target: 0 })); appState.scenario.cells = [sbMakeCell('decision')];`);
  assert.equal(h.run('sbWantedInjects(sbMainBlocks(appState.scenario.storyboard)[0], appState.scenario)'), 5);
});

test('stimulus preview zoom: Auto by default, steps in and out, kept for the session', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); appState.stimulusModalId = appState.scenario.stimuli[0].id;`);
  let view = h.run('renderStimulusModal(getStimulus(appState.stimulusModalId))');
  assert.ok(view.includes('data-zoom="in"') && view.includes('data-zoom="out"') && /data-zoom="auto" disabled/.test(view), 'Auto is the default');
  h.run(`appState.ui.previewZoom = previewZoomStep(1)`);
  assert.equal(h.run('appState.ui.previewZoom'), 1);
  h.run(`appState.ui.previewZoom = previewZoomStep(1)`);
  assert.equal(h.run('appState.ui.previewZoom'), 1.1);
  view = h.run('renderStimulusModal(getStimulus(appState.stimulusModalId))');
  assert.ok(view.includes('110 %') && /class="preview-stage[^"]*" style="zoom:1\.100"/.test(view));
  h.run(`appState.ui.previewZoom = 0.5`);
  assert.equal(h.run('previewZoomStep(-1)'), 0.5, 'no smaller than 50 %');
});

test('live stimuli demo mode: its own clock at ×50, from the first stimulus to the end, then again', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); playUI().demo = true; playUI().demoStart = 1000000; playUI().liveOpen = true;`);
  const first = h.run(`Math.min(...playItems().filter((item) => item.stimulus).map((item) => item.time))`);
  const duration = h.run('playDuration()');
  assert.equal(h.run('playDemoNow(appState.scenario, 1000000)'), first, 'starts at the first stimulus');
  assert.equal(Math.round(h.run('playDemoNow(appState.scenario, 1000000 + 60000)')), first + 50, 'one real minute is 50 exercise minutes');
  const loopMs = (duration - first) / 50 * 60000;
  assert.ok(Math.abs(h.run(`playDemoNow(appState.scenario, 1000000 + ${loopMs} + 60000)`) - (first + 50)) < 0.01, 'after the end, again from the first stimulus');
  // The exercise clock and its log do not move.
  assert.equal(h.run('playNow()'), 0);
  assert.equal(h.run('playState().log.length'), 0);
  const view = h.run('renderPlayView()');
  assert.ok(view.includes('data-play-demo checked') && view.includes('×50') && !/play-live[\s\S]*data-play-set="sent"[\s\S]*<\/aside>/.test(view.slice(view.indexOf('class="play-live"'))), 'no Mark as sent in demo mode');
});
