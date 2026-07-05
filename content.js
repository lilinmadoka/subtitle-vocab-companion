console.log('[LR Subtitle Companion] injected:', location.href);

const SETTINGS_KEY = 'settings_v1';
const DEFAULT_SETTINGS = { autoSaveOnSubtitleClick: true };
const DICT_WAIT_TIMEOUT_MS = 1800;
const DICT_WAIT_INTERVAL_MS = 140;
const MAX_DICT_TEXT_LEN = 5000;

const SUPPORTED_SITES = [
  {
    id: 'netflix',
    name: 'Netflix',
    matches(hostname) {
      return hostname === 'netflix.com' || hostname.endsWith('.netflix.com');
    }
  },
  {
    id: 'youtube',
    name: 'YouTube',
    matches(hostname) {
      return hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
    }
  }
];

const LR_ROOT_SELECTORS = [
  '#lln-subs',
  '[id^="lln-subs"]',
  '#lln-translations',
  '[id^="lln-translations"]',
  '.lln-dict-area',
  '.lln-dict-def',
  '[class*="lln-"]'
];

const EN_SUBTITLE_SELECTORS = [
  '#lln-subs .lln-sentence-wrap',
  '#lln-subs [id^="lln-subs"]',
  '.lln-sentence-wrap',
  '[class*="sentence-wrap"]'
];

const ZH_SUBTITLE_SELECTORS = [
  '#lln-translations .translationText',
  '#lln-translations .lln-whole-title-translation',
  '#lln-translations [class*="translation"] .translationText',
  '.lln-whole-title-translation .translationText'
];

const DICT_ROOT_SELECTORS = [
  '.lln-dict-area',
  '.lln-dict-def',
  '[class*="dict-area"]',
  '[class*="dict-def"]'
];

const DICT_REMOVE_SELECTORS = [
  '.close-dict',
  '.lln-word-save-buttons',
  '.lln-notifications',
  '.watch-video-player-view',
  '.visually-hidden',
  '.screenReaderMessage',
  '[role="alert"]',
  'audio',
  'video',
  'svg',
  'button'
];

let currentSettings = { ...DEFAULT_SETTINGS };
let toastTimer = null;
let lastSaved = { key: '', at: 0 };
let lastSubtitlePointer = { x: 0, y: 0, block: null, at: 0 };

function getCurrentSite() {
  const hostname = location.hostname.toLowerCase();
  return SUPPORTED_SITES.find((site) => site.matches(hostname)) || null;
}

function getPageMetadata() {
  const site = getCurrentSite();
  return {
    site: site?.id || '',
    siteName: site?.name || '',
    pageTitle: String(document.title || '').trim()
  };
}

function hasLanguageReactorDom() {
  return LR_ROOT_SELECTORS.some((selector) => document.querySelector(selector));
}

const lrAdapter = {
  isAvailable: hasLanguageReactorDom,
  getEnglishSubtitleBlockAtPoint,
  findBestEnglishBlock,
  extractSentence: extractTextWithSpaces,
  findTranslationForBlock: findNearestChineseSubtitle,
  extractDictionaryData,
  waitForDictionaryData
};

