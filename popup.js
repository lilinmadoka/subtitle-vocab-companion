const STORAGE_KEY = 'vocabItems';
const SETTINGS_KEY = 'settings_v1';
const DEFAULT_SETTINGS = { autoSaveOnSubtitleClick: true };
const MAX_BACK_DEFINITION_LINES = 2;
const MAX_BACK_EXAMPLE_LINES = 3;
const LR_CONTROL_TEXT_PATTERNS = [
  /保存短语/g
];

let allItems = [];

function storageGet(key, fallbackValue) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [key]: fallbackValue }, (res) => resolve(res[key]));
  });
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function collapseWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function removeLrControlText(text) {
  let value = String(text || '');
  for (const pattern of LR_CONTROL_TEXT_PATTERNS) {
    value = value.replace(pattern, ' ');
  }
  return value;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

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

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = removeLrControlText(html || '');
  return div.textContent || div.innerText || '';
}

function previewText(text, maxLen = 240) {
  const value = String(text || '').trim();
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + '…';
}

function sanitizeField(text) {
  return collapseWhitespace(removeLrControlText(text)).replace(/\t/g, ' ');
}

function tsvField(text) {
  return removeLrControlText(text).replace(/\r?\n/g, ' ').replace(/\t/g, ' ').trim();
}

function htmlifyPlainText(text) {
  return escapeHtml(String(text || '').replace(/\r/g, '')).replace(/\n/g, '<br>');
}

function highlightPlainText(text, word) {
  const source = String(text || '');
  const target = sanitizeField(word || '');
  if (!source || !target) return htmlifyPlainText(source);

  const useWordBoundary = /^[A-Za-z0-9]+$/.test(target);
  const pattern = useWordBoundary
    ? `\\b${escapeRegExp(target)}\\b`
    : escapeRegExp(target);
  const re = new RegExp(pattern, 'ig');

  let out = '';
  let lastIndex = 0;
  let matched = false;
  source.replace(re, (match, offset) => {
    matched = true;
    out += escapeHtml(source.slice(lastIndex, offset));
    out += `<b>${escapeHtml(match)}</b>`;
    lastIndex = offset + match.length;
    return match;
  });

  if (!matched) return htmlifyPlainText(source);
  out += escapeHtml(source.slice(lastIndex));
  return out.replace(/\n/g, '<br>');
}

function splitCleanLines(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => sanitizeField(line))
    .filter(Boolean);
}

function comparableText(text) {
  return sanitizeField(text).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim();
}

function isPartOfSpeechLine(line) {
  return /^\((?!ANY\)?)[A-Za-z][A-Za-z.\s-]{0,24}\)$/.test(line);
}

function isDiscardedDictionaryLine(line, word, sentence) {
  const value = sanitizeField(line);
  if (!value) return true;
  if (/^示例/.test(value)) return true;
  if (/^>>\s*/.test(value)) return true;
  if (/^\[[^\]]+\]$/.test(value)) return true;
  if (/^\(ANY\)$/i.test(value)) return true;
  if (value.toLowerCase() === String(word || '').trim().toLowerCase()) return true;

  const comparable = comparableText(value);
  const sentenceComparable = comparableText(sentence);
  return !!(sentenceComparable && comparable && sentenceComparable.includes(comparable));
}

function isEnglishExampleLine(line) {
  if (/[\u4e00-\u9fff]/.test(line)) return false;
  if (!/[A-Za-z]/.test(line)) return false;
  return line.split(/\s+/).length >= 4;
}

function parseDictionary(item) {
  const word = sanitizeField(item.word || '');
  const rawText = removeLrControlText(item.wordMeaning || '').trim() || stripHtml(item.wordMeaningHtml || '');
  const lines = splitCleanLines(rawText);
  const definitions = [];
  const examples = [];
  const seenDefinitions = new Set();
  const seenExamples = new Set();
  let partOfSpeech = '';

  for (const line of lines) {
    if (isDiscardedDictionaryLine(line, word, item.sentence || '')) continue;

    if (!partOfSpeech && isPartOfSpeechLine(line)) {
      partOfSpeech = line.replace(/[()]/g, '');
      continue;
    }

    if (isEnglishExampleLine(line)) {
      const key = comparableText(line);
      if (!seenExamples.has(key) && examples.length < MAX_BACK_EXAMPLE_LINES) {
        examples.push(line);
        seenExamples.add(key);
      }
      continue;
    }

    if (!/[\u4e00-\u9fff]/.test(line)) continue;
    const key = comparableText(line);
    if (!seenDefinitions.has(key) && definitions.length < MAX_BACK_DEFINITION_LINES) {
      definitions.push(line);
      seenDefinitions.add(key);
    }
  }

  return { definitions, examples, partOfSpeech };
}

function getMeaningPreview(item) {
  const text = removeLrControlText(item.wordMeaning || '').trim() || stripHtml(item.wordMeaningHtml || '');
  return previewText(text);
}

function buildFront(item) {
  const word = sanitizeField(item.word || '');
  const sentence = sanitizeField(item.sentence || '');
  const parts = [
    `<div style="font-size:24px;font-weight:700;line-height:1.3;">${htmlifyPlainText(word)}</div>`
  ];

  if (sentence) {
    parts.push(
      `<div style="margin-top:14px;font-size:18px;line-height:1.45;">${highlightPlainText(sentence, word)}</div>`
    );
  }

  return parts.join('');
}

