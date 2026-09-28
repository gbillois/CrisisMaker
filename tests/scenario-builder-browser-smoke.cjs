// Optional browser smoke test for the Scenario Builder; mocked AI, no API key or credits.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/scenario-builder-browser-smoke.cjs [app-url]
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function answerFor(system, user) {
  if (!system.includes('Scenario Builder')) return { subject: 'Generated subject', body: '<p>Generated body</p>', headline: 'Generated headline', text: 'Generated text', title: 'Generated title' };
  const payload = JSON.parse(user);
  if (payload.task.startsWith('Design a complete')) {
    return {
      title: 'Hospital ransomware drill', summary: 'A ransomware affiliate encrypts the hospital group.', threat: 'Affiliate via VPN',
      objectives: ['Protect patient safety', 'Notify authorities on time'],
      cast: [{ key: 'ciso', label: 'CISO', role: 'internal' }, { key: 'press', label: 'Health reporter', role: 'journalist' }],
      tracks: ['main', 'communication'],
      blocks: [
        { key: 'b1', type: 'trigger', title: 'Night alerts', track: 'main', start: 0, duration: 60, stimuli: 2, brief: 'EDR alerts.', objectives: [0] },
        { key: 'b2', type: 'containment', title: 'Isolate or not', track: 'main', start: 60, duration: 60, stimuli: 2, brief: 'Isolation dilemma.' },
        { key: 'b3', type: 'exit', title: 'Exit', track: 'main', start: 120, duration: 60, stimuli: 1, brief: 'Close.' },
        { key: 'b4', type: 'communication', title: 'Media storm', track: 'communication', start: 30, duration: 90, stimuli: 2, brief: 'Press calls.', objectives: [1] }
      ]
    };
  }
  if (payload.task.startsWith('Deepen')) {
    const cast = payload.context.storyboard.cast;
    return { blocks: payload.target.map(target => ({ id: target.id, narrative: 'Players only see partial information.', beats: target.want === 'narrative' ? undefined : Array.from({ length: target.injects - target.existing_beats }, (_, i) => ({ at: i * 10, channel: i % 2 ? 'sms_notification' : 'email_internal', cast: cast[i % cast.length].id, title: `Inject ${i + 1}`, intent: 'Forces a decision.' })) })) };
  }
  if (payload.task.startsWith('Give realistic')) return { actors: payload.roles.map(role => ({ cast: role.cast, name: `${role.label} person`, title: role.label, organization: 'Hospital group', role: role.role, language: 'en' })) };
  return { score: 80, summary: 'Coherent.', issues: [] };
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
  assert.ok(await page.isVisible('.sb-workspace'), 'Scenario Builder is the landing tab');
  await page.evaluate(() => { appState.scenario = emptyScenario({ ...appState.scenario.settings, ai_provider: 'openai', ai_api_key: 'sk-test', ai_model: 'gpt-test' }); App.render(); });

  // Library: preview and use a built-in scenario, then undo it.
  await page.click('[data-sb-action="set-bin"][data-sb-value="library"]');
  await page.click('[data-sb-action="preview-template"][data-sb-template="ransomware-double-extortion"]');
  await page.click('.sb-modal-foot [data-sb-action="use-template"][data-sb-mode="replace"]');
  assert.ok(await page.evaluate(() => sbStoryboard().blocks.length) >= 8);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => sbStoryboard().blocks.length), 0);

  // AI skeleton, deepening and generation.
  await page.click('[data-sb-modal="skeleton"]');
  await page.fill('[data-sb-ui="skeleton.brief"]', 'Three-hour hospital ransomware exercise');
  await page.fill('[data-sb-ui="skeleton.duration"]', '180');
  await page.click('[data-sb-action="generate-skeleton"]');
  await page.waitForFunction(() => sbStoryboard().blocks.length === 4);
  await page.click('[data-sb-action="deepen-all"]');
  await page.waitForFunction(() => sbStoryboard().blocks.every(block => block.narrative));
  await page.click('[data-sb-modal="generate"]');
  await page.click('[data-sb-action="start-generation"]');
  await page.waitForFunction(() => SbPipeline.status === 'complete', null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.length), 7);
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.every(s => s.scenario_link && s.status === 'ready')), true);
  await page.click('[data-sb-action="close-modal"]');

  // Drag the containment clip 30 minutes later, then synchronise.
  const id = await page.evaluate(() => sbStoryboard().blocks.find(block => block.type === 'containment').id);
  const clip = await page.$(`[data-sb-clip="${id}"]`);
  const box = await clip.boundingBox();
  const ppm = await page.evaluate(() => sbUI().zoom);
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30 * ppm, box.y + 12, { steps: 6 });
  await page.mouse.up();
  const moved = await page.evaluate(id => sbBlock(sbStoryboard(), id).start_minutes, id);
  assert.ok(moved > 60, `block moved (${moved})`);
  assert.ok(await page.evaluate(() => sbComputeImpacts(appState.scenario).some(impact => impact.kind === 'retime')));
  await page.click('[data-sb-modal="sync"]');
  await page.click('[data-sb-action="apply-sync"]');
  await page.waitForFunction(() => !SbPipeline.active);
  assert.equal(await page.evaluate(() => sbComputeImpacts(appState.scenario).length), 0);

  // Persistence across reload.
  await page.evaluate(() => saveLocal(false));
  await page.reload();
  assert.equal(await page.evaluate(() => appState.scenario.storyboard.blocks.length), 4);
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.filter(s => s.scenario_link).length), 7);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Scenario Builder browser smoke passed.');
})().catch(error => { console.error(error); process.exit(1); });
