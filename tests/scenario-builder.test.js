const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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
  vm.runInContext(`App.render = () => {}; pushToast = () => {}; sanitizeBody = value => value;
    appState.scenario = emptyScenario({ ai_api_key: 'TEST-SECRET', ai_provider: 'openai' });
    appState.route = 'builder';`, context);
  const run = code => vm.runInContext(code, context);
  return { context, run, storage, json: code => JSON.parse(run(`JSON.stringify(${code})`)) };
}

/* Mocks AITextGenerator.generate with a queue of answers (functions receive the parsed user payload). */
function mockAI(h, answers) {
  const calls = [];
  h.context.aiAnswers = answers;
  h.context.aiCalls = calls;
  h.run(`AITextGenerator.generate = async (channel, system, user) => {
    const payload = (() => { try { return JSON.parse(user); } catch (_) { return user; } })();
    aiCalls.push({ channel, system, payload });
    const next = aiAnswers.length > 1 ? aiAnswers.shift() : aiAnswers[0];
    return typeof next === 'function' ? next(payload) : JSON.parse(JSON.stringify(next));
  };`);
  return calls;
}

test('library: every built-in template is structurally valid and converts to a storyboard', () => {
  const h = harness();
  const report = h.json(`SCENARIO_LIBRARY.map(t => ({ id: t.id, errors: sbValidateTemplate(t), blocks: sbTemplateToStoryboard(t).storyboard.blocks.length, beats: sbTemplateToStoryboard(t).storyboard.blocks.reduce((s, b) => s + b.beats.length, 0), castLinked: sbTemplateToStoryboard(t).storyboard.blocks.every(b => b.beats.every(beat => beat.cast_id)) }))`);
  assert.equal(report.length, 8);
  assert.equal(new Set(report.map(r => r.id)).size, 8);
  for (const item of report) {
    assert.deepEqual(item.errors, [], item.id);
    assert.ok(item.blocks >= 8, item.id);
    assert.ok(item.beats >= 20, item.id);
    assert.ok(item.castLinked, `${item.id}: every beat has a sender`);
  }
  for (const id of ['ransomware-double-extortion', 'personal-data-breach', 'software-supply-chain', 'ddos-hacktivism', 'ceo-fraud-deepfake', 'destructive-wiper', 'insider-threat-sabotage', 'ot-industrial-incident']) assert.ok(report.some(r => r.id === id), id);
});

test('model: legacy phases migrate to main-track blocks and phases stay derived', () => {
  const h = harness();
  const merged = h.json(`mergeScenario(migrateScenario({ name: 'Legacy', scenario: { summary: 'x', phases: [{ name: 'Detection', start_minutes: 0, end_minutes: 60, purpose: 'Alerts' }, { name: 'Containment and isolation', start_minutes: 60, end_minutes: 150, purpose: 'Cut access' }] }, actors: [], stimuli: [] }))`);
  assert.equal(merged.storyboard.blocks.length, 2);
  assert.equal(merged.storyboard.blocks[1].type, 'containment');
  assert.equal(merged.storyboard.blocks[0].brief, 'Alerts');
  assert.deepEqual(merged.scenario.phases.map(p => [p.name, p.start_minutes, p.end_minutes]), [['Detection', 0, 60], ['Containment and isolation', 60, 150]]);
  const empty = h.json(`mergeScenario(migrateScenario({ name: 'Old', scenario: { summary: 'x' }, actors: [], stimuli: [] }))`);
  assert.equal(empty.storyboard.blocks.length, 0);
  assert.deepEqual(empty.scenario.phases, []);
  assert.equal(empty.scenario.objectives, undefined);
});

test('model: example project ships a single linked storyline with recipient cells and no pending sync', () => {
  const h = harness();
  h.run('appState.scenario = defaultScenario()');
  const info = h.json(`({ blocks: appState.scenario.storyboard.blocks.length, tracks: appState.scenario.storyboard.tracks.length, cells: appState.scenario.cells.map(c => c.key), beatsWithoutCell: appState.scenario.storyboard.blocks.flatMap(b => b.beats).filter(b => !sbHasRecipient(appState.scenario, b.cell_id)).length, stimuliWithoutCell: appState.scenario.stimuli.filter(s => !s.cell_id).length, linked: appState.scenario.stimuli.filter(s => s.scenario_link).length, impacts: sbComputeImpacts(appState.scenario).length, issues: sbStructuralChecks(appState.scenario.storyboard, appState.scenario).filter(i => i.severity !== 'info').map(i => i.message), exercise: appState.scenario.exercise })`);
  assert.equal(info.tracks, 1);
  assert.equal(info.blocks, 6);
  assert.deepEqual(info.cells, ['decision', 'it', 'communication', 'legal', 'business']);
  assert.equal(info.beatsWithoutCell, 0);
  assert.equal(info.stimuliWithoutCell, 0);
  assert.equal(info.linked, 40);
  assert.equal(info.impacts, 0);
  assert.deepEqual(info.issues, []);
  assert.deepEqual(info.exercise, { players_count: 15, cells_count: 5 });
});

test('model: workstreams flatten into the main storyline with recipient cells, links and objectives kept', () => {
  const h = harness();
  const result = h.json(`(() => {
    const project = emptyScenario({});
    const sb = project.storyboard; const main = sbMainTrack(sb).id;
    sb.tracks.push({ id: 'track_com', key: 'communication', name: 'Communication', kind: 'workstream', color: '#000', collapsed: false });
    sb.blocks.push(sbMakeBlock('trigger', { id: 'm1', track_id: main, start_minutes: 0, duration_minutes: 60, beats: [sbMakeBeat({ id: 'beat_a', offset_minutes: 5, channel: 'article_press', title: 'Press call' })] }, sb));
    sb.blocks.push(sbMakeBlock('investigation', { id: 'm2', track_id: main, start_minutes: 60, duration_minutes: 60 }, sb));
    sb.blocks.push(sbMakeBlock('communication', { id: 'w1', track_id: 'track_com', start_minutes: 50, duration_minutes: 40, objectives: ['Communicate'], brief: 'Media storm', beats: [sbMakeBeat({ id: 'beat_w', offset_minutes: 20, channel: 'email_internal', title: 'Holding statement' })] }, sb));
    project.stimuli.push({ id: 'st1', channel: 'email_internal', fields: {}, scenario_link: { block_id: 'w1', beat_id: 'beat_w', offset: 20 } });
    sbFlattenWorkstreams(project);
    const beat = sbBlock(sb, 'm2').beats.find(b => b.id === 'beat_w');
    return { tracks: sb.tracks.length, blocks: sb.blocks.map(b => b.id), beatAt: sbBeatAbsolute(sbBlock(sb, 'm2'), beat), beatCell: sbCell(project, beat.cell_id).key, pressCell: sbCell(project, sbBlock(sb, 'm1').beats[0].cell_id).key, link: project.stimuli[0].scenario_link.block_id, stimulusCell: project.stimuli[0].cell_id === beat.cell_id, objectives: sbBlock(sb, 'm2').objectives, notes: sbBlock(sb, 'm2').notes };
  })()`);
  assert.equal(result.tracks, 1);
  assert.deepEqual(result.blocks, ['m1', 'm2']);
  assert.equal(result.beatAt, 70);
  assert.equal(result.beatCell, 'communication');
  assert.equal(result.pressCell, 'communication');
  assert.equal(result.link, 'm2');
  assert.ok(result.stimulusCell);
  assert.deepEqual(result.objectives, ['Communicate']);
  assert.ok(result.notes.includes('Media storm'));
  const legacy = h.json(`mergeScenario({ name: 'Old', storyboard: { tracks: [{ id: 't1', key: 'main', kind: 'main', name: 'Main' }, { id: 't2', key: 'technical', kind: 'workstream', name: 'Tech' }], blocks: [{ id: 'a', track_id: 't1', type: 'trigger', start_minutes: 0, duration_minutes: 90 }, { id: 'b', track_id: 't2', type: 'custom', start_minutes: 10, duration_minutes: 30, beats: [{ id: 'x', offset_minutes: 5, channel: 'email_internal', title: 'Logs' }] }] }, actors: [], stimuli: [{ id: 's', channel: 'email_internal', cell_id: 'bad id!', fields: {} }] })`);
  assert.equal(legacy.storyboard.tracks.length, 1);
  assert.equal(legacy.storyboard.blocks[0].beats[0].cell_id, legacy.cells.find(c => c.key === 'it').id);
  assert.ok(legacy.stimuli[0].cell_id !== 'bad id!');
});

test('model: cell count adds presets without dropping cells in use, and cell changes outdate linked injects', () => {
  const h = harness();
  h.run('appState.scenario = defaultScenario()');
  h.run('sbSetCellsCount(appState.scenario, 6)');
  assert.equal(h.run('appState.scenario.cells.length'), 6);
  h.run('sbSetCellsCount(appState.scenario, 1)');
  assert.equal(h.run('appState.scenario.cells.length'), 5, 'cells with injects are kept');
  const before = h.run('sbComputeImpacts(appState.scenario).length');
  assert.equal(before, 0);
  h.run(`(() => { const block = sbStoryboard().blocks.find(b => b.beats.length); block.beats[0].cell_id = appState.scenario.cells.find(c => c.id !== block.beats[0].cell_id).id; })()`);
  assert.ok(h.json('sbComputeImpacts(appState.scenario).map(i => i.kind)').includes('outdated'));
});

test('checks: exercise rules flag idle cells, dead times, floods, empty phases and missing recipients', () => {
  const h = harness();
  const codes = h.json(`(() => {
    const project = emptyScenario({}); const sb = project.storyboard; const main = sbMainTrack(sb).id;
    sb.duration_minutes = 240;
    project.cells = [sbMakeCell('decision'), sbMakeCell('communication')];
    const decision = project.cells[0].id;
    sb.blocks.push(sbMakeBlock('trigger', { id: 'p1', track_id: main, start_minutes: 0, duration_minutes: 120, beats: [0, 2, 4, 6, 8].map(at => sbMakeBeat({ offset_minutes: at, channel: 'email_internal', title: 'Flood ' + at, cell_id: decision, cast_id: '' })) }, sb));
    sb.blocks.push(sbMakeBlock('exit', { id: 'p2', track_id: main, start_minutes: 120, duration_minutes: 120 }, sb));
    return sbExerciseChecks(project).map(i => i.code);
  })()`);
  for (const code of ['cell_idle', 'gap', 'peak', 'phase_empty', 'no_sender']) assert.ok(codes.includes(code), code);
  assert.deepEqual(h.json(`sbExerciseChecks(emptyScenario({})).map(i => i.code)`), ['empty']);
});
test('persistence: storyboard, named versions and stimulus links survive export/import', () => {
  const h = harness();
  h.run(`sbApplyTemplate(sbFindTemplate('personal-data-breach'), 'replace'); StoryboardHistory.ensure(appState.scenario, 'Use template');
    const block = appState.scenario.storyboard.blocks[0];
    const actor = addActor({ name: 'DPO', role: 'internal' }, false);
    const stimulus = makeStimulus('email_internal', actor.id, block.start_minutes); appState.scenario.stimuli.push(stimulus);
    sbStampStimulus(stimulus, block, block.beats[0], appState.scenario.storyboard);
    StoryboardHistory.snapshot('V1 for client', 'named');`);
  const reloaded = h.json('mergeScenario(migrateScenario(JSON.parse(JSON.stringify(buildProjectFileData()))))');
  assert.equal(reloaded.storyboard.blocks.length, h.run('appState.scenario.storyboard.blocks.length'));
  assert.equal(reloaded.storyboard_versions[0].label, 'V1 for client');
  assert.equal(reloaded.stimuli[0].scenario_link.block_id, h.run('appState.scenario.storyboard.blocks[0].id'));
  assert.equal(reloaded.stimuli[0].scenario_link.beat_id, h.run('appState.scenario.storyboard.blocks[0].beats[0].id'));
  assert.ok(reloaded.scenario.objectives.includes('\n'));
  assert.ok(!JSON.stringify(reloaded).includes('TEST-SECRET'));
});

test('history: undo/redo, debounced text edits, versions, restore and diff', () => {
  const h = harness();
  h.run(`StoryboardHistory.ensure(); sbAddBlock('trigger'); sbAddBlock('investigation');`);
  assert.equal(h.run('appState.scenario.storyboard.blocks.length'), 2);
  assert.equal(h.run('appState.scenario.scenario.phases.length'), 2);
  h.run(`appState.scenario.storyboard.blocks[0].brief = 'First signals'; StoryboardHistory.commit('Edit brief', { debounce: true });`);
  assert.equal(h.run('StoryboardHistory.canUndo()'), true);
  assert.equal(h.run('StoryboardHistory.undo()'), 'Edit brief');
  assert.equal(h.run('appState.scenario.storyboard.blocks[0].brief'), '');
  assert.equal(h.run('StoryboardHistory.redo()'), 'Edit brief');
  assert.equal(h.run('appState.scenario.storyboard.blocks[0].brief'), 'First signals');
  h.run(`StoryboardHistory.snapshot('Checkpoint', 'named'); sbStoryboard().blocks.pop(); StoryboardHistory.commit('Delete block');`);
  const version = h.json(`StoryboardHistory.versions().find(v => v.label === 'Checkpoint')`);
  const diff = h.json(`StoryboardHistory.diff('${version.id}')`);
  assert.equal(diff.removed.length, 1);
  h.run(`StoryboardHistory.restore('${version.id}')`);
  assert.equal(h.run('appState.scenario.storyboard.blocks.length'), 2);
  assert.ok(h.json('StoryboardHistory.versions()').some(v => v.label.startsWith('Before restoring')));
  assert.equal(h.run('StoryboardHistory.undo()'), 'Restore "Checkpoint"');
  assert.equal(h.run('appState.scenario.storyboard.blocks.length'), 1);
});

test('history: undo of a tracked edit restores only what it changed, and keeps a later edit and big media', () => {
  const h = harness();
  h.run(`StoryboardHistory.ensure();
    const project = appState.scenario;
    project.cells = [{ id: 'c1', name: 'IT', players: [] }, { id: 'c2', name: 'Comms', players: [] }];
    project.stimuli = [{ id: 's1', cell_id: 'c1', fields: { body: 'first', date: 'd1' }, image_data: 'data:image/png;base64,' + 'A'.repeat(50000) }];
    StoryboardHistory.track();
    project.stimuli[0].cell_id = 'c2';
    project.stimuli[0].fields.date = 'd2';
    StoryboardHistory.commit('Move inject');
    project.stimuli[0].fields.body = 'edited later';`);
  assert.equal(h.run('StoryboardHistory.undo()'), 'Move inject');
  assert.equal(h.run('appState.scenario.stimuli[0].cell_id'), 'c1');
  assert.equal(h.run('appState.scenario.stimuli[0].fields.date'), 'd1');
  assert.equal(h.run('appState.scenario.stimuli[0].fields.body'), 'edited later');
  assert.equal(h.run('appState.scenario.stimuli[0].image_data.length'), 50022);
  assert.equal(h.run('StoryboardHistory.redo()'), 'Move inject');
  assert.equal(h.run('appState.scenario.stimuli[0].cell_id'), 'c2');
});

test('persistence: opening a project file keeps the interface language chosen here', () => {
  const h = harness();
  h.run(`appState.scenario.settings.language = 'fr'; appState.checkerState.challengeRestoredFor = 'x';
    const file = JSON.parse(JSON.stringify(defaultScenario())); file.settings.language = 'en';
    applyLoadedScenario(file);`);
  assert.equal(h.run('appState.scenario.settings.language'), 'fr');
  assert.equal(h.run('appState.checkerState.challengeRestoredFor'), null);
});

