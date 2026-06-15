const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  console,
  navigator: { language: 'en' },
  localStorage: { getItem: () => null },
  sessionStorage: { getItem: () => null },
  appState: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

for (const file of [
  'js/data.js',
  'js/config.js',
  'js/debrief-renderer.js',
  'js/debrief.js'
]) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const result = vm.runInContext(`(() => {
  const stonaWave = defaultScenario();
  const stonaWaveVideo = stonaWave.stimuli.find((stimulus) => stimulus.channel === 'breaking_news_tv');
  const newVideo = makeStimulus('breaking_news_tv', stonaWave.actors[0].id, 0, 'cnn');

  return {
    defaultVideo: DEFAULT_NEWS_VIDEO,
    stonaWaveVideo: makeDefaultVideoFiles(stonaWave)[stonaWaveVideo.id],
    newVideo: makeDefaultVideoFiles({ stimuli: [newVideo] })[newVideo.id]
  };
})()`, context);

assert.equal(result.defaultVideo.objectUrl, 'media/anchor.mp4');
assert.equal(result.defaultVideo.fileName, 'anchor.mp4');
assert.equal(result.stonaWaveVideo.objectUrl, 'media/anchor.mp4');
assert.equal(result.newVideo.objectUrl, 'media/anchor.mp4');
assert.ok(fs.existsSync(result.defaultVideo.objectUrl));

console.log('Default news video coverage passed.');
