const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasAll(text, values, label) {
  for (const value of values) {
    assert(text.includes(value), `${label} is missing ${value}`);
  }
}

const manifest = JSON.parse(read('manifest.json'));
const background = read('background.js');
const content = read('content.js');
const popup = read('popup.js');
const popupHtml = read('popup.html');
const readme = read('README.md');
const privacy = read('PRIVACY.md');
const checklist = read('CHROME_WEB_STORE_CHECKLIST.md');

const hostPatterns = ['*://www.netflix.com/*', '*://www.youtube.com/*'];

assert(manifest.manifest_version === 3, 'manifest must stay MV3');
assert(manifest.version === '0.2.0', 'manifest version must be 0.2.0 for YouTube v1');
hasAll(manifest.permissions || [], ['storage', 'contextMenus', 'commands'], 'manifest permissions');
hasAll(manifest.host_permissions || [], hostPatterns, 'manifest host_permissions');

const matches = (manifest.content_scripts || []).flatMap((script) => script.matches || []);
hasAll(matches, hostPatterns, 'manifest content script matches');
hasAll(background, hostPatterns, 'background context menu URL patterns');

for (const [name, text] of [
  ['README.md', readme],
  ['PRIVACY.md', privacy],
  ['CHROME_WEB_STORE_CHECKLIST.md', checklist]
]) {
  hasAll(text, hostPatterns, name);
  assert(text.includes('原生字幕'), `${name} must state the native subtitle boundary`);
  assert(text.includes('Language Reactor'), `${name} must describe the LR-based support boundary`);
}

const popupIds = [...popup.matchAll(/getElementById\('([^']+)'\)/g)].map((match) => match[1]);
for (const id of popupIds) {
  assert(new RegExp(`id=["']${id}["']`).test(popupHtml), `popup.html is missing id ${id}`);
}

hasAll(background + popup, ['vocabItems', 'settings_v1'], 'storage keys');
hasAll(popup, ['anki_vocab_cards.tsv', 'vocab_words.csv', 'vocab_word_counts.csv'], 'export file names');
assert(!/item\.site|item\.siteName|item\.pageTitle/.test(popup), 'popup must not require new metadata fields');

hasAll(content, [
  'LR_ROOT_SELECTORS',
  'hasLanguageReactorDom',
  'isLanguageReactorElement',
  'lrAdapter',
  'siteName',
  'pageTitle'
], 'content LR adapter boundary');

hasAll(background, ['siteName', 'pageTitle'], 'background additive metadata');

const forbiddenNativeSubtitleReads = [
  /timedtext/i,
  /captionTracks/i,
  /ytInitial/i,
  /playerResponse/i,
  /youtubei/i,
  /transcript/i,
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /\.textTracks\b/,
  /querySelector(All)?\([^)]*caption/i
];

for (const [name, text] of [
  ['content.js', content],
  ['background.js', background],
  ['popup.js', popup]
]) {
  for (const pattern of forbiddenNativeSubtitleReads) {
    assert(!pattern.test(text), `${name} appears to read native subtitle/player data: ${pattern}`);
  }
}

console.log('extension verification ok');
