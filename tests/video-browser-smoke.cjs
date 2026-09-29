// Video Debrief produced in the browser, offline: no voice (music + subtitles),
// frames from the scene engine, WebCodecs encoding, MP4 muxing. The video is the one of
// the demo project, opened from CrisisMaker on a first visit.
//   node tests/video-browser-smoke.cjs [http://127.0.0.1:8765/]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
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
  // A first visit: the demo project opens its video debrief at step 2, its scenario written.
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.launch-hero-close');
  await page.click('.nav-icon-btn[data-route="debrief"]');
  await page.click('[data-db-part="video"]');
  const studio = await (await page.waitForSelector('#video-debrief-frame')).contentFrame();
  await studio.waitForFunction(() => typeof project !== 'undefined' && project && project.scenes.length > 3);
  const opened = await studio.evaluate(async () => ({
    step: document.querySelector('.step-btn.active')?.dataset.step,
    title: $('p-title').value,
    cards: document.querySelectorAll('#scene-list > *').length,
    lang: $('set-lang').value,
    sameAsExample: JSON.stringify(project) === JSON.stringify(await (await fetch('examples/stonawave.json')).json())
  }));
  assert.deepEqual(opened, { step: '2', title: 'StonaWave, Operation Cold Chain', cards: 8, lang: 'en', sameAsExample: true });
  assert.equal(await studio.evaluate(() => project.theme.preset), 'wavestone', 'Wavestone style by default');
  // Two scenes keep the production short.
  await studio.evaluate(() => { const p = JSON.parse(JSON.stringify(project)); p.scenes = [p.scenes[0], p.scenes[p.scenes.length - 1]]; applyProject(p); });
  await studio.click('.step-btn[data-step="3"]');
  assert.ok(await studio.isVisible('#btn-local-voice'), 'the local voice button is on the production step');
  assert.equal(await studio.evaluate(() => typeof window.ort), 'undefined', 'the voice engine is not loaded by default');
  assert.equal(await studio.isChecked('#browser-subtitles'), true, 'subtitles on without a voice');
  await studio.click('#btn-browser-produce');
  await studio.waitForFunction(() => $('browser-done').style.display === 'block' || /Failed|Échec|Fehler/.test($('browser-stage').textContent), null, { timeout: 600000 });
  const stage = await studio.textContent('#browser-stage');
  assert.ok(!/Failed|Échec|Fehler/.test(stage), stage);
  const result = await studio.evaluate(async () => {
    const blob = await (await fetch($('browser-link').href)).blob();
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    return { size: blob.size, type: blob.type, box: String.fromCharCode(...head.slice(4, 8)), name: $('browser-link').download };
  });
  assert.equal(result.box, 'ftyp');
  assert.ok(result.size > 100000, `file size ${result.size}`);
  assert.ok(/^stonawave-operation-cold-chain-debrief-video\.(mp4|mov)$/.test(result.name), result.name);
  assert.deepEqual(external, [], 'nothing fetched for the voice');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(`Video browser smoke passed (${(result.size / 1048576).toFixed(1)} MB, ${result.name}).`);
})().catch(error => { console.error(error); process.exit(1); });
