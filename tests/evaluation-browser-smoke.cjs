// Optional browser smoke test for the Evaluation tab; no API key needed.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/evaluation-browser-smoke.cjs [app-url] [screenshot-dir]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const shots = process.argv[3];
  await page.goto(process.argv[2] || 'http://127.0.0.1:8765/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.launch-hero-close');

  // Evaluation sits in the Run group, after Play.
  const runGroup = await page.evaluate(() => [...document.querySelectorAll('.nav-group')].map((group) => [...group.querySelectorAll('.nav-icon-btn')].map((button) => button.dataset.route)));
  assert.deepEqual(runGroup[1], ['summary', 'play', 'evaluation']);
  await page.click('.nav-icon-btn[data-route="evaluation"]');
  await page.click('.ev-cells button:nth-child(4)');

  // The rating drop-down says what each letter means.
  const options = await page.locator('.ev-criteria select.ev-rating').first().locator('option').allInnerTexts();
  assert.ok(options.includes('P · Performed without challenges') && options.includes('U · Unable to be performed'), options.join('|'));
  await page.locator('.ev-criteria select.ev-rating').first().selectOption('S');
  assert.ok(await page.locator('.ev-criteria select.ev-rating.is-S').count());
  // Generic criteria at the bottom, rated like the others.
  assert.equal(await page.locator('.ev-generic tbody tr').count(), 14);
  await page.locator('.ev-generic select.ev-rating').nth(2).selectOption('M');
  assert.equal(await page.evaluate(() => Object.values(appState.scenario.evaluation.sheets).some((sheet) => sheet.generic?.gen_logbook?.rating === 'M')), true);

  // The eye shows the stimulus as the players see it, in a right pane that can be widened.
  await page.locator('.ev-eye').first().click();
  assert.ok(await page.isVisible('.ev-view'));
  if (shots) await page.screenshot({ path: path.join(shots, 'evaluation-view.png') });
  const before = await page.evaluate(() => document.querySelector('.ev-view').getBoundingClientRect().width);
  const handle = await page.locator('[data-ev-resize]').boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 200);
  await page.mouse.down();
  await page.mouse.move(handle.x - 140, handle.y + 200, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => document.querySelector('.ev-view').getBoundingClientRect().width);
  assert.ok(after > before + 100, `${before} -> ${after}`);
  await page.locator('.ev-view-nav [data-ev-view]:not([disabled])').last().click();
  assert.ok(await page.isVisible('.ev-view'));
  await page.click('.ev-view .assistant-close');
  assert.equal(await page.locator('.ev-view').count(), 0);

  // An evaluator exports their evaluation; the central team imports it (and a filled Excel).
  await page.fill('.ev-evaluator input', 'Alice Martin');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('.ev-sheet [data-ev-action="export"]')]);
  assert.ok(download.suggestedFilename().endsWith('.crisiseval.json'));
  const json = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(json.evaluator, 'Alice Martin');
  // Bruno rates the same cell in the Excel sheet.
  await page.fill('.ev-evaluator input', 'Bruno Leroy');
  await page.locator('.ev-criteria select.ev-rating').first().selectOption('U');
  const [excel] = await Promise.all([page.waitForEvent('download'), page.click('.ev-sheet [data-ev-action="download"]')]);
  assert.ok(excel.suggestedFilename().endsWith('.xlsx'));
  const excelPath = await excel.path();
  // The central team has not rated this criterion yet.
  await page.fill('.ev-evaluator input', 'Central team');
  await page.locator('.ev-criteria select.ev-rating').first().selectOption('');
  await page.setInputFiles('[data-ev-import]', [{ name: 'alice.crisiseval.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) }, { name: 'bruno.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(excelPath) }]);
  await page.waitForSelector('.ev-report');
  const report = await page.locator('.ev-report').innerText();
  assert.ok(report.includes('Alice Martin') && report.includes('Bruno Leroy'), report);
  assert.equal(await page.locator('.ev-contrib li').count(), 2);
  // Ratings side by side: S and U give the lower one, U, as the proposal.
  assert.ok((await page.locator('.ev-criteria tbody tr').first().locator('.ev-chip').allInnerTexts()).length === 2);
  await page.click('.ev-contrib [data-ev-action="apply"]');
  assert.equal(await page.locator('.ev-criteria select.ev-rating').first().inputValue(), 'U');
  assert.ok(await page.locator('.ev-chip').count() > 0);
  if (shots) await page.screenshot({ path: path.join(shots, 'evaluation-consolidation.png'), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (shots) await page.screenshot({ path: path.join(shots, 'evaluation-top.png') });

  // Download all: a ZIP.
  const [zip] = await Promise.all([page.waitForEvent('download'), page.click('[data-ev-action="download-all"]')]);
  assert.ok(zip.suggestedFilename().endsWith('.zip'));

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('evaluation browser smoke: ok');
})().catch((error) => { console.error(error); process.exit(1); });
