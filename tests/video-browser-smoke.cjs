// Video Debrief produced in the browser, offline: no voice (music + subtitles),
// frames from the scene engine, WebCodecs encoding, MP4 muxing.
//   node tests/video-browser-smoke.cjs [http://127.0.0.1:8765/]
const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const base = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const external = [];
  page.on('request', request => { if (/onnxruntime|piper|huggingface/.test(request.url())) external.push(request.url()); });
  await page.goto(`${base}video-debrief/index.html`);
  // The studio shows three steps only: no local server, no GitHub production.
  for (const gone of ['#server-label', '#btn-produce', '#btn-gh-produce', '#src-material']) assert.equal(await page.$(gone), null, gone);
  await page.evaluate(() => fetch('examples/stonawave.json').then((r) => r.json()).then((p) => applyProject(p)));
  await page.waitForFunction(() => project && project.scenes.length > 3);
  assert.equal(await page.evaluate(() => project.theme.preset), 'wavestone', 'Wavestone style by default');
  await page.evaluate(() => { const p = JSON.parse(JSON.stringify(project)); p.scenes = [p.scenes[0], p.scenes[p.scenes.length - 1]]; applyProject(p); });
  await page.click('.step-btn[data-step="3"]');
  assert.ok(await page.isVisible('#btn-local-voice'), 'the local voice button is on the production step');
  assert.equal(await page.evaluate(() => typeof window.ort), 'undefined', 'the voice engine is not loaded by default');
  assert.equal(await page.isChecked('#browser-subtitles'), true, 'subtitles on without a voice');
  await page.click('#btn-browser-produce');
  await page.waitForFunction(() => $('browser-done').style.display === 'block' || /Failed|Échec|Fehler/.test($('browser-stage').textContent), null, { timeout: 600000 });
  const stage = await page.textContent('#browser-stage');
  assert.ok(!/Failed|Échec|Fehler/.test(stage), stage);
  const result = await page.evaluate(async () => {
    const blob = await (await fetch($('browser-link').href)).blob();
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    return { size: blob.size, type: blob.type, box: String.fromCharCode(...head.slice(4, 8)), name: $('browser-link').download };
  });
  assert.equal(result.box, 'ftyp');
  assert.ok(result.size > 100000, `file size ${result.size}`);
  assert.ok(/^stonawave.*\.(mp4|mov)$/.test(result.name), result.name);
  assert.deepEqual(external, [], 'nothing fetched for the voice');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(`Video browser smoke passed (${(result.size / 1048576).toFixed(1)} MB, ${result.name}).`);
})().catch(error => { console.error(error); process.exit(1); });