test('people: real names written in the players list replace the invented ones in the injects at Update', async () => {
  const h = harness();
  h.run(`StoryboardHistory.ensure();
    const project = appState.scenario;
    project.cells = [sbMakeCell('decision', { id: 'c1' })];
    project.cells[0].players.push(sbNormalizePlayer({ id: 'p1', name: 'Marie Dupont', role: 'CFO', email: 'marie.dupont@example.com' }));
    project.player_pool = [sbNormalizePlayer({ id: 'p2', name: 'Paul Martin', role: 'CIO' })];
    project.stimuli = [makeStimulus('email_internal', project.actors[0]?.id || '', 10)];
    project.stimuli[0].fields.to = 'Marie Dupont, CFO <marie.dupont@example.com>';
    project.stimuli[0].fields.body = '<p>Dear Marie, the board awaits your figures. Marie Dupont must decide.</p>';`);
  // A player moves from the list into a cell, and back.
  assert.equal(h.run(`ceMovePlayer(appState.scenario, 'p2', 'c1')`), true);
  assert.equal(h.run('appState.scenario.cells[0].players.length'), 2);
  assert.equal(h.run(`ceMovePlayer(appState.scenario, 'p2', '')`), true);
  assert.equal(h.run('appState.scenario.player_pool.length'), 1);
  // The real name: nothing changes in the injects until Update.
  h.run(`const player = ceFindPlayer(appState.scenario, 'p1').player; ceEditPlayer(player, 'name', 'Claire Martin'); ceEditPlayer(player, 'role', 'Chief Financial Officer'); ceEditPlayer(player, 'email', 'claire.martin@client.com');`);
  assert.ok(h.run('appState.scenario.stimuli[0].fields.to').includes('Marie Dupont'));
  const impacts = h.json('sbComputeImpacts(appState.scenario).filter((impact) => impact.kind === "rename")');
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].label, 'Marie Dupont, CFO → Claire Martin, Chief Financial Officer');
  assert.equal(h.run(`ceApplyPlayerRename(appState.scenario, 'p1')`), 1);
  assert.equal(h.run('appState.scenario.stimuli[0].fields.to'), 'Claire Martin, Chief Financial Officer <claire.martin@client.com>');
  assert.equal(h.run('appState.scenario.stimuli[0].fields.body'), '<p>Dear Claire, the board awaits your figures. Claire Martin must decide.</p>');
  assert.equal(h.json('sbComputeImpacts(appState.scenario).filter((impact) => impact.kind === "rename")').length, 0);
  assert.equal(h.run(`!!ceFindPlayer(appState.scenario, 'p1').player.synced`), false);
  // Back to the first value: nothing left to write.
  h.run(`const p = ceFindPlayer(appState.scenario, 'p2').player; ceEditPlayer(p, 'name', 'Paul M'); ceEditPlayer(p, 'name', 'Paul Martin');`);
  assert.equal(h.run(`!!ceFindPlayer(appState.scenario, 'p2').player.synced`), false);
  // The list and the categories survive the project file.
  h.run(`ceActorCategories(appState.scenario).push({ id: 'cat1', label: 'Insurers', role: 'partner' });`);
  const reloaded = h.json('mergeScenario(migrateScenario(buildProjectFileData()))');
  assert.equal(reloaded.player_pool[0].name, 'Paul Martin');
  assert.equal(reloaded.actor_categories[0].label, 'Insurers');
});

test('model: a time in the text of an event is read only on the day played', () => {
  const h = harness();
  const at = (text) => h.run(`sbTextClockMinute(${JSON.stringify(text)}, '2026-11-27T08:00:00', 180)`);
  assert.equal(at('09:30 Leak posted'), 90);
  assert.equal(at('D-Day 09h30'), 90);
  for (const text of ['D+1 09:30', 'J-1: 09:30', 'Day 2, 09:30', 'Jour 2 09h30', 'Tag 2 10:00', 'D2 09:30', '12:00 too late']) assert.equal(at(text), null, text);
});

test('checks: deterministic coherence rules flag gaps, overlaps, coverage and plan mismatches', () => {
  const h = harness();
  h.run(`{ appState.scenario.scenario.objectives = 'Isolate on time\\nNotify the regulator';
    const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    sb.blocks.push(sbMakeBlock('investigation', { track_id: main, start_minutes: 0, duration_minutes: 60, brief: 'x', objectives: ['Isolate on time'] }, sb));
    sb.blocks.push(sbMakeBlock('containment', { track_id: main, start_minutes: 120, duration_minutes: 30, brief: 'y', stimuli_target: 3, beats: [{ offset_minutes: 5, channel: 'email_internal', title: 'a' }] }, sb));
    sb.blocks.push(sbMakeBlock('recovery', { track_id: main, start_minutes: 140, duration_minutes: 30 }, sb)); }`);
  const codes = h.json('sbStructuralChecks(sbStoryboard(), appState.scenario).map(i => i.code)');
  for (const code of ['no_trigger', 'gap', 'overlap', 'beat_count', 'no_brief', 'objective_uncovered']) assert.ok(codes.includes(code), code);
  assert.ok(!codes.includes('no_exit'), 'a recovery phase closes the storyline');
  assert.ok(h.run('sbScore(sbStructuralChecks(sbStoryboard(), appState.scenario))') < 100);
});

test('checks: the main storyline ends with a closing phase (recovery or exit), a warning otherwise', () => {
  const h = harness();
  const exitIssue = () => h.json(`sbStructuralChecks(sbStoryboard(), appState.scenario).find(i => i.code === 'no_exit') || null`);
  h.run(`{ const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    sb.blocks.push(sbMakeBlock('trigger', { track_id: main, start_minutes: 0, duration_minutes: 60, brief: 'x' }, sb));
    sb.blocks.push(sbMakeBlock('exit', { track_id: main, start_minutes: 60, duration_minutes: 30, brief: 'y' }, sb));
    sb.blocks.push(sbMakeBlock('twist', { track_id: main, start_minutes: 90, duration_minutes: 30, brief: 'z' }, sb)); }`);
  // An exit block that is not last does not close the exercise.
  const issue = exitIssue();
  assert.equal(issue.severity, 'warning');
  assert.match(issue.message, /does not end with a closing phase/);
  h.run(`appState.scenario.settings.language = 'fr'`);
  assert.match(exitIssue().display, /phase de clôture/);
  assert.ok(h.json('ccRuleIssues(appState.scenario).map(i => i.code)').includes('no_exit'), 'shown in Check & Challenge');
  h.run(`sbStoryboard().blocks[2].type = 'recovery'`);
  assert.equal(exitIssue(), null);
  h.run(`sbStoryboard().blocks[2].type = 'exit'`);
  assert.equal(exitIssue(), null);
});

test('nudges: a planned inject can be a nudge, carried through normalisation, templates, writing, the editor and Play', () => {
  const h = harness();
  assert.equal(h.json(`sbNormalizeBeat({ title: 'a', kind: 'nudge' })`).kind, 'nudge');
  assert.equal(h.json(`sbNormalizeBeat({ title: 'a', nudge: true })`).kind, 'nudge');
  assert.ok(!('kind' in h.json(`sbNormalizeBeat({ title: 'a', kind: 'other' })`)), 'only nudges are marked');
  h.run(`{ const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    appState.scenario.cells = [sbMakeCell('decision', { id: 'cell_a', name: 'Decision cell' }), sbMakeCell('communication', { id: 'cell_b', name: 'Communication cell' }), sbMakeCell('it', { id: 'cell_c', name: 'IT cell' })];
    sb.blocks.push(sbMakeBlock('trigger', { track_id: main, start_minutes: 0, duration_minutes: 60, brief: 'x', stimuli_target: 3, beats: [
      { offset_minutes: 5, channel: 'email_internal', title: 'Alert', cell_id: 'cell_a' },
      { offset_minutes: 30, channel: 'email_internal', title: 'CEO asks for a decision', cell_id: 'cell_a', kind: 'nudge' },
      { offset_minutes: 40, channel: 'phone_call', title: 'Journalist calls', cell_id: 'cell_b' }] }, sb));
    appState.scenario.stimuli.push(makeStimulus('email_internal', '', 10, null)); appState.scenario.stimuli.at(-1).cell_id = 'cell_c'; }`);
  // Only cells with planned injects are flagged, and a nudge addressed to it clears the warning.
  const nudgeCells = () => h.json(`sbExerciseChecks(appState.scenario).filter(i => i.code === 'cell_no_nudge').map(i => i.cell_id)`);
  assert.deepEqual(nudgeCells(), ['cell_b']);
  const issue = h.json(`sbExerciseChecks(appState.scenario).find(i => i.code === 'cell_no_nudge')`);
  assert.equal(issue.severity, 'warning');
  assert.ok(h.json('ccRuleIssues(appState.scenario).map(i => i.code)').includes('cell_no_nudge'), 'shown in Check & Challenge');
  h.run(`sbStoryboard().blocks[0].beats.push(sbMakeBeat({ offset_minutes: 50, channel: 'email_internal', title: 'Deadline reminder', cell_id: 'all', kind: 'nudge' }))`);
  assert.deepEqual(nudgeCells(), [], 'a nudge to all cells reaches every cell');
  // Templates keep the flag both ways.
  const template = h.json(`sbStoryboardToTemplate(sbStoryboard(), appState.scenario)`);
  assert.equal(template.blocks[0].beats.filter(beat => beat.kind === 'nudge').length, 2);
  assert.equal(h.json(`sbTemplateToStoryboard(${JSON.stringify(template)}).storyboard.blocks[0].beats.filter(b => b.kind === 'nudge').length`), 2);
  // The writing prompt of a nudge says what it is for.
  const nudge = h.json(`sbStoryboard().blocks[0].beats.find(b => b.title === 'CEO asks for a decision')`);
  assert.match(h.run(`sbGenerationBrief(appState.scenario, sbStoryboard().blocks[0], sbStoryboard().blocks[0].beats.find(b => b.id === '${nudge.id}'))`), /This inject is a nudge/);
  // Tagged in the Detailed storyline (card and editor) and in the Play chronogram.
  h.run(`tabUI('detailed').cell = 'all'; tabUI('detailed').selected = 'beat:${nudge.id}'`);
  const detailed = h.run('renderDetailedView()');
  assert.ok(detailed.includes('sb-nudge-tag') && /data-ds-beat="kind" checked/.test(detailed), 'tag and checked toggle in the editor');
  h.run(`appState.scenario.settings.language = 'fr'`);
  assert.ok(h.run('renderDetailedView()').includes('>Relance<'));
  h.run(`appState.scenario.settings.language = 'de'`);
  const play = h.run(`playItems().filter(item => item.beat?.kind === 'nudge').map(item => renderPlayRow(item, 0)).join('')`);
  assert.ok(play.includes('sb-nudge-tag') && play.includes('Impuls'));
  assert.ok(!h.run(`playItems().filter(item => item.beat && !item.beat.kind).map(item => renderPlayRow(item, 0)).join('')`).includes('sb-nudge-tag'));
});

test('AI planning: the Scenario Builder asks for a closing phase and one nudge per cell, and keeps the nudge flag', async () => {
  const h = harness();
  assert.match(h.run('sbAISystemPrompt()'), /closing phase/);
  assert.match(h.run('sbAISystemPrompt()'), /NUDGE/);
  h.run(`{ const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    appState.scenario.cells = [sbMakeCell('decision', { id: 'cell_a', name: 'Decision cell' })];
    sb.blocks.push(sbMakeBlock('trigger', { id: 'block_a', track_id: main, start_minutes: 0, duration_minutes: 60, brief: 'x', narrative: 'y', stimuli_target: 2 }, sb)); }`);
  const calls = mockAI(h, [{ blocks: [{ id: 'block_a', beats: [
    { at: 5, channel: 'email_internal', cell: 'cell_a', title: 'Alert', intent: 'a' },
    { at: 40, channel: 'email_internal', cell: 'cell_a', title: 'CEO follow-up', intent: 'Decide now', nudge: true }] }] }]);
  await h.run(`SbAI.deepen(['block_a'], 3)`);
  assert.ok(calls[0].payload.rules.some(rule => /Nudges: every player cell/.test(rule)));
  assert.deepEqual(h.json(`sbStoryboard().blocks[0].beats.map(b => b.kind || '')`), ['', 'nudge']);
  // The planning context shows the nudges already planned, in full or compact form.
  assert.match(JSON.stringify(h.json(`sbAIContext(appState.scenario, {})`)), /"nudge":true/);
  assert.match(JSON.stringify(h.json(`sbAIContext(appState.scenario, { focus: ['other'] })`)), /CEO follow-up \[nudge\]/);
});

test('AI: skeleton output is repaired, validated and applied as one undoable step on a single storyline', async () => {
  const h = harness();
  const calls = mockAI(h, [{ title: 'Hospital ransomware', summary: 'Hidden story', threat: 'Affiliate', objectives: ['Protect patients', 'Notify on time'],
    cast: [{ key: 'ciso', label: 'CISO', role: 'internal', organization: 'Hospital' }, { key: 'press', label: 'Health reporter', role: 'journalist', organization: 'Daily' }],
    tracks: ['main', 'communication', 'bogus'],
    blocks: [{ key: 'b1', type: 'trigger', title: 'Alarms', track: 'main', start: 0, duration: 50, stimuli: 2, brief: 'Alerts', objectives: [0] },
      { key: 'b2', type: 'investigation', title: 'Scoping', track: 'main', start: 70, duration: 100, stimuli: 3, brief: 'Scope' },
      { key: 'b3', type: 'unknown', title: 'Press storm', track: 'communication', start: 400, duration: 90, stimuli: 2, brief: 'Media', objectives: [1] },
      { key: 'b4', type: 'exit', title: 'Closure', track: 'main', start: 200, duration: 20, stimuli: 1, brief: 'End' }] }]);
  await h.run(`(async () => { const result = await SbAI.skeleton({ brief: 'Hospital ransomware', duration: 240 }); sbReplaceStoryboard(result.storyboard, 'AI skeleton'); })()`);
  const sb = h.json('sbStoryboard()');
  assert.equal(sb.tracks.length, 1);
  const main = [...sb.blocks].sort((a, b) => a.start_minutes - b.start_minutes);
  assert.equal(main[0].start_minutes, 0);
  for (let i = 1; i < main.length; i++) assert.equal(main[i].start_minutes, main[i - 1].start_minutes + main[i - 1].duration_minutes);
  assert.equal(main[main.length - 1].start_minutes + main[main.length - 1].duration_minutes, 240);
  assert.ok(!sb.blocks.some(b => b.title === 'Press storm'), 'workstream folded into the storyline');
  assert.ok(sb.blocks.some(b => b.notes.includes('Press storm')));
  assert.equal(sb.cast.length, 2);
  assert.ok(calls[0].system.includes('Scenario Builder'));
  assert.ok(calls[0].system.includes('CELLS') || calls[0].system.toLowerCase().includes('cell'));
  assert.ok(!JSON.stringify(calls).includes('TEST-SECRET'));
  assert.equal(h.run('StoryboardHistory.undo()'), 'AI skeleton');
  assert.equal(h.run('sbStoryboard().blocks.length'), 0);
});

