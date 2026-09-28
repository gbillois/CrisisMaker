// Optional browser smoke test for the Play tab; no API key needed.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/play-browser-smoke.cjs [app-url]
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.argv[2] || 'http://127.0.0.1:8765/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.launch-hero-close');
  await page.click('.nav-icon-btn[data-route="play"]');

  // Generate block, permanent bar, chronogram by phase, log panel.
  assert.ok(await page.isVisible('.play-generate [data-action="export-all"]'));
  assert.ok(await page.isVisible('[data-play-bar] [data-play="toggle"]'));
  assert.equal(await page.locator('.play-phase-group').count(), await page.evaluate(() => sbMainBlocks(sbStoryboard()).length));
  assert.ok(await page.isVisible('.play-log'));

  // Start at ×30: the clock runs, the log records the start.
  await page.selectOption('[data-play-speed]', '30');
  await page.click('[data-play="toggle"]');
  await page.waitForFunction(() => playNow() > 1);
  assert.ok((await page.locator('.play-log-list').innerText()).includes('Exercise started'));

  // The bar stays visible while scrolling the chronogram.
  await page.evaluate(() => window.scrollTo(0, 1500));
  const barTop = await page.evaluate(() => document.querySelector('[data-play-bar]').getBoundingClientRect().top);
  assert.ok(barTop >= 100 && barTop <= 112, `sticky bar (${barTop})`);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Pause, then send #01, bring it back to draft, send it again: all logged.
  await page.click('[data-play="toggle"]');
  const first = await page.evaluate(() => getSortedStimuli()[0].id);
  await page.click(`[data-play-set="sent"][data-stimulus-id="${first}"]`);
  await page.click(`[data-play-set="draft"][data-stimulus-id="${first}"]`);
  await page.click(`[data-play-set="sent"][data-stimulus-id="${first}"]`);
  assert.equal(await page.evaluate((id) => getStimulus(id).sent_count, first), 2);
  assert.ok((await page.locator('.play-log-list').innerText()).includes('re-sent (2×)'));

  // A pilot note, then an inject added on the fly opens the editor.
  await page.fill('[data-play-note]', 'Decision cell asks for a press briefing');
  await page.press('[data-play-note]', 'Enter');
  assert.ok((await page.locator('.play-log-list').innerText()).includes('press briefing'));
  const before = await page.evaluate(() => appState.scenario.stimuli.length);
  await page.click('[data-play="add"]');
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.length), before + 1);
  assert.ok(await page.evaluate(() => !!appState.stimulusModalId));
  await page.click('[data-action="close-stimulus-modal"]');
  assert.ok(await page.isVisible('.play-added'));

  // Filters: "Sent" shows only sent injects.
  await page.click('[data-play-quick="sent"]');
  assert.equal(await page.locator('.play-row').count(), 1);
  await page.click('[data-play-quick="all"]');

  // Save log downloads a CSV.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-play="save-log"]')]);
  assert.ok(download.suggestedFilename().endsWith('_exercise-log.csv'));

  // Reset play asks twice; declining the second keeps everything.
  let dialogs = 0;
  page.on('dialog', (dialog) => { dialogs++; dialogs === 2 ? dialog.dismiss() : dialog.accept(); });
  await page.click('[data-play="reset-all"]');
  assert.equal(dialogs, 2);
  assert.ok(await page.evaluate(() => playState().log.length > 0));
  dialogs = 10;
  page.removeAllListeners('dialog');
  page.on('dialog', (dialog) => dialog.accept());
  await page.click('[data-play="reset-all"]');
  assert.equal(await page.evaluate(() => playState().log.length), 0);
  assert.equal(await page.evaluate((id) => getStimulus(id).status, first), 'ready');

  // State survives a reload.
  await page.click(`[data-play-set="sent"][data-stimulus-id="${first}"]`);
  await page.reload();
  assert.equal(await page.evaluate((id) => getStimulus(id).status, first), 'sent');
  assert.equal(await page.evaluate(() => playState().log.length), 1);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Play browser smoke passed.');
})().catch((error) => { console.error(error); process.exit(1); });
