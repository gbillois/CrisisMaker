// Optional browser smoke test for the scenario tabs; mocked AI, no API key or credits.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/scenario-builder-browser-smoke.cjs [app-url]
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function builderAgentAnswer(payload) {
  // The Context tab's "Generate with AI" drives the builder agent: ask, build, plan, finish.
  if (payload.step === 1) return { type: 'question', questions: ['Who plays the exercise?', 'Which decision matters most?'], reason: 'The audience changes the phases' };
  if (!payload.state.storyboard.blocks.length) {
    return { type: 'tool_call', tool: 'buildMainStoryline', reason: 'Main storyline from the context', arguments: {
      title: 'Hospital ransomware drill', summary: 'A ransomware affiliate encrypts the hospital group.', objectives: ['Protect patient safety', 'Notify authorities on time'],
      cast: [{ key: 'ciso', label: 'CISO', role: 'internal' }, { key: 'press', label: 'Health reporter', role: 'journalist' }],
      phases: [
        { type: 'trigger', title: 'Night alerts', start_minutes: 0, duration_minutes: 60, injects: 2, brief: 'EDR alerts.', objectives: [0] },
        { type: 'containment', title: 'Isolate or not', start_minutes: 60, duration_minutes: 60, injects: 2, brief: 'Isolation dilemma.' },
        { type: 'exit', title: 'Exit', start_minutes: 120, duration_minutes: 60, injects: 1, brief: 'Close.', objectives: [1] }
      ] } };
  }
  const containment = payload.state.storyboard.blocks.find((block) => block.type === 'containment');
  if (!containment.planned) {
    const cell = payload.state.storyboard.cells[1];
    return { type: 'tool_call', tool: 'planPhaseInjects', reason: 'Per-cell plan', arguments: { id: containment.id, injects: [{ at: 5, channel: 'email_internal', cell: cell.id, cast: 'CISO', title: 'Isolation request', intent: 'Forces the decision.' }] } };
  }
  return { type: 'final', summary: 'Built the storyline and the containment plan.', issues: [], changes: ['Main storyline', 'Inject plan'] };
}

