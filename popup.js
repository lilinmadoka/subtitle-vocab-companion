const STORAGE_KEY = 'vocabItems';
const SETTINGS_KEY = 'settings_v1';
const DEFAULT_SETTINGS = { autoSaveOnSubtitleClick: true };

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

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  return div.textContent || div.innerText || '';
}

function previewText(text, maxLen = 240) {
  const value = String(text || '').trim();
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + '…';
}

function sanitizeField(text) {
  return collapseWhitespace(text).replace(/\t/g, ' ');
}

function tsvField(text) {
  return String(text || '').replace(/\r?\n/g, ' ').replace(/\t/g, ' ').trim();
}

function htmlifyPlainText(text) {
  return escapeHtml(String(text || '').replace(/\r/g, '')).replace(/\n/g, '<br>');
}

function getMeaningPreview(item) {
  const text = String(item.wordMeaning || '').trim() || stripHtml(item.wordMeaningHtml || '');
  return previewText(text);
}

function buildFront(item) {
  const word = htmlifyPlainText(sanitizeField(item.word || ''));
  const sentence = htmlifyPlainText(sanitizeField(item.sentence || ''));
  return sentence ? `${word}<br><br>${sentence}` : word;
}

function buildBack(item) {
  const parts = [];
  const sentenceMeaning = sanitizeField(item.sentenceMeaning || '');
  const dictHtml = String(item.wordMeaningHtml || '').trim();
  const dictText = String(item.wordMeaning || '').trim();

  if (sentenceMeaning) {
    parts.push(`<div>${htmlifyPlainText(sentenceMeaning)}</div>`);
  }

  if (dictHtml) {
    parts.push(dictHtml);
  } else if (dictText) {
    parts.push(`<div>${htmlifyPlainText(dictText)}</div>`);
  }

  return parts.join('<br><br>');
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
    list.innerHTML = '<div class="hint">暂无记录。去 Netflix 播放页点击字幕单词保存吧。</div>';
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
      const meaningText = String(item.wordMeaning || '').trim() || stripHtml(item.wordMeaningHtml || '');
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
