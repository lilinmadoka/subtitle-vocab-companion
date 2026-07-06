const MENU_ID = 'nflx_save_vocab';
const STORAGE_KEY = 'vocabItems';
const DOCUMENT_URL_PATTERNS = [
  '*://www.netflix.com/*',
  '*://www.youtube.com/*'
];
const LR_CONTROL_TEXT_PATTERNS = [
  /保存短语/g
];

function storageGet(key, fallbackValue) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [key]: fallbackValue }, (res) => resolve(res[key]));
  });
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function normalize(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/^[\s"'“”‘’.,!?;:()\[\]{}<>《》]+/, '')
    .replace(/[\s"'“”‘’.,!?;:()\[\]{}<>《》]+$/, '')
    .trim();
}

function removeLrControlText(text) {
  let value = String(text || '');
  for (const pattern of LR_CONTROL_TEXT_PATTERNS) {
    value = value.replace(pattern, ' ');
  }
  return value.trim();
}

function sanitizeItem(item) {
  return {
    id: item?.id || crypto.randomUUID(),
    word: normalize(removeLrControlText(item?.word || '')),
    sentence: removeLrControlText(item?.sentence || ''),
    wordMeaning: removeLrControlText(item?.wordMeaning || ''),
    wordMeaningHtml: removeLrControlText(item?.wordMeaningHtml || ''),
    sentenceMeaning: removeLrControlText(item?.sentenceMeaning || ''),
    url: String(item?.url || '').trim(),
    t_ms: Number.isFinite(item?.t_ms) ? item.t_ms : null,
    createdAt: item?.createdAt || Date.now(),
    site: String(item?.site || '').trim(),
    siteName: String(item?.siteName || '').trim(),
    pageTitle: String(item?.pageTitle || '').trim()
  };
}

async function addItem(rawItem) {
  const item = sanitizeItem(rawItem);
  if (!item.word) return;

  const items = await storageGet(STORAGE_KEY, []);
  items.unshift(item);
  await storageSet({ [STORAGE_KEY]: items });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '保存到单词本',
    contexts: ['selection'],
    documentUrlPatterns: DOCUMENT_URL_PATTERNS
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab?.id) return;

  const selectionText = normalize(info.selectionText || '');
  if (!selectionText) return;

  try {
    const ctx = await chrome.tabs.sendMessage(tab.id, {
      type: 'collectContext',
      selectionText
    });
    if (ctx?.captureAvailable !== true) return;

    const word = normalize(ctx?.word || selectionText);
    if (!word) return;

    await addItem({
      id: crypto.randomUUID(),
      word,
      sentence: ctx?.sentence || '',
      wordMeaning: ctx?.wordMeaning || '',
      wordMeaningHtml: ctx?.wordMeaningHtml || '',
      sentenceMeaning: ctx?.sentenceMeaning || '',
      url: ctx?.url || tab.url || '',
      t_ms: ctx?.t_ms ?? null,
      createdAt: Date.now(),
      site: ctx?.site || '',
      siteName: ctx?.siteName || '',
      pageTitle: ctx?.pageTitle || tab.title || ''
    });
  } catch (error) {
    console.warn('Failed to collect context:', error);
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'save-word') return;
  if (!tab?.id) return;

  try {
    const ctx = await chrome.tabs.sendMessage(tab.id, { type: 'collectFromHotkey' });
    if (ctx?.captureAvailable !== true) return;

    const word = normalize(ctx?.word || '');
    if (!word) return;

    await addItem({
      id: crypto.randomUUID(),
      word,
      sentence: ctx?.sentence || '',
      wordMeaning: ctx?.wordMeaning || '',
      wordMeaningHtml: ctx?.wordMeaningHtml || '',
      sentenceMeaning: ctx?.sentenceMeaning || '',
      url: ctx?.url || tab.url || '',
      t_ms: ctx?.t_ms ?? null,
      createdAt: Date.now(),
      site: ctx?.site || '',
      siteName: ctx?.siteName || '',
      pageTitle: ctx?.pageTitle || tab.title || ''
    });
  } catch (error) {
    console.warn('Hotkey save failed:', error);
  }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req?.type !== 'addItemFromContent') return;
  if (req.item?.captureAvailable !== true) {
    sendResponse({ ok: false, error: 'capture unavailable' });
    return;
  }

  addItem(req.item)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
