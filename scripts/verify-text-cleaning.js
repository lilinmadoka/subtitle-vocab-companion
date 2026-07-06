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

console.log('text cleaning verification ok');