function buildBack(item) {
  const parts = [];
  const sentenceMeaning = sanitizeField(item.sentenceMeaning || '');
  const word = sanitizeField(item.word || '');
  const dictionary = parseDictionary(item);

  if (sentenceMeaning) {
    parts.push(`<div style="font-size:17px;line-height:1.55;">${htmlifyPlainText(sentenceMeaning)}</div>`);
  }

  if (word || dictionary.partOfSpeech || dictionary.definitions.length) {
    const head = [];
    if (word) {
      head.push(`<div style="font-size:22px;font-weight:700;line-height:1.3;">${htmlifyPlainText(word)}</div>`);
    }
    if (dictionary.partOfSpeech) {
      head.push(`<div style="opacity:.78;margin-top:2px;">${htmlifyPlainText(dictionary.partOfSpeech)}</div>`);
    }
    if (dictionary.definitions.length) {
      head.push(`<div style="margin-top:8px;line-height:1.55;">${dictionary.definitions.map(htmlifyPlainText).join('<br>')}</div>`);
    }
    parts.push(`<div>${head.join('')}</div>`);
  }

  if (dictionary.examples.length) {
    const exampleHtml = dictionary.examples
      .map((example) => `<div style="margin-top:4px;">• ${highlightPlainText(example, word)}</div>`)
      .join('');
    parts.push(`<div style="line-height:1.45;"><div style="font-weight:600;margin-bottom:4px;">Examples</div>${exampleHtml}</div>`);
  }

  return parts.join('<div style="height:12px;"></div>');
}

async function load() {
  allItems = await storageGet(STORAGE_KEY, []);
  render();
}

function render() {
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const items = !q
    ? allItems
    : allItems.filter((item) =>
        [item.word, item.sentence, item.wordMeaning, item.wordMeaningHtml, item.sentenceMeaning]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );

  document.getElementById('count').textContent = `${items.length} / ${allItems.length}`;

  const list = document.getElementById('list');
  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = '<div class="hint">暂无记录。去 Netflix 或 YouTube 播放页配合 Language Reactor 点击字幕单词保存吧。</div>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';

    const url = item.url || '';
    const sentence = sanitizeField(item.sentence || '');
    const wordMeaningPreview = sanitizeField(getMeaningPreview(item));
    const sentenceMeaning = sanitizeField(item.sentenceMeaning || '');

    card.innerHTML = `
      <div class="wordRow">
        <div class="word">${escapeHtml(item.word || '')}</div>
        <div class="actions">
          <button class="smallBtn" data-act="copy" data-id="${item.id}">复制</button>
          <button class="smallBtn" data-act="del" data-id="${item.id}">删除</button>
        </div>
      </div>
      ${sentence ? `<div class="sentence">${escapeHtml(sentence)}</div>` : ''}
      ${wordMeaningPreview ? `<div class="meaning"><span class="label">词典：</span>${escapeHtml(wordMeaningPreview)}</div>` : ''}
      ${sentenceMeaning ? `<div class="meaning"><span class="label">句义：</span>${escapeHtml(sentenceMeaning)}</div>` : ''}
      <div class="footer">
        <div>${escapeHtml(formatTime(item.createdAt))}</div>
        ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">来源</a>` : '<span></span>'}
      </div>
    `;
    list.appendChild(card);
  }
}

async function removeById(id) {
  allItems = allItems.filter((item) => item.id !== id);
  await storageSet({ [STORAGE_KEY]: allItems });
  render();
}

async function clearAll() {
  allItems = [];
  await storageSet({ [STORAGE_KEY]: allItems });
  render();
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportWordCountCSV() {
  const map = new Map();

  for (const item of allItems) {
    const word = (item.word || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (!map.has(key)) map.set(key, { word, count: 0 });
    map.get(key).count += 1;
  }

  const rows = Array.from(map.values()).sort((a, b) => (b.count - a.count) || a.word.localeCompare(b.word));
  const lines = ['word,count', ...rows.map((row) => `${csvEscape(row.word)},${row.count}`)];
  downloadText('vocab_word_counts.csv', '\uFEFF' + lines.join('\r\n'));
}

function exportWordsCSV() {
  const map = new Map();
  for (const item of allItems) {
    const word = (item.word || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (!map.has(key)) map.set(key, word);
  }

  const words = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  const lines = ['word', ...words.map(csvEscape)];
  downloadText('vocab_words.csv', '\uFEFF' + lines.join('\r\n'));
}

function exportTSV() {
  const lines = allItems.map((item) => {
    const front = tsvField(buildFront(item));
    const back = tsvField(buildBack(item));
    return `${front}\t${back}`;
  });
  downloadText('anki_vocab_cards.tsv', lines.join('\n'));
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, (res) => {
    const settings = res[SETTINGS_KEY] || DEFAULT_SETTINGS;
    document.getElementById('autoSave').checked = !!settings.autoSaveOnSubtitleClick;
  });

  document.getElementById('autoSave').addEventListener('change', (e) => {
    chrome.storage.local.set({
      [SETTINGS_KEY]: { autoSaveOnSubtitleClick: !!e.target.checked }
    });
  });

  document.getElementById('q').addEventListener('input', render);
  document.getElementById('exportWordCountCsv').addEventListener('click', exportWordCountCSV);
  document.getElementById('exportWordsCsv').addEventListener('click', exportWordsCSV);
  document.getElementById('export').addEventListener('click', exportTSV);
  document.getElementById('clear').addEventListener('click', clearAll);

  document.getElementById('list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const item = allItems.find((x) => x.id === btn.dataset.id);
    if (!item) return;

    if (btn.dataset.act === 'del') {
      await removeById(item.id);
      return;
    }

    if (btn.dataset.act === 'copy') {
      const meaningText = removeLrControlText(item.wordMeaning || '').trim() || stripHtml(item.wordMeaningHtml || '');
      const text = [item.word, item.sentence, meaningText, item.sentenceMeaning, item.url]
        .filter(Boolean)
        .join('\n')
        .trim();
      await navigator.clipboard.writeText(text);
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.textContent = '复制';
      }, 600);
    }
  });

  load();
});
