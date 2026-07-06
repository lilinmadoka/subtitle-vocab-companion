const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const popupSource = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createBaseContext() {
  return {
  console: {
    log() {},
    warn() {},
    error: console.error
  },
  location: {
    href: 'https://www.youtube.com/watch?v=test',
    hostname: 'www.youtube.com'
  },
  document: {
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  },
  chrome: {
    storage: {
      local: {
        get(defaults, callback) {
          callback(defaults);
        }
      },
      onChanged: {
        addListener() {}
      }
    },
    runtime: {
      onMessage: {
        addListener() {}
      },
      sendMessage() {}
    }
  },
  setTimeout,
  clearTimeout,
  crypto: {
    randomUUID() {
      return 'id';
    }
  }
  };
}

const context = createBaseContext();
vm.runInNewContext(source, context, { filename: 'content.js' });

const sentence = context.normalizeSentenceText(
  "People are focused on the wrong thing. They're looking at the big shiny [ music ] 保存短语"
);
assert(!sentence.includes('保存短语'), 'subtitle sentence should remove LR save-phrase control text');
assert(sentence.includes('[music]'), 'subtitle sentence should normalize bracketed music cue spacing');

const dictionary = context.cleanDictionaryLines(`
shiny
闪亮的, 光亮的, 发亮的
示例：当前文本
People are focused on the wrong thing. They' looking at the big shiny [music]保存短语
>> exactly people are focused on the wrong thing they' looking at the big shiny保存短语
示例： Tatoeba[noun]
Tom saw something shiny in the water.保存短语
Sami had a bike with shiny wheels on it.保存短语
`);

assert(!dictionary.includes('保存短语'), 'dictionary text should remove LR save-phrase control text');
assert(dictionary.includes('Tom saw something shiny in the water.'), 'dictionary examples should preserve useful text');
assert(!dictionary.includes('示例：当前文本'), 'dictionary text should remove current-text example headers');
assert(!dictionary.includes("They' looking at the big shiny [music]"), 'dictionary text should skip duplicated current subtitle examples');
assert(!dictionary.includes('exactly people are focused'), 'dictionary text should remove LR alignment/debug lines');
assert(!dictionary.includes('I had never seen such a shiny star.'), 'dictionary text should limit excessive examples');

const popupContext = createBaseContext();
popupContext.document.createElement = () => ({
  innerHTML: '',
  get textContent() {
    return this.innerHTML.replace(/<[^>]+>/g, '');
  },
  get innerText() {
    return this.textContent;
  }
});
vm.runInNewContext(popupSource, popupContext, { filename: 'popup.js' });

assert(
  popupContext.sanitizeField('People are looking at shiny 保存短语') === 'People are looking at shiny',
  'popup display fields should clean old saved control text'
);
assert(
  !popupContext.buildBack({ wordMeaningHtml: '<div>Tom saw something shiny.保存短语</div>' }).includes('保存短语'),
  'popup export HTML should clean old saved control text'
);

const formattedItem = {
  word: 'environment',
  sentence: 'and improving the environment in which the model runs. As I sort of said with',
  sentenceMeaning: '\u4ee5\u53ca\u2026\u2026\u6539\u5584\u6a21\u578b\u8fd0\u884c\u7684\u73af\u5883\u3002',
  wordMeaning: [
    'environment',
    '\u73af\u5883, \u5468\u56f4, \u6c14\u6c1b',
    'environment',
    '(noun)',
    '\u73af\u5883, \u5468\u56f4, \u81ea\u7136\u73af\u5883, \u751f\u6001\u73af\u5883, \u6c14\u6c1b',
    '(ANY)',
    '\u73af\u5883, \u56db\u5468, \u6c14\u6c1b',
    '\u80cc\u666f, \u751f\u6d3b\u73af\u5883, \u73af\u4fdd',
    '\u793a\u4f8b\uff1a\u5f53\u524d\u6587\u672c',
    'and improving the environment in which the model runs.\u4fdd\u5b58\u77ed\u8bed',
    '>> exactly people are focused on the wrong thing',
    '\u793a\u4f8b\uff1a Tatoeba[noun]',
    'We must try to protect the environment.',
    'This is bad for the environment',
    'Eating meat is bad for the environment.',
    'Do you care about the environment?',
    'Our character is affected by the environment.'
  ].join('\n')
};

const front = popupContext.buildFront(formattedItem);
assert(front.includes('<b>environment</b>'), 'Anki front should highlight the target word in the sentence');
assert(front.includes('font-size:24px'), 'Anki front should make the word visually prominent');

const back = popupContext.buildBack(formattedItem);
assert(back.includes('\u4ee5\u53ca'), 'Anki back should include sentence translation first');
assert(back.includes('noun'), 'Anki back should include the primary part of speech');
assert(back.includes('\u73af\u5883, \u5468\u56f4, \u6c14\u6c1b'), 'Anki back should include concise definitions');
assert(!back.includes('\u4fdd\u5b58\u77ed\u8bed'), 'Anki back should remove LR control text');
assert(!back.includes('\u793a\u4f8b'), 'Anki back should remove LR example headers');
assert(!back.includes('exactly people are focused'), 'Anki back should remove LR alignment/debug lines');
assert(!back.includes('Do you care about the environment?'), 'Anki back should limit excessive examples');
assert(!back.includes('(ANY)'), 'Anki back should suppress broad ANY labels');
assert((back.match(/•/g) || []).length === 3, 'Anki back should include at most three examples');

console.log('text cleaning verification ok');