test('AI: reviewExercise merges rules with AI findings', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); Object.assign(appState.scenario.settings, { ai_api_key: 'TEST-SECRET', ai_provider: 'openai' }); StoryboardHistory.ensure();`);
  // The demo passes every rule: one planned inject without recipient gives the rules a finding.
  h.run(`appState.scenario.storyboard.blocks[0].beats[0].cell_id = ''`);
  const target = h.json(`({ cell: appState.scenario.cells[1].id, name: appState.scenario.cells[1].name })`);
  const calls = mockAI(h, [
    () => ({ score: 71, summary: 'Rhythm is uneven.', issues: [{ severity: 'warning', at: 90, cell: target.name, message: 'Two floods in a row.', suggestion: 'Spread them.' }, { severity: 'bogus', message: '' }] })
  ]);
  const review = await h.run(`SbAI.reviewExercise().then(r => JSON.stringify(r))`).then(JSON.parse);
  assert.equal(review.score, 71);
  const ai = review.issues.filter(issue => issue.source === 'ai');
  assert.equal(ai.length, 1);
  assert.equal(ai[0].cell_id, target.cell);
  assert.equal(ai[0].at, 90);
  assert.ok(review.issues.some(issue => issue.source === 'rules'));
  assert.equal(calls[0].payload.injects.length, h.run('sbExerciseItems(appState.scenario).length'));
  assert.ok(!JSON.stringify(calls).includes('TEST-SECRET'));
});

test('AI: deepen adds narrative then exactly the missing beats, keeping existing ones and locked blocks', async () => {
  const h = harness();
  h.run(`const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    sb.cast.push(sbMakeCast({ id: 'cast_ciso', label: 'CISO' }));
    sb.blocks.push(sbMakeBlock('trigger', { id: 'b1', track_id: main, start_minutes: 0, duration_minutes: 60, stimuli_target: 3, brief: 'Alerts', beats: [{ id: 'keep', offset_minutes: 0, channel: 'sms_notification', title: 'Existing' }] }, sb));
    sb.blocks.push(sbMakeBlock('investigation', { id: 'b2', track_id: main, start_minutes: 60, duration_minutes: 60, brief: 'Scope', locked: true }, sb));`);
  mockAI(h, [
    payload => ({ blocks: payload.target.map(t => ({ id: t.id, narrative: 'Players see alerts but not the cause.' })) }),
    payload => ({ blocks: payload.target.map(t => ({ id: t.id, beats: [{ at: 10, channel: 'email_internal', cast: 'cast_ciso', title: 'CISO asks', intent: 'Decide' }, { at: 90, channel: 'post_twitter', cast: 'newbie', title: 'Rumour', intent: 'Pressure' }, { at: 20, channel: 'nope', cast: 'cast_ciso', title: 'Extra', intent: 'x' }] })), cast: [{ key: 'newbie', label: 'Blogger', role: 'journalist' }] })
  ]);
  await h.run(`sbRunAI('Deepen', () => SbAI.deepen(['b1', 'b2'], null))`);
  assert.equal(h.run(`sbBlock(sbStoryboard(), 'b1').narrative`), 'Players see alerts but not the cause.');
  assert.equal(h.run(`sbBlock(sbStoryboard(), 'b2').narrative`), '');
  await h.run(`sbRunAI('Plan', () => SbAI.deepen(['b1'], 3))`);
  const block = h.json(`sbBlock(sbStoryboard(), 'b1')`);
  assert.equal(block.beats.length, 3);
  assert.ok(block.beats.some(b => b.id === 'keep'));
  assert.ok(block.beats.every(b => b.offset_minutes < 60));
  assert.ok(block.beats.every(b => b.channel !== 'nope'));
  assert.equal(h.run(`sbStoryboard().cast.some(c => c.label === 'Blogger')`), true);
  assert.equal(h.run(`StoryboardHistory.undo()`), 'Plan');
  assert.equal(h.run(`sbBlock(sbStoryboard(), 'b1').beats.length`), 1);
});

test('AI: a library scenario is made the client\'s own in short requests, keeping its structure', async () => {
  const h = harness();
  h.run(`appState.scenario.client.name = 'Maison Aubray'; appState.scenario.client.sector = 'Retail';`);
  const template = h.json(`sbFindTemplate('ransomware-double-extortion')`);
  const calls = mockAI(h, [
    (payload) => ({ name: 'Black Friday Blackout', summary: 'Maison Aubray is hit on Black Friday.', threat: 'An affiliate and a card skimmer.', objectives: payload.template.objectives.map((item, i) => `Retail objective ${i + 1}`),
      cast: payload.template.cast.map((cast) => ({ key: cast.key, label: `${cast.label} (Aubray)`, organization: cast.organization === 'The organisation' ? 'Maison Aubray' : cast.organization })),
      blocks: payload.template.blocks.map((block) => ({ key: block.key, title: `Aubray: ${block.title}`, brief: 'Stores and checkout are down.' })) }),
    (payload) => ({ phases: payload.phases.filter((phase) => phase.key !== payload.scenario.phases[2].key).map((phase) => ({ key: phase.key, narrative: 'The skimmer was there first.', beats: phase.beats.map((beat, i) => ({ title: `Store alert ${i + 1}`, intent: 'Store managers call the crisis cell.' })) })) })
  ]);
  const adapted = await h.run(`(async () => JSON.stringify(await SbAI.instantiateTemplate(sbFindTemplate('ransomware-double-extortion'))))()`).then(JSON.parse);
  assert.equal(calls.length, 1 + Math.ceil(template.blocks.length / 2), 'one request for the scenario, then one per two phases');
  assert.ok(JSON.stringify(calls[0].payload.rules).includes('Maison Aubray'));
  assert.equal(adapted.name, 'Black Friday Blackout');
  assert.equal(adapted.blocks.length, template.blocks.length);
  assert.ok(adapted.blocks.every((block) => block.title.startsWith('Aubray: ')));
  assert.equal(adapted.blocks[0].beats[0].title, 'Store alert 1');
  assert.equal(adapted.blocks[0].beats[0].channel, template.blocks[0].beats[0].channel, 'channels stay');
  assert.equal(adapted.blocks[0].beats[0].cast, template.blocks[0].beats[0].cast, 'senders stay');
  // A phase the AI left out keeps its original story.
  assert.equal(adapted.blocks[2].narrative, template.blocks[2].narrative);
  assert.ok(adapted.cast.some((cast) => cast.organization === 'Maison Aubray'));
});

test('AI: a library phase group cut at its length is retried phase by phase, and a failing phase keeps its text', async () => {
  const h = harness();
  h.run(`appState.scenario.client.name = 'Maison Aubray';`);
  const template = h.json(`sbFindTemplate('ransomware-double-extortion')`);
  mockAI(h, [
    (payload) => ({ name: 'Adapted', blocks: payload.template.blocks.map((block) => ({ key: block.key, title: `A ${block.title}` })) }),
    (payload) => {
      if (payload.phases.length > 1) throw new Error('The AI reply was cut off at its length limit.');
      if (payload.phases[0].key === payload.scenario.phases[1].key) throw new Error('LLM response contained malformed JSON.');
      return { phases: payload.phases.map((phase) => ({ key: phase.key, narrative: 'Adapted story.' })) };
    }
  ]);
  const adapted = await h.run(`(async () => JSON.stringify(await SbAI.instantiateTemplate(sbFindTemplate('ransomware-double-extortion'))))()`).then(JSON.parse);
  assert.equal(adapted.blocks[0].narrative, 'Adapted story.');
  assert.equal(adapted.blocks[1].narrative, template.blocks[1].narrative, 'the phase that kept failing keeps its original story');
  assert.equal(adapted.kept_phases, 1);
});

test('library: a template keeps the number of cells set in Context, its workstreams go to the closest cells', () => {
  const h = harness();
  h.run(`appState.scenario.cells = ['decision', 'operational', 'communication', 'it'].map((key) => sbMakeCell(key)); appState.scenario.exercise.cells_count = 4; StoryboardHistory.ensure();
    sbApplyTemplate(sbFindTemplate('ransomware-double-extortion'), 'replace');`);
  assert.equal(h.run('appState.scenario.cells.length'), 4);
  assert.equal(h.run('appState.scenario.exercise.cells_count'), 4);
  assert.ok(h.json('(() => { const cells = appState.scenario.cells.map((cell) => cell.id); return sbStoryboard().blocks.flatMap((block) => block.beats).filter((beat) => beat.cell_id && !sbIsAllCells(beat.cell_id)).every((beat) => sbRecipientIds(beat.cell_id).every((id) => cells.includes(id))); })()'), 'every planned inject goes to one of the 4 cells');
});

test('pipeline: plans, casts, creates linked injects through agent tools and writes content with storyboard context', async () => {
  const h = harness();
  h.run(`appState.scenario.client.name = 'Acme Bank'; appState.scenario.settings.inject_language = 'fr';
    const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    sb.meta.synopsis = 'Ransomware hits payment systems.';
    sb.cast.push(sbMakeCast({ id: 'cast_ciso', label: 'CISO', role: 'internal' }), sbMakeCast({ id: 'cast_press', label: 'Reporter', role: 'journalist', organization: 'Le Monde' }));
    sb.blocks.push(sbMakeBlock('trigger', { id: 'b1', track_id: main, start_minutes: 30, duration_minutes: 60, stimuli_target: 2, brief: 'Alerts', narrative: 'Payments fail.' }, sb));`);
  const calls = mockAI(h, [
    () => ({ blocks: [{ id: 'b1', beats: [{ at: 0, channel: 'email_internal', cast: 'cast_ciso', title: 'Payments down', intent: 'CISO asks to isolate' }, { at: 40, channel: 'article_press', template_id: 'lemonde', cast: 'cast_press', title: 'Bank outage', intent: 'Public pressure' }] }] }),
    () => ({ actors: [{ cast: 'cast_ciso', name: 'Claire Martin', title: 'RSSI', organization: 'Acme Bank', role: 'internal', language: 'fr' }] })
  ]);
  const written = [];
  h.context.written = written;
  h.run(`AITextGenerator.generateForStimulus = async (stimulus, field, guided) => { written.push({ id: stimulus.id, guided }); return stimulus.channel === 'article_press' ? { headline: 'Panne géante', body: '<p>Texte</p>', unknown_key: 'dropped' } : { subject: 'Paiements à l\\'arrêt', body: '<p>Isoler ?</p>' }; };`);
  const result = await h.run(`SbPipeline.run({ plan: true, cast: true, write: true }).then(r => JSON.stringify(r))`).then(JSON.parse);
  assert.deepEqual(result, { created: 2, written: 2 });
  const stimuli = h.json('appState.scenario.stimuli');
  assert.equal(stimuli.length, 2);
  assert.deepEqual(stimuli.map(s => s.timestamp_offset_minutes), [30, 70]);
  assert.ok(stimuli.every(s => s.scenario_link?.block_id === 'b1' && s.scenario_link.beat_id && s.scenario_link.content_hash));
  assert.equal(stimuli[1].template_id, 'lemonde');
  assert.equal(stimuli[1].fields.unknown_key, undefined);
  assert.equal(h.run('appState.scenario.actors.length'), 2);
  assert.equal(h.run(`appState.scenario.actors.find(a => a.name === 'Claire Martin').language`), 'fr');
  assert.ok(written[0].guided.includes('Ransomware hits payment systems.'));
  assert.ok(written[0].guided.includes('Payments down'));
  assert.ok(written[0].guided.includes('Français'));
  assert.ok(!JSON.stringify(calls).includes('TEST-SECRET'));
  assert.equal(h.run('sbComputeImpacts(appState.scenario).length'), 0);
  assert.equal(h.run('SbPipeline.undo()'), true);
  assert.equal(h.run('appState.scenario.stimuli.length'), 0);
  assert.equal(h.run(`sbBlock(sbStoryboard(), 'b1').beats.length`), 0);
});

test('pipeline: a cell-scoped run only creates that cell\'s injects and carries the recipient into the brief', async () => {
  const h = harness();
  h.run(`const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    appState.scenario.cells = [sbMakeCell('decision'), sbMakeCell('communication')];
    const [decision, communication] = appState.scenario.cells.map(c => c.id);
    sb.cast.push(sbMakeCast({ id: 'cast_ceo', label: 'CEO', role: 'internal' }));
    sb.blocks.push(sbMakeBlock('trigger', { id: 'b1', track_id: main, start_minutes: 0, duration_minutes: 60, stimuli_target: 5, beats: [
      sbMakeBeat({ id: 'beat_d', offset_minutes: 5, channel: 'email_internal', cast_id: 'cast_ceo', title: 'Board call', cell_id: decision }),
      sbMakeBeat({ id: 'beat_c', offset_minutes: 10, channel: 'email_internal', cast_id: 'cast_ceo', title: 'Press line', cell_id: communication })] }, sb));`);
  const calls = mockAI(h, [() => { throw new Error('no planning expected'); }]);
  const guided = [];
  h.context.guided = guided;
  h.run(`AITextGenerator.generateForStimulus = async (stimulus, field, text) => { guided.push(text); return { subject: 'S', body: '<p>B</p>' }; };`);
  const cell = h.run('appState.scenario.cells[0].id');
  h.context.cell = cell;
  const result = await h.run(`SbPipeline.run({ cellIds: [cell], cast: false }).then(r => JSON.stringify(r))`).then(JSON.parse);
  assert.deepEqual(result, { created: 1, written: 1 });
  const stimuli = h.json('appState.scenario.stimuli');
  assert.equal(stimuli.length, 1);
  assert.equal(stimuli[0].cell_id, cell);
  assert.equal(stimuli[0].scenario_link.beat_id, 'beat_d');
  assert.ok(guided[0].includes('Decision cell'));
  assert.equal(calls.length, 0);
});

test('sync: moved blocks retime injects, changed briefs flag content, manual edits are adapted and locks respected', async () => {
  const h = harness();
  h.run(`{ const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    sb.cast.push(sbMakeCast({ id: 'cast_ciso', label: 'CISO' }));
    sb.blocks.push(sbMakeBlock('trigger', { id: 'b1', track_id: main, start_minutes: 0, duration_minutes: 60, stimuli_target: 3, brief: 'Alerts', beats: [
      { id: 'k1', offset_minutes: 10, channel: 'email_internal', cast_id: 'cast_ciso', title: 'One' },
      { id: 'k2', offset_minutes: 20, channel: 'email_internal', cast_id: 'cast_ciso', title: 'Two' },
      { id: 'k3', offset_minutes: 30, channel: 'email_internal', cast_id: 'cast_ciso', title: 'Three' }] }, sb));
    StoryboardHistory.ensure(); }`);
  h.run(`AITextGenerator.generateForStimulus = async (stimulus, field, guided) => ({ subject: guided.includes('edited by hand') ? 'Adapted' : 'Fresh', body: '<p>Body</p>' });`);
  await h.run(`SbPipeline.run({ plan: false, cast: true, write: true })`);
  h.run(`{ const [s1, s2, s3] = getSortedStimuli();
    s2.fields.body = '<p>Designer rewrite</p>';
    sbLockStimulus(s3, true);
    const block = sbBlock(sbStoryboard(), 'b1'); block.start_minutes = 100; block.brief = 'New alerts'; StoryboardHistory.commit('Move and rewrite'); }`);
  const impacts = h.json('sbComputeImpacts(appState.scenario)');
  const [s1, s2, s3] = h.json('getSortedStimuli().map(s => s.id)');
  assert.ok(impacts.some(i => i.kind === 'retime' && i.stimulus_id === s1 && i.to === 110 && i.action === 'apply'));
  assert.equal(impacts.find(i => i.kind === 'outdated' && i.stimulus_id === s1).action, 'regenerate');
  assert.equal(impacts.find(i => i.kind === 'outdated' && i.stimulus_id === s2).action, 'adapt');
  assert.ok(!impacts.some(i => i.stimulus_id === s3), 'locked inject untouched');
  await h.run(`SbPipeline.applyImpacts(sbComputeImpacts(appState.scenario))`);
  const after = h.json('Object.fromEntries(appState.scenario.stimuli.map(s => [s.id, { at: s.timestamp_offset_minutes, subject: s.fields.subject, body: s.fields.body }]))');
  assert.equal(after[s1].at, 110); assert.equal(after[s1].subject, 'Fresh');
  assert.equal(after[s2].at, 120); assert.equal(after[s2].subject, 'Adapted');
  assert.equal(after[s3].at, 30);
  assert.deepEqual(h.json('sbComputeImpacts(appState.scenario).map(i => i.kind)'), []);
  h.run(`sbBlock(sbStoryboard(), 'b1').beats = sbBlock(sbStoryboard(), 'b1').beats.filter(b => b.id !== 'k1'); StoryboardHistory.commit('Remove beat');`);
  const orphan = h.json('sbComputeImpacts(appState.scenario)').find(i => i.kind === 'orphan');
  assert.equal(orphan.stimulus_id, s1);
  h.run(`{ const block = sbBlock(sbStoryboard(), 'b1'); block.beats.push(sbMakeBeat({ id: 'k4', offset_minutes: 50, channel: 'sms_notification', cast_id: 'cast_ciso', title: 'Four' })); StoryboardHistory.commit('Add beat'); }`);
  assert.ok(h.json('sbComputeImpacts(appState.scenario)').some(i => i.kind === 'missing' && i.beat_id === 'k4'));
});

test('agent integration: storyboard tools expose cells, phases tool and scoped Agent brief', async () => {
  const h = harness();
  h.run(`sbApplyTemplate(sbFindTemplate('ceo-fraud-deepfake'), 'replace'); StoryboardHistory.ensure(appState.scenario, 'Use');`);
  const registry = h.json('[...createAgentToolRegistry().keys()]');
  assert.ok(registry.includes('getStoryboard') && registry.includes('updateStoryboardBlock'));
  const storyboard = await h.run(`(async () => JSON.stringify(await createAgentToolRegistry().get('getStoryboard').execute({})))()`).then(JSON.parse);
  assert.ok(storyboard.blocks.length >= 5);
  assert.equal(storyboard.tracks, undefined);
  assert.ok(storyboard.cells.length >= 2);
  const cellIds = new Set(storyboard.cells.map(cell => cell.id));
  assert.ok(storyboard.blocks.flatMap(block => block.beats).every(beat => cellIds.has(beat.cell_id)));
  const blockId = storyboard.blocks[0].id;
  h.context.args = { id: blockId, patch: { brief: 'Agent brief' } };
  h.run(`ToolValidator.validate(args, createAgentToolRegistry().get('updateStoryboardBlock').inputSchema); createAgentToolRegistry().get('updateStoryboardBlock').execute(args)`);
  assert.equal(h.run(`sbBlock(sbStoryboard(), '${blockId}').brief`), 'Agent brief');
  h.run(`createAgentToolRegistry().get('setPhases').execute({ phases: [{ name: 'Fraud call', start_minutes: 0, end_minutes: 90, purpose: 'Deepfake call' }, { name: 'Exit', start_minutes: 90, end_minutes: 120, purpose: 'Close' }] })`);
  assert.deepEqual(h.json('appState.scenario.scenario.phases.map(p => p.name)'), ['Fraud call', 'Exit']);
  h.run(`sbSendToAgent(sbStoryboard().blocks[0])`);
  assert.equal(h.run('appState.route'), 'agent');
  assert.ok(h.run('getCrisisAgent().objective').includes('Work ONLY on injects scheduled inside this time window'));
  assert.ok(h.run('JSON.stringify(AgentContext.build())').includes('storyboard'));
});
test('library: user templates round-trip through save, export format and import parsing', () => {
  const h = harness();
  h.run(`sbApplyTemplate(sbFindTemplate('insider-threat-sabotage'), 'replace'); StoryboardHistory.ensure(appState.scenario, 'Use');`);
  const saved = h.json(`sbSaveCurrentAsTemplate('My insider drill')`);
  assert.equal(h.json('sbUserTemplates()').length, 1);
  assert.deepEqual(h.json(`sbValidateTemplate(sbUserTemplates()[0])`), []);
  const parsed = h.json(`sbParseTemplateFile(JSON.stringify({ schema: 'crisismaker-scenario-template', version: 1, template: sbUserTemplates()[0] }))`);
  assert.equal(parsed.name, 'My insider drill');
  assert.equal(parsed.blocks.length, saved.blocks.length);
  assert.throws(() => h.run(`sbParseTemplateFile('{"foo":1}')`), /not a CrisisMaker scenario template/);
  h.run(`appState.scenario = emptyScenario({}); StoryboardHistory.ensure(); sbApplyTemplate(sbUserTemplates()[0], 'replace')`);
  assert.equal(h.run('sbStoryboard().blocks.length'), saved.blocks.length);
  h.run(`sbApplyTemplate(sbFindTemplate('ot-industrial-incident'), 'insert')`);
  assert.ok(h.run('sbStoryboard().blocks.length') > saved.blocks.length);
  assert.ok(h.run('sbStoryboard().duration_minutes') > saved.duration_minutes);
});

