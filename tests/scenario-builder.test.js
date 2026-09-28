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
  const info = h.json(`({ blocks: appState.scenario.storyboard.blocks.length, tracks: appState.scenario.storyboard.tracks.length, cells: appState.scenario.cells.map(c => c.key), beatsWithoutCell: appState.scenario.storyboard.blocks.flatMap(b => b.beats).filter(b => !sbCell(appState.scenario, b.cell_id)).length, stimuliWithoutCell: appState.scenario.stimuli.filter(s => !s.cell_id).length, linked: appState.scenario.stimuli.filter(s => s.scenario_link).length, impacts: sbComputeImpacts(appState.scenario).length, issues: sbStructuralChecks(appState.scenario.storyboard, appState.scenario).filter(i => i.severity !== 'info').map(i => i.message), exercise: appState.scenario.exercise })`);
  assert.equal(info.tracks, 1);
  assert.equal(info.blocks, 6);
  assert.deepEqual(info.cells, ['operational', 'communication', 'legal', 'business']);
  assert.equal(info.beatsWithoutCell, 0);
  assert.equal(info.stimuliWithoutCell, 0);
  assert.equal(info.linked, 19);
  assert.equal(info.impacts, 0);
  assert.deepEqual(info.issues, []);
  assert.deepEqual(info.exercise, { players_count: 12, cells_count: 4 });
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
  assert.equal(h.run('appState.scenario.cells.length'), 4, 'cells with injects are kept');
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