function answerFor(system, user) {
  if (system.includes('Crisis Context Builder Agent')) return builderAgentAnswer(JSON.parse(user));
  if (!system.includes('Scenario Builder')) return { subject: 'Generated subject', body: '<p>Generated body</p>', headline: 'Generated headline', text: 'Generated text', title: 'Generated title' };
  const payload = JSON.parse(user);
  if (payload.task.startsWith('Design a complete')) {
    return {
      title: 'Hospital ransomware drill', summary: 'A ransomware affiliate encrypts the hospital group.', threat: 'Affiliate via VPN',
      objectives: ['Protect patient safety', 'Notify authorities on time'],
      cast: [{ key: 'ciso', label: 'CISO', role: 'internal' }, { key: 'press', label: 'Health reporter', role: 'journalist' }],
      blocks: [
        { key: 'b1', type: 'trigger', title: 'Night alerts', track: 'main', start: 0, duration: 60, stimuli: 2, brief: 'EDR alerts.', objectives: [0] },
        { key: 'b2', type: 'containment', title: 'Isolate or not', track: 'main', start: 60, duration: 60, stimuli: 2, brief: 'Isolation dilemma.' },
        { key: 'b3', type: 'exit', title: 'Exit', track: 'main', start: 120, duration: 60, stimuli: 1, brief: 'Close.', objectives: [1] }
      ]
    };
  }
  if (payload.task.startsWith('Deepen')) {
    const cast = payload.context.storyboard.cast;
    const cells = payload.context.cells || [];
    return { blocks: payload.target.map(target => ({ id: target.id, narrative: 'Players only see partial information.', beats: target.want === 'narrative' ? undefined : Array.from({ length: target.injects - target.existing_beats }, (_, i) => ({ at: i * 10, channel: i % 2 ? 'sms_notification' : 'email_internal', cast: cast[i % cast.length].id, cell: cells[i % Math.max(1, cells.length)]?.id, title: `Inject ${i + 1}`, intent: 'Forces a decision.' })) })) };
  }
  if (payload.task.startsWith('Plan ')) return { beats: Array.from({ length: payload.target.count }, (_, i) => ({ at: 5 + i * 5, channel: 'email_internal', cast: 'cfo', title: `Cell inject ${i + 1}`, intent: 'Cell pressure.' })), cast: [{ key: 'cfo', label: 'CFO', role: 'internal' }] };
  if (payload.task.startsWith('Give realistic')) return { actors: payload.roles.map(role => ({ cast: role.cast, name: `${role.label} person`, title: role.label, organization: 'Hospital group', role: role.role, language: 'en' })) };
  if (payload.task.startsWith('Review the whole')) return { score: 77, summary: 'Rhythm is uneven between cells.', issues: [{ severity: 'warning', at: 60, message: 'The decision cell waits too long.', suggestion: 'Add an early escalation.' }] };
  return { score: 80, summary: 'Coherent.', issues: [] };
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    const body = JSON.parse(route.request().postData());
    const answer = answerFor(body.messages[0].content, body.messages[1].content);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }) });
  });
  await page.goto(process.argv[2] || 'http://127.0.0.1:8765/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.launch-hero-close');

  // 0. Project is the first tab, top left.
  assert.equal(await page.evaluate(() => appState.route), 'project');
  assert.equal(await page.evaluate(() => document.querySelector('.nav-topbar-left .nav-icon-btn')?.dataset.route), 'project');
  const navX = await page.evaluate(() => document.querySelector('.nav-topbar-left').getBoundingClientRect().left);
  assert.ok(navX < 40, `nav starts top left (${navX})`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => { appState.scenario = emptyScenario({ ...appState.scenario.settings, ai_provider: 'openai', ai_api_key: 'sk-test', ai_model: 'gpt-test' }); App.render(); });

  // 1. Context: client, duration, cells and players.
  await page.click('.nav-icon-btn[data-route="scenario"]');
  await page.fill('[data-bind="client.name"]', 'Northwind Hospitals');
  await page.fill('[data-sc-duration]', '3');
  await page.dispatchEvent('[data-sc-duration]', 'change');
  await page.fill('[data-sc-cells]', '3');
  await page.dispatchEvent('[data-sc-cells]', 'change');
  await page.fill('[data-sc-players]', '14');
  await page.dispatchEvent('[data-sc-players]', 'change');
  assert.deepEqual(await page.evaluate(() => ({ client: appState.scenario.client.name, duration: appState.scenario.storyboard.duration_minutes, cells: appState.scenario.cells.length, players: Number(appState.scenario.exercise.players_count) })), { client: 'Northwind Hospitals', duration: 180, cells: 3, players: 14 });

  // The scenario library lives on the Project tab.
  await page.click('.nav-icon-btn[data-route="project"]');
  await page.click('.pj-library [data-sb-action="preview-template"][data-sb-template="ransomware-double-extortion"]');
  // Load selects the scenario and opens Context; nothing replaces the storyline yet.
  assert.equal(await page.isDisabled('[data-cx-load-basic]').catch(() => null), null);
  await page.click('.sb-modal-foot [data-sb-action="select-template"]');
  assert.equal(await page.evaluate(() => appState.route), 'scenario');
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 0);
  assert.ok((await page.locator('.cx-brief').innerText()).includes('Ransomware with double extortion'));
  await page.click('[data-cx-load-basic]');
  assert.equal(await page.evaluate(() => appState.route), 'storyline');
  assert.equal(await page.evaluate(() => sbStoryboard().tracks.length), 1);
  assert.ok(await page.evaluate(() => sbStoryboard().blocks.length) >= 8);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 0);

  // Context tab: objectives and ideas, then Generate with AI runs the builder agent, which asks first.
  await page.click('.nav-icon-btn[data-route="scenario"]');
  await page.fill('[data-sb-meta="brief"]', 'Three-hour hospital ransomware exercise for the executive cell');
  await page.dispatchEvent('[data-sb-meta="brief"]', 'change');
  await page.selectOption('[data-cx-mode]', 'auto');
  await page.click('[data-cx-generate]');
  await page.waitForSelector('.agent-panel .agent-question');
  await page.fill('#agent-answer', 'The executive committee; the isolation decision.');
  await page.click('.agent-panel [data-agent-action="answer"]');
  await page.waitForFunction(() => crisisAgentRunner.status === 'complete');
  assert.ok(await page.isVisible('.agent-panel.is-complete'));
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 3);
  assert.ok(await page.evaluate(() => crisisAgentRunner.answers.some((entry) => entry.answers?.includes('executive committee'))));
  assert.equal(await page.evaluate(() => sbMainBlocks(sbStoryboard())[1].beats[0].cell_id), await page.evaluate(() => appState.scenario.cells[1].id));
  await page.click('.nav-icon-btn[data-route="storyline"]');

  // 2. Main storyline: single line, phase editor at the bottom.
  assert.equal(await page.isVisible('.sb-inspector'), false);
  const id = await page.evaluate(() => sbStoryboard().blocks.find(block => block.type === 'containment').id);
  await page.click(`[data-sb-clip="${id}"]`);
  const editor = await page.$('.sl-editor .bottom-editor-head');
  const timeline = await page.$('.sl-timeline');
  assert.ok((await editor.boundingBox()).y > (await timeline.boundingBox()).y, 'phase editor below the timeline');
  await page.fill('.sl-editor [data-sb-field="brief"]', 'The CEO must choose between isolation and patient care.');
  await page.click('.sl-editor [data-sb-field="title"]');
  assert.equal(await page.evaluate(id => sbBlock(sbStoryboard(), id).brief, id), 'The CEO must choose between isolation and patient care.');
  // One AI button: empty prompt, it details the phase; the key stimuli are managed beside it.
  await page.click('.sl-editor [data-sb-action="modify-block"]');
  await page.waitForFunction(id => sbBlock(sbStoryboard(), id).narrative, id);
  // A main event: a line of text at a time, shown under the phases.
  await page.click('.sl-editor [data-tab-action="sl-event-add"]');
  await page.keyboard.type('The ransom note appears on every screen');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(id => sbBlock(sbStoryboard(), id).events[0].text, id), 'The ransom note appears on every screen');
  assert.equal(await page.locator('.sb-key-card').count(), 1, 'shown under the phases');

  // Drag the containment phase 30 minutes later.
  const clip = await page.$(`[data-sb-clip="${id}"]`);
  const box = await clip.boundingBox();
  const ppm = await page.evaluate(() => sbUI().zoom);
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30 * ppm, box.y + 12, { steps: 6 });
  await page.mouse.up();
  assert.ok(await page.evaluate(id => sbBlock(sbStoryboard(), id).start_minutes, id) > 60);

  // 3. Cells & actors: add a player.
  await page.click('.nav-icon-btn[data-route="cells"]');
  const firstCell = await page.evaluate(() => appState.scenario.cells[0].id);
  await page.click(`[data-tab-action="add-player"][data-tab-value="${firstCell}"]`);
  const playerInput = `[data-ce-player^="${firstCell}."][data-ce-player$=".name"]`;
  await page.fill(playerInput, 'Dr Ana Ruiz');
  await page.dispatchEvent(playerInput, 'change');
  assert.equal(await page.evaluate(() => appState.scenario.cells[0].players[0].name), 'Dr Ana Ruiz');

  // 4. Detailed storyline: pick a cell, plan with AI, add an inject, generate the cell.
  await page.click('.nav-icon-btn[data-route="detailed"]');
  assert.ok(await page.isVisible('.ds-phase-row'));
  await page.click(`[data-tab-action="ds-cell"][data-tab-value="${firstCell}"]`);
  await page.evaluate(() => { tabUI('detailed').playhead = 10; App.render(); });
  await page.click('[data-tab-action="ds-plan"]');
  await page.waitForFunction(cell => sbStoryboard().blocks.flatMap(block => block.beats).filter(beat => beat.cell_id === cell && beat.title.startsWith('Cell inject')).length === 3, firstCell);
  const before = await page.evaluate(() => sbExerciseItems(appState.scenario).length);
  await page.click('[data-tab-action="ds-add"]');
  assert.equal(await page.evaluate(() => sbExerciseItems(appState.scenario).length), before + 1);
  assert.ok(await page.isVisible('.ds-editor [data-ds-time]'));
  await page.click('[data-tab-action="ds-generate"]');
  await page.click('[data-sb-action="start-generation"]');
  await page.waitForFunction(() => SbPipeline.status === 'complete', null, { timeout: 30000 });
  const stimuli = await page.evaluate(() => appState.scenario.stimuli.map(s => ({ cell: s.cell_id, linked: !!s.scenario_link })));
  assert.ok(stimuli.length >= 4);
  assert.ok(stimuli.every(s => s.cell === firstCell && s.linked), 'only the selected cell was generated');
  await page.click('[data-sb-action="close-modal"]');

  // 5. Check & Challenge: readiness, live checks, one AI challenge, folded rehearsal.
  assert.equal(await page.evaluate(() => document.querySelector('.nav-icon-btn[data-route="checker"]')), null, 'no separate Checker tab');
  await page.click('.nav-icon-btn[data-route="summary"]');
  assert.ok((await page.locator('.page-title, h2').first().innerText()).includes('Check & Challenge'));
  assert.ok(await page.isVisible('.cc-readiness') && await page.isVisible('.su-issue-group'), 'readiness and live checks without running anything');
  assert.equal(await page.isVisible('[data-su-columns]'), false, 'rehearsal folded');
  await page.click('[data-su-rehearse] > summary');
  await page.click('[data-tab-action="su-toggle"]');
  await page.waitForFunction(() => tabUI('summary').time > 0);
  await page.click('[data-tab-action="su-toggle"]');
  assert.equal(await page.evaluate(() => tabUI('summary').playing), false);
  assert.equal(await page.evaluate(() => tabUI('summary').rehearseOpen), true);
  // The five-axis analysis streams; the timing review goes through the mocked chat endpoint.
  await page.evaluate(() => {
    const original = AITextGenerator.generateStreaming;
    AITextGenerator.generateStreaming = async (kind, ...rest) => kind === 'checker_analysis'
      ? { summary: 'Solid storyline, thin external pressure.', maturity: 'advanced_draft', priority_actions: ['Add a media inject in phase 2'], axes: [1, 2, 3, 4, 5].map(id => ({ id, title: `Axis ${id}`, verdict: id === 3 ? 'insufficient' : 'satisfactory', positive: ['Good'], negative: id === 3 ? ['No press'] : [], recommendations: ['Keep'] })) }
      : original.call(AITextGenerator, kind, ...rest);
  });
  await page.click('.cc-run [data-action="checker-analyze"]');
  await page.waitForFunction(() => tabUI('summary').review?.issues.some(issue => issue.source === 'ai') && appState.checkerState.analysisResult);
  await page.waitForFunction(() => !appState.checkerState.analysisLoading && !SbAI.busy);
  assert.ok(await page.isVisible('.su-issue-group'));
  assert.ok((await page.locator('.cc-challenge').innerText()).includes('Add a media inject in phase 2'), 'priority actions shown');
  assert.ok(await page.evaluate(() => tabUI('summary').liveIssues.some(issue => issue.source === 'ai')), 'AI timing findings join the live checks');
  const gauges = await page.evaluate(() => [...document.querySelectorAll('.cc-gauge strong')].map(node => node.textContent));
  assert.ok(!gauges[1].includes('—'), `AI gauge filled (${gauges})`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  // Persistence across reload.
  await page.evaluate(() => saveLocal(false));
  await page.reload();
  assert.equal(await page.evaluate(() => appState.scenario.storyboard.blocks.length), 3);
  assert.equal(await page.evaluate(() => appState.scenario.cells[0].players[0].name), 'Dr Ana Ruiz');
  assert.ok(await page.evaluate(() => appState.scenario.stimuli.every(s => s.cell_id)));
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Scenario tabs browser smoke passed.');
})().catch(error => { console.error(error); process.exit(1); });
