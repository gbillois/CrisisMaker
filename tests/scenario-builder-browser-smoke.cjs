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
  // The AI generation reads the sources first and fills the empty Context fields.
  if (system.includes('fill the frame of the exercise')) return { exercise_name: 'Northwind ransomware drill', learning_objectives: 'Executives: decide on isolation under uncertainty', incident_timeline: 'D-3: phishing of a nurse', context: 'Regional hospital group.', cells: [], missing: [] };
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

  // 0. Context is the first tab, top left, in the Prepare group; Project is a menu of the header.
  assert.equal(await page.evaluate(() => appState.route), 'scenario');
  assert.equal(await page.evaluate(() => document.querySelector('.nav-topbar-left .nav-icon-btn')?.dataset.route), 'scenario');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.nav-group')].map((group) => group.querySelectorAll('.nav-icon-btn').length)), [5, 3, 1]);
  assert.equal(await page.locator('.nav-icon-btn[data-route="project"]').count(), 0);
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

  // The scenario library lives on the Project page, opened from the Project menu of the header.
  await page.click('.brand-project');
  assert.ok(await page.isVisible('.project-menu'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.project-menu').count(), 0, 'Esc closes the Project menu');
  await page.click('.brand-project');
  await page.click('.project-menu [data-route="project"]');
  assert.equal(await page.locator('.project-menu').count(), 0);
  await page.click('.pj-library [data-sb-action="preview-template"][data-sb-template="ransomware-double-extortion"]');
  // Load selects the scenario and opens Context; nothing replaces the storyline yet.
  assert.equal(await page.isDisabled('[data-cx-load-basic]').catch(() => null), null);
  await page.click('.sb-modal-foot [data-sb-action="select-template"]');
  // The project already has a client: Load asks for a new project or the storyline only.
  assert.ok(await page.isVisible('[data-sb-load="new"]'), 'load choice offered');
  await page.click('[data-sb-load="storyline"]');
  assert.equal(await page.evaluate(() => appState.route), 'scenario');
  assert.equal(await page.evaluate(() => appState.scenario.client.name), 'Northwind Hospitals', 'the project is kept');
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 0);
  assert.equal(await page.inputValue('[data-cx-library]'), 'ransomware-double-extortion', 'the generic scenario is chosen in Context');
  await page.click('[data-cx-load-basic]');
  assert.equal(await page.evaluate(() => appState.route), 'storyline');
  assert.equal(await page.evaluate(() => sbStoryboard().tracks.length), 1);
  assert.ok(await page.evaluate(() => sbStoryboard().blocks.length) >= 8);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 0);

  // Context tab: what you want, then AI generation reads the sources, fills the empty fields and runs the builder agent (framing only), which asks first.
  await page.click('.nav-icon-btn[data-route="scenario"]');
  await page.fill('[data-sb-meta="brief"]', 'Three-hour hospital ransomware exercise for the executive cell');
  await page.dispatchEvent('[data-sb-meta="brief"]', 'change');
  await page.selectOption('[data-cx-mode]', 'auto');
  assert.equal(await page.locator('[data-bf-action]').count(), 0, 'no Build my exercise block in the Context');
  // Without the library scenario, the agent builds from the notes alone; the framing only (the
  // stimuli and the evaluation sheets come after the client review).
  await page.selectOption('[data-cx-library]', '');
  await page.uncheck('[data-cx-create="stimuli"]');
  await page.uncheck('[data-cx-create="evaluation"]');
  await page.click('[data-cx-generate]');
  await page.waitForSelector('.agent-panel .agent-question');
  assert.deepEqual(await page.evaluate(() => [appState.scenario.name, appState.scenario.scenario.learning_objectives, appState.scenario.scenario.attack_path]), ['Ransomware with double extortion', 'Executives: decide on isolation under uncertainty', 'D-3: phishing of a nurse'], 'the empty fields are filled first; the name already set stays');
  assert.equal(await page.evaluate(() => crisisAgentRunner.scope), 'framing');
  await page.fill('#agent-answer', 'The executive committee; the isolation decision.');
  await page.click('.agent-panel [data-agent-action="answer"]');
  // The framing is checked: phases left without key points get a second, targeted agent run
  // (the mock agent asks again first).
  await page.waitForFunction(() => crisisAgentRunner.status === 'complete' || (crisisAgentRunner.status === 'question' && ContextGeneration.step === 'repair'));
  assert.ok(await page.evaluate(() => crisisAgentRunner.answers.some((entry) => entry.answers?.includes('executive committee')) || ContextGeneration.step === 'repair'), 'the first run got the answer');
  if (await page.evaluate(() => ContextGeneration.step === 'repair')) {
    assert.ok((await page.evaluate(() => crisisAgentRunner.objective)).startsWith('VERIFICATION AFTER THE FRAMING'));
    await page.fill('#agent-answer', 'Add the key points.');
    await page.click('.agent-panel [data-agent-action="answer"]');
  }
  await page.waitForFunction(() => crisisAgentRunner.status === 'complete' && !ContextGeneration.busy());
  // The framing done, the Main storyline opens for the review; no approval step.
  await page.waitForFunction(() => appState.route === 'storyline');
  assert.equal(await page.locator('[data-bf-action]').count(), 0);
  await page.click('.nav-icon-btn[data-route="scenario"]');
  assert.ok(await page.isVisible('.agent-panel.is-complete'));
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 3);
  assert.equal(await page.evaluate(() => sbMainBlocks(sbStoryboard())[1].beats[0].cell_id), await page.evaluate(() => appState.scenario.cells[1].id));
  // Update: an amended field is listed, then carried into the exercise by the agent.
  assert.ok(await page.isVisible('.cx-update-row:not(.has-changes)'), 'up to date after the generation');
  await page.fill('[data-bind="client.name"]', 'Northwind Health');
  await page.dispatchEvent('[data-bind="client.name"]', 'change');
  await page.waitForSelector('.cx-update-row.has-changes');
  assert.ok((await page.locator('.cx-update-row').innerText()).includes('Client'));
  await page.click('[data-cx-update]');
  await page.waitForSelector('.cx-update .agent-panel .agent-question');
  assert.ok((await page.evaluate(() => crisisAgentRunner.objective)).includes('Client: "Northwind Hospitals" → "Northwind Health"'));
  await page.fill('#agent-answer', 'Keep the phases.');
  await page.click('.agent-panel [data-agent-action="answer"]');
  await page.waitForFunction(() => crisisAgentRunner.status === 'complete' && !ContextGeneration.stage);
  await page.waitForSelector('.cx-update-row:not(.has-changes)');
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

  // 3. Cells & actors: a player is added to the Players list, then picked into a cell.
  await page.click('.nav-icon-btn[data-route="cells"]');
  const firstCell = await page.evaluate(() => appState.scenario.cells[0].id);
  await page.click('.ce-people [data-tab-action="add-player"][data-tab-value=""], [data-tab-action="add-player"][data-tab-value=""]');
  const newPlayer = await page.evaluate(() => appState.scenario.player_pool.at(-1).id);
  const playerInput = `[data-ce-person="${newPlayer}.name"]`;
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.cePerson), `${newPlayer}.name`, 'the new row takes the focus');
  await page.fill(`[data-ce-person="${newPlayer}.name"]`, 'Dr Ana Ruiz');
  await page.dispatchEvent(`[data-ce-person="${newPlayer}.name"]`, 'change');
  assert.equal(await page.locator(`[data-ce-player]`).count(), 0, 'no player is typed inside a cell');
  await page.selectOption(`[data-ce-cell-add="${firstCell}"]`, newPlayer);
  assert.equal(await page.evaluate(() => appState.scenario.cells[0].players[0].name), 'Dr Ana Ruiz');
  assert.equal(await page.evaluate((id) => appState.scenario.player_pool.some((player) => player.id === id), newPlayer), false);
  // Ctrl+Z undoes the last player added, not an earlier change; the name typed before stays.
  const playerCount = () => page.evaluate(() => appState.scenario.player_pool.length);
  const players = await playerCount();
  await page.click('[data-tab-action="add-player"][data-tab-value=""]');
  assert.equal(await playerCount(), players + 1);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  assert.equal(await playerCount(), players, 'Ctrl+Z removes the player just added');
  assert.equal(await page.evaluate(() => appState.scenario.cells[0].players[0].name), 'Dr Ana Ruiz');
  // A category of simulated actors of the project's own, and an actor in it.
  await page.click('[data-tab-action="add-category"]');
  const category = await page.evaluate(() => appState.scenario.actor_categories.at(-1).id);
  await page.fill(`[data-ce-category="${category}.label"]`, 'Insurers');
  await page.dispatchEvent(`[data-ce-category="${category}.label"]`, 'change');
  await page.click(`[data-tab-action="add-actor"][data-tab-value="cat:${category}"]`);
  assert.equal(await page.evaluate((id) => appState.scenario.actors.filter((actor) => actor.category === id).length, category), 1);
  assert.ok((await page.locator('.ce-group-row').allInnerTexts()).some((text) => text.includes('1')));

  // 4. Detailed storyline: pick a cell, add an inject, generate the cell (no "+ Cell", no "Plan with AI").
  assert.equal(await page.locator('.ds-cell-chip.is-add, [data-tab-action="ds-plan"]').count(), 0);
  await page.click('.nav-icon-btn[data-route="detailed"]');
  assert.ok(await page.isVisible('.ds-phase-row'));
  await page.click(`[data-tab-action="ds-cell"][data-tab-value="${firstCell}"]`);
  await page.evaluate(() => { tabUI('detailed').playhead = 10; App.render(); });
  const before = await page.evaluate(() => sbExerciseItems(appState.scenario).length);
  await page.click('[data-tab-action="ds-add"]');
  assert.equal(await page.evaluate(() => sbExerciseItems(appState.scenario).length), before + 1);
  assert.ok(await page.isVisible('.ds-editor [data-ds-time]'));
  await page.click('[data-tab-action="ds-generate"]');
  await page.click('[data-sb-action="start-generation"]');
  await page.waitForFunction(() => SbPipeline.status === 'complete', null, { timeout: 30000 });
  const stimuli = await page.evaluate(() => appState.scenario.stimuli.map(s => ({ cell: s.cell_id, linked: !!s.scenario_link })));
  assert.ok(stimuli.length >= 1);
  assert.ok(stimuli.every(s => s.cell === firstCell && s.linked), 'only the selected cell was generated');
  await page.click('[data-sb-action="close-modal"]');

  // Drag a written inject onto another cell's row: its recipient changes (the tip says so), Ctrl+Z undoes it.
  await page.click('[data-tab-action="ds-cell"][data-tab-value="all"]');
  const secondCell = await page.evaluate(() => appState.scenario.cells[1].id);
  const dragged = await page.evaluate((cell) => sbExerciseItems(appState.scenario).find((item) => item.stimulus && item.cell_id === cell)?.key, firstCell);
  const card = await page.locator(`[data-ds-lane="${firstCell}"] [data-ds-item="${dragged}"]`).boundingBox();
  const row = await page.locator(`[data-ds-lane="${secondCell}"]`).boundingBox();
  await page.mouse.move(card.x + 20, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + 20, row.y + row.height / 2, { steps: 8 });
  const tip = await page.locator('.sb-drag-tip').innerText();
  assert.ok(tip.includes('→') && tip.includes(await page.evaluate((id) => sbCell(appState.scenario, id).name, secondCell)), `drag tip names the new cell (${tip})`);
  await page.mouse.up();
  const recipientOf = (key) => page.evaluate((key) => { const item = tabItemByKey(appState.scenario, key); return [item.cell_id, item.stimulus.cell_id]; }, key);
  assert.deepEqual(await recipientOf(dragged), [secondCell, secondCell], 'dropped on another row: the recipient changes');
  await page.keyboard.press('Control+z');
  assert.deepEqual(await recipientOf(dragged), [firstCell, firstCell], 'Ctrl+Z restores the planned and the written inject');

  // Cells & actors: deleting a cell is undone and redone from the keyboard, and stays deleted after a reload.
  await page.click('.nav-icon-btn[data-route="cells"]');
  const cellIds = await page.evaluate(() => appState.scenario.cells.map((cell) => cell.id));
  await page.click(`[data-tab-action="delete-cell"][data-tab-value="${secondCell}"]`);
  assert.equal(await page.evaluate(() => appState.scenario.cells.length), cellIds.length - 1);
  await page.keyboard.press('Control+z');
  assert.deepEqual(await page.evaluate(() => appState.scenario.cells.map((cell) => cell.id)), cellIds);
  await page.keyboard.press('Control+Shift+z');
  assert.deepEqual(await page.evaluate(() => appState.scenario.cells.map((cell) => cell.id)), cellIds.filter((id) => id !== secondCell));
  // Undo inside a text field stays the field's own.
  await page.fill(playerInput, 'Dr Ana Ruiz-Lopez');
  await page.focus(playerInput);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => appState.scenario.cells.length), cellIds.length - 1, 'Ctrl+Z in a field does not undo the storyline');
  await page.fill(playerInput, 'Dr Ana Ruiz');
  await page.dispatchEvent(playerInput, 'change');
  await page.click('.nav-icon-btn[data-route="detailed"]');

  // 5. Check & Challenge: readiness, live checks, one AI challenge launched from its gauge.
  assert.equal(await page.evaluate(() => document.querySelector('.nav-icon-btn[data-route="checker"]')), null, 'no separate Checker tab');
  await page.click('.nav-icon-btn[data-route="summary"]');
  assert.ok((await page.locator('.page-title, h2').first().innerText()).includes('Check & Challenge'));
  assert.ok(await page.isVisible('.cc-readiness') && await page.isVisible('.su-issue-group'), 'readiness and live checks without running anything');
  assert.equal(await page.locator('[data-su-rehearse]').count(), 0, 'no rehearsal block');
  assert.equal(await page.locator('.cc-launch').count(), 0, 'one way to launch the challenge: Challenge with AI');
  assert.equal(await page.locator('[data-action="checker-analyze"]').count(), 1);
  // The five-axis analysis streams; the timing review goes through the mocked chat endpoint.
  await page.evaluate(() => {
    const original = AITextGenerator.generateStreaming;
    AITextGenerator.generateStreaming = async (kind, ...rest) => kind === 'checker_analysis'
      ? { summary: 'Solid storyline, thin external pressure.', maturity: 'advanced_draft', priority_actions: ['Add a media inject in phase 2'], axes: [1, 2, 3, 4, 5].map(id => ({ id, title: `Axis ${id}`, verdict: id === 3 ? 'insufficient' : 'satisfactory', positive: ['Good'], negative: id === 3 ? ['No press'] : [], recommendations: ['Keep'] })) }
      : original.call(AITextGenerator, kind, ...rest);
  });
  await page.click('[data-action="checker-analyze"]');
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
  assert.deepEqual(await page.evaluate(() => appState.scenario.cells.map((cell) => cell.id)), cellIds.filter((id) => id !== secondCell), 'a deleted cell is not recreated on load');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Scenario tabs browser smoke passed.');
})().catch(error => { console.error(error); process.exit(1); });
