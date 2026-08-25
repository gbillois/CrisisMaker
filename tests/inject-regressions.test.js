const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.js', 'utf8');

function functionSource(startName, nextName) {
  const start = source.indexOf(`function ${startName}(`);
  const next = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `Missing ${startName}`);
  assert.notEqual(next, -1, `Missing ${nextName}`);
  return source.slice(start, next).replace(/\s+async\s*$/, '\n');
}

const articleContext = {
  ARTICLE_TEMPLATE_LIBRARY: {
    nyt: { template_id: 'nyt', defaults: { headline: 'NYT default', body: '<p>NYT default</p>', location: 'NEW YORK' } },
    faz: { template_id: 'faz', defaults: { headline: 'FAZ default', body: '<p>FAZ default</p>', kicker: 'Analyse' } }
  },
  deepClone: (value) => JSON.parse(JSON.stringify(value))
};
vm.createContext(articleContext);
vm.runInContext(functionSource('replaceArticleVariant', 'replaceTVVariant'), articleContext);

const article = {
  channel: 'article_press',
  template_id: 'nyt',
  fields: {
    headline: 'Authored headline',
    body: '<p>Authored article text</p>',
    subheadline: 'Authored standfirst',
    photo_data: 'data:image/png;base64,abc'
  }
};
articleContext.article = article;
vm.runInContext('replaceArticleVariant(article, "faz")', articleContext);
assert.equal(article.template_id, 'faz');
assert.equal(article.fields.headline, 'Authored headline');
assert.equal(article.fields.body, '<p>Authored article text</p>');
assert.equal(article.fields.subheadline, 'Authored standfirst');
assert.equal(article.fields.photo_data, 'data:image/png;base64,abc');
assert.equal(article.fields.kicker, 'Analyse');

let channelReplacementCalls = 0;
let articleReplacementCalls = 0;
const updateContext = {
  appState: {
    scenario: { actors: [] },
    llmState: { stimulus: { text: 'Update the article' } }
  },
  replaceStimulusTemplate: (stimulus, channel) => {
    channelReplacementCalls += 1;
    stimulus.channel = channel;
  },
  replaceArticleVariant: () => { articleReplacementCalls += 1; },
  replaceTVVariant: () => {},
  resolveActorFromName: () => null,
  setDefaultVideoForStimulus: () => {},
  Date
};
vm.createContext(updateContext);
vm.runInContext(functionSource('applyStimulusConfig', 'handleMultiStimulusResult'), updateContext);

const editedArticle = {
  channel: 'article_press',
  template_id: 'nyt',
  fields: { headline: 'Original headline', body: '<p>Old body</p>' }
};
updateContext.editedArticle = editedArticle;

async function run() {
  await vm.runInContext(`applyStimulusConfig(editedArticle, {
    channel: 'press_release',
    template_id: 'press_release',
    fields: { body: '<p>Updated body</p>' }
  }, { preserveType: true })`, updateContext);

  assert.equal(editedArticle.channel, 'article_press');
  assert.equal(editedArticle.template_id, 'nyt');
  assert.equal(editedArticle.fields.headline, 'Original headline');
  assert.equal(editedArticle.fields.body, '<p>Updated body</p>');
  assert.equal(channelReplacementCalls, 0);
  assert.equal(articleReplacementCalls, 0);

  assert.match(source, /case 'new-scenario':[\s\S]*?const preservedSettings = \{ \.\.\.appState\.scenario\.settings \};[\s\S]*?emptyScenario\(preservedSettings\)/);
  console.log('Inject editing and newspaper layout regressions covered.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