test('view: the six tabs and every modal render without a DOM and escape user text', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  const context = h.run('renderScenarioView()');
  for (const marker of ['data-sc-duration', 'data-sc-cells', 'data-sc-players', 'data-bind="client.name"', 'data-cx-sector', 'data-cx-logo', 'data-bind="scenario.start_date"', 'data-bind="scenario.end_date"', 'data-bind="scenario.timezone"', 'data-bind="client.language"', 'data-bind="settings.inject_language"', 'data-sb-meta="brief"', 'data-bf-action="framing"', 'Build my exercise', 'data-bf-action="validate"', 'data-bf-action="stimuli"']) assert.ok(context.includes(marker), marker);
  assert.ok(context.indexOf('data-sc-players') < context.indexOf('data-sb-meta="brief"'), 'context, then objectives and AI');
  assert.ok(context.includes('data-bind="name"') && !context.includes('cx-details') && !context.includes('data-sb-meta="synopsis"'), 'the exercise name in the Context card; no "Scenario details" block');
  assert.ok(!context.includes('skeleton.brief') && !context.includes('llm-block-scenario'), 'the old AI blocks are gone');
  assert.ok(!context.includes('sb-template-card'), 'the library moved to the Project tab');
  const projectView = h.run('renderProjectView()');
  for (const marker of ['pj-summary', 'pj-data', 'data-action="new-scenario"', 'data-action="project-scroll-library"', 'data-action="load-json"', 'data-action="import-chronogram-ia"', 'data-action="load-example"', 'data-action="save-local"', 'data-action="save-json"', 'data-action="export-all"', 'Scenario library', 'sb-template-card', 'data-sb-action="export-current"', 'data-sb-action="import-template"']) assert.ok(projectView.includes(marker), marker);
  assert.ok(projectView.indexOf('pj-summary') < projectView.indexOf('pj-data') && projectView.indexOf('pj-data') < projectView.indexOf('Scenario library'), 'summary, then data, then library');
  assert.ok(!context.includes('data-sb-skeleton-track'), 'no workstream choice any more');
  const storyline = h.run('renderStorylineView()');
  for (const marker of ['sb-toolbar', 'sb-timeline-panel', 'data-sb-clip', 'data-sl-add', 'bottom-editor']) assert.ok(storyline.includes(marker), marker);
  assert.ok(!storyline.includes('sb-inspector') && !storyline.includes('sb-bin'), 'no side columns');
  h.run(`sbUI().selected = [sbStoryboard().blocks[1].id]`);
  const phase = h.run('renderStorylineView()');
  for (const marker of ['bottom-editor-head', 'data-sb-field="brief"', 'What happens during this phase', 'data-tab-action="open-detailed"', 'modify-block', 'Main events', 'data-sb-modal="sync"']) assert.ok(phase.includes(marker), marker);
  for (const gone of ['data-sb-field="narrative"', 'deepen-all', 'rewrite-block', 'Behind the scenes']) assert.ok(!phase.includes(gone), gone);
  assert.ok(!phase.includes('data-sb-objective'), 'objectives are not edited in the phase editor');
  for (const modal of ['versions', 'coherence', 'generate', 'sync']) {
    h.run(`sbUI().modal = '${modal}'`);
    assert.ok(h.run('renderStorylineView()').includes('sb-modal'), modal);
  }
  h.run(`sbUI().modal = 'preview'; sbUI().previewId = 'ransomware-double-extortion'`);
  const preview = h.run('renderProjectView()');
  assert.ok(preview.includes('data-sb-action="select-template"') && !preview.includes('Use this scenario'), 'library offers Load');
  h.run(`sbUI().modal = null; sbStoryboard().meta.library_id = 'ransomware-double-extortion'`);
  const loaded = h.run('renderScenarioView()');
  assert.ok(loaded.includes('Scenario generation') && loaded.includes('Library scenario loaded') && /data-cx-load-basic\s(?!disabled)/.test(loaded), 'Context offers the loaded library scenario');
  h.run(`sbStoryboard().meta.library_id = ''`);
  assert.ok(/data-cx-load-basic disabled/.test(h.run('renderScenarioView()')), 'greyed without a library scenario');
  h.run(`sbUI().modal = null; appState.scenario.cells[0].players.push(sbNormalizePlayer({ name: 'Ann Lee', role: 'CEO' }))`);
  const cells = h.run('renderCellsView()');
  for (const marker of ['data-ce-cell', 'data-ce-person', 'data-ce-assign', 'data-ce-cell-add', 'data-actor-bind', 'Played by', 'Storyline roles', 'data-ce-add-actor', 'Attackers', 'Press', 'Authorities']) assert.ok(cells.includes(marker), marker);
  const detailed = h.run('renderDetailedView()');
  for (const marker of ['data-tab-action="ds-cell"', 'ds-phase-row', 'data-ds-item', 'bottom-editor']) assert.ok(detailed.includes(marker), marker);
  h.run(`tabUI('detailed').cell = appState.scenario.cells[0].id; tabUI('detailed').selected = sbExerciseItems(appState.scenario).find(i => i.cell_id === appState.scenario.cells[0].id).key`);
  const inject = h.run('renderDetailedView()');
  for (const marker of ['data-ds-time', 'data-rcpt=', 'data-tab-action="ds-add"']) assert.ok(inject.includes(marker), marker);
  assert.ok(!inject.includes('data-tab-action="ds-plan"') && !inject.includes('ds-cell-chip is-add'), 'no "Plan with AI", no "+ Cell"');
  h.run(`appState.scenario.storyboard.blocks[0].beats[0].cell_id = ''`);
  h.run(`tabUI('summary').review = { score: null, summary: '', issues: sbExerciseChecks(appState.scenario) }; tabUI('summary').time = 120`);
  const summary = h.run('renderSummaryView()');
  for (const marker of ['cc-readiness', 'cc-gauge', 'su-kpis', 'su-heat', 'cc-launch', 'data-action="checker-analyze"', 'data-mode="file"', 'su-issue-group']) assert.ok(summary.includes(marker), marker);
  h.run(`appState.scenario.storyboard.blocks[0].title = '<img src=x onerror=alert(1)>'; appState.scenario.cells[0].name = '<img src=y onerror=alert(1)>'; sbUI().selected = [sbStoryboard().blocks[0].id]`);
  for (const view of ['renderStorylineView()', 'renderCellsView()', 'renderDetailedView()', 'renderSummaryView()']) assert.ok(!/<img src=[xy]/.test(h.run(view)), view);
});
test('library: every built-in scenario and the demo play in 3 hours', () => {
  const h = harness();
  const report = h.run(`SCENARIO_LIBRARY.map((template) => ({
    id: template.id,
    duration: template.duration_minutes,
    end: Math.max(...template.blocks.map((block) => block.start + block.duration)),
    beatsInside: template.blocks.every((block) => (block.beats || []).every((beat) => beat.at >= 0 && beat.at < block.duration))
  }))`);
  assert.ok(report.length >= 8);
  for (const item of report) assert.deepEqual([item.duration, item.end, item.beatsInside], [180, 180, true], item.id);
  h.run(`appState.scenario = defaultScenario()`);
  assert.equal(h.run('appState.scenario.storyboard.duration_minutes'), 180);
  assert.ok(h.run('Math.max(...appState.scenario.stimuli.map((item) => item.timestamp_offset_minutes))') < 180);
});

test('context: the learning objectives (one text) and the incident timeline feed every AI operation', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  assert.ok(h.run('appState.scenario.scenario.attack_path').includes('Initial access'), 'demo has an incident timeline');
  assert.equal(h.run(`emptyScenario().scenario.attack_path`), '', 'a new project starts blank');
  assert.equal(h.run(`emptyScenario().scenario.learning_objectives`), '');
  assert.ok(h.run('appState.scenario.scenario.learning_objectives').includes('NIS2'), 'one text, cells named inside');
  assert.ok(h.run('appState.scenario.cells.every((cell) => !cell.objectives)'));
  const cell = h.json(`appState.scenario.cells.find((item) => item.key === 'legal')`);
  // Context tab markup: one block of objectives, the incident timeline.
  const context = h.run('renderScenarioView()');
  for (const marker of ['Learning objectives', 'data-bind="scenario.learning_objectives"', 'Incident timeline', 'data-bind="scenario.attack_path"']) assert.ok(context.includes(marker), marker);
  assert.ok(!context.includes('data-cx-cell-objectives') && !context.includes('Attack path'));
  // Shared prompt lines: the objectives, pointed at the recipient, then the incident timeline.
  const lines = h.json(`sbDesignContextLines(appState.scenario, { cellId: '${cell.id}' })`);
  assert.ok(lines[0].startsWith('- Learning objectives') && lines[0].includes(`the recipient, the ${cell.name}`) && lines[0].includes('NIS2'));
  assert.ok(lines[1].startsWith('- Incident timeline'));
  // Every stimulus prompt, whatever its channel.
  const stimulus = h.run(`(() => { const s = appState.scenario.stimuli.find((item) => item.channel === 'email_authority'); s.cell_id = '${cell.id}'; return PromptBuilder.forStimulus(s, getActor(s.actor_id), appState.scenario).systemPrompt; })()`);
  assert.ok(stimulus.includes('Exercise design') && stimulus.includes('NIS2') && stimulus.includes('Kerberoasting'));
  // Storyline AI context and the agent frame.
  const ai = h.json('sbAIContext(appState.scenario)');
  assert.ok(ai.exercise.attack_path.includes('Exfiltration') && ai.exercise.learning_objectives.includes('crisis management'));
  const frame = h.json('agentExerciseFrame()');
  assert.ok(frame.attack_path.includes('Lateral movement'));
  assert.ok(frame.learning_objectives.includes('NIS2'));
  // Older projects kept objectives per cell: they fold into the text on load.
  const reloaded = h.json(`(() => { const data = JSON.parse(JSON.stringify(appState.scenario)); data.scenario.learning_objectives = 'Everyone: follow the procedure.'; data.cells.find((item) => item.id === '${cell.id}').objectives = 'Notify the regulator on time.'; return mergeScenario(data); })()`);
  assert.equal(reloaded.scenario.learning_objectives, `Everyone: follow the procedure.\n${cell.name}: Notify the regulator on time.`);
  assert.ok(reloaded.cells.every((item) => !item.objectives));
  assert.ok(reloaded.scenario.attack_path.includes('Impact'));
});

test('scenario first: injects grouped by phase, phase and cell filters, scenario-first checks', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.libraryFilter = { phase: '', cellId: '', channel: '', status: '', actorId: '', sort: 'timeline' };`);
  const phases = h.json('sbMainBlocks(sbStoryboard()).map((block) => ({ id: block.id, title: block.title }))');
  const view = h.run('renderLibraryView()');
  assert.ok(view.includes('data-library-filter="phase"') && view.includes('data-library-filter="cellId"'));
  assert.ok(view.includes('By phase'));
  const order = phases.map((phase) => view.indexOf(`<strong>${phase.title}</strong>`));
  assert.ok(order.every((index) => index > 0) && order.every((index, i) => !i || index > order[i - 1]), 'one section per phase, in scenario order');
  h.run(`appState.libraryFilter.phase = '${phases[1].id}'`);
  const one = h.run('renderLibraryView()');
  assert.ok(one.includes(`<strong>${phases[1].title}</strong>`) && !one.includes(`<strong>${phases[0].title}</strong>`));
  // The agent's check reads the storyline and the cells before the injects.
  // (an inject sent to all cells reaches a new cell too: give the demo's to one cell first)
  h.run(`(() => { const first = appState.scenario.cells[0].id; sbStoryboard().blocks.forEach((b) => b.beats.forEach((beat) => { if (beat.cell_id === 'all') beat.cell_id = first; })); appState.scenario.stimuli.forEach((s) => { if (s.cell_id === 'all') s.cell_id = first; }); appState.scenario.cells.push(sbMakeCell('custom', { name: 'Idle cell' })); })()`);
  const check = h.json('agentConsistencyCheck()');
  assert.ok(check.issues.some((issue) => issue.includes('Cell "Idle cell" receives no inject')));
  assert.ok(check.note.includes('scenario first'));
  assert.ok(h.run('AgentPrompts.protocol').includes('The scenario is the core'));
});

test('play: clock, numbering, timing, statuses both ways with the log, on-the-fly injects, full reset', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.route = 'play';`);
  // Numbered in play order, shared with the ZIP files and the chronogram CSV.
  const first = h.run(`getSortedStimuli()[0].id`);
  assert.equal(h.run(`playNumbers().get('${first}')`), 1);
  assert.ok(h.run(`ExportEngine.filenameForStimulus(getSortedStimuli()[0])`).startsWith('01_H+00-00_'));
  const csv = h.run(`ExportEngine.chronogramCsv(getSortedStimuli())`);
  assert.ok(csv.includes('"#";"Time";"Simulated time";"Phase"') && csv.includes('"Monday 08:30: the plants stop"'));
  // Clock: paused at H+1:06, the right items are due, late and soon.
  h.run(`Object.assign(playState(), { offset_min: 66, running: false })`);
  assert.equal(Math.round(h.run('playNow()')), 66);
  const items = h.json(`playItems().map((item) => ({ key: item.key, time: item.time, timing: playTiming(item, 66) }))`);
  assert.ok(items.some((item) => item.timing === 'is-late') && items.some((item) => item.timing === 'is-due'));
  // View: generate block, permanent bar with reset, chronogram by phase with the NOW line, log panel.
  const closed = h.run('renderPlayView()');
  assert.ok(closed.includes('data-play="log"') && !closed.includes('data-play-note'), 'log hidden in a pane by default');
  h.run('playUI().logOpen = true');
  const view = h.run('renderPlayView()');
  assert.ok(!view.includes('play-generate'), 'the download block moved to the Injects library');
  assert.ok(h.run('renderLibraryView()').includes('Download all injects'));
  for (const marker of ['data-play-bar', 'data-play="toggle"', 'data-play="reset-all"', 'data-play="add"', 'data-play-quick="now"', 'data-play-filter="cell"', 'data-play-now', 'play-phase-group', 'data-play-set="sent"', 'data-action="open-stimulus-modal"', 'Exercise log', 'data-play="save-log"', 'data-play-note']) assert.ok(view.includes(marker), marker);
  // Statuses go both ways, each change is logged, a re-send is counted.
  const id = h.run(`getSortedStimuli()[3].id`);
  h.run(`playSetStatus(getStimulus('${id}'), 'sent')`);
  assert.equal(h.run(`getStimulus('${id}').status`), 'sent');
  assert.ok(h.run(`getStimulus('${id}').sent_at_min`) > 60);
  h.run(`playSetStatus(getStimulus('${id}'), 'draft')`);
  assert.equal(h.run(`getStimulus('${id}').sent_at_min`), undefined, 'going back clears the send time');
  h.run(`playSetStatus(getStimulus('${id}'), 'sent')`);
  const log = h.json('playState().log');
  assert.equal(log.length, 3);
  assert.ok(log[0].text.includes('late') && log[1].text.includes('Sent → Draft') && log[2].text.includes('re-sent (2×)'));
  // Inject added on the fly, at the current time, saved with the project.
  h.run(`playAddInject()`);
  const added = h.json(`appState.scenario.stimuli.find((item) => item.added_in_play)`);
  assert.equal(added.timestamp_offset_minutes, 66);
  assert.equal(h.run(`appState.stimulusModalId`), added.id, 'the editor opens on it');
  const reloaded = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario)))`);
  assert.ok(reloaded.stimuli.some((item) => item.added_in_play && item.id === added.id));
  assert.equal(reloaded.stimuli.find((item) => item.id === id).sent_count, 2);
  assert.equal(reloaded.play.log.length, 4);
  // Log export and the full reset after two confirmations.
  assert.ok(h.run('playLogCsv()').includes('"Exercise time";"Wall clock";"Simulated time";"Type";"Event"'));
  h.run(`window.confirm = () => true; playResetAll()`);
  assert.equal(h.run('playState().log.length'), 0);
  assert.equal(h.run('playState().offset_min'), 0);
  assert.equal(h.run(`getStimulus('${id}').status`), 'ready');
  let asked = 0;
  h.run(`playSetStatus(getStimulus('${id}'), 'sent'); window.confirm = () => { globalThis.asked = (globalThis.asked || 0) + 1; return globalThis.asked < 2; }; playResetAll()`);
  asked = h.run('globalThis.asked');
  assert.equal(asked, 2, 'two confirmations');
  assert.equal(h.run(`getStimulus('${id}').status`), 'sent', 'declining the second confirmation keeps everything');
});

test('play: numbers freeze during the run, blank added injects, batched alerts, real clock shifts, the end pauses once', () => {
  const h = harness();
  h.context.clearInterval = () => {};
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.route = 'play';`);
  const before = h.json(`[...playNumbers().entries()]`);
  const total = before.length;
  // Clock shifts: nothing logged at H+0:00, the actual change otherwise.
  h.run(`playShiftClock(-5)`);
  assert.equal(h.run('playState().log.length'), 0, '−5 at H+0:00 is not logged');
  h.run(`playState().offset_min = 3; playShiftClock(-5)`);
  assert.ok(h.run('playState().log.at(-1).text').includes('−3 min → H+0'), h.run('playState().log.at(-1).text'));
  // Started: an inject added at H+0:20 takes the next number, the others keep theirs everywhere.
  h.run(`playToggle(); Object.assign(playState(), { running: false, run_since: null, offset_min: 20 }); playAddInject()`);
  const added = h.json(`appState.scenario.stimuli.find((item) => item.added_in_play)`);
  const after = new Map(h.json(`[...playNumbers().entries()]`));
  for (const [id, number] of before) assert.equal(after.get(id), number, 'numbers stay stable');
  assert.equal(after.get(added.id), total + 1);
  assert.equal(h.run(`ExerciseModel.of(appState.scenario).byStimulus.get('${added.id}').numberLabel`), `#${String(total + 1).padStart(2, '0')}`);
  assert.ok(h.run(`ExportEngine.filenameForStimulus(getStimulus('${added.id}'))`).startsWith(`${String(total + 1).padStart(2, '0')}_H+00-20_`));
  assert.ok(h.run('playState().log.at(-1).text').includes(`#${total + 1}`));
  // Blank, not the template's demo content.
  assert.equal(added.fields.subject, '[New inject]');
  assert.equal(added.fields.body, '');
  assert.ok(!JSON.stringify(added.fields).includes('Ransomware'));
  // Frozen numbers survive a reload; Reset play unfreezes them.
  assert.equal(h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario)))`).play.numbers[added.id], total + 1);
  h.run(`window.confirm = () => true; playResetAll()`);
  assert.equal(h.run('playState().numbers'), null);
  assert.ok(h.run(`playNumbers().get('${added.id}')`) < total + 1, 'back to play order after a reset');
  // A clock jump: one toast for every inject it brought, none for those already late.
  h.run(`globalThis.toasts = []; pushToast = (message) => toasts.push(message);
    Object.assign(playState(), { running: true, run_since: Date.now(), offset_min: 70 }); Object.assign(playUI(), { alertedAt: 60 });
    playTick(false); playTick(false)`); // the first tick logs the phase start
  const toasts = h.json('toasts');
  const fresh = h.json(`playItems().filter((item) => ['is-due', 'is-late'].includes(playTiming(item, 70)) && item.time > 58).length`);
  assert.ok(fresh > 1, `several injects between H+0:58 and H+1:10 (${fresh})`);
  assert.equal(toasts.length, 1);
  assert.ok(toasts[0].startsWith(`${fresh} injects to send now: #`), toasts[0]);
  assert.equal(h.run(`playItems().filter((item) => ['is-due', 'is-late'].includes(playTiming(item, 70))).every((item) => playUI().notified.has(item.key))`), true);
  // The end: complete, paused once, one log entry.
  h.run(`playState().offset_min = playDuration() + 0.5; playState().run_since = Date.now(); playTick(false)`);
  assert.equal(h.run('playState().running'), false);
  assert.equal(h.run('playState().log.at(-1).text'), 'Exercise time is over');
  h.run(`playToggle(); playTick(false)`);
  assert.equal(h.run('playState().running'), true, 'resuming after the end is allowed');
  assert.equal(h.run(`playState().log.filter((entry) => entry.type === 'end').length`), 1);
  assert.ok(h.run('renderPlayView()').includes('Exercise complete'));
});

