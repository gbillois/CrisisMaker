const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('video-debrief/index.html', 'utf8');

const commit = source.match(/function commit\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(commit, /notifyCrisisMakerProjectChange\(\)/);

const fileLoad = source.match(/\$\('file-input'\)\.addEventListener\('change', e => \{([\s\S]*?)\n\}\);/)?.[1] || '';
assert.match(fileLoad, /notifyCrisisMakerProjectChange\(\)/);

assert.match(source, /\['src-material','set-duration','set-lang','set-theme','set-voice','set-tone','set-audience'\]/);
assert.match(source, /ui: \{ active_step: activeStep \}/);
assert.match(source, /setStep\(Number\(state\.ui\.active_step\)\)/);

console.log('Video Debrief project bridge coverage passed.');
