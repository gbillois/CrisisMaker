// Render engine/scene.html to PNG frames via Playwright.
//   node render.js <workdir> [preview]
// <workdir> must contain timing.json; engine/project.js + engine/timing.js
// must already be written by build.py.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const work = process.argv[2];
const preview = process.argv[3] === 'preview';
const ENGINE = path.join(__dirname, '..', 'engine');
const TIMING = JSON.parse(fs.readFileSync(path.join(work, 'timing.json'), 'utf8'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGEERROR: ' + e.message); process.exitCode = 1; });
  await page.goto('file://' + path.join(ENGINE, 'scene.html'));
  await page.waitForFunction('window.READY === true', { timeout: 30000 });

  if (preview) {
    const dir = path.join(work, 'preview');
    fs.mkdirSync(dir, { recursive: true });
    for (const s of TIMING.scenes) {
      const t = (s.voStart + s.voEnd) / 2;
      await page.evaluate(tt => window.seek(tt), t);
      await page.screenshot({ path: path.join(dir, `${s.id}.png`) });
    }
    console.log('preview ok');
  } else {
    const dir = path.join(work, 'frames');
    fs.mkdirSync(dir, { recursive: true });
    const n = Math.ceil(TIMING.total * TIMING.fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate(tt => window.seek(tt), i / TIMING.fps);
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.png`) });
      if (i % 120 === 0) console.log(`FRAME ${i}/${n}`);
    }
    console.log(`FRAME ${n}/${n}`);
    console.log('done');
  }
  await browser.close();
})();