test('check & challenge: one readiness verdict, the checker merged into Summary, the exercise file in Context', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.route = 'checker'`);
  // The old Checker tab is gone: its route opens Check & Challenge.
  assert.equal(h.run('viewConfig().title'), 'Check & Challenge');
  assert.equal(h.run('appState.route'), 'summary');
  const shell = h.run('renderAppShell()');
  assert.ok(/Check (&amp;|&) Challenge/.test(shell), 'nav renamed');
  assert.ok(!/data-route="checker"/.test(shell), 'no Checker button');

  // Readiness: live rules only, then the AI challenge and the checklist join in.
  let readiness = h.run(`ccReadiness(appState.scenario, ccRuleIssues(appState.scenario), tabUI('summary'))`);
  assert.equal(readiness.ai, null);
  assert.ok(readiness.structure >= 0 && readiness.structure <= 100);
  assert.notEqual(readiness.verdict, 'ready', 'never ready without an AI challenge');
  h.run(`appState.checkerState.mode = 'scenario'; appState.checkerState.analysisResult = { axes: [{ verdict: 'satisfactory' }, { verdict: 'insufficient' }] }; tabUI('summary').review = { score: 80, issues: [] }`);
  readiness = h.run(`ccReadiness(appState.scenario, ccRuleIssues(appState.scenario), tabUI('summary'))`);
  assert.equal(readiness.ai, 70, 'mean of the timing score (80) and the axes (60)');

  // No external file: the challenge audits the scenario, the file source is greyed.
  let view = h.run('renderSummaryView()');
  assert.ok(/data-mode="file" disabled/.test(view) && view.includes('data-route="scenario"'), 'points to Context to load a file');
  assert.ok(!view.includes('checker-dropzone'), 'no file loader in Check & Challenge');

  // Context hosts the exercise file loader.
  let context = h.run('renderScenarioView()');
  assert.ok(context.includes('Existing crisis exercise file') && context.includes('checker-dropzone is-compact'));
  h.run(`Object.assign(appState.checkerState, { file: { name: 'old-drill.xlsx' }, parsedData: { headers: ['Time', 'Sender', 'Content'], rows: [['09:00', 'CERT', 'Ransom note found on <b>file server</b>']] }, sheets: [], columnMapping: checkerAutoDetectColumns(['Time', 'Sender', 'Content']) })`);
  context = h.run('renderScenarioView()');
  assert.ok(context.includes('old-drill.xlsx') && context.includes('data-action="cc-challenge-file"') && context.includes('Preview and column mapping'));
  const objective = h.run('contextAgentObjective(appState.scenario)');
  assert.ok(objective.includes('old-drill.xlsx') && objective.includes('Ransom note found'), 'the agent gets the file as a reference');
  assert.ok(objective.length <= 7900);

  // Switching what to challenge keeps the result of each source.
  h.run(`checkerSwitchMode('file')`);
  assert.equal(h.run('appState.checkerState.analysisResult'), null);
  h.run(`appState.checkerState.analysisResult = { summary: 'file result', axes: [] }`);
  view = h.run('renderSummaryView()');
  assert.ok(view.includes('old-drill.xlsx') && !/data-mode="file" disabled/.test(view));
  h.run(`checkerSwitchMode('scenario')`);
  assert.equal(h.run('appState.checkerState.analysisResult.axes.length'), 2, 'scenario result restored');
  h.run(`checkerSwitchMode('file')`);
  assert.equal(h.run('appState.checkerState.analysisResult.summary'), 'file result');

  // Removing the file keeps the checklist (the project's) and the scenario challenge.
  h.run(`appState.scenario.checklist = { checked: { a_0: true }, customItems: {} }; checkerClearFile()`);
  assert.equal(h.run('appState.checkerState.mode'), 'scenario');
  assert.equal(h.run('appState.checkerState.parsedData'), null);
  assert.equal(h.run('checkerChecklist().checked.a_0'), true);
  assert.equal(h.run('appState.checkerState.analysisResult.axes.length'), 2);
});

test('update: a changed phase is re-planned, then its injects follow in cascade; actor and cell edits adapt the injects', async () => {
  const h = harness();
  h.run(`isLLMAvailable = () => true;
    { const project = appState.scenario; const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
      if (!project.cells.length) project.cells = sbNormalizeCells([{ name: 'Decision cell' }]);
      const cell = project.cells[0].id;
      sb.cast.push(sbMakeCast({ id: 'cast_ciso', label: 'CISO' }));
      sb.blocks.push(sbMakeBlock('trigger', { id: 'b1', track_id: main, start_minutes: 0, duration_minutes: 60, stimuli_target: 3, brief: 'EDR alerts on two servers', beats: [
        { id: 'k1', offset_minutes: 10, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: cell, title: 'One' },
        { id: 'k2', offset_minutes: 20, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: cell, title: 'Two' },
        { id: 'k3', offset_minutes: 30, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: cell, title: 'Three' }] }, sb));
      StoryboardHistory.ensure(); }`);
  h.run(`AITextGenerator.generateForStimulus = async (stimulus, field, guided) => ({ subject: guided.includes('edited by hand') ? 'Adapted' : 'Fresh ' + (stimulus.name || ''), body: '<p>Body</p>' });`);
  await h.run(`SbPipeline.run({ plan: false, cast: true, write: true })`);
  h.run(`sbSealLinks(appState.scenario)`);
  assert.deepEqual(h.json('sbComputeImpacts(appState.scenario).map(i => i.kind)'), [], 'up to date after generation');
  assert.equal(h.run('sbPendingSyncCount(appState.scenario)'), 0);

  // The designer rewrites what happens: the phase needs a new plan, its injects wait for it.
  h.run(`sbBlock(sbStoryboard(), 'b1').brief = 'Ransomware encrypts the file servers; the attacker calls the CEO'; StoryboardHistory.commit('Rewrite phase');`);
  const impacts = h.json('sbComputeImpacts(appState.scenario)');
  assert.deepEqual(impacts.map(i => [i.kind, i.action]), [['replan', 'replan']]);
  assert.equal(h.run('sbPendingSyncCount(appState.scenario)'), 1);
  const phaseEditor = h.run(`sbUI().selected = ['b1']; renderStorylineView()`);
  assert.ok(phaseEditor.includes('sl-replan') && phaseEditor.includes('still follow the previous version'));
  const [s1, s2, s3] = h.json('getSortedStimuli().map(s => s.id)');
  const calls = mockAI(h, [payload => ({ block: { brief: 'The AI must not change this', beats: [
    { id: 'k1', at: 5, channel: 'email_internal', cast: 'cast_ciso', title: 'Encrypted shares', intent: 'Files unreadable' },
    { id: 'k2', at: 20, channel: 'email_internal', cast: 'cast_ciso', title: 'Two' },
    { at: 40, channel: 'email_internal', cast: 'cast_ciso', cell: payload.context?.cells?.[0]?.id, title: 'Call from the attacker', intent: 'Pressure on the CEO' }] } })]);
  await h.run(`SbPipeline.applyImpacts(sbComputeImpacts(appState.scenario))`);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].payload.instruction.includes('rewrote what happens'));
  const block = h.json(`sbBlock(sbStoryboard(), 'b1')`);
  assert.equal(block.brief, 'Ransomware encrypts the file servers; the attacker calls the CEO', 'the designer text stays');
  assert.deepEqual(block.beats.map(b => b.title), ['Encrypted shares', 'Two', 'Call from the attacker']);
  const after = h.json('Object.fromEntries(appState.scenario.stimuli.map(s => [s.id, { at: s.timestamp_offset_minutes, subject: s.fields.subject, beat: s.scenario_link?.beat_id }]))');
  assert.equal(after[s1].at, 5, 'retimed by the new plan');
  assert.match(after[s1].subject, /^Fresh/, 'rewritten from the new plan');
  assert.ok(!after[s3], 'the inject of a dropped planned item is removed');
  assert.ok(after[s2], 'unchanged planned inject kept');
  const newBeat = block.beats.find(b => b.title === 'Call from the attacker').id;
  assert.ok(Object.values(after).some(item => item.beat === newBeat), 'the new planned inject is created and written');
  assert.deepEqual(h.json('sbComputeImpacts(appState.scenario).map(i => i.kind)'), [], 'everything up to date after the cascade');

  // Cells & actors: an actor renamed and a cell renamed adapt the injects concerned.
  h.run(`{ const s = getStimulus('${s2}'); getActor(s.actor_id).name = 'Dana Scully'; }`);
  let people = h.json('sbComputeImpacts(appState.scenario)');
  assert.ok(people.length >= 1 && people.every(i => i.kind === 'people' && i.action === 'adapt'));
  assert.match(people[0].detail, /sender changed \(Dana Scully\)/);
  h.run(`appState.scenario.cells[0].name = 'Executive crisis cell'`);
  people = h.json('sbComputeImpacts(appState.scenario)');
  assert.ok(people.some(i => /recipient cell changed \(Executive crisis cell\)/.test(i.detail)));
  const cells = h.run('renderCellsView()');
  assert.ok(cells.includes('ce-update has-changes') && cells.includes('data-sb-modal="sync"'), 'Update on Cells & actors');
  await h.run(`SbPipeline.applyImpacts(sbComputeImpacts(appState.scenario))`);
  assert.deepEqual(h.json('sbComputeImpacts(appState.scenario).map(i => i.kind)'), []);
  assert.ok(h.run('renderDetailedView()').includes('data-sb-modal="sync"'), 'Update on Detailed storyline');
});

test('exercise model: one pivot, the same phase, number, cell, sender and statuses in every tab', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  const model = h.json(`(() => { const m = ExerciseModel.of(appState.scenario); return { phases: m.phases.length, injects: m.injects.length, written: m.written.length, planned: m.planned.length, total: m.total, stimuli: appState.scenario.stimuli.length }; })()`);
  assert.equal(model.written, model.stimuli);
  assert.equal(model.total, model.stimuli);
  assert.equal(model.injects, model.written + model.planned);
  assert.ok(model.phases >= 3);
  assert.ok(h.run('ExerciseModel.DEPENDENCIES.length') >= 5 && h.run(`ExerciseModel.DEPENDENCIES.some(d => d.tracked_by === 'block.plan_hash')`));

  // A written inject linked to phase 1 but timed inside phase 2: every view says phase 1.
  const probe = h.json(`(() => {
    const project = appState.scenario;
    const [p1, p2] = sbMainBlocks(project.storyboard);
    const stimulus = getSortedStimuli().find(s => s.scenario_link?.block_id === p1.id);
    stimulus.timestamp_offset_minutes = p2.start_minutes + 1;
    const inject = ExerciseModel.of(project).byStimulus.get(stimulus.id);
    const play = playItems(project).find(item => item.stimulus?.id === stimulus.id);
    const csv = ExportEngine.chronogramCsv(getSortedStimuli());
    const line = csv.split('\\r\\n').find(row => row.includes(sbStimulusLabel(stimulus).replace(/"/g, '""')));
    const serialized = checkerSerializeScenario().serialized;
    return { p1: p1.title, model: inject.phase.title, library: libraryPhaseOf(stimulus).title, play: play.phase.title, csv: line.includes('"' + p1.title + '"'),
      checker: serialized.split('\\n').some(row => row.includes(p1.title) && row.includes(sbStimulusLabel(stimulus).slice(0, 20))),
      number: inject.number, playNumber: play.number, prefix: ExportEngine.playPrefix(stimulus).split('_')[0], label: inject.numberLabel,
      run: inject.run, sync: inject.sync, sender: inject.sender, actor: getActor(stimulus.actor_id).name, cell: inject.cell_id === stimulus.cell_id };
  })()`);
  assert.equal(probe.model, probe.p1);
  assert.equal(probe.library, probe.p1);
  assert.equal(probe.play, probe.p1);
  assert.ok(probe.csv, 'chronogram CSV uses the same phase');
  assert.ok(probe.checker, 'the Checker uses the storyline phases');
  assert.equal(probe.playNumber, probe.number);
  assert.equal(Number(probe.prefix), probe.number, 'ZIP file names use the same number');
  assert.match(probe.label, /^#\d{2,}$/);
  assert.ok(['draft', 'ready', 'sent'].includes(probe.run));
  assert.ok(['synced', 'retime', 'outdated', 'manual', 'locked', 'unlinked', 'orphan'].includes(probe.sync));
  assert.equal(probe.sender, probe.actor, 'a written inject shows the actor who signs it');
  assert.ok(probe.cell);

  // Planned injects: no number, run status "planned", the role as sender.
  const planned = h.json(`(() => { const p = ExerciseModel.of(appState.scenario).planned[0]; return p ? { number: p.number, run: p.run, sync: p.sync, sender: p.sender, role: p.role } : null; })()`);
  if (planned) {
    assert.equal(planned.number, null);
    assert.equal(planned.run, 'planned');
    assert.equal(planned.sync, 'planned');
    assert.equal(planned.sender, planned.role);
  }
  // The agent consistency check catches an inject outside every phase.
  h.run(`getSortedStimuli()[0].timestamp_offset_minutes = sbStoryboard().duration_minutes + 500;`);
  assert.ok(h.json(`agentConsistencyCheck ? agentConsistencyCheck().issues : []`).some(issue => /outside every phase/.test(issue)));
});

test('audit regressions: safe loading, CSV, debrief theme, duplicates, agent fields, locked injects', async () => {
  const h = harness();
  // A shared project cannot smuggle markup through ids; injects follow a renamed actor.
  const loaded = h.json(`(() => {
    const p = mergeScenario({ scenario: { summary: 'x' }, actors: [{ id: 'a"><img src=x onerror=alert(1)>', name: 'Eve', role: '<b>' }], stimuli: [{ id: '"><svg onload=alert(2)>', actor_id: 'a"><img src=x onerror=alert(1)>', channel: 'x" onmouseover="y', status: '<i>' }] });
    return { actorId: p.actors[0].id, role: p.actors[0].role, stimulusId: p.stimuli[0].id, actorOfStimulus: p.stimuli[0].actor_id, channel: p.stimuli[0].channel, status: p.stimuli[0].status };
  })()`);
  for (const value of Object.values(loaded)) assert.match(value, /^[A-Za-z0-9_-]+$/, value);
  assert.equal(loaded.actorOfStimulus, loaded.actorId, 'the inject follows its renamed actor');
  assert.equal(loaded.status, 'draft');
  // A file without actors or injects never gets the demo's.
  assert.deepEqual(h.json(`(() => { const p = mergeScenario({ scenario: {} }); return [p.actors.length, p.stimuli.length]; })()`), [0, 0]);
  // CSV cells cannot start a formula in Excel.
  assert.equal(h.run(`csvCell('=HYPERLINK("x")')`), `"'=HYPERLINK(""x"")"`);
  assert.equal(h.run(`csvCell('@StonaWave')`), `"'@StonaWave"`);
  assert.equal(h.run(`csvCell('Plain')`), '"Plain"');
  // The debrief theme cannot break out of the exported page's <style>.
  const theme = h.json(`debriefSafeTheme({ bg: 'red;}</style><script>alert(1)</script>', fontBody: 'Inter"</style>', accent: '#04F06A', preset: 'x' }, makeEmptyDebrief(appState.scenario).theme)`);
  assert.ok(!JSON.stringify(theme).includes('<'), JSON.stringify(theme));
  assert.equal(theme.accent, '#04F06A');
  assert.equal(theme.preset, 'wavestone', 'Wavestone by default');
  // Agent content: list fields and numbers given as text are accepted.
  const clean = h.json(`(() => { const s = makeStimulus('dark_web_forum', appState.scenario.actors[0]?.id || 'a', 0); return agentCleanFields(s, { files: ['hr.csv', { name: 'ids.zip', size: '2 GB' }], replies_count: '47' }); })()`);
  assert.deepEqual(clean.files, ['hr.csv', { name: 'ids.zip', size: '2 GB' }]);
  assert.equal(clean.replies_count, 47);
  // A duplicated inject is its own inject: visible, not tied to the original's planned item.
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  const dup = h.json(`(() => { const s = appState.scenario.stimuli.find(x => x.scenario_link?.beat_id); const before = sbExerciseItems(appState.scenario).length; duplicateStimulus(s.id); const copy = appState.scenario.stimuli[appState.scenario.stimuli.length - 1]; return { before, after: sbExerciseItems(appState.scenario).length, linked: !!copy.scenario_link }; })()`);
  assert.equal(dup.after, dup.before + 1);
  assert.equal(dup.linked, false);
});

test('audit regressions: the cascade never deletes a locked inject and keeps skipped new injects out', async () => {
  const h = harness();
  h.run(`isLLMAvailable = () => true;
    { const project = appState.scenario; const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
      if (!project.cells.length) project.cells = sbNormalizeCells([{ name: 'Decision cell' }]);
      const cell = project.cells[0].id;
      sb.cast.push(sbMakeCast({ id: 'cast_ciso', label: 'CISO' }));
      sb.blocks.push(sbMakeBlock('trigger', { id: 'b1', track_id: main, start_minutes: 0, duration_minutes: 60, stimuli_target: 2, brief: 'Alerts', beats: [
        { id: 'k1', offset_minutes: 10, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: cell, title: 'One' },
        { id: 'k2', offset_minutes: 20, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: cell, title: 'Two' }] }, sb));
      StoryboardHistory.ensure(); }`);
  h.run(`AITextGenerator.generateForStimulus = async (stimulus) => ({ subject: 'Fresh ' + (stimulus.name || ''), body: '<p>Body</p>' });`);
  await h.run(`SbPipeline.run({ plan: false, cast: true, write: true })`);
  h.run(`sbSealLinks(appState.scenario)`);
  const [s1, s2] = h.json('getSortedStimuli().map(s => s.id)');
  h.run(`sbLockStimulus(getStimulus('${s2}'), true); sbBlock(sbStoryboard(), 'b1').brief = 'Ransomware everywhere'; StoryboardHistory.commit('Rewrite');`);
  // The AI keeps k1 only and adds one new planned inject.
  mockAI(h, [() => ({ block: { beats: [{ id: 'k1', at: 5, channel: 'email_internal', cast: 'cast_ciso', title: 'One v2' }, { at: 30, channel: 'email_internal', cast: 'cast_ciso', title: 'New one' }] } })]);
  // The new planned inject is skipped in the dialog: it must not be created.
  const impacts = h.json('sbComputeImpacts(appState.scenario)');
  await h.run(`(async () => {
    const first = sbComputeImpacts(appState.scenario);
    await SbPipeline.applyImpacts(first);
  })()`);
  const ids = h.json('appState.scenario.stimuli.map(s => s.id)');
  assert.ok(ids.includes(s2), 'the locked inject of a dropped planned item is kept');
  assert.ok(impacts.some(i => i.kind === 'replan'));
  assert.deepEqual(h.json('sbComputeImpacts(appState.scenario).map(i => i.kind)').filter(k => k !== 'orphan'), [], 'the rest is up to date');
  // Two new planned injects; the second is skipped in the dialog: only the first is created.
  h.run(`{ const b = sbBlock(sbStoryboard(), 'b1'); b.beats.push(sbMakeBeat({ id: 'k8', offset_minutes: 40, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: appState.scenario.cells[0].id, title: 'Eight' }), sbMakeBeat({ id: 'k9', offset_minutes: 50, channel: 'email_internal', cast_id: 'cast_ciso', cell_id: appState.scenario.cells[0].id, title: 'Nine' })); sbMarkPlanned(b); StoryboardHistory.commit('Add'); }`);
  await h.run(`(async () => { const list = sbComputeImpacts(appState.scenario).filter(i => i.kind === 'missing'); list.find(i => i.beat_id === 'k9').action = 'skip'; await SbPipeline.applyImpacts(list); })()`);
  const created = h.json(`['k8', 'k9'].map(id => !!sbStimulusForBeat(appState.scenario, id))`);
  assert.deepEqual(created, [true, false]);
});

test('Context duration reads h:min, minutes or hours', () => {
  const h = harness();
  const read = text => h.run(`sbParseDuration(${JSON.stringify(text)})`);
  assert.equal(read('0:45'), 45);
  assert.equal(read('1:30'), 90);
  assert.equal(read('1h30'), 90);
  assert.equal(read('3h'), 180);
  assert.equal(read('45 min'), 45);
  assert.equal(read('3'), 180);
  assert.equal(read('2,5'), 150);
  assert.equal(read('1:75'), null);
  assert.equal(read('soon'), null);
  assert.equal(h.run('sbFormatHoursMinutes(45)'), '0:45');
  assert.equal(h.run('sbFormatHoursMinutes(180)'), '3:00');
});

test('main events: a line of text at a time in each phase, framing the AI plans and the injects', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.route = 'storyline';`);
  const blockId = h.run('sbMainBlocks(sbStoryboard())[1].id');
  const event = h.json(`(() => { const block = sbBlock(sbStoryboard(), '${blockId}'); const event = sbMakeEvent({ offset_minutes: 10, text: 'The ransom note appears on every screen' }); block.events.push(event); return event; })()`);
  // The phase editor: name and settings, "What happens", then the main events.
  h.run(`sbUI().selected = ['${blockId}']`);
  const view = h.run('renderStorylineView()');
  assert.ok(view.includes('Main events') && view.includes(`data-sl-event="${event.id}.text"`) && view.includes('The ransom note appears on every screen'));
  assert.ok(view.indexOf('data-sb-field="brief"') < view.indexOf(`data-sl-event="${event.id}.text"`), 'what happens, then the main events');
  assert.ok(view.includes('sb-key-card') && !view.includes('Key stimuli'), 'shown under the phases');
  // Saved, exported with templates, and given to the AI with their time.
  const reloaded = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).storyboard.blocks.find((block) => block.id === '${blockId}').events`);
  assert.ok(reloaded.some((item) => item.text === 'The ransom note appears on every screen'));
  assert.ok(h.json(`sbAIContext(appState.scenario).storyboard.blocks.find((block) => block.id === '${blockId}').key_events`).some((item) => item.at === 10 && item.text.includes('ransom note appears')));
  // Writing an inject: events before its time have happened, later ones are not revealed.
  const early = h.run(`(() => { const block = sbBlock(sbStoryboard(), '${blockId}'); return sbGenerationBrief(appState.scenario, block, sbMakeBeat({ offset_minutes: 2, title: 'x' }), {}); })()`);
  const late = h.run(`(() => { const block = sbBlock(sbStoryboard(), '${blockId}'); return sbGenerationBrief(appState.scenario, block, sbMakeBeat({ offset_minutes: 20, title: 'x' }), {}); })()`);
  assert.ok(/still to come[^\n]*ransom note/.test(early) && !/already happened[^\n]*ransom note/.test(early));
  assert.ok(/already happened[^\n]*ransom note/.test(late));
  // An AI re-plan never touches them.
  mockAI(h, [{ block: { beats: [{ at: 3, channel: 'email_internal', cast: '', title: 'New planned inject', intent: 'x' }] } }]);
  h.run(`Object.assign(appState.scenario.settings, { ai_provider: 'openai', ai_api_key: 'TEST', ai_model: 'gpt-test' })`);
  await h.run(`SbAI.rewrite('${blockId}', 'Replan')`);
  assert.ok(h.json(`sbBlock(sbStoryboard(), '${blockId}').events`).some((item) => item.id === event.id));
  // Older projects: planned injects marked "main" become main events, the injects stay.
  const legacy = h.json(`normalizeStoryboard({ ...JSON.parse(JSON.stringify(sbStoryboard())), blocks: [{ id: 'b_old', type: 'trigger', title: 'Old', start_minutes: 0, duration_minutes: 30, beats: [{ id: 'beat_old', at: 5, channel: 'breaking_news_tv', title: 'TV flash', intent: 'Hospitals hit', main: true }] }] }).blocks[0]`);
  assert.equal(legacy.events[0].text, 'TV flash — Hospitals hit');
  assert.equal(legacy.beats.length, 1);
});

test('phase colour follows its stress level: from the type by default, or set in the phase editor', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  assert.equal(h.run(`sbBlockColor(sbMakeBlock('exit'))`), h.run('sbStressLevel(1).color'), 'exit: calm green');
  assert.equal(h.run(`sbBlockColor(sbMakeBlock('twist'))`), h.run('sbStressLevel(5).color'), 'escalation: peak red');
  const id = h.run('sbMainBlocks(sbStoryboard())[0].id');
  h.run(`sbBlock(sbStoryboard(), '${id}').stress = 5; sbUI().selected = ['${id}']`);
  assert.equal(h.run(`sbBlockColor(sbBlock(sbStoryboard(), '${id}'))`), h.run('sbStressLevel(5).color'));
  assert.ok(h.run('renderStorylineView()').includes('data-sb-field="stress"'));
  assert.equal(h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).storyboard.blocks.find((block) => block.id === '${id}').stress`), 5);
  assert.equal(h.json(`sbAIContext(appState.scenario).storyboard.blocks.find((block) => block.id === '${id}').stress`), 'Peak');
});

