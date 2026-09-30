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

  // Permanent bar, chronogram by phase, log panel; the download of every stimulus is in the Injects library.
  assert.equal(await page.locator('.play-generate').count(), 0);
  assert.ok(await page.isVisible('[data-play-bar] [data-play="toggle"]'));
  assert.equal(await page.locator('.play-phase-group').count(), await page.evaluate(() => sbMainBlocks(sbStoryboard()).length));
  // The log is hidden in a pane, opened from the control bar.
  assert.equal(await page.locator('.play-log').count(), 0);
  await page.click('.play-bar [data-play="log"]');
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

  // Space does nothing under the settings drawer, and starts or pauses on the tab.
  await page.evaluate(() => { appState.settingsDrawerOpen = true; App.render(); document.activeElement?.blur(); });
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => playState().running), false, 'Space under the settings drawer');
  await page.evaluate(() => { appState.settingsDrawerOpen = false; App.render(); document.activeElement?.blur(); });
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => playState().running), true);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => playState().running), false);
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
  const numbersBefore = await page.evaluate(() => [...playNumbers().entries()]);
  await page.click('[data-play="add"]');
  assert.equal(await page.evaluate(() => appState.scenario.stimuli.length), before + 1);
  assert.ok(await page.evaluate(() => !!appState.stimulusModalId));
  await page.click('[data-action="close-stimulus-modal"]');
  assert.ok(await page.isVisible('.play-added'));
  // The run has started: the new inject takes the next number, the others keep theirs; it starts blank.
  const numbersAfter = new Map(await page.evaluate(() => [...playNumbers().entries()]));
  for (const [id, number] of numbersBefore) assert.equal(numbersAfter.get(id), number, `number of ${id} kept`);
  const addedRow = page.locator('.play-row', { has: page.locator('.play-added') });
  assert.equal(await addedRow.locator('.play-num').innerText(), `#${String(before + 1).padStart(2, '0')}`);
  assert.ok((await addedRow.locator('.play-title strong').innerText()).includes('[New inject]'));

  // Filters: "Sent" shows only sent injects.
  await page.click('[data-play-quick="sent"]');
  assert.equal(await page.locator('.play-row').count(), 1);
  await page.click('[data-play-quick="all"]');

  // Time-based quick filters and their counts follow the running clock, without taking
  // the focus from the note; a clock jump brings one alert for all its injects.
  await page.click('[data-play-quick="now"]');
  const nowRows = await page.locator('.play-row').count();
  await page.click('[data-play="toggle"]');
  await page.fill('[data-play-note]', 'typing');
  await page.evaluate(() => { appState.toasts = []; renderToasts(); const play = playState(); play.offset_min = 62; play.run_since = Date.now();
    // Same phase as already logged: only the quick filter refresh can update the rows.
    play.last_phase = sbMainBlockAt(sbStoryboard(), 62).id; });
  await page.waitForFunction((count) => {
    const expected = playFilter(playItems(), playUI(), playNow());
    const rows = document.querySelectorAll('[data-play-key]').length;
    return rows > count && Math.abs(rows - expected.length) <= 1 && document.querySelector('[data-play-quick="now"] b').textContent === String(rows);
  }, nowRows, { timeout: 5000 });
  assert.ok(await page.evaluate(() => document.activeElement?.matches('[data-play-note]') && document.activeElement.value === 'typing'), 'the note keeps the focus');
  await page.waitForSelector('#toast-root .toast:has-text("to send now")', { timeout: 5000 });
  await page.waitForTimeout(1200);
  const alerts = await page.locator('#toast-root .toast', { hasText: 'to send now' }).allInnerTexts();
  assert.equal(alerts.length, 1, alerts.join(' | '));
  assert.match(alerts[0], /^\d+ injects to send now: #/);
  await page.click('[data-play="toggle"]');
  await page.fill('[data-play-note]', '');
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

  // The end: the clock pauses once, the bar says the exercise is complete, the log says so once.
  if (await page.isVisible('.launch-hero-close')) await page.click('.launch-hero-close');
  await page.click('.nav-icon-btn[data-route="play"]');
  await page.evaluate(() => { playState().offset_min = playDuration() - 0.2; });
  await page.click('[data-play="toggle"]');
  await page.waitForFunction(() => !playState().running && playState().ended, null, { timeout: 5000 });
  assert.equal(await page.locator('[data-play-phase]').innerText(), 'Exercise complete');
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => playState().running), false);
  assert.equal(await page.evaluate(() => playState().log.filter((entry) => entry.text === 'Exercise time is over').length), 1);
  assert.deepEqual(errors, []);
  // Live stimuli, like a film: the stimulus of this moment, replaced by the next one when its
  // time comes; the pane sits left of the log and is widened by dragging its left edge.
  await page.evaluate(() => { playState().running = false; playState().offset_min = 0; App.render(); });
  await page.click('.play-bar [data-play="live"]');
  assert.ok(await page.isVisible('.play-live'));
  const [firstTime, secondTime] = await page.evaluate(() => [...new Set(playItems().filter((item) => item.stimulus).map((item) => item.time))].sort((a, b) => a - b).slice(0, 2));
  await page.evaluate((t) => { playState().offset_min = t; App.render(); }, firstTime);
  const firstShown = await page.locator('.play-live-card header strong').first().innerText();
  assert.ok(firstShown.includes(`H+${Math.floor(firstTime / 60)}:${String(Math.floor(firstTime) % 60).padStart(2, '0')}`), firstShown);
  assert.ok(await page.locator('.play-live-card .play-live-stage').count() >= 1, 'the visual of the stimulus');
  assert.ok((await page.locator('.play-live-next').innerText()).includes('Next'));
  // The clock reaches the next stimulus: the tick swaps it in without a click.
  await page.evaluate((t) => { const play = playState(); play.offset_min = t - 0.05; play.speed = 30; play.running = true; play.run_since = Date.now(); App.render(); }, secondTime);
  await page.waitForFunction((t) => [...document.querySelectorAll('.play-live-card header strong')].some((el) => el.textContent.includes(`H+${Math.floor(t / 60)}:${String(Math.floor(t) % 60).padStart(2, '0')}`)), secondTime, { timeout: 8000 });
  await page.evaluate(() => { const play = playState(); play.offset_min = playNow(); play.running = false; playUI().logOpen = true; App.render(); });
  const logBox = await page.locator('.play-log').boundingBox();
  const liveBox = await page.locator('.play-live').boundingBox();
  assert.ok(Math.abs(liveBox.x + liveBox.width - logBox.x) <= 2, 'the live pane sits left of the log');
  const handle = await page.locator('.play-live .play-pane-resize').boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 200);
  await page.mouse.down();
  await page.mouse.move(handle.x - 200, handle.y + 200, { steps: 5 });
  await page.mouse.up();
  const widened = await page.locator('.play-live').boundingBox();
  assert.ok(widened.width >= liveBox.width + 150, `widened (${liveBox.width} → ${widened.width})`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.play-page')).getPropertyValue('--play-panes').trim()), `${Math.round(widened.width + logBox.width)}px`);

  // Demo mode, for a booth: the stimuli follow each other at ×50 by themselves, in a loop, and
  // the exercise clock, its log and the statuses stay as they are.
  const frozen = await page.evaluate(() => ({ now: playNow(), log: playState().log.length, sent: playItems().filter((item) => item.status === 'sent').length }));
  await page.check('[data-play-demo]');
  const firstKey = await page.getAttribute('.play-live', 'data-play-live-key');
  await page.waitForFunction((key) => document.querySelector('.play-live')?.dataset.playLiveKey !== key, firstKey, { timeout: 15000 });
  assert.equal(await page.locator('.play-live [data-play-set]').count(), 0, 'no Mark as sent in demo mode');
  // The chronogram on the left runs at the same pace: demo clock in the bar, NOW line moving.
  assert.ok((await page.locator('.play-clock .play-label').innerText()).includes('×50'));
  const clockA = await page.locator('[data-play-clock]').innerText();
  const lineA = await page.evaluate(() => document.querySelector('[data-play-now]')?.nextElementSibling?.dataset.playAt);
  await page.waitForFunction((before) => document.querySelector('[data-play-now]')?.nextElementSibling?.dataset.playAt !== before, lineA, { timeout: 15000 });
  assert.notEqual(await page.locator('[data-play-clock]').innerText(), clockA);
  assert.deepEqual(await page.evaluate(() => ({ now: playNow(), log: playState().log.length, sent: playItems().filter((item) => item.status === 'sent').length })), frozen);
  await page.uncheck('[data-play-demo]');

  await browser.close();
  console.log('Play browser smoke passed.');
})().catch((error) => { console.error(error); process.exit(1); });
