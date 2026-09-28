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
  for (const marker of ['bottom-editor-head', 'data-sb-field="brief"', 'data-sb-objective', 'data-tab-action="open-detailed"', 'rewrite-block']) assert.ok(phase.includes(marker), marker);
  for (const modal of ['versions', 'coherence', 'generate', 'sync']) {
    h.run(`sbUI().modal = '${modal}'`);
    assert.ok(h.run('renderStorylineView()').includes('sb-modal'), modal);
  }
  h.run(`sbUI().modal = 'preview'; sbUI().previewId = 'ransomware-double-extortion'`);
  assert.ok(h.run('renderProjectView()').includes('Use this scenario'));
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
  for (const marker of ['su-kpis', 'su-heat', 'data-su-scrub', 'data-su-columns', 'data-tab-action="su-ai"', 'su-issue-group']) assert.ok(summary.includes(marker), marker);
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