test('recipients: an inject goes to one cell, several cells or all cells', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  const cells = h.json('appState.scenario.cells.map((cell) => cell.id)');
  const two = h.run(`sbJoinRecipients(appState.scenario, ['${cells[2]}', '${cells[0]}'])`);
  assert.equal(two, `${cells[0]}+${cells[2]}`, 'kept in the project order');
  assert.ok(h.run(`sbReaches('${two}', '${cells[0]}') && sbReaches('${two}', '${cells[2]}') && !sbReaches('${two}', '${cells[1]}')`));
  assert.ok(h.run(`sbHasRecipient(appState.scenario, '${two}')`));
  assert.ok(h.run(`sbRecipientName(appState.scenario, '${two}')`).includes(' + '));
  // A planned inject sent to two cells: a card in both rows, saved and reloaded as is.
  const item = h.json(`(() => { const item = sbExerciseItems(appState.scenario).find((entry) => entry.kind === 'beat'); dsMoveItem(appState.scenario, item, item.time, '${two}'); return { key: item.key, id: item.beat.id }; })()`);
  const detailed = h.run(`(() => { tabUI('detailed').cell = 'all'; return renderDetailedView(); })()`);
  assert.equal((detailed.match(new RegExp(`data-ds-item="${item.key}"`, 'g')) || []).length, 2);
  const reloaded = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).storyboard.blocks.flatMap((block) => block.beats).find((beat) => beat.id === '${item.id}').cell_id`);
  assert.equal(reloaded, two);
  assert.ok(!h.json('sbExerciseChecks(appState.scenario)').some((issue) => issue.code === 'no_cell' && issue.item_key === item.key));
  assert.ok(h.run(`ExerciseModel.cellById(appState.scenario, '${two}').name`).includes(' + '));
});

test('inject editor: the phase it belongs to and the cells that receive it', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  const stimulus = h.json('appState.scenario.stimuli.find((item) => item.scenario_link?.beat_id)');
  const html = h.run(`renderStimulusLinks(appState.scenario, getStimulus('${stimulus.id}'))`);
  assert.ok(html.includes(`data-stimulus-phase="${stimulus.id}"`) && html.includes(`data-rcpt="beat:${stimulus.scenario_link.beat_id}"`) && html.includes('All cells'));
  const manual = h.run(`(() => { const s = makeStimulus('email_internal', appState.scenario.actors[0].id, 5); appState.scenario.stimuli.push(s); return s.id; })()`);
  assert.ok(h.run(`renderStimulusLinks(appState.scenario, getStimulus('${manual}'))`).includes(`data-rcpt="stim:${manual}"`));
});

test('evaluation: one sheet per cell, default criteria by type, editable, saved, exported to Excel', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.scenario.evaluation = normalizeEvaluation(null);`);
  const cells = h.json('appState.scenario.cells.map((cell) => ({ id: cell.id, key: cell.key, name: cell.name }))');
  const legal = cells.find((cell) => cell.key === 'legal');
  const sheet = h.json(`evSheet(appState.scenario, sbCell(appState.scenario, '${legal.id}'))`);
  assert.equal(sheet.isDefault, true);
  assert.ok(sheet.criteria.some((item) => item.text.includes('Regulatory obligations')) && sheet.criteria.some((item) => item.category === 'Mobilisation'));
  const view = h.run(`(() => { appState.route = 'evaluation'; return renderEvaluationView(); })()`);
  for (const cell of cells) assert.ok(view.includes(escapeForTest(cell.name)), cell.name);
  assert.ok(view.includes('data-ev-action="download-all"') && view.includes('data-ev-field='));
  // Edited: the sheet is kept with the project and survives a reload.
  h.run(`(() => { const sheet = evEditableSheet(appState.scenario, sbCell(appState.scenario, '${legal.id}')); sheet.criteria.push({ id: 'crit_custom', category: 'Sector', text: 'Notify the health regulator', observe: 'Within 24 h' }); })()`);
  const reloaded = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).evaluation.sheets['${legal.id}'].criteria.map((item) => item.text)`);
  assert.ok(reloaded.includes('Notify the health regulator'));
  // Excel rows: criteria, then every inject the cell receives with the reaction expected.
  const rows = h.json(`evSheetRows(appState.scenario, sbCell(appState.scenario, '${legal.id}'))`);
  assert.ok(rows.some((row) => row[1] === 'Notify the health regulator'));
  const received = h.json(`evReceivedInjects(appState.scenario, sbCell(appState.scenario, '${legal.id}')).length`);
  const start = rows.findIndex((row) => row[0] === 'Injects received');
  assert.ok(received > 0 && rows.slice(start + 2).filter((row) => /^H\+/.test(row[0] || '')).length === received);
  // Marks: a rating and notes per criterion, a rating and the reaction per inject received.
  const critId = h.run(`evSheet(appState.scenario, sbCell(appState.scenario, '${legal.id}')).criteria[0].id`);
  const injectKey = h.run(`evInjectKey(evReceivedInjects(appState.scenario, sbCell(appState.scenario, '${legal.id}'))[0])`);
  assert.equal(h.run(`evApplyField(appState.scenario, '${legal.id}|crit|${critId}|rating', 'M')`), true);
  h.run(`evApplyField(appState.scenario, '${legal.id}|crit|${critId}|notes', 'Late notification draft')`);
  h.run(`evApplyField(appState.scenario, '${legal.id}|inject|${injectKey}|rating', 'P')`);
  h.run(`evApplyField(appState.scenario, '${legal.id}|inject|${injectKey}|observed', 'Called the DPO at once')`);
  h.run(`evApplyField(appState.scenario, '${legal.id}|crit|${critId}|rating', 'X')`);
  assert.equal(h.run(`evSheet(appState.scenario, sbCell(appState.scenario, '${legal.id}')).criteria[0].rating`), '', 'only P/S/M/U/N/A');
  h.run(`evApplyField(appState.scenario, '${legal.id}|crit|${critId}|rating', 'M'); evApplyField(appState.scenario, '${legal.id}|sheet|strengths|x', 'ignored'); evApplyField(appState.scenario, '${legal.id}|sheet|strengths', 'Calm')`);
  const saved = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).evaluation.sheets['${legal.id}']`);
  assert.equal(saved.criteria[0].rating, 'M');
  assert.equal(saved.criteria[0].notes, 'Late notification draft');
  assert.equal(saved.injects[injectKey].rating, 'P');
  assert.equal(saved.strengths, 'Calm');
  const tally = h.json(`evTally(appState.scenario, sbCell(appState.scenario, '${legal.id}'))`);
  assert.equal(tally.counts.M, 1); assert.equal(tally.counts.P, 1); assert.equal(tally.rated, 2);
  const marked = h.json(`evSheetRows(appState.scenario, sbCell(appState.scenario, '${legal.id}'))`);
  assert.ok(marked.some((row) => row[3] === 'M' && row[4] === 'Late notification draft'));
  assert.ok(marked.some((row) => row[4] === 'Called the DPO at once' && row[6] === 'P'));
  h.run(`evUI().cell = '${legal.id}'`);
  const marksView = h.run('renderEvaluationView()');
  assert.ok(marksView.includes('class="ev-rating is-M"') && marksView.includes('data-ev-action="ai-update"') && marksView.includes('Called the DPO at once'));
});

