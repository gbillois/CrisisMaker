// Scale test: a 300-inject exercise through every save, export and import path.
//   node tests/scale-browser-smoke.cjs [http://127.0.0.1:8765/] [injects=300]
// Builds the exercise inside the app (library storyline, 6 cells, 40 actors, every inject
// template, long texts, photos, a Play log), then checks that nothing is lost or changed
// through: browser save + reload, JSON export, JSON import, ZIP export (images + CSV + JSON)
// and ZIP import. Prints the time and size of each step.
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const base = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const COUNT = Number(process.argv[3]) || 300;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-scale-'));
const report = [];
const step = (name, ms, extra = '') => { report.push(`${name.padEnd(34)} ${String(Math.round(ms)).padStart(7)} ms  ${extra}`); console.log(report[report.length - 1]); };

/* Everything that must survive a round trip, in a stable order. */
const SNAPSHOT = `(() => {
  const p = appState.scenario;
  return JSON.stringify({
    name: p.name, client: p.client, lo: p.scenario.learning_objectives, ap: p.scenario.attack_path, summary: p.scenario.summary,
    cells: p.cells.map(c => [c.id, c.name, c.description, c.objectives, c.players.map(x => [x.id, x.name, x.role, x.email])]),
    actors: p.actors.map(a => [a.id, a.name, a.role, a.organization, a.title, a.language]),
    blocks: p.storyboard.blocks.map(b => [b.id, b.title, b.brief, b.narrative, b.start_minutes, b.duration_minutes, b.plan_hash, [...b.beats].sort((x, y) => x.id < y.id ? -1 : 1).map(k => [k.id, k.offset_minutes, k.channel, k.cell_id, k.cast_id, k.title, k.intent])]),
    cast: p.storyboard.cast.map(c => [c.id, c.label, c.actor_id]),
    stimuli: p.stimuli.map(s => [s.id, s.name, s.channel, s.template_id, s.actor_id, s.cell_id, s.timestamp_offset_minutes, s.status, s.sent_at || null, s.sent_count || 0, s.added_in_play || false, s.fields, s.scenario_link || null]),
    log: (p.play?.log || []).map(e => [e.type, e.text, Math.round(e.t * 100)]),
    versions: (p.storyboard_versions || []).length
  });
})()`;

