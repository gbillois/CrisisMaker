const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function load() {
  const window = {};
  const context = vm.createContext({ window, Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts.type; } }, Math, Float32Array, Uint8Array, DataView, ArrayBuffer, Number, String, Object, JSON });
  for (const file of ['mp4', 'music', 'produce']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'video-debrief', 'browser', `${file}.js`), 'utf8'), context);
  return window.VDB;
}
const project = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'video-debrief', 'examples', 'stonawave.json'), 'utf8'));

test('browser video: timing follows the Python pipeline (lead, gaps, min duration, tail)', () => {
  const VDB = load();
  const p = { pacing: { lead: 0.8, gap: 0.5, tail: 2 }, scenes: [{ id: 'a' }, { id: 'b', minDuration: 4 }, { id: 'c' }] };
  const timing = VDB.computeTiming(p, { a: 5, b: 1, c: 0 });
  assert.deepEqual(timing.scenes.map(s => [s.voStart, s.voEnd]), [[0.8, 5.8], [6.3, 10.3], [10.8, 13.8]]);
  assert.equal(timing.total, 15.8);
  assert.equal(VDB.computeTiming({ scenes: [{ id: 'a' }] }, { a: 3 }).total, 0.8 + 3 + 4.8, 'default tail as build.py');
});

test('browser video: the synthesized score is deterministic, bounded and follows the moods', () => {
  const VDB = load();
  const timing = VDB.computeTiming(project, Object.fromEntries(project.scenes.map(s => [s.id, s.vo ? 6 : 0])));
  const a = VDB.makeMusic(project, timing, 8000), b = VDB.makeMusic(project, timing, 8000);
  assert.equal(a.channels[0].length, Math.floor(timing.total * 8000));
  let peak = 0, diff = 0, energy = 0;
  for (let i = 0; i < a.channels[0].length; i++) {
    peak = Math.max(peak, Math.abs(a.channels[0][i]), Math.abs(a.channels[1][i]));
    diff = Math.max(diff, Math.abs(a.channels[0][i] - b.channels[0][i]));
    energy += a.channels[0][i] ** 2;
  }
  assert.ok(peak <= 1 && peak > 0.5, `peak ${peak}`);
  assert.equal(diff, 0, 'same project, same music');
  assert.ok(energy > 0 && !a.channels[0].some(Number.isNaN));
});

test('browser video: the mix ducks the music under the voice and limits the peaks', () => {
  const VDB = load();
  const SR = 48000;
  const p = { audio: { musicLevel: -8.5 }, scenes: [{ id: 'a' }] };
  const timing = { scenes: [{ id: 'a', voStart: 1, voEnd: 2 }], total: 3 };
  // Music opposite in the two channels, voice identical in both: (L - R) / 2 is the music alone.
  const music = { sampleRate: SR, channels: [new Float32Array(3 * SR).fill(0.8), new Float32Array(3 * SR).fill(-0.8)] };
  const voice = new Float32Array(SR).map((_, i) => 0.5 * Math.sin(i / 10));
  const mix = VDB.mixSoundtrack(p, timing, { a: voice }, music);
  const musicAt = t => { const i = Math.floor(t * SR); return (mix.channels[0][i] - mix.channels[1][i]) / 2; };
  assert.ok(musicAt(1.8) < musicAt(0.5) * 0.5, `ducked under the voice (${musicAt(1.8)} vs ${musicAt(0.5)})`);
  assert.ok(musicAt(2.9) > musicAt(1.8), 'the music comes back after the voice');
  let peak = 0;
  for (const channel of mix.channels) for (const v of channel) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= 0.8901, `limited to 0.89 (${peak})`);
  const noVoice = VDB.mixSoundtrack(p, timing, {}, music);
  assert.ok(Math.abs(noVoice.channels[0][Math.floor(1.8 * SR)] - 0.8 * Math.pow(10, -8.5 / 20)) < 1e-3, 'no voice: music at its level, no ducking');
});

test('browser video: the MP4 muxer writes ftyp, moov first, then mdat', () => {
  const VDB = load();
  const video = { codec: 'vp9', width: 1920, height: 1080, samples: [0, 1, 2].map(i => ({ data: new Uint8Array([i, i, i]), timestamp: i * 41667, duration: 41667, key: i === 0 })) };
  const audio = { codec: 'opus', sampleRate: 48000, channels: 2, samples: [0, 1].map(i => ({ data: new Uint8Array([9, i]), timestamp: i * 20000, duration: 20000 })) };
  const blob = VDB.muxMp4(video, audio);
  assert.equal(blob.type, 'video/mp4');
  const bytes = Buffer.concat(blob.parts.map(p => Buffer.from(p)));
  const boxes = [];
  for (let offset = 0; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    boxes.push(bytes.toString('latin1', offset + 4, offset + 8));
    if (boxes.at(-1) === 'mdat') break;
    offset += size;
  }
  assert.deepEqual(boxes, ['ftyp', 'moov', 'mdat']);
  assert.ok(bytes.includes(Buffer.from('vp09')) && bytes.includes(Buffer.from('Opus')));
});

test('browser video: the studio loads the production scripts and nothing heavy by default', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'video-debrief', 'index.html'), 'utf8');
  for (const file of ['mp4', 'encode', 'music', 'voice', 'produce']) assert.ok(html.includes(`<script src="browser/${file}.js"></script>`), file);
  assert.ok(!/onnxruntime|piper_phonemize|huggingface/.test(html), 'the voice engine is only fetched by voice.js on demand');
  assert.ok(html.includes('id="btn-local-voice"') && html.includes('id="btn-browser-produce"'));
  assert.ok(html.indexOf('Produire dans le navigateur') < html.indexOf('Produire en local'), 'browser production comes first');
  const voice = fs.readFileSync(path.join(__dirname, '..', 'video-debrief', 'browser', 'voice.js'), 'utf8');
  assert.ok(/VDB\.loadLocalVoice = async function/.test(voice) && !/^\s*VDB\.loadLocalVoice\(/m.test(voice), 'no load at startup');
});