test('evaluation: Update with AI adapts every sheet to the scenario, keeping the marks of unchanged criteria', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); Object.assign(appState.scenario.settings, { ai_provider: 'openai', ai_api_key: 'TEST', ai_model: 'gpt-test' }); window.confirm = () => true;`);
  const cells = h.json('appState.scenario.cells.map((cell) => cell.id)');
  const kept = h.run(`evSheet(appState.scenario, appState.scenario.cells[0]).criteria[0].text`);
  const critId = h.run(`evSheet(appState.scenario, appState.scenario.cells[0]).criteria[0].id`);
  h.run(`evApplyField(appState.scenario, '${cells[0]}|crit|${critId}|rating', 'S')`);
  const calls = mockAI(h, [(payload) => ({ criteria: [{ category: 'Mobilisation', text: payload.current_criteria[0].text, observe: 'x' }, { category: 'Ransom', text: `Ransom stance for ${payload.cell.name}`, observe: 'Decision before the leak countdown' }] })]);
  await h.run('EvAI.updateAll(appState.scenario)');
  assert.equal(calls.length, cells.length, 'one request per cell');
  assert.ok(calls[0].payload.learning_objectives !== undefined && calls[0].payload.phases.length && calls[0].payload.injects_received.length);
  assert.ok(calls[0].payload.phases.some((phase) => phase.main_events.length), 'main events given with their time');
  const sheet = h.json(`evSheet(appState.scenario, appState.scenario.cells[0])`);
  assert.equal(sheet.criteria.length, 2);
  assert.equal(sheet.criteria[0].text, kept);
  assert.equal(sheet.criteria[0].rating, 'S', 'mark kept on an unchanged criterion');
  assert.ok(sheet.adapted_at);
});
function escapeForTest(text) { return String(text).replace(/&/g, '&amp;'); }

test('debrief: one tab with three parts; the slide deck shows the timeline, the phases, the evaluation and the debrief messages', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.scenario.evaluation = normalizeEvaluation(null); appState.scenario.slide_debrief = normalizeSlideDebrief(null); appState.route = 'debrief';`);
  const hub = h.run('renderDebriefView()');
  for (const part of ['slides', 'story', 'video']) assert.ok(hub.includes(`data-db-part="${part}"`), part);
  assert.ok(hub.includes('data-sd-action="download"') && hub.includes('sd-grid'), 'slide debrief by default');
  h.run(`appState.ui.debriefPart = 'story'`);
  assert.ok(h.run('renderDebriefView()').includes('debrief-editor-frame'));
  h.run(`appState.ui.debriefPart = 'video'`);
  assert.ok(h.run('renderDebriefView()').includes('id="video-debrief-slot"'));
  h.run(`appState.ui.debriefPart = 'slides'`);
  const phases = h.run('sbMainBlocks(sbStoryboard()).length');
  let kinds = h.json('sdSlides(appState.scenario).map((slide) => slide.kind)');
  assert.equal(kinds[0], 'title');
  assert.equal(kinds[kinds.length - 1], 'end');
  assert.ok(kinds.includes('overview') && kinds.includes('timeline') && kinds.includes('evaluation'));
  assert.equal(h.json('sdSlides(appState.scenario).filter((slide) => slide.kind === "phase" && !slide.continued).length'), phases, 'one slide per phase, plus continuation slides');
  const timeline = h.json(`sdSlides(appState.scenario).find((slide) => slide.kind === 'timeline')`);
  assert.equal(timeline.phases.length, phases);
  assert.ok(timeline.events.length > 0, 'main events on the timeline');
  // The debrief messages: written by the AI from the exercise and the evaluation marks.
  const cell = h.run('appState.scenario.cells[0].id');
  h.run(`evApplyField(appState.scenario, '${cell}|crit|crit_default_1|rating', 'U'); evApplyField(appState.scenario, '${cell}|sheet|strengths', 'Clear leadership')`);
  h.run(`Object.assign(appState.scenario.settings, { ai_provider: 'openai', ai_api_key: 'TEST', ai_model: 'gpt-test' }); window.confirm = () => true;`);
  const calls = mockAI(h, [{ key_messages: ['Isolate early', 'One voice outside'], went_well: ['Fast mobilisation'], to_improve: ['Late regulator notification'], recommendations: ['Write a GDPR notification template (DPO, 1 month)'], next_steps: ['Action plan review'] }]);
  await h.run('SdAI.write(appState.scenario)');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].payload.evaluation[0].criteria.some((line) => line.startsWith('U')) && calls[0].payload.evaluation[0].strengths === 'Clear leadership');
  assert.ok(calls[0].payload.phases.some((phase) => phase.main_events.length));
  assert.equal(h.run('appState.scenario.slide_debrief.key_messages'), 'Isolate early\nOne voice outside');
  // A render during the call that replaces the debrief object (a reload, a merge) does not lose the answer.
  h.run(`var renderBefore = App.render; App.render = () => { appState.scenario.slide_debrief = JSON.parse(JSON.stringify(appState.scenario.slide_debrief)); };`);
  mockAI(h, [{ key_messages: ['Decide the isolation by 10:00'], went_well: ['Shared picture'], to_improve: ['Ransom stance'], recommendations: ['Write a GDPR notification template (DPO, 1 month)'], next_steps: ['Review'] }]);
  await h.run('SdAI.write(appState.scenario)');
  assert.equal(h.run('appState.scenario.slide_debrief.key_messages'), 'Decide the isolation by 10:00');
  h.run('App.render = renderBefore');
  kinds = h.json('sdSlides(appState.scenario).map((slide) => slide.kind)');
  assert.ok(kinds.includes('bullets') && kinds.filter((kind) => kind === 'columns').length === 2 && kinds.includes('cells'));
  // Sections can be left out; everything is saved with the project.
  h.run(`appState.scenario.slide_debrief.sections.phases = false`);
  assert.equal(h.json('sdSlides(appState.scenario).filter((slide) => slide.kind === "phase").length'), 0);
  const saved = h.json('mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).slide_debrief');
  assert.equal(saved.sections.phases, false);
  assert.ok(saved.recommendations.includes('GDPR'));
});

test('cells: a deleted cell stays deleted after reload, injects for several cells keep the others, undo brings it back', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); var lastConfirm = ''; window.confirm = (text) => { lastConfirm = text; return true; };`);
  const cells = h.json('appState.scenario.cells.map((cell) => cell.id)');
  const [first, target] = cells;
  // One written inject goes to the first cell and to the cell deleted below.
  const multi = h.json(`(() => { const item = sbExerciseItems(appState.scenario).find((entry) => entry.kind === 'beat' && entry.stimulus && entry.cell_id === '${first}'); dsMoveItem(appState.scenario, item, item.time, sbJoinRecipients(appState.scenario, ['${first}', '${target}'])); return { beat: item.beat.id, stimulus: item.stimulus.id }; })()`);
  const alone = h.json(`sbExerciseItems(appState.scenario).filter((item) => item.cell_id === '${target}').map((item) => item.key)`);
  assert.ok(alone.length > 0);
  const recipients = () => h.json(`[...appState.scenario.storyboard.blocks.flatMap((block) => block.beats.map((beat) => beat.cell_id)), ...appState.scenario.stimuli.map((stimulus) => stimulus.cell_id)]`);
  const beatCell = (id) => h.run(`appState.scenario.storyboard.blocks.flatMap((block) => block.beats).find((beat) => beat.id === '${id}').cell_id`);
  const before = recipients();
  const shared = h.json(`sbExerciseItems(appState.scenario).filter((item) => item.cell_id !== '${target}' && sbRecipientIds(item.cell_id).includes('${target}')).map((item) => item.key)`);
  await h.run(`tabHandleAction({ currentTarget: { dataset: { tabAction: 'delete-cell', tabValue: '${target}' } } })`);
  const message = h.run('lastConfirm');
  assert.ok(message.includes(`It receives ${alone.length + shared.length} inject(s)`), message);
  assert.ok(message.includes(`${alone.length} become unassigned`) && message.includes(`${shared.length} keep their other recipient cells`), message);
  assert.deepEqual(h.json('appState.scenario.cells.map((cell) => cell.id)'), cells.filter((id) => id !== target));
  assert.ok(!recipients().some((value) => value.split('+').includes(target)), 'no reference to the deleted cell is left');
  assert.equal(beatCell(multi.beat), first);
  assert.equal(h.run(`getStimulus('${multi.stimulus}').cell_id`), first);
  const flagged = h.json(`sbExerciseChecks(appState.scenario).filter((issue) => issue.code === 'no_cell').map((issue) => issue.item_key)`);
  for (const key of alone) assert.ok(flagged.includes(key), `${key} is flagged without recipient`);
  // Reloaded: the cell is not recreated, the cells keep their order, unassigned injects stay so.
  const unassigned = h.run(`appState.scenario.storyboard.blocks.flatMap((block) => block.beats).filter((beat) => !beat.cell_id).length`);
  assert.ok(unassigned > 0);
  const reloaded = h.json(`(() => { const p = mergeScenario(JSON.parse(JSON.stringify(appState.scenario))); return { cells: p.cells.map((cell) => cell.id), unassigned: p.storyboard.blocks.flatMap((block) => block.beats).filter((beat) => !beat.cell_id).length }; })()`);
  assert.deepEqual(reloaded, { cells: cells.filter((id) => id !== target), unassigned });
  // One undo restores the cell (in its place) and every recipient; redo deletes it again.
  assert.equal(h.run('StoryboardHistory.undo()'), 'Delete cell');
  assert.deepEqual(h.json('appState.scenario.cells.map((cell) => cell.id)'), cells);
  assert.equal(h.run('appState.scenario.exercise.cells_count'), cells.length);
  assert.deepEqual(recipients(), before);
  assert.equal(h.run('StoryboardHistory.redo()'), 'Delete cell');
  assert.deepEqual(h.json('appState.scenario.cells.map((cell) => cell.id)'), cells.filter((id) => id !== target));
  assert.equal(h.run(`getStimulus('${multi.stimulus}').cell_id`), first);
  // A project from before cells still gets its recipients on load.
  const legacy = h.json(`mergeScenario({ name: 'Old', storyboard: { blocks: [{ id: 'a', type: 'trigger', start_minutes: 0, duration_minutes: 60, beats: [{ id: 'x', offset_minutes: 5, channel: 'article_press', title: 'Press' }] }] }, actors: [], stimuli: [] })`);
  assert.equal(legacy.storyboard.blocks[0].beats[0].cell_id, legacy.cells.find((cell) => cell.key === 'communication').id);
});

test('history: moving or deleting an inject undoes its written inject too, keeping only what changed', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); window.confirm = () => true;`);
  const item = h.json(`(() => { const item = sbExerciseItems(appState.scenario).find((entry) => entry.kind === 'beat' && entry.stimulus); return { key: item.key, time: item.time, stimulus: item.stimulus.id }; })()`);
  const stimulusJson = () => h.run(`JSON.stringify(getStimulus('${item.stimulus}'))`);
  const original = stimulusJson();
  h.run(`dsMoveItem(appState.scenario, tabItemByKey(appState.scenario, '${item.key}'), ${item.time + 20}, undefined)`);
  assert.equal(h.run(`getStimulus('${item.stimulus}').timestamp_offset_minutes`), item.time + 20);
  const side = h.json('StoryboardHistory.undoStack[StoryboardHistory.undoStack.length - 1].side');
  assert.deepEqual(Object.keys(side), ['stimuli']);
  assert.equal(side.stimuli.changed.length, 1, 'only the moved inject is kept in the undo step');
  assert.equal(h.run('StoryboardHistory.undo()'), 'Move inject');
  assert.equal(h.run(`getStimulus('${item.stimulus}').timestamp_offset_minutes`), item.time);
  assert.equal(h.run(`tabItemByKey(appState.scenario, '${item.key}').time`), item.time);
  assert.equal(stimulusJson(), original);
  assert.equal(h.run('StoryboardHistory.redo()'), 'Move inject');
  assert.equal(h.run(`getStimulus('${item.stimulus}').timestamp_offset_minutes`), item.time + 20);
  h.run('StoryboardHistory.undo()');
  // Deleting the planned inject deletes its written inject: one undo brings both back.
  const count = h.run('appState.scenario.stimuli.length');
  h.run(`tabUI('detailed').selected = '${item.key}'; dsDeleteSelected(appState.scenario);`);
  assert.equal(h.run('appState.scenario.stimuli.length'), count - 1);
  assert.equal(h.run(`!!tabItemByKey(appState.scenario, '${item.key}')`), false);
  assert.equal(h.run('StoryboardHistory.undo()'), 'Delete inject');
  assert.equal(h.run('appState.scenario.stimuli.length'), count);
  assert.equal(stimulusJson(), original);
  assert.equal(h.run(`tabItemByKey(appState.scenario, '${item.key}').stimulus.id`), item.stimulus);
  // An inject edited outside the history is not reverted by undoing another step.
  const other = h.run(`appState.scenario.stimuli.find((stimulus) => stimulus.id !== '${item.stimulus}').id`);
  h.run(`dsMoveItem(appState.scenario, tabItemByKey(appState.scenario, '${item.key}'), ${item.time + 5}, undefined); getStimulus('${other}').name = 'Kept';`);
  h.run('StoryboardHistory.undo()');
  assert.equal(h.run(`getStimulus('${other}').name`), 'Kept');
});

