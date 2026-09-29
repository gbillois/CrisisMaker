const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  console,
  navigator: { language: 'en' },
  localStorage: { getItem: () => null, setItem: () => {} },
  sessionStorage: { getItem: () => null },
  appState: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ['js/demo-scenario.js', 'js/data.js', 'js/config.js', 'js/debrief-renderer.js', 'js/debrief.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const demo = vm.runInContext('defaultScenario()', context);
const video = demo.video_debrief;
const example = JSON.parse(fs.readFileSync('video-debrief/examples/stonawave.json', 'utf8'));
const studio = fs.readFileSync('video-debrief/index.html', 'utf8');

test('demo video debrief: opens at step 2 with its setup, its story material and a written scenario', () => {
  assert.equal(video.ui.active_step, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(video.setup)), { duration: 120, language: 'en', theme: 'wavestone', voice: 'en-US-AndrewNeural', tone: 'documentaire sobre et factuel', audience: 'comité exécutif' });
  // Every setup value is one the studio's step 1 offers.
  for (const value of [video.setup.language, video.setup.theme, video.setup.tone, video.setup.audience]) assert.ok(studio.includes(`<option value="${value}"`), value);
  assert.ok(studio.includes(`'${video.setup.voice}'`), 'a voice of the studio');
  for (const part of ['Operation Cold Chain', 'PharmLeaks', '05:40', '08:55 PharmLeaks ransom email', '11:00 Hyderabad immutable backups confirmed clean']) assert.ok(video.source_material.includes(part), part);
  assert.equal(video.project.meta.title, 'StonaWave, Operation Cold Chain');
  assert.equal(video.project.meta.lang, 'en');
  assert.equal(video.project.target.duration, video.setup.duration);
});

test('demo video debrief: the studio example is the same project', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(video.project)), example);
  // The saved project keeps it (the normalizer copies it as it is).
  const saved = vm.runInContext(`normalizeVideoDebrief(JSON.parse(${JSON.stringify(JSON.stringify(video))}), 'fr')`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), JSON.parse(JSON.stringify(video)));
});

test('demo video debrief: scenes tell the Cold Chain story in the engine format and fit the target', () => {
  const scenes = example.scenes;
  assert.deepEqual(scenes.map((scene) => scene.type), ['cold-open', 'chain', 'map-focus', 'stat-grid', 'map-spread', 'map-trace', 'lessons', 'endcard']);
  assert.equal(new Set(scenes.map((scene) => scene.id)).size, scenes.length);
  let total = example.pacing.lead + example.pacing.tail + example.pacing.gap * (scenes.length - 1);
  for (const scene of scenes) {
    const duration = Math.max(scene.vo.length / 14.2, scene.minDuration || 3);
    total += duration;
    if (scene.type !== 'endcard') assert.ok(scene.vo.length > 150, `${scene.id} has a voice-over`);
    // On-screen cues fall inside the voice-over of their scene.
    for (const cue of JSON.stringify(scene).match(/"(at|titleAt|statAt|bigAt|finalAt|impactAt)":[\d.]+/g) || []) {
      assert.ok(Number(cue.split(':')[1]) < duration, `${scene.id} ${cue}`);
    }
  }
  assert.ok(total >= 90 && total <= example.target.duration + 4, `about ${Math.round(total)} s`);
  const text = JSON.stringify(example);
  for (const part of ['PharmLeaks', 'Hyderabad', 'Frankfurt', 'Lyon', '1.9 TB', '$18M', 'OPERATION COLD CHAIN']) assert.ok(text.includes(part), part);
  assert.doesNotMatch(text, /Bitter Pill|\u2014/);
  // Map coordinates are [longitude, latitude].
  assert.deepEqual(scenes.find((scene) => scene.type === 'map-focus').epicenter, [2.35, 48.86]);
});
