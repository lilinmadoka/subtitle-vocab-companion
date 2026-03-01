const MENU_ID = "nflx_save_vocab";
const STORAGE_KEY = "vocabItems";

function storageGet(key, fallbackValue) {
    return new Promise((resolve) => {
        chrome.storage.local.get({ [key]: fallbackValue }, (res) => resolve(res[key]));
    });
}
 
function storageSet(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve)); 
}

function normalize(text) {
    if (!text) return "";
    // 去掉首尾常见标点、空格
    return text
        .trim()
        .replace(/^[\s"'“”‘’.,!?;:()[\]{}<>《》]+/, "")
        .replace(/[\s"'“”‘’.,!?;:()[\]{}<>《》]+$/, "")
        .trim();
}

async function addItem(item) {
    const items = await storageGet(STORAGE_KEY, []);
    const wordKey = (item.word || "").toLowerCase();
    const sentenceKey = (item.sentence || "").toLowerCase();

    // 简单去重：同一个 word + sentence 不重复
    const exists = items.some(
        (x) =>
            (x.word || "").toLowerCase() === wordKey &&
            (x.sentence || "").toLowerCase() === sentenceKey
    );
    if (exists) return;

    items.unshift(item);
    await storageSet({ [STORAGE_KEY]: items });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: MENU_ID,
        title: "保存到单词本",
        contexts: ["selection"],
        documentUrlPatterns: ["*://www.netflix.com/*"]
    });
});

// 右键菜单保存
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID) return;
    if (!tab?.id) return;

    const selectionText = normalize(info.selectionText || "");
    if (!selectionText) return;

    try {
        const ctx = await chrome.tabs.sendMessage(tab.id, {
            type: "collectContext",
            selectionText
        });

        const word = normalize(ctx?.word || selectionText);
        const sentence = (ctx?.sentence || "").trim();
        const url = ctx?.url || tab.url || "";
        const createdAt = Date.now();

        await addItem({
            id: crypto.randomUUID(),
            word,
            sentence,
            url,
            createdAt
        });
    } catch (e) {
        // content script 可能还没注入（比如刚打开页面）
        console.warn("Failed to collect context:", e);
    }
});

// 快捷键保存（Alt+Shift+S）
chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "save-word") return;
    if (!tab?.id) return;

    try {
        const ctx = await chrome.tabs.sendMessage(tab.id, { type: "collectFromHotkey" });
        const word = normalize(ctx?.word || "");
        if (!word) return;

        await addItem({
            id: crypto.randomUUID(),
            word,
            sentence: (ctx?.sentence || "").trim(),
            url: ctx?.url || tab.url || "",
            createdAt: Date.now()
        });
    } catch (e) {
        console.warn("Hotkey save failed:", e);
    }
});
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req?.type !== "addItemFromContent") return;

    addItem(req.item)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));

    return true;
});
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req?.type !== "addItemFromContent") return;

    addItem(req.item)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));

    return true;
});