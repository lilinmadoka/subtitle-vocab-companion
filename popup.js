const STORAGE_KEY = "vocabItems";
const SETTINGS_KEY = "settings_v1";
const DEFAULT_SETTINGS = { autoSaveOnSubtitleClick: true };
function escapeRegExp(str) {
    return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 把 “中文释义 + 英文词” 清洗成更好看的排版
function prettyLine(raw, word) {
    let s = (raw || "").replace(/\s+/g, " ").trim();
    if (!s) return "";

    const w = (word || "").trim();
    if (w) {
        // ✅ 去掉末尾重复的 headword（不依赖 \b，避免带 ' - 的词失效）
        const re = new RegExp("\\s*" + escapeRegExp(w) + "\\s*$", "i");
        s = s.replace(re, "").trim();
    }

    // ✅ 如果还同时包含中文和英文，把英文部分换到下一行（更像“释义 / 例句”的排版）
    if (/[\u4e00-\u9fff]/.test(s) && /[A-Za-z]/.test(s)) {
        s = s.replace(/\s+([A-Za-z])/g, "\n$1");
    }
    // ✅ 中文释义分隔：换行/分号/顿号 → 空格
    if (/[\u4e00-\u9fff]/.test(s)) {
        s = s.replace(/\r\n/g, "\n");
        s = s.replace(/\n+/g, " ");        // 换行变空格
        s = s.replace(/[；;、]/g, " ");     // 常见分隔符也统一成空格
        s = s.replace(/\s{2,}/g, " ").trim();
    }
    return s;
}
function storageGet(key, fallbackValue) {
    return new Promise((resolve) => {
        chrome.storage.local.get({ [key]: fallbackValue }, (res) => resolve(res[key]));
    });
}
function storageSet(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function formatTime(ts) {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return "";
    }
}

function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[c]));
}

let allItems = [];

async function load() {
    allItems = await storageGet(STORAGE_KEY, []);
    render();
}

function render() {
    const q = (document.getElementById("q").value || "").trim().toLowerCase();
    const items = !q
        ? allItems
        : allItems.filter((x) =>
            (x.word || "").toLowerCase().includes(q) ||
            (x.sentence || "").toLowerCase().includes(q)
        );

    document.getElementById("count").textContent = `${items.length} / ${allItems.length}`;

    const list = document.getElementById("list");
    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = `<div class="hint">暂无记录。去 Netflix 播放页选中字幕单词保存吧～</div>`;
        return;
    }

    for (const item of items) {
        const card = document.createElement("div");
        card.className = "card";

        const url = item.url || "";
        card.innerHTML = `
      <div class="wordRow">
        <div class="word">${escapeHtml(item.word || "")}</div>
        <div class="actions">
          <button class="smallBtn" data-act="copy" data-id="${item.id}">复制</button>
          <button class="smallBtn" data-act="del" data-id="${item.id}">删除</button>
        </div>
      </div>
      <div class="sentence">${escapeHtml(prettyLine(item.sentence || "", item.word || ""))}</div>
      <div class="footer">
        <div>${escapeHtml(formatTime(item.createdAt))}</div>
        ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">来源</a>` : `<span></span>`}
      </div>
    `;
        list.appendChild(card);
    }
}

async function removeById(id) {
    allItems = allItems.filter((x) => x.id !== id);
    await storageSet({ [STORAGE_KEY]: allItems });
    render();
}

async function clearAll() {
    allItems = [];
    await storageSet({ [STORAGE_KEY]: allItems });
    render();
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
 
function exportTSV() {
    // Anki 支持“字段用逗号/分号/Tab 分隔”的纯文本导入；TSV（Tab 分隔）通常最省事。 :contentReference[oaicite:7]{index=7}
    // 这里导出两列：Front=word, Back=sentence（导入 Anki 时映射字段即可）
    const lines = allItems.map((x) => {
        const w = (x.word || "").replace(/\t/g, " ").trim();
        const s = prettyLine(x.sentence || "", x.word || "").replace(/\t/g, " ").trim();
        return `${w}\t${s}`;
    });
    downloadText("netflix_vocab.tsv", lines.join("\n"));
}

document.addEventListener("DOMContentLoaded", () => {
    // 初始化开关
    chrome.storage.local.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, (res) => {
        const s = res[SETTINGS_KEY] || DEFAULT_SETTINGS;
        document.getElementById("autoSave").checked = !!s.autoSaveOnSubtitleClick;
    });

    document.getElementById("autoSave").addEventListener("change", (e) => {
        const v = !!e.target.checked;
        chrome.storage.local.set({ [SETTINGS_KEY]: { autoSaveOnSubtitleClick: v } });
    });
    document.getElementById("q").addEventListener("input", render);

    document.getElementById("list").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const item = allItems.find((x) => x.id === id);
        if (!item) return;

        if (act === "del") await removeById(id);
        if (act === "copy") {
            const text = `${item.word}\n${item.sentence || ""}\n${item.url || ""}`.trim();
            await navigator.clipboard.writeText(text);
            btn.textContent = "已复制";
            setTimeout(() => (btn.textContent = "复制"), 600);
        }
    });

    document.getElementById("export").addEventListener("click", exportTSV);
    document.getElementById("clear").addEventListener("click", clearAll);

    load();
});