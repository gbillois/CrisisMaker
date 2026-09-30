// Browser smoke test of the Context tab's AI generation with every box ticked: a deck with its
// own phases, a mocked AI (no key, no credits) whose builder agent plans no inject (as real
// models sometimes do), and a report that must show everything created.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/context-creation-browser-smoke.cjs [app-url]
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function agentAnswer(payload) {
  const blocks = payload.state.storyboard.blocks;
  if (!blocks.length) {
    return { type: 'tool_call', tool: 'buildMainStoryline', reason: 'The three sequences of the deck', arguments: {
      title: 'AI agent out of control', summary: 'An AI agent intrudes on a competitor.', objectives: ['Decide under uncertainty'],
      cast: [{ key: 'competitor', label: 'Competitor', role: 'partner' }, { key: 'press', label: 'Journalist', role: 'journalist' }],
      // No inject wanted nor planned: the stimuli step must still create some.
      phases: [
        { type: 'trigger', title: 'Sequence 1', start_minutes: 0, duration_minutes: 15, injects: 0, brief: 'A third party reports an intrusion.' },
        { type: 'investigation', title: 'Sequence 2', start_minutes: 15, duration_minutes: 15, injects: 0, brief: 'Proof of the AI agent.' },
        { type: 'containment', title: 'Sequence 3', start_minutes: 30, duration_minutes: 15, injects: 0, brief: 'A fix is deployed.' }
      ] } };
  }
  const index = payload.step - 2;
  if (index >= 0 && index < blocks.length) return { type: 'tool_call', tool: 'setMainEvents', reason: 'Key points', arguments: { id: blocks[index].id, events: [{ at: 2, text: `Key point of ${blocks[index].title}` }] } };
  return { type: 'final', summary: 'Framing built.', issues: [], changes: ['Phases', 'Main events'] };
}

function answerFor(system, user) {
  if (system.includes('fill the frame of the exercise')) return { duration_minutes: 45, understanding: ['A 45-minute board exercise'], missing: [], learning_objectives: 'Board: decide under uncertainty', incident_timeline: 'D-1: the AI agent intrudes', context: 'An AI agent goes beyond its role.', cells: [{ name: 'Board', players: [{ role: 'CEO' }, { role: 'General counsel' }] }] };
  if (system.includes('Crisis Context Builder Agent')) return agentAnswer(JSON.parse(user));
  if (system.includes('senior crisis exercise evaluator')) return { criteria: [{ category: 'Decision', text: 'Decides on the AI agent shutdown', observe: 'Decision logged by minute 30' }] };
  if (system.includes('Scenario Builder')) {
    const payload = JSON.parse(user);
    if (payload.task.startsWith('Deepen')) {
      const cast = payload.context.storyboard.cast;
      const cells = payload.context.storyboard.cells;
      return { blocks: payload.target.map((target) => ({ id: target.id, beats: Array.from({ length: Math.max(0, target.injects - target.existing_beats) }, (_, i) => ({ at: i * 3, channel: 'email_external', cast: cast[i % cast.length].id, cell: cells[i % cells.length].id, title: `Stimulus ${i + 1}`, intent: 'Pushes a decision.' })) })) };
    }
    if (payload.task.startsWith('Give realistic')) return { actors: payload.roles.map((role) => ({ cast: role.cast, name: `${role.label} person`, title: role.label, organization: 'Contoso', role: role.role, language: 'en' })) };
    return { score: 80, summary: 'Coherent.', issues: [] };
  }
  return { subject: 'Intrusion traced back to your network', body: '<p>Our security team traced last night’s intrusion back to addresses of your group. We expect an explanation today.</p>', text: 'Intrusion traced back to your network: explain today.', headline: 'Intrusion traced', title: 'Intrusion traced' };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('https://api.openai.com/v1/chat/completions', async (route) => {
    const body = JSON.parse(route.request().postData());
    const answer = answerFor(body.messages[0].content, body.messages[1].content);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }) });
  });
  await page.goto(process.argv[2] || 'http://127.0.0.1:8765/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.launch-hero-close');
  await page.evaluate(() => { appState.scenario = emptyScenario({ ...appState.scenario.settings, ai_provider: 'openai', ai_api_key: 'sk-test', ai_model: 'gpt-test' }); appState.route = 'scenario'; App.render(); });

  // The example deck, offered next to the upload zone: downloaded, then loaded.
  const download = page.waitForEvent('download');
  await page.click('[data-cx-example-download]');
  assert.equal((await download).suggestedFilename(), 'exemple-support-exercice-crise.pptx');
  await page.click('[data-cx-example-load]');
  await page.waitForSelector('.cx-file-loaded');
  assert.ok((await page.locator('.cx-essentials').innerText()).includes('7 of the 7 essential points'));
  // The five boxes, all ticked by default.
  assert.equal(await page.locator('[data-cx-create]:checked').count(), 5);
  await page.fill('[data-sb-meta="brief"]', 'Board exercise on an AI agent out of control.');
  await page.dispatchEvent('[data-sb-meta="brief"]', 'input');
  await page.selectOption('[data-cx-mode]', 'auto');
  await page.click('[data-cx-generate]');
  await page.waitForFunction(() => ContextGeneration.report && !ContextGeneration.busy(), null, { timeout: 120000 });

  const report = await page.evaluate(() => ContextGeneration.report);
  if (process.env.DEBUG_SMOKE) console.log(await page.evaluate(() => JSON.stringify({ log: SbPipeline.log.slice(-15), agent: getCrisisAgent().log.slice(-12).map(e => e.message), phases: sbMainBlocks(appState.scenario.storyboard).map(b => [b.title, b.stimuli_target, b.beats.length, (b.events||[]).length]) })));
  assert.deepEqual(report.map((item) => [item.key, item.ok]), [['context', true], ['cells', true], ['phases', true], ['stimuli', true], ['evaluation', true]], JSON.stringify(report));
  const state = await page.evaluate(() => ({
    duration: appState.scenario.storyboard.duration_minutes,
    phases: sbMainBlocks(appState.scenario.storyboard).map((block) => [block.title, block.beats.length]),
    stimuli: appState.scenario.stimuli.length,
    actors: appState.scenario.actors.length,
    sheets: Object.keys(appState.scenario.evaluation.sheets).length,
    route: appState.route
  }));
  assert.equal(state.duration, 45);
  assert.deepEqual(state.phases.map(([title]) => title), ['Sequence 1', 'Sequence 2', 'Sequence 3'], 'exactly the phases of the deck');
  assert.ok(state.phases.every(([, beats]) => beats >= 5), `every phase got the injects the deck lists (14 over 3 sequences) although the agent planned none: ${JSON.stringify(state.phases)}`);
  assert.ok(state.stimuli >= 15 && state.actors >= 1 && state.sheets === 1, JSON.stringify(state));
  assert.equal(state.route, 'scenario', 'back to the Context, on the report');
  assert.ok(await page.isVisible('.cx-report:not(.has-failed)'));
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Context creation browser smoke passed.');
})().catch((error) => { console.error(error); process.exit(1); });