chrome.storage.local.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, (res) => {
  currentSettings = { ...DEFAULT_SETTINGS, ...(res?.[SETTINGS_KEY] || {}) };
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes?.[SETTINGS_KEY]) return;
  currentSettings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
});

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/^[\s"'“”‘’.,!?;:()\[\]{}<>《》]+/, '')
    .replace(/[\s"'“”‘’.,!?;:()\[\]{}<>《》]+$/, '')
    .trim();
}

function collapseWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeSentenceText(text) {
  let value = collapseWhitespace(text);
  if (!value) return '';

  value = value.replace(/\s+([,.!?;:])/g, '$1');
  value = value.replace(/([A-Za-z])\s+([’'])\s+([A-Za-z])/g, '$1$2$3');
  value = value.replace(/\b([A-Za-z]+)\s+([’'](?:s|t|re|ve|ll|d|m))\b/g, '$1$2');
  value = value.replace(/^([A-Z][A-Za-z0-9_-]{1,24})\s+\]\s+/, '[$1] ');
  value = value.replace(/^([A-Z][A-Za-z0-9_-]{1,24})\]\s+/, '[$1] ');
  value = value.replace(/\s{2,}/g, ' ').trim();
  return value;
}

function isLikelyEnglishWord(word) {
  return /^[A-Za-z][A-Za-z0-9'’_-]{0,48}$/.test(word || '');
}

function isVisible(el) {
  if (!(el instanceof Element)) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getSelectionWord() {
  const sel = window.getSelection?.();
  return normalize(sel?.toString?.() || '');
}

function getSelectionAnchorElement() {
  const sel = window.getSelection?.();
  const node = sel?.anchorNode || sel?.focusNode || null;
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}

function getWordAtPoint(x, y) {
  let range = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }
  if (!range) return '';

  const node = range.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return '';

  const text = node.textContent || '';
  const idx = range.startOffset;
  const isWordChar = (c) => /[A-Za-z0-9’'_-]/.test(c);

  let left = idx;
  let right = idx;
  while (left > 0 && isWordChar(text[left - 1])) left--;
  while (right < text.length && isWordChar(text[right])) right++;

  return normalize(text.slice(left, right));
}

function showToast(msg) {
  let toast = document.getElementById('__vocab_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__vocab_toast';
    toast.style.cssText = `
      position: fixed; left: 50%; bottom: 18%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.78);
      color: #fff; padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px; z-index: 999999;
      max-width: 70vw; text-align: center;
      pointer-events: none;
    `;
    document.documentElement.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 1100);
}

function shouldAutoSave(event) {
  return currentSettings.autoSaveOnSubtitleClick || !!event.altKey;
}

function tooSoonSameCard(item) {
  const key = `${String(item?.word || '').toLowerCase()}|${String(item?.sentence || '').toLowerCase()}`;
  const now = Date.now();
  if (key && key === lastSaved.key && now - lastSaved.at < 900) return true;
  lastSaved = { key, at: now };
  return false;
}

function matchesAnySelector(el, selectors) {
  return !!(el instanceof Element && selectors.some((selector) => el.matches(selector)));
}

function closestMatching(el, selectors) {
  let node = el instanceof Element ? el : null;
  for (let depth = 0; depth < 8 && node; depth += 1, node = node.parentElement) {
    if (matchesAnySelector(node, selectors)) return node;
  }
  return null;
}

function isLanguageReactorElement(el) {
  let node = el instanceof Element ? el : null;
  for (let depth = 0; depth < 10 && node; depth += 1, node = node.parentElement) {
    if (matchesAnySelector(node, LR_ROOT_SELECTORS)) return true;
  }
  return false;
}

function pointInsideRect(x, y, rect, padding = 0) {
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
}

function getEnglishSubtitleBlockAtPoint(x, y) {
  const elements = document.elementsFromPoint(x, y) || [];
  for (const el of elements) {
    const block = closestMatching(el, EN_SUBTITLE_SELECTORS);
    if (block && isVisible(block) && isLanguageReactorElement(block)) {
      const rect = block.getBoundingClientRect();
      if (pointInsideRect(x, y, rect, 10)) return block;
    }
  }
  return null;
}

function extractTextWithSpaces(container) {
  if (!(container instanceof Element)) return '';

  const directChunks = [];
  try {
    for (const child of container.querySelectorAll(':scope > *')) {
      const text = normalizeSentenceText(child.innerText || child.textContent || '');
      if (text) directChunks.push(text);
    }
  } catch {}

  if (directChunks.length >= 2) return normalizeSentenceText(directChunks.join(' '));

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = (node.nodeValue || '').trim();
      return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const parts = [];
  while (walker.nextNode()) {
    const text = collapseWhitespace(walker.currentNode.nodeValue || '');
    if (!text) continue;
    if (parts.length > 0) parts.push(' ');
    parts.push(text);
  }

  return normalizeSentenceText(parts.join(''));
}

function collectVisibleBlocks(selectors, maxLen = 260) {
  const seen = new Set();
  const out = [];

  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      if (!(el instanceof Element) || !isVisible(el) || seen.has(el)) continue;
      if (!isLanguageReactorElement(el)) continue;
      seen.add(el);
      const text = extractTextWithSpaces(el);
      if (!text || text.length > maxLen) continue;
      out.push({ el, text, rect: el.getBoundingClientRect() });
    }
  }

  return out;
}

function findBestEnglishBlock(word, target, x, y) {
  const targetBlock = closestMatching(target, EN_SUBTITLE_SELECTORS)
    || closestMatching(getSelectionAnchorElement(), EN_SUBTITLE_SELECTORS)
    || getEnglishSubtitleBlockAtPoint(x, y);

  if (targetBlock && isVisible(targetBlock) && isLanguageReactorElement(targetBlock)) return targetBlock;

  if (lastSubtitlePointer.block && Date.now() - lastSubtitlePointer.at < 2500) {
    const recentText = extractTextWithSpaces(lastSubtitlePointer.block);
    if (!word || recentText.toLowerCase().includes(String(word).toLowerCase())) {
      return lastSubtitlePointer.block;
    }
  }

  return null;
}

function findNearestChineseSubtitle(englishRect) {
  if (!englishRect) return '';

  const candidates = collectVisibleBlocks(ZH_SUBTITLE_SELECTORS, 180)
    .filter((block) => /[\u4e00-\u9fff]/.test(block.text));

  if (!candidates.length) return '';

  candidates.sort((a, b) => {
    const aGap = Math.abs(a.rect.top - englishRect.bottom);
    const bGap = Math.abs(b.rect.top - englishRect.bottom);
    if (aGap !== bGap) return aGap - bGap;

    const aDx = Math.abs((a.rect.left + a.rect.width / 2) - (englishRect.left + englishRect.width / 2));
    const bDx = Math.abs((b.rect.left + b.rect.width / 2) - (englishRect.left + englishRect.width / 2));
    return aDx - bDx;
  });

  const best = candidates[0];
  if (!best) return '';

  const verticalGap = Math.abs(best.rect.top - englishRect.bottom);
  const horizontalGap = Math.abs((best.rect.left + best.rect.width / 2) - (englishRect.left + englishRect.width / 2));
  if (verticalGap > 180 || horizontalGap > 480) return '';

  return best.text;
}

function containsWholeWord(text, word) {
  if (!text || !word) return false;
  const re = new RegExp(`(^|[^A-Za-z])${escapeRegExp(word)}([^A-Za-z]|$)`, 'i');
  return re.test(text);
}

function getDictionaryRootCandidate(root) {
  if (!(root instanceof Element) || !isVisible(root)) return null;
  const area = root.matches('.lln-dict-area') ? root : root.closest('.lln-dict-area');
  return area || root;
}

function findBestDictionaryRoot(word) {
  const candidates = new Set();
  for (const selector of DICT_ROOT_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      const root = getDictionaryRootCandidate(el);
      if (root) candidates.add(root);
    }
  }

  let best = null;
  let bestScore = -Infinity;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 220 || rect.height < 180) continue;
    const text = collapseWhitespace(el.innerText || el.textContent || '');
    if (!text) continue;

    let score = Math.min((rect.width * rect.height) / 1200, 400);
    if (containsWholeWord(text, word)) score += 1000;
    if (/解释/.test(text)) score += 120;
    if (/例子/.test(text)) score += 60;
    if (/语法/.test(text)) score += 40;

    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }

  return best;
}

function stripDictionaryControls(root) {
  const clone = root.cloneNode(true);

  for (const selector of DICT_REMOVE_SELECTORS) {
    for (const el of clone.querySelectorAll(selector)) {
      el.remove();
    }
  }

  for (const el of clone.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;

    if (el.getAttribute('aria-hidden') === 'true') {
      el.remove();
      continue;
    }

    const text = collapseWhitespace(el.innerText || el.textContent || '');
    if (!text) continue;

    if (/^(解释|例子|语法)$/.test(text)) {
      el.remove();
      continue;
    }

    if (/^(Re|Ca|Wr|Gl|Wi|Ba)(\s+(Re|Ca|Wr|Gl|Wi|Ba))*$/i.test(text)) {
      el.remove();
      continue;
    }

    if (/^标记\s*>>$/i.test(text)) {
      el.remove();
      continue;
    }
  }

  return clone;
}

function cleanDictionaryLines(text) {
  const out = [];
  let prev = '';

  for (const rawLine of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = collapseWhitespace(rawLine);
    if (!line) continue;
    if (/^(解释|例子|语法)$/.test(line)) continue;
    if (/^(Re|Ca|Wr|Gl|Wi|Ba)(\s+(Re|Ca|Wr|Gl|Wi|Ba))*$/i.test(line)) continue;
    if (/^标记\s*>>$/i.test(line)) continue;
    if (/^[✓✔✕✖×○●◉]$/.test(line)) continue;
    if (line === prev) continue;
    out.push(line);
    prev = line;
  }

  const joined = out.join('\n');
  return joined.slice(0, MAX_DICT_TEXT_LEN).trim();
}

function dictionaryTextToHtml(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';

  return lines.map((line, index) => {
    const safe = escapeHtml(line);
    if (index === 0) return `<div><b>${safe}</b></div>`;
    return `<div>${safe}</div>`;
  }).join('');
}

function extractDictionaryData(word) {
  const root = findBestDictionaryRoot(word);
  if (!root) return null;

  const stripped = stripDictionaryControls(root);
  const text = cleanDictionaryLines(stripped.innerText || stripped.textContent || '');
  if (!text) return null;
  if (word && !containsWholeWord(text, word)) return null;

  return {
    text,
    html: dictionaryTextToHtml(text)
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDictionaryData(word) {
  const startedAt = Date.now();
  let best = null;
  let lastText = '';
  let stableHits = 0;

  while (Date.now() - startedAt <= DICT_WAIT_TIMEOUT_MS) {
    const data = extractDictionaryData(word);
    if (data?.text) {
      best = data;
      if (data.text === lastText) {
        stableHits += 1;
      } else {
        lastText = data.text;
        stableHits = 1;
      }

      if (stableHits >= 2) break;
    }

    await sleep(DICT_WAIT_INTERVAL_MS);
  }

  return best;
}

function buildCardPayload({ word, target, x, y }) {
  const normalizedWord = normalize(word || '');
  if (!normalizedWord || !isLikelyEnglishWord(normalizedWord)) return null;

  const englishBlock = lrAdapter.findBestEnglishBlock(normalizedWord, target, x, y);
  if (!englishBlock) return null;

  const sentence = lrAdapter.extractSentence(englishBlock);
  if (!sentence) return null;
  if (!sentence.toLowerCase().includes(normalizedWord.toLowerCase())) return null;

  const sentenceMeaning = lrAdapter.findTranslationForBlock(englishBlock.getBoundingClientRect());
  const video = document.querySelector('video');
  const t = video ? Math.floor(video.currentTime * 1000) : null;

  return {
    id: crypto.randomUUID(),
    word: normalizedWord,
    sentence,
    wordMeaning: '',
    wordMeaningHtml: '',
    sentenceMeaning,
    url: location.href,
    t_ms: t,
    createdAt: Date.now(),
    ...getPageMetadata()
  };
}

function getWordForSave(selectionText, x, y) {
  const selected = normalize(selectionText || getSelectionWord());
  if (selected && isLikelyEnglishWord(selected)) return selected;

  const pointWord = normalize(getWordAtPoint(x, y));
  if (pointWord && isLikelyEnglishWord(pointWord)) return pointWord;

  return '';
}

function buildEmptyContextResponse() {
  return {
    word: '',
    sentence: '',
    wordMeaning: '',
    wordMeaningHtml: '',
    sentenceMeaning: '',
    url: location.href,
    ...getPageMetadata()
  };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req?.type === 'collectContext') {
    if (!getCurrentSite() || !lrAdapter.isAvailable()) {
      sendResponse(buildEmptyContextResponse());
      return true;
    }

    const x = lastSubtitlePointer.x || Math.round(window.innerWidth / 2);
    const y = lastSubtitlePointer.y || Math.round(window.innerHeight / 2);
    const word = getWordForSave(req.selectionText || '', x, y);
    const payload = buildCardPayload({
      word,
      target: lastSubtitlePointer.block || getSelectionAnchorElement(),
      x,
      y
    });

    const dictData = payload?.word ? lrAdapter.extractDictionaryData(payload.word) : null;
    if (payload && dictData?.text) {
      payload.wordMeaning = dictData.text;
      payload.wordMeaningHtml = dictData.html;
    }

    sendResponse(payload || {
      word,
      sentence: '',
      wordMeaning: '',
      wordMeaningHtml: '',
      sentenceMeaning: '',
      url: location.href,
      ...getPageMetadata()
    });
    return true;
  }

  if (req?.type === 'collectFromHotkey') {
    if (!getCurrentSite() || !lrAdapter.isAvailable()) {
      sendResponse(buildEmptyContextResponse());
      return true;
    }

    const x = lastSubtitlePointer.x || Math.round(window.innerWidth / 2);
    const y = lastSubtitlePointer.y || Math.round(window.innerHeight / 2);
    const word = getWordForSave('', x, y);
    const payload = buildCardPayload({
      word,
      target: lastSubtitlePointer.block || getSelectionAnchorElement(),
      x,
      y
    });

    const dictData = payload?.word ? lrAdapter.extractDictionaryData(payload.word) : null;
    if (payload && dictData?.text) {
      payload.wordMeaning = dictData.text;
      payload.wordMeaningHtml = dictData.html;
    }

    sendResponse(payload || {
      word,
      sentence: '',
      wordMeaning: '',
      wordMeaningHtml: '',
      sentenceMeaning: '',
      url: location.href,
      ...getPageMetadata()
    });
    return true;
  }
});

document.addEventListener('pointermove', (event) => {
  if (!getCurrentSite() || !lrAdapter.isAvailable()) return;

  const block = lrAdapter.getEnglishSubtitleBlockAtPoint(event.clientX, event.clientY);
  if (!block) return;
  lastSubtitlePointer = {
    x: event.clientX,
    y: event.clientY,
    block,
    at: Date.now()
  };
}, true);

document.addEventListener('pointerup', (event) => {
  if (!shouldAutoSave(event)) return;
  if (!getCurrentSite() || !lrAdapter.isAvailable()) return;

  setTimeout(async () => {
    const targetBlock = lrAdapter.getEnglishSubtitleBlockAtPoint(event.clientX, event.clientY)
      || closestMatching(event.target, EN_SUBTITLE_SELECTORS);

    if (!targetBlock) return;

    const word = getWordForSave('', event.clientX, event.clientY);
    if (!word) return;

    const item = buildCardPayload({
      word,
      target: targetBlock,
      x: event.clientX,
      y: event.clientY
    });

    if (!item?.sentence) return;

    const dictData = await lrAdapter.waitForDictionaryData(item.word);
    if (dictData?.text) {
      item.wordMeaning = dictData.text;
      item.wordMeaningHtml = dictData.html;
    }

    if (tooSoonSameCard(item)) return;

    chrome.runtime.sendMessage({ type: 'addItemFromContent', item });
    const suffixParts = [];
    if (item.sentenceMeaning) suffixParts.push('中英字幕');
    else suffixParts.push('英文字幕');
    if (item.wordMeaning) suffixParts.push('词典解释');
    showToast(`已保存：${item.word} · ${suffixParts.join(' + ')}`);
  }, 0);
}, true);