test('actors: deleting an actor asks first, leaves its injects without sender, unlinks its roles and is undoable', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); var lastConfirm = ''; var answer = false; window.confirm = (text) => { lastConfirm = text; return answer; };`);
  const actor = h.json(`(() => { const cast = appState.scenario.storyboard.cast.find((item) => item.actor_id && appState.scenario.stimuli.some((s) => s.actor_id === item.actor_id)); return { id: cast.actor_id, cast: cast.id, sent: appState.scenario.stimuli.filter((s) => s.actor_id === cast.actor_id).map((s) => s.id) }; })()`);
  const count = h.run('appState.scenario.actors.length');
  const senders = () => h.json(`${JSON.stringify(actor.sent)}.map((id) => getStimulus(id).actor_id)`);
  const castActor = () => h.run(`appState.scenario.storyboard.cast.find((item) => item.id === '${actor.cast}').actor_id`);
  h.run(`deleteActor('${actor.id}')`);
  assert.equal(h.run('appState.scenario.actors.length'), count, 'declined: nothing changes');
  assert.ok(h.run('lastConfirm').includes(`${actor.sent.length} inject(s) it sends will have no sender`), h.run('lastConfirm'));
  h.run(`answer = true; deleteActor('${actor.id}')`);
  assert.equal(h.run('appState.scenario.actors.length'), count - 1);
  assert.deepEqual(senders(), actor.sent.map(() => ''));
  assert.equal(castActor(), '');
  // Views and checks cope with injects without sender; a reload keeps them without sender.
  h.run(`renderCellsView(); tabUI('detailed').cell = 'all'; renderDetailedView();`);
  assert.ok(Array.isArray(h.json('sbExerciseChecks(appState.scenario)')));
  assert.ok(h.run('ExerciseModel.build(appState.scenario).injects.length') > 0);
  assert.ok(h.run('ExportEngine.chronogramCsv(appState.scenario.stimuli)').includes('Sender'));
  const reloaded = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario))).stimuli.filter((s) => ${JSON.stringify(actor.sent)}.includes(s.id)).map((s) => s.actor_id)`);
  assert.deepEqual(reloaded, actor.sent.map(() => ''));
  assert.equal(h.run('StoryboardHistory.undo()'), 'Delete actor');
  assert.equal(h.run('appState.scenario.actors.length'), count);
  assert.deepEqual(senders(), actor.sent.map(() => actor.id));
  assert.equal(castActor(), actor.id);
});

test('check & challenge: the ready-to-play checklist is saved with each project, the old shared one migrates once', () => {
  const h = harness();
  h.run(`saveLocal = () => {}; appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.scenario.checklist = normalizeChecklist(null)`);
  const key = h.run('checkerLegacyChecklistKey()');
  h.storage.set(key, JSON.stringify({ checked: { playability_0: true, bogus: 'yes' }, customItems: { playability: ['Book the room', ''] } }));
  assert.equal(h.run('checkerLoadChecklist()'), true);
  assert.equal(h.storage.has(key), false, 'the shared key is gone');
  assert.deepEqual(h.json('appState.scenario.checklist'), { checked: { playability_0: true }, customItems: { playability: ['Book the room'] } });
  assert.equal(h.run('checkerLoadChecklist()'), false, 'only once');
  // Ticks live in the project: they survive a reload and travel in the project file.
  h.run(`checkerChecklist().checked.playability_1 = true; checkerSaveChecklist()`);
  const reloaded = h.json('mergeScenario(migrateScenario(JSON.parse(JSON.stringify(buildProjectFileData({ forFile: true }))))).checklist');
  assert.deepEqual(reloaded.checked, { playability_0: true, playability_1: true });
  assert.equal(h.run('ccChecklistProgress().done'), 2);
  // Another project starts with its own, empty checklist.
  h.run(`appState.scenario = emptyScenario({})`);
  assert.equal(h.run('ccChecklistProgress().done'), 0);
  assert.deepEqual(h.json('mergeScenario({ scenario: {}, stimuli: [] }).checklist'), { checked: {}, customItems: {} });
});

test('check & challenge: an empty project has nothing to check, not a near-perfect score', () => {
  const h = harness();
  h.run(`appState.scenario = emptyScenario({}); StoryboardHistory.ensure()`);
  const readiness = h.json(`ccReadiness(appState.scenario, ccRuleIssues(appState.scenario), tabUI('summary'))`);
  assert.equal(readiness.structure, null);
  assert.equal(readiness.overall, null);
  assert.equal(readiness.verdict, 'empty');
  const view = h.run('renderSummaryView()');
  assert.ok(view.includes('Nothing to check yet') && !view.includes('Almost ready') && !view.includes('Ready to play</strong>'));
  // Ticking the checklist does not make an empty exercise ready.
  h.run(`checkerChecklist().checked = Object.fromEntries(checkerGetChecklistCategories().flatMap((c) => c.items.map((_, i) => [c.key + '_' + i, true])))`);
  assert.equal(h.json(`ccReadiness(appState.scenario, ccRuleIssues(appState.scenario), tabUI('summary'))`).verdict, 'empty');
  // A storyline without any inject is scored, and the missing injects weigh as a warning.
  assert.deepEqual(h.json(`sbExerciseChecks(appState.scenario).map((i) => i.severity)`), ['warning']);
  assert.ok(h.run('sbScore(sbStructuralChecks(sbStoryboard(), appState.scenario))') <= 94, 'an empty storyboard is a warning');
});

test('project: New, demo and library loads ask before replacing a project with content', () => {
  const h = harness();
  h.run(`appState.scenario = emptyScenario({}); StoryboardHistory.ensure()`);
  assert.equal(h.run('projectHasContent(appState.scenario)'), false);
  assert.equal(h.run('confirmReplaceProject("new")'), true, 'nothing to lose: no question');
  h.run(`appState.scenario.client.name = 'Acme'`);
  assert.equal(h.run('projectHasContent(appState.scenario)'), true);
  assert.equal(h.run('projectHasContent(defaultScenario())'), true);
  h.run(`globalThis.asked = []; window.confirm = (text) => { asked.push(text); return false; }`);
  assert.equal(h.run('confirmReplaceProject("demo")'), false);
  assert.ok(h.run('asked[0]').includes('replaced'));
  // Loading a library scenario over it offers a new project or the storyline only.
  h.run(`sbHandleAction({ currentTarget: { dataset: { sbAction: 'select-template', sbTemplate: 'ransomware-double-extortion' } } })`);
  assert.equal(h.run('sbUI().modal'), 'load-choice');
  const view = h.run('renderProjectView()');
  assert.ok(view.includes('data-sb-load="new"') && view.includes('data-sb-load="storyline"'));
  h.run(`sbHandleAction({ currentTarget: { dataset: { sbAction: 'select-template', sbTemplate: 'ransomware-double-extortion', sbLoad: 'new' } } })`);
  assert.equal(h.run('appState.scenario.client.name'), '', 'a fresh project');
  assert.equal(h.run('sbStoryboard().meta.library_id'), 'ransomware-double-extortion');
  assert.equal(h.run('appState.route'), 'scenario');
});

test('library: the search query survives a category change and says when nothing matches', () => {
  const h = harness();
  h.run(`appState.scenario = emptyScenario({}); StoryboardHistory.ensure(); sbUI().libraryQuery = 'zzz-no-match'`);
  let html = h.run('renderSbLibrary()');
  assert.ok(html.includes('value="zzz-no-match"'));
  assert.ok(/data-sb-library-empty >No scenario matches/.test(html));
  h.run(`sbUI().libraryQuery = 'ransomware'; sbUI().libraryCategory = sbLibraryEntries()[0].category`);
  html = h.run('renderSbLibrary()');
  assert.ok(html.includes('value="ransomware"') && /data-sb-library-empty hidden/.test(html));
  assert.ok(/<article class="sb-template-card[^"]*" data-sb-search="[^"]*ransomware[^"]*" >/.test(html), 'a matching card is shown');
});

test('slide debrief: long lists continue on extra slides; nothing is dropped and texts are clipped at a word', () => {
  const h = harness();
  assert.deepEqual(h.json('sdPages([1, 2, 3, 4, 5], 4)'), [[1, 2, 3, 4], [5]]);
  assert.deepEqual(h.json('sdPages([], 4)'), [[]]);
  assert.deepEqual(h.json('sdPages([1, 2], 0)'), [[1], [2]]);
  assert.equal(h.run('sdClip("Coordinated encryption begins on a Sunday", 20)'), 'Coordinated…');
  assert.equal(h.run('sdClip("Short", 20)'), 'Short');
  // The first label of the timeline stays inside the slide, its tick on the exact time.
  assert.deepEqual(h.json('sdTimelineTick(0, 180)'), { left: 9, tick: 0 });
  assert.deepEqual(h.json('sdTimelineTick(180, 180)'), { left: 91, tick: 100 });
  assert.deepEqual(h.json('sdTimelineTick(90, 180)'), { left: 50, tick: 50 });

  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure(); appState.scenario.slide_debrief = normalizeSlideDebrief(null);`);
  const blockId = h.run('sbMainBlocks(sbStoryboard())[0].id');
  const phaseInjects = h.run(`ExerciseModel.of(appState.scenario).injects.filter((inject) => inject.phase_id === '${blockId}').length`);
  // Nine main events in phase 1: 4 + 4 + 1 over three slides.
  h.run(`sbMainBlocks(sbStoryboard())[0].events = Array.from({ length: 9 }, (_, i) => ({ offset_minutes: i, text: 'Event ' + i + ' ' + 'with a long description '.repeat(8) }));`);
  const phase1 = h.json(`sdSlides(appState.scenario).filter((slide) => slide.kind === 'phase' && slide.title.startsWith('Phase 1:'))`);
  const pages = Math.max(3, Math.ceil(phaseInjects / 4));
  assert.equal(phase1.length, pages);
  assert.equal(phase1[1].title, `${phase1[0].title} (continued)`);
  assert.equal(phase1[1].what, '', 'the phase summary is on its first slide only');
  assert.deepEqual(phase1.flatMap((slide) => slide.events.map((event) => event.text.split(' ')[1])), ['0', '1', '2', '3', '4', '5', '6', '7', '8']);
  assert.equal(phase1.reduce((sum, slide) => sum + slide.injects.length, 0), phaseInjects);
  assert.ok(phase1.every((slide) => slide.events.length <= 4 && slide.injects.length <= 4));
  assert.ok(phase1.every((slide) => slide.events.every((event) => event.text.length <= 64 && (event.text.length < 64 || event.text.endsWith('…')))));
  // Every debrief event is shown, four per slide.
  const story = h.run('(appState.scenario.debrief?.events || []).length');
  const storySlides = h.json(`sdSlides(appState.scenario).filter((slide) => slide.kind === 'story')`);
  assert.equal(storySlides.length, Math.ceil(story / 4));
  assert.equal(storySlides.reduce((sum, slide) => sum + slide.items.length, 0), story);
  // Seven strengths and two improvements: two slides, the second one with the three last strengths.
  h.run(`Object.assign(sdState(appState.scenario), { went_well: 'a\\nb\\nc\\nd\\ne\\nf\\ng', to_improve: 'x\\ny' })`);
  const columns = h.json(`sdSlides(appState.scenario).filter((slide) => slide.kind === 'columns')`);
  assert.equal(columns.length, 2);
  assert.deepEqual(columns[1].left.items, ['e', 'f', 'g']);
  assert.deepEqual(columns[1].right.items, []);
  assert.ok(h.run('sdSlideHtml(sdSlides(appState.scenario).find((slide) => slide.kind === "timeline"))').includes('--tick:'));
});

test('planning: nudges are capped per cell, the latest of each phase kept first', () => {
  const h = harness();
  const beats = (block, n) => Array.from({ length: n }, (_, i) => ({ id: `${block}_${i}`, offset_minutes: i * 5, cell_id: i % 2 ? 'cell_b' : 'cell_a', kind: 'nudge' }));
  h.context.sb = { blocks: [{ id: 'p1', start_minutes: 0, beats: beats('p1', 8) }, { id: 'p2', start_minutes: 60, beats: beats('p2', 8) }] };
  assert.equal(h.run('sbCapNudges(sb)'), 12);
  const kept = h.json(`sb.blocks.flatMap(b => b.beats.filter(x => x.kind === 'nudge').map(x => x.id))`);
  // 8 injects per cell: 2 nudges each, the last one of each phase.
  assert.deepEqual(kept.sort(), ['p1_6', 'p1_7', 'p2_6', 'p2_7']);
  // A cell with one nudge among few injects keeps it.
  h.context.sb = { blocks: [{ id: 'p1', start_minutes: 0, beats: [{ id: 'x', offset_minutes: 1, cell_id: 'cell_a', kind: 'nudge' }, { id: 'y', offset_minutes: 2, cell_id: 'cell_a' }] }] };
  assert.equal(h.run('sbCapNudges(sb)'), 0);
});

test('players: a job title given as the name is not replaced in the injects by a real name', async () => {
  const h = harness();
  h.run(`StoryboardHistory.ensure();
    const project = appState.scenario;
    project.cells = [sbMakeCell('decision', { id: 'c1' })];
    project.cells[0].players.push(sbNormalizePlayer({ id: 'p1', name: 'CEO', role: 'Chief Executive Officer' }));
    project.stimuli = [makeStimulus('email_internal', project.actors[0]?.id || '', 10)];
    project.stimuli[0].fields.body = '<p>The CEO wants a decision before the CEO office call.</p>';
    ceEditPlayer(ceFindPlayer(project, 'p1').player, 'name', 'Camille Dubreuil');`);
  assert.equal(h.json('ceRenameImpacts(appState.scenario)').length, 0);
  assert.equal(h.run(`ceApplyPlayerRename(appState.scenario, 'p1')`), 0);
  assert.match(h.run('appState.scenario.stimuli[0].fields.body'), /The CEO wants a decision before the CEO office call/);
  // A name is found as a whole word: "Marc Abel" is not named by "Marc Abella".
  h.run(`appState.scenario.cells[0].players.push(sbNormalizePlayer({ id: 'p2', name: 'Marc Abel', role: 'CFO' }));
    appState.scenario.stimuli[0].fields.to = 'Marc Abella, COO';
    ceEditPlayer(ceFindPlayer(appState.scenario, 'p2').player, 'name', 'Lea Roux');`);
  assert.equal(h.json('ceRenameImpacts(appState.scenario)').length, 0);
  assert.equal(h.run(`ceIsTitleLike('Player 3', 'CFO')`), true);
  // The builder agent does not store a job title as a player name.
  const tool = h.run(`createAgentToolRegistry().get('upsertCells')`);
  await tool.execute({ cells: [{ id: 'c1', name: 'Decision cell', players: [{ name: 'CISO', role: 'Chief Information Security Officer' }, { name: 'Press Officer', role: 'Press Officer' }, { name: 'Lina Haddad', role: 'CFO' }] }] });
  assert.deepEqual(h.json('appState.scenario.cells[0].players.map(p => p.name)'), ['', '', 'Lina Haddad']);
});

test('press templates: the byline and reading-time prefixes are never doubled', () => {
  const h = harness();
  const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const [author, readTime] of [['Par Florian Music', '4 min de lecture'], ['Florian Music', '4 min'], ['By Florian Music', 'Lecture 4 min'], ['par  Florian Music', 'Temps de lecture : 4 min']]) {
    h.context.fields = { author, read_time: readTime, date: '15 mars 2026', headline: 'H', body: '<p>B</p>' };
    for (const html of [h.run('TemplateEngine.articleLeMondeHD(fields)'), h.run('TemplateEngine.articleLeMonde(fields)')]) {
      const shown = text(html);
      assert.match(shown, /Par Florian Music/, author);
      assert.doesNotMatch(shown, /Par (Par|By|par)/i, author);
      assert.match(shown, /Lecture 4 min(?! de lecture)/, readTime);
      assert.doesNotMatch(shown, /Lecture Lecture|de lecture/, readTime);
    }
  }
  h.context.fields = { author: 'By Nicole Perlroth', read_time: '6 min read', date: 'March 15, 2026', headline: 'H', body: '<p>B</p>' };
  for (const html of [h.run('TemplateEngine.articleNyt(fields)'), h.run('TemplateEngine.articleNytHD(fields)')]) {
    assert.match(text(html), /By Nicole Perlroth/);
    assert.doesNotMatch(text(html), /By By/);
  }
  h.context.fields = { author: '', read_time: '', date: '15 mars 2026', headline: 'H', body: '' };
  assert.doesNotMatch(text(h.run('TemplateEngine.articleLeMondeHD(fields)')), /Par|Lecture/, 'no prefix without a value');
  // The defaults no longer carry the prefixes themselves.
  assert.equal(h.run('ARTICLE_TEMPLATE_LIBRARY.lemonde.defaults.author.startsWith("Par ")'), false);
  assert.equal(h.run('ARTICLE_TEMPLATE_LIBRARY.lemonde.defaults.read_time'), '4 min');
});

test('play: the chronogram for Excel has one row per inject in play order, with its phase, cell, sender and status', () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  const rows = h.json('playChronogramRows(appState.scenario)');
  assert.equal(rows[0].length, 12);
  assert.equal(rows.length - 1, h.run('playItems(appState.scenario).length'));
  assert.equal(rows[1][0], 1);
  assert.match(rows[1][1], /^H\+0:0/);
  assert.ok(rows.slice(1).every((row) => row[3] && row[5] && row[10]), 'phase, channel and status on every row');
  assert.ok(rows.slice(1).some((row) => row[9]), 'nudges are marked');
});
