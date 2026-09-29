// Optional browser smoke test; no application dependency. Uses an existing Playwright installation.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/agent-browser-smoke.cjs [app-url]
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let step = 0, reviewStep = 0;
  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    const input = JSON.parse(JSON.parse(route.request().postData()).messages[1].content);
    const responses = [
      { type: 'tool_call', tool: 'getScenario', arguments: {}, reason: 'Inspect existing exercise' },
      { type: 'tool_call', tool: 'updateScenario', arguments: { name: 'Bank ransomware exercise', client: { name: 'Test Bank', sector: 'Banking' }, scenario: { summary: 'Ransomware threatens payment services. Teams must weigh isolation against continuity.' } }, reason: 'Apply the banking brief' },
      { type: 'tool_call', tool: 'updateExerciseObjectives', arguments: { objectives: 'Test executive isolation, external communication and safe restoration decisions.' }, reason: 'Make participant decisions explicit' },
      { type: 'tool_call', tool: 'setPhases', arguments: { phases: [{ name: 'Escalation and decisions', start_minutes: 0, end_minutes: 240, purpose: 'Containment, communication, recovery' }] }, reason: 'Plan four hours' },
      { type: 'tool_call', tool: 'createActor', arguments: { name: 'Bank CISO', role: 'internal', title: 'CISO' }, reason: 'Create the decision requester' },
      { type: 'tool_call', tool: 'createStimulus', arguments: { name: 'Isolation decision', actor_id: input.state.actors[0]?.id || 'placeholder', channel: 'email_internal', timestamp_offset_minutes: 90, status: 'ready', fields: { subject: 'Disconnect payment services?', body: '<p>Isolate now and halt payments, or remain online and risk further spread. Decide by T+100.</p><script>window.AGENT_XSS=true</script>' } }, reason: 'Introduce a concrete executive dilemma' },
      { type: 'tool_call', tool: 'runConsistencyCheck', arguments: {}, reason: 'Re-analyze the resulting exercise' },
      { type: 'final', summary: 'Created a bank exercise with a concrete isolation dilemma.', issues: ['Additional communication and recovery injects are still needed.'], changes: ['Scenario, objectives, phase, actor and timed inject'] }
    ];
    const reviewer = [
      { type: 'tool_call', tool: 'getStimulus', arguments: { id: input.state.timeline[0]?.id || 'missing' }, reason: 'Inspect the existing dilemma' },
      { type: 'tool_call', tool: 'updateStimulus', arguments: { id: input.state.timeline[0]?.id || 'missing', patch: { fields: { body: '<p>Isolation will halt payments for two hours. Remaining online risks backup compromise. The CEO must decide by T+100, then explain the impact to customers.</p>' } } }, reason: 'Add consequences and a decision owner' },
      { type: 'tool_call', tool: 'runConsistencyCheck', arguments: {}, reason: 'Re-analyze the improvement' },
      { type: 'final', summary: 'Strengthened the isolation dilemma.', issues: [], changes: ['Added CEO decision, deadline and consequences'] }
    ];
    const system = JSON.parse(route.request().postData()).messages[0].content;
    // Assistant chat: a question answered from the data, then a change request.
    const assistant = input.objective.includes('Rename the exercise')
      ? (input.step === 1 ? { type: 'tool_call', tool: 'updateExerciseObjectives', arguments: { objectives: 'Chat objective' }, reason: 'Apply the requested change' } : { type: 'final', summary: 'Done:\n- objectives updated', issues: [], changes: ['Objectives'] })
      : (input.step === 1 ? { type: 'tool_call', tool: 'getStoryboard', arguments: {}, reason: 'Read the storyline' } : { type: 'final', summary: 'The exercise has one inject so far.', issues: [], changes: [] });
    const response = system.includes('You are the CrisisMaker Assistant') ? assistant : system.includes('You are the Crisis Reviewer Agent.') ? reviewer[Math.min(reviewStep++, reviewer.length - 1)] : responses[Math.min(step++, responses.length - 1)];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }) });
  });
  await page.goto(process.argv[2] || 'http://127.0.0.1:8765/', { waitUntil: 'load' });
  await page.evaluate(() => {
    appState.scenario = emptyScenario({ ai_provider: 'openai', ai_api_key: 'mock-key', ai_model: 'mock-model', confidentiality_acknowledged: true });
    appState.launchScreenOpen = false; App.render();
  });
  // The agent console lives in Settings, not in the tab bar.
  assert.equal(await page.locator('.nav-icon-btn[data-route="agent"]').count(), 0);
  await page.locator('.brand-actions .nav-gear-btn[data-action="toggle-settings-drawer"]').click();
  await page.locator('.settings-agent-card [data-agent-action="open-console"]').click();
  await page.locator('#agent-mode').selectOption('auto');
  await page.locator('#agent-objective').fill('Build a 4-hour ransomware bank exercise testing executive decisions.');
  await page.locator('[data-agent-action="start"]').click();
  await page.waitForFunction(() => crisisAgentRunner.status === 'complete');
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.length), 1);
  assert.equal(await page.evaluate(() => window.AGENT_XSS), undefined);
  assert.equal(await page.evaluate(() => appState.scenario.stimuli[0].fields.body.includes('<script>')), false);
  assert.equal(await page.evaluate(() => appState.scenario.stimuli[0].timestamp_offset_minutes), 90);
  const built = await page.evaluate(() => buildProjectFileData());
  await page.screenshot({ path: '/tmp/crisismaker-agent-desktop.png', fullPage: true });
  await page.locator('.nav-icon-btn[data-route="scenario"]').click();
  assert.ok((await page.evaluate(() => appState.scenario.scenario.objectives)).includes('isolation'));
  await page.locator('.nav-icon-btn[data-route="detailed"]').click();
  assert.ok((await page.locator('main').innerText()).includes('Isolation decision'));
  await page.evaluate(() => { appState.route = 'agent'; App.render(); });
  // One challenge: the reviewer is no longer in the console; Check & Challenge starts it.
  assert.deepEqual(await page.locator('#agent-kind option').evaluateAll((options) => options.map((option) => option.value)), ['builder', 'designer']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/crisismaker-agent-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'No mobile horizontal overflow');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-agent-action="undo"]').click();
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.length), 0);
  assert.equal(await page.evaluate(() => appState.scenario.actors.length), 0);
  assert.equal(await page.evaluate(() => appState.scenario.settings.ai_api_key), 'mock-key');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(project => { applyLoadedScenario(project); appState.route = 'agent'; App.render(); }, built);
  // The fix of a Check & Challenge priority action, in Assist mode: every change waits for approval.
  await page.evaluate(() => { startCrisisAgent({ kind: 'reviewer', mode: 'assist', objective: 'Apply these priority actions of the Check & Challenge report to the exercise, then re-check it:\n1. Strengthen weak dilemmas.', origin: 'summary' }); });
  await page.waitForFunction(() => crisisAgentRunner.status === 'approval');
  assert.ok((await page.locator('.agent-approval').innerText()).includes('decision owner'));
  assert.ok(!(await page.evaluate(() => appState.scenario.stimuli[0].fields.body)).includes('two hours'));
  await page.screenshot({ path: '/tmp/crisismaker-agent-approval.png', fullPage: true });
  await page.locator('[data-agent-action="approve"]').click();
  await page.waitForFunction(() => crisisAgentRunner.status === 'complete');
  assert.ok((await page.evaluate(() => appState.scenario.stimuli[0].fields.body)).includes('two hours'));
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-agent-action="undo"]').click();
  assert.equal(await page.evaluate(() => appState.scenario.stimuli[0].fields.body), built.stimuli[0].fields.body);

  // Assistant: floating button, suggestions, a question, then a change and its undo.
  await page.locator('.brand-project').click();
  await page.locator('.project-menu [data-route="project"]').click();
  await page.locator('.assistant-fab').click();
  await page.locator('.assistant-panel').waitFor();
  assert.ok(await page.locator('.assistant-chip').count() >= 6);
  await page.locator('[data-assistant-input]').fill('How many injects are there?');
  await page.locator('[data-assistant-input]').press('Enter');
  await page.waitForFunction(() => assistantState().messages.length === 2 && !crisisAgentRunner.active);
  assert.ok((await page.locator('.assistant-thread').innerText()).includes('one inject so far'));
  await page.locator('[data-assistant-input]').fill('Rename the exercise objectives');
  await page.locator('.assistant-send').click();
  await page.waitForFunction(() => assistantState().messages.length === 4 && !crisisAgentRunner.active);
  assert.equal(await page.evaluate(() => appState.scenario.scenario.objectives), 'Chat objective');
  assert.ok((await page.locator('.assistant-thread').innerText()).includes('objectives updated'));
  await page.screenshot({ path: '/tmp/crisismaker-assistant.png' });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.assistant-panel [data-agent-action="undo"]').click();
  assert.notEqual(await page.evaluate(() => appState.scenario.scenario.objectives), 'Chat objective');
  await page.locator('[data-assistant="clear"]').click();
  assert.equal(await page.evaluate(() => assistantState().messages.length), 0);
  await page.locator('[data-assistant="close"]').click();
  assert.equal(await page.locator('.assistant-panel').count(), 0);
  assert.deepEqual(errors, []);
  await browser.close(); console.log('Browser smoke passed: build, content sanitization, normal UI, responsive layout, reviewer approval, undo, assistant chat.');
})().catch(error => { console.error(error); process.exit(1); });
