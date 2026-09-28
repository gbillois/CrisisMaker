const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('video-debrief/index.html', 'utf8');

const commit = source.match(/function commit\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(commit, /notifyCrisisMakerProjectChange\(\)/);

// The scenario comes from the CrisisMaker exercise (no source text to paste); settings are saved.
assert.match(source, /\['set-duration','set-lang','set-theme','set-voice','set-tone','set-audience'\]/);
assert.match(source, /getExerciseMaterial/);
assert.match(source, /id="btn-generate"/);
assert.match(source, /id="btn-manual"/);
for (const gone of [/localhost:8765/, /server-pill/, /btn-gh-produce/, /api\.github\.com/, /id="src-material"/]) assert.doesNotMatch(source, gone);
assert.match(fs.readFileSync('js/app.js', 'utf8'), /getExerciseMaterial: \(\) => videoDebriefExerciseMaterial\(\)/);
assert.match(source, /ui: \{ active_step: activeStep \}/);
assert.match(source, /setStep\(Number\(state\.ui\.active_step\)\)/);
assert.match(source, /<option value="openrouter">OpenRouter<\/option>/);
assert.match(source, /https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
assert.match(source, /baseUrl !== 'https:\/\/ollama\.com' \? \{ format: 'json' \} : \{\}/);

console.log('Video Debrief project bridge coverage passed.');