test('checks: deterministic coherence rules flag gaps, overlaps, coverage and plan mismatches', () => {
  const h = harness();
  h.run(`{ appState.scenario.scenario.objectives = 'Isolate on time\\nNotify the regulator';
    const sb = sbStoryboard(); const main = sbMainTrack(sb).id;
    sb.blocks.push(sbMakeBlock('investigation', { track_id: main, start_minutes: 0, duration_minutes: 60, brief: 'x', objectives: ['Isolate on time'] }, sb));
    sb.blocks.push(sbMakeBlock('containment', { track_id: main, start_minutes: 120, duration_minutes: 30, brief: 'y', stimuli_target: 3, beats: [{ offset_minutes: 5, channel: 'email_internal', title: 'a' }] }, sb));
    sb.blocks.push(sbMakeBlock('recovery', { track_id: main, start_minutes: 140, duration_minutes: 30 }, sb)); }`);
  const codes = h.json('sbStructuralChecks(sbStoryboard(), appState.scenario).map(i => i.code)');
  for (const code of ['no_trigger', 'gap', 'overlap', 'beat_count', 'no_brief', 'objective_uncovered', 'no_exit']) assert.ok(codes.includes(code), code);
  assert.ok(h.run('sbScore(sbStructuralChecks(sbStoryboard(), appState.scenario))') < 100);
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

test('AI: planCellInjects adds beats for one cell and reviewExercise merges rules with AI findings', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); Object.assign(appState.scenario.settings, { ai_api_key: 'TEST-SECRET', ai_provider: 'openai' }); StoryboardHistory.ensure();`);
  const target = h.json(`({ block: sbMainBlocks(sbStoryboard())[1].id, cell: appState.scenario.cells[1].id, name: appState.scenario.cells[1].name, before: sbMainBlocks(sbStoryboard())[1].beats.length })`);
  const calls = mockAI(h, [
    () => ({ beats: [{ at: 5, channel: 'article_press', cast: 'new_reporter', title: 'Reporter calls', intent: 'Pressure' }, { at: 9999, channel: 'email_internal', cast: 'new_reporter', title: 'Too late', intent: 'Clamp' }, { at: 1, channel: 'sms_notification', title: 'Extra', intent: 'Dropped' }], cast: [{ key: 'new_reporter', label: 'Reporter', role: 'journalist', organization: 'Daily' }] }),
    () => ({ score: 71, summary: 'Rhythm is uneven.', issues: [{ severity: 'warning', at: 90, cell: target.name, message: 'Two floods in a row.', suggestion: 'Spread them.' }, { severity: 'bogus', message: '' }] })
  ]);
  h.context.target = target;
  const added = await h.run(`SbAI.planCellInjects(target.block, target.cell, 2, 'more pressure').then(r => JSON.stringify(r))`).then(JSON.parse);
  assert.equal(added.length, 2);
  assert.ok(added.every(beat => beat.cell_id === target.cell));
  const block = h.json(`sbBlock(sbStoryboard(), target.block)`);
  assert.equal(block.beats.length, target.before + 2);
  assert.ok(block.beats.every(beat => beat.offset_minutes < block.duration_minutes));
  assert.ok(h.json('sbStoryboard().cast').some(cast => cast.label === 'Reporter'));
  assert.equal(calls[0].payload.target.cell_id, target.cell);
  assert.equal(calls[0].payload.instruction, 'more pressure');
  const review = await h.run(`SbAI.reviewExercise().then(r => JSON.stringify(r))`).then(JSON.parse);
  assert.equal(review.score, 71);
  const ai = review.issues.filter(issue => issue.source === 'ai');
  assert.equal(ai.length, 1);
  assert.equal(ai[0].cell_id, target.cell);
  assert.equal(ai[0].at, 90);
  assert.ok(review.issues.some(issue => issue.source === 'rules'));
  assert.ok(calls[1].payload.injects.length > 19);
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

test('AI: coherence merges rules with AI findings and fixes apply to one block', async () => {
  const h = harness();
  h.run(`sbApplyTemplate(sbFindTemplate('ddos-hacktivism'), 'replace'); StoryboardHistory.ensure(appState.scenario, 'Use');`);
  const target = h.run('sbStoryboard().blocks[1].id');
  mockAI(h, [{ score: 70, summary: 'Solid but late escalation.', issues: [{ severity: 'warning', block_ids: [target, 'ghost'], message: 'Escalation arrives late.', fix: { block_id: target, patch: { brief: 'Earlier escalation', start_minutes: 'no' } } }, { severity: 'loud', message: 'Odd severity' }] }]);
  const coherence = await h.run(`(async () => JSON.stringify(await SbAI.coherence({ ai: true })))()`).then(JSON.parse);
  assert.ok(coherence.issues.some(i => i.source === 'ai' && i.block_ids.length === 1 && i.fix?.patch?.brief === 'Earlier escalation'));
  assert.ok(coherence.issues.every(i => ['error', 'warning', 'info'].includes(i.severity)));
  assert.ok(coherence.score > 0 && coherence.score <= 100);
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
  for (const marker of ['data-sc-duration', 'data-sc-cells', 'data-sc-players', 'data-bind="client.name"', 'data-bind="client.sector"', 'data-cx-logo', 'data-bind="scenario.start_date"', 'data-bind="scenario.end_date"', 'data-bind="scenario.timezone"', 'data-bind="client.language"', 'data-bind="settings.inject_language"', 'data-sb-meta="brief"', 'data-cx-generate', 'Generate with AI', 'data-sb-meta="synopsis"']) assert.ok(context.includes(marker), marker);
  assert.ok(context.indexOf('data-sc-players') < context.indexOf('data-sb-meta="brief"') && context.indexOf('data-cx-generate') < context.indexOf('data-sb-meta="synopsis"'), 'context, then objectives and AI, then details');
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
  for (const marker of ['bottom-editor-head', 'data-sb-field="brief"', 'What happens during this phase', 'data-tab-action="open-detailed"', 'rewrite-block', 'data-sb-modal="sync"']) assert.ok(phase.includes(marker), marker);
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
  for (const marker of ['data-ce-cell', 'data-ce-player', 'data-actor-bind', 'Attackers', 'Press', 'Authorities']) assert.ok(cells.includes(marker), marker);
  const detailed = h.run('renderDetailedView()');
  for (const marker of ['data-tab-action="ds-cell"', 'ds-phase-row', 'data-ds-item', 'bottom-editor']) assert.ok(detailed.includes(marker), marker);
  h.run(`tabUI('detailed').cell = appState.scenario.cells[0].id; tabUI('detailed').selected = sbExerciseItems(appState.scenario).find(i => i.cell_id === appState.scenario.cells[0].id).key`);
  const inject = h.run('renderDetailedView()');
  for (const marker of ['data-ds-time', 'data-ds-cell', 'data-tab-action="ds-plan"']) assert.ok(inject.includes(marker), marker);
  h.run(`tabUI('summary').review = { score: null, summary: '', issues: sbExerciseChecks(appState.scenario) }; tabUI('summary').time = 120`);
  const summary = h.run('renderSummaryView()');
  for (const marker of ['cc-readiness', 'cc-gauge', 'su-kpis', 'su-heat', 'data-su-scrub', 'data-su-columns', 'data-su-rehearse', 'data-action="checker-analyze"', 'data-mode="file"', 'su-issue-group']) assert.ok(summary.includes(marker), marker);
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

test('context: learning objectives per player category and the attack path feed every AI operation', async () => {
  const h = harness();
  h.run(`appState.scenario = defaultScenario(); StoryboardHistory.ensure();`);
  assert.ok(h.run('appState.scenario.scenario.attack_path').includes('Initial access'), 'demo has an attack path');
  assert.equal(h.run(`emptyScenario().scenario.attack_path`), '', 'a new project starts blank');
  assert.equal(h.run(`emptyScenario().scenario.learning_objectives`), '');
  const cell = h.json(`appState.scenario.cells.find((item) => item.key === 'legal')`);
  assert.ok(cell.objectives.includes('NIS2'));
  // Context tab markup.
  const context = h.run('renderScenarioView()');
  for (const marker of ['Learning objectives by player category', 'data-bind="scenario.learning_objectives"', `data-cx-cell-objectives="${cell.id}"`, 'Attack path', 'data-bind="scenario.attack_path"']) assert.ok(context.includes(marker), marker);
  // Shared prompt lines: the recipient cell first, then the attack path.
  const lines = h.json(`sbDesignContextLines(appState.scenario, { cellId: '${cell.id}' })`);
  assert.ok(lines[0].startsWith('- Learning objectives of the recipient (Legal'));
  assert.ok(lines.some((line) => line.startsWith('- Attack path')));
  assert.ok(!lines.some((line) => line.includes('Communication cell')), 'only the recipient cell objectives for one inject');
  // Every stimulus prompt, whatever its channel.
  const stimulus = h.run(`(() => { const s = appState.scenario.stimuli.find((item) => item.channel === 'email_authority'); s.cell_id = '${cell.id}'; return PromptBuilder.forStimulus(s, getActor(s.actor_id), appState.scenario).systemPrompt; })()`);
  assert.ok(stimulus.includes('Exercise design') && stimulus.includes('NIS2') && stimulus.includes('Kerberoasting'));
  // Storyline AI context and the agent frame.
  const ai = h.json('sbAIContext(appState.scenario)');
  assert.ok(ai.exercise.attack_path.includes('Exfiltration') && ai.exercise.learning_objectives.includes('crisis management'));
  assert.ok(ai.storyboard.cells.some((item) => item.objectives.includes('NIS2')));
  const frame = h.json('agentExerciseFrame()');
  assert.ok(frame.attack_path.includes('Lateral movement'));
  assert.ok(frame.learning_objectives.by_cell.some((item) => item.cell_id === cell.id));
  // Cell objectives survive a save and reload.
  const reloaded = h.json(`mergeScenario(JSON.parse(JSON.stringify(appState.scenario)))`);
  assert.ok(reloaded.cells.find((item) => item.id === cell.id).objectives.includes('NIS2'));
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
  h.run(`appState.scenario.cells.push(sbMakeCell('custom', { name: 'Idle cell' }))`);
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
  assert.ok(csv.includes('"#";"Time";"Simulated time";"Phase"') && csv.includes('"Encryption hits on Sunday morning"'));
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
  for (const marker of ['Generate all stimuli', 'data-play-bar', 'data-play="toggle"', 'data-play="reset-all"', 'data-play="add"', 'data-play-quick="now"', 'data-play-filter="cell"', 'data-play-now', 'play-phase-group', 'data-play-set="sent"', 'data-action="open-stimulus-modal"', 'Exercise log', 'data-play="save-log"', 'data-play-note']) assert.ok(view.includes(marker), marker);
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

  // Removing the file keeps the checklist and the scenario challenge.
  h.run(`appState.checkerState.checklist = { checked: { a_0: true } }; checkerClearFile()`);
  assert.equal(h.run('appState.checkerState.mode'), 'scenario');
  assert.equal(h.run('appState.checkerState.parsedData'), null);
  assert.equal(h.run('appState.checkerState.checklist.checked.a_0'), true);
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
