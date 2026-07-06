const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'background.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeHarness(sendMessage) {
  const listeners = {
    installed: [],
    contextClicked: [],
    command: [],
    runtimeMessage: []
  };
  const storage = {};
  const menus = [];

  const chrome = {
    storage: {
      local: {
        get(defaults, callback) {
          const result = {};
          for (const [key, fallback] of Object.entries(defaults)) {
            result[key] = Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : fallback;
          }
          callback(result);
        },
        set(values, callback) {
          Object.assign(storage, values);
          callback?.();
        }
      }
    },
    contextMenus: {
      create(config) {
        menus.push(config);
      },
      onClicked: {
        addListener(listener) {
          listeners.contextClicked.push(listener);
        }
      }
    },
    commands: {
      onCommand: {
        addListener(listener) {
          listeners.command.push(listener);
        }
      }
    },
    runtime: {
      onInstalled: {
        addListener(listener) {
          listeners.installed.push(listener);
        }
      },
      onMessage: {
        addListener(listener) {
          listeners.runtimeMessage.push(listener);
        }
      }
    },
    tabs: {
      sendMessage
    }
  };

  const context = {
    chrome,
    console,
    crypto: {
      randomUUID() {
        return `id-${Math.random().toString(16).slice(2)}`;
      }
    }
  };

  vm.runInNewContext(source, context, { filename: 'background.js' });

  return { listeners, menus, storage };
}

function items(storage) {
  return storage.vocabItems || [];
}

async function triggerContextMenu(harness, ctx) {
  for (const listener of harness.listeners.contextClicked) {
    await listener(
      { menuItemId: 'nflx_save_vocab', selectionText: 'chosen' },
      { id: 1, url: 'https://www.youtube.com/watch?v=test', title: 'Video title' }
    );
  }
}

async function triggerHotkey(harness) {
  for (const listener of harness.listeners.command) {
    await listener('save-word', { id: 1, url: 'https://www.youtube.com/watch?v=test', title: 'Video title' });
  }
}

async function triggerContentMessage(harness, item) {
  const responses = [];
  for (const listener of harness.listeners.runtimeMessage) {
    const result = listener({ type: 'addItemFromContent', item }, {}, (response) => responses.push(response));
    if (result === true) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return responses;
}

async function run() {
  {
    const harness = makeHarness(async () => ({ captureAvailable: false }));
    harness.listeners.installed.forEach((listener) => listener());
    assert(harness.menus[0].documentUrlPatterns.includes('*://www.youtube.com/*'), 'context menu must include YouTube');
    await triggerContextMenu(harness);
    assert(items(harness.storage).length === 0, 'context menu must not save when capture is unavailable');
  }

  {
    const harness = makeHarness(async () => undefined);
    await triggerContextMenu(harness);
    assert(items(harness.storage).length === 0, 'context menu must not save without explicit captureAvailable true');
  }

  {
    const harness = makeHarness(async () => ({
      captureAvailable: true,
      word: 'chosen',
      sentence: 'chosen words matter 保存短语',
      wordMeaning: 'meaning 保存短语',
      site: 'youtube',
      siteName: 'YouTube',
      pageTitle: 'Video title'
    }));
    await triggerContextMenu(harness);
    assert(items(harness.storage).length === 1, 'context menu should save valid LR payload');
    assert(items(harness.storage)[0].site === 'youtube', 'context menu should preserve additive site metadata');
    assert(!items(harness.storage)[0].sentence.includes('保存短语'), 'context menu should clean control text before saving');
    assert(!items(harness.storage)[0].wordMeaning.includes('保存短语'), 'context menu should clean dictionary control text before saving');
  }

  {
    const harness = makeHarness(async () => ({ captureAvailable: false, word: 'chosen' }));
    await triggerHotkey(harness);
    assert(items(harness.storage).length === 0, 'hotkey must not save when capture is unavailable');
  }

  {
    const harness = makeHarness(async () => ({
      captureAvailable: true,
      word: 'chosen',
      sentence: 'chosen words matter',
      site: 'youtube'
    }));
    await triggerHotkey(harness);
    assert(items(harness.storage).length === 1, 'hotkey should save valid LR payload');
  }

  {
    const harness = makeHarness(async () => ({}));
    const responses = await triggerContentMessage(harness, { captureAvailable: false, word: 'chosen' });
    assert(items(harness.storage).length === 0, 'content message must not save when capture is unavailable');
    assert(responses.some((response) => response?.ok === false), 'content message should report rejected capture');
  }

  {
    const harness = makeHarness(async () => ({}));
    const responses = await triggerContentMessage(harness, {
      captureAvailable: true,
      word: 'chosen',
      sentence: 'chosen words matter',
      site: 'youtube'
    });
    assert(items(harness.storage).length === 1, 'content message should save valid LR payload');
    assert(responses.some((response) => response?.ok === true), 'content message should report saved capture');
  }
}

run()
  .then(() => {
    console.log('background behavior verification ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