/* The first place where two snapshots differ, as a readable path. */
function firstDiff(a, b, where = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) && a.length !== b.length) return `${where}: length ${a.length} -> ${b.length}`;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const found = firstDiff(a[key], b[key], `${where}.${key}`);
      if (found) return found;
    }
  }
  return `${where}: ${JSON.stringify(a)?.slice(0, 160)} -> ${JSON.stringify(b)?.slice(0, 160)}`;
}
function sameAs(original, other, message) {
  const diff = firstDiff(JSON.parse(original), JSON.parse(other));
  assert.ok(!diff, `${message}; first difference ${diff}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const dialogs = [];
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); dialog.accept(); });
  // The classic file input path (the File System Access picker cannot be automated).
  await page.addInitScript(() => { window.showOpenFilePicker = async () => { throw new Error('The test uses the classic file input.'); }; });
  await page.goto(`${base}index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.launch-hero-close');

  // ── 1. Build the exercise ────────────────────────────────────────────────────
  let t0 = Date.now();
  const built = await page.evaluate(async (COUNT) => {
    const p = emptyScenario({ ...appState.scenario.settings });
    appState.scenario = p;
    p.name = 'Scale test « Opération Nuit Blanche » — 300 injects';
    p.client = { ...p.client, name: 'Groupe Hospitalier Émeraude', sector: 'Healthcare' };
    p.scenario.summary = 'Ransomware on a regional hospital group. '.repeat(20);
    p.scenario.learning_objectives = 'Decide under uncertainty; notify authorities within 72 h; keep patients safe.';
    p.scenario.attack_path = Array.from({ length: 8 }, (_, i) => `${i + 1}. Step ${i + 1}: lateral movement, "quoted", <tag> & ampersand`).join('\n');
    StoryboardHistory.ensure(p);
    sbApplyTemplate(sbFindTemplate('ransomware-double-extortion'), 'replace');
    // 6 cells with players.
    const cells = sbNormalizeCells(['Decision', 'Operations', 'Communication', 'Legal', 'IT & SOC', 'Business continuity'].map((name, i) => ({ name: `${name} cell`, description: `Mission of the ${name} cell. `.repeat(4), objectives: `Objectives ${i}: act fast, stay accurate.`, players: Array.from({ length: 4 }, (_, k) => ({ name: `Player ${i}-${k} Ünïcødé`, role: 'Member', email: `p${i}${k}@example.org` })) })));
    p.cells = cells;
    // The library storyline's own planned injects go to these cells.
    p.storyboard.blocks.forEach((block) => block.beats.forEach((beat, k) => { beat.cell_id = cells[k % cells.length].id; }));
    // 40 actors of every role.
    const roles = ['internal', 'journalist', 'authority', 'attacker', 'partner', 'customer', 'expert'];
    p.actors = Array.from({ length: 40 }, (_, i) => ({ id: uid('actor'), name: `Actor ${i} Ñoël O'Brien "Jr"`, role: roles[i % roles.length], organization: `Org ${i % 9}`, title: `Title ${i}`, language: 'fr', avatar_initials: 'AO', avatar_url: '' }));
    // Every role of the storyline is played by one of the actors.
    p.storyboard.cast.forEach((cast, k) => { cast.actor_id = p.actors[k % p.actors.length].id; });
    sbSealLinks(p);
    // Every inject template, a few TV injects.
    const channels = Object.keys(TEMPLATE_LIBRARY);
    const blocks = sbMainBlocks(p.storyboard);
    const longText = (i) => `<p>Paragraphe ${i} : l'attaquant « PharmLeaks » exige 25 M$ — délai 48 h. Emoji 🚨 et caractères spéciaux <b>&amp;</b> "guillemets".</p>`.repeat(6);
    const photo = (() => {
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
      const g = c.getContext('2d');
      for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 37 % 360},60%,${30 + i % 40}%)`; g.fillRect((i * 97) % 1600, (i * 53) % 1000, 120, 80); }
      return c.toDataURL('image/jpeg', 0.8);
    })();
    let photos = 0;
    for (let i = 0; i < COUNT; i++) {
      const block = blocks[i % blocks.length];
      const cell = cells[i % cells.length];
      const cast = p.storyboard.cast[i % p.storyboard.cast.length];
      const beat = sbMakeBeat({ cast_id: cast?.id || '', offset_minutes: Math.floor((i / COUNT) * block.duration_minutes * 0.9) % Math.max(1, block.duration_minutes - 1), channel: channels[i % channels.length], cell_id: cell.id, title: `Inject ${i} — « titre » & <html>`, intent: `Intent ${i}: forces a decision. `.repeat(3) });
      block.beats.push(beat);
      const actor = (cast && p.actors.find((a) => a.id === cast.actor_id)) || p.actors[i % p.actors.length];
      const s = makeStimulus(beat.channel, actor.id, sbBeatAbsolute(block, beat));
      s.name = beat.title;
      s.cell_id = cell.id;
      for (const def of getTemplateDefinition(s).fields || []) {
        if (/upload|image|photo|logo|video|audio|url|_data/.test(def.type + def.key)) continue;
        if (def.type === 'number') s.fields[def.key] = i * 3;
        else if (def.type === 'checkbox') s.fields[def.key] = i % 2 === 0;
        else if (def.options) s.fields[def.key] = def.options[i % def.options.length];
        else if (def.type === 'textarea' && typeof s.fields[def.key] === 'string') s.fields[def.key] = longText(i);
        else if (typeof s.fields[def.key] === 'string') s.fields[def.key] = `${def.key} ${i} — « ${actor.name} »`;
      }
      const photoKey = Object.keys(s.fields).find((k) => /photo|image/.test(k) && !/url/.test(k));
      if (photoKey && photos < 6) { s.fields[photoKey] = photo; photos++; }
      s.status = ['draft', 'ready', 'sent'][i % 3];
      if (s.status === 'sent') { s.sent_at = new Date(Date.now() - i * 1000).toISOString(); s.sent_at_min = s.timestamp_offset_minutes; s.sent_count = 1 + (i % 2); }
      p.stimuli.push(s);
      sbStampStimulus(s, block, beat, p.storyboard, p);
    }
    for (const block of blocks) { block.stimuli_target = block.beats.length; block.beats.sort((x, y) => x.offset_minutes - y.offset_minutes); sbMarkPlanned(block); }
    sortStimuli();
    // A Play run with a long log.
    const play = playState(p);
    play.offset_min = 95; play.running = false;
    for (let i = 0; i < 600; i++) play.log.push({ t: i / 5, at: new Date().toISOString(), type: ['note', 'sent', 'status', 'clock'][i % 4], text: `Log entry ${i} — « note » & <tag>` });
    StoryboardHistory.commit('Scale build');
    StoryboardHistory.saveVersion?.('Scale v1');
    App.render();
    return { stimuli: p.stimuli.length, beats: p.storyboard.blocks.reduce((n, b) => n + b.beats.length, 0), channels: new Set(p.stimuli.map((s) => s.channel)).size, photos, tv: p.stimuli.filter((s) => s.channel === 'breaking_news_tv').length, pending: sbPendingSyncCount(p) };
  }, COUNT);
  step('Build exercise', Date.now() - t0, JSON.stringify(built));
  assert.equal(built.stimuli, COUNT);
  assert.equal(built.pending, 0, 'a freshly built exercise has nothing to update');
  const original = await page.evaluate(SNAPSHOT);

  // ── 2. Browser save and reload ───────────────────────────────────────────────
  t0 = Date.now();
  const saved = await page.evaluate(() => { const t = performance.now(); const ok = saveLocal(false); return { ok, ms: performance.now() - t, chars: (localStorage.getItem(STORAGE_KEY) || '').length }; });
  step('Browser save (saveLocal)', saved.ms, `${(saved.chars / 1048576).toFixed(2)} M chars, ok=${saved.ok}`);
  assert.equal(saved.ok, true, 'saved in the browser');
  await page.evaluate(() => autoSave());
  assert.ok(!(await page.locator('#save-indicator.is-error').count()), 'indicator says saved');
  t0 = Date.now();
  await page.reload();
  await page.waitForFunction(() => typeof appState !== 'undefined' && appState.scenario?.stimuli?.length > 0);
  step('Reload and restore', Date.now() - t0);
  const restored = await page.evaluate(SNAPSHOT);
  sameAs(original, restored, 'browser save and reload keep everything');
  await page.evaluate(() => { appState.launchScreenOpen = false; App.render(); });

  // ── 3. JSON export ───────────────────────────────────────────────────────────
  await page.evaluate(() => { appState.route = 'project'; App.render(); });
  t0 = Date.now();
  const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.click('.pj-data [data-action="save-json"]')]);
  const jsonPath = path.join(out, jsonDownload.suggestedFilename());
  await jsonDownload.saveAs(jsonPath);
  step('JSON export', Date.now() - t0, `${(fs.statSync(jsonPath).size / 1048576).toFixed(2)} MB ${jsonDownload.suggestedFilename()}`);
  const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.equal(exported.stimuli.length, COUNT);
  assert.ok(!exported.settings.ai_api_key, 'no API key in the file');

  // ── 4. JSON import into a fresh browser ──────────────────────────────────────
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => { appState.launchScreenOpen = false; appState.route = 'project'; App.render(); });
  t0 = Date.now();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.pj-data [data-action="load-json"]')]);
  await chooser.setFiles(jsonPath);
  await page.waitForFunction((n) => appState.scenario.stimuli.length === n, COUNT, { timeout: 60000 });
  step('JSON import', Date.now() - t0);
  const imported = await page.evaluate(SNAPSHOT);
  sameAs(original, imported, 'JSON export then import keep everything');
  // Idempotent: exporting the imported project gives the same file (timestamps aside).
  await page.evaluate(() => { appState.route = 'project'; App.render(); });
  const [again] = await Promise.all([page.waitForEvent('download'), page.click('.pj-data [data-action="save-json"]')]);
  const againPath = path.join(out, `again-${again.suggestedFilename()}`);
  await again.saveAs(againPath);
  const strip = (text) => JSON.stringify(JSON.parse(text, (key, value) => (/^(updated_at|created_at|imported_at|at)$/.test(key) ? undefined : value)));
  assert.equal(strip(fs.readFileSync(againPath, 'utf8')), strip(fs.readFileSync(jsonPath, 'utf8')), 'export, import, export gives the same file');
  assert.equal(await page.evaluate(() => sbPendingSyncCount(appState.scenario)), 0, 'nothing flagged for update after import');

  // ── 5. ZIP export: every inject rendered, CSV and project inside ─────────────
  t0 = Date.now();
  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
  const [zipDownload] = await Promise.all([page.waitForEvent('download', { timeout: 1800000 }), page.click('.pj-data [data-action="export-all"]')]);
  const zipPath = path.join(out, zipDownload.suggestedFilename());
  await zipDownload.saveAs(zipPath);
  const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
  step('ZIP export (images + CSV + JSON)', Date.now() - t0, `${(fs.statSync(zipPath).size / 1048576).toFixed(1)} MB, heap ${Math.round(heapBefore / 1048576)} -> ${Math.round(heapAfter / 1048576)} MB`);
  const listing = JSON.parse(execFileSync('python3', ['-c', `
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1])
names = z.namelist()
csv = [n for n in names if n.endswith('_chronogram.csv')]
rows = z.read(csv[0]).decode('utf-8-sig').split('\\r\\n') if csv else []
errors = z.read('export_errors.txt').decode() if 'export_errors.txt' in names else ''
print(json.dumps({ 'names': names, 'rows': len(rows), 'errors': errors, 'json': [n for n in names if n.endswith('.json')] }))
`, zipPath]).toString());
  const media = listing.names.filter((n) => /\.(png|webm)$/.test(n));
  const lines = listing.errors ? listing.errors.split(/\r?\n/).filter(Boolean) : [];
  const failed = lines.filter((line) => !/exported as a still image/.test(line)).length;
  const stills = lines.length - failed;
  console.log(`  ZIP: ${media.length} files (${stills} TV injects as still images), ${failed} not rendered, CSV rows ${listing.rows - 1}, JSON ${listing.json.join(', ')}`);
  if (failed) console.log('  errors:', listing.errors.split(/\r?\n/).slice(0, 5).join(' | '));
  assert.equal(media.length + failed, COUNT, 'every inject is rendered or listed as an error');
  assert.equal(new Set(media.map((n) => n.split('_')[0])).size, media.length, 'unique play numbers in file names');
  assert.equal(listing.rows - 1, COUNT, 'one CSV line per inject');
  assert.equal(listing.json.length, 1);

  // ── 6. ZIP import ────────────────────────────────────────────────────────────
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => { appState.launchScreenOpen = false; appState.route = 'project'; App.render(); });
  t0 = Date.now();
  const [zipChooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.pj-data [data-action="load-json"]')]);
  await zipChooser.setFiles(zipPath);
  await page.waitForFunction((n) => appState.scenario.stimuli.length === n, COUNT, { timeout: 120000 });
  step('ZIP import', Date.now() - t0);
  sameAs(original, await page.evaluate(SNAPSHOT), 'ZIP export then import keep everything');
  const afterImport = await page.evaluate(() => { const t = performance.now(); const ok = saveLocal(false); return { ok, ms: performance.now() - t }; });
  step('Browser save after import', afterImport.ms, `ok=${afterImport.ok}`);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log(`Scale browser smoke passed (${COUNT} injects). Files in ${out}`);
})().catch((error) => { console.error(error); process.exit(1); });
