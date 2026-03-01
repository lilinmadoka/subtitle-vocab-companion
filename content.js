console.log("[Vocab Companion] injected:", location.href);

function normalize(text) {
    if (!text) return "";
    return text
        .trim()
        .replace(/^[\s"'“”‘’.,!?;:()[\]{}<>《》]+/, "")
        .replace(/[\s"'“”‘’.,!?;:()[\]{}<>《》]+$/, "")
        .trim();
}

function isLikelyEnglishWord(w) {
    return /^[A-Za-z][A-Za-z0-9'’_-]{0,48}$/.test(w);
}

function getSelectionWord() {
    const sel = window.getSelection?.();
    return normalize(sel?.toString?.() || "");
}

// 从点击位置取词（无需 OCR）
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
    if (!range) return "";

    const node = range.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return "";

    const text = node.textContent || "";
    const idx = range.startOffset;

    const isWordChar = (c) => /[A-Za-z0-9’'_-]/.test(c);

    let l = idx,
        r = idx;
    while (l > 0 && isWordChar(text[l - 1])) l--;
    while (r < text.length && isWordChar(text[r])) r++;

    return normalize(text.slice(l, r));
}

// 尝试从点击目标附近提取“字幕整句”
// 逻辑：向上找 1~8 层祖先，挑一个短文本（10~220字）且包含该单词
function extractWithSpaces(container) {
    if (!(container instanceof Element)) return "";

    // 1) 优先：把“直接子元素”当作一个个释义块/行，拼空格
    // :scope 在 Chrome 可用；用于只取直接子级，避免把整页都扫进去
    let parts = [];
    try {
        const children = container.querySelectorAll(":scope > *");
        if (children && children.length) {
            for (const ch of children) {
                const t = normalize((ch.innerText || ch.textContent || "").replace(/\s+/g, " "));
                if (t) parts.push(t);
            }
        }
    } catch {
        // 某些情况下 :scope 可能异常，直接跳过
    }

    // 如果拆出来至少 2 段，说明我们成功把“多个释义”分开了
    if (parts.length >= 2) return parts.join(" ");

    // 2) 回退：TreeWalker 扫 text node，跨父元素时插一个空格
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const t = (node.nodeValue || "").trim();
            return t ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });

    const out = [];
    let prevParent = null;
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;

        const t = normalize((node.nodeValue || "").replace(/\s+/g, " "));
        if (!t) continue;

        if (out.length > 0 && parent && prevParent && parent !== prevParent) {
            out.push(" "); // ✅ 关键：不同父元素之间强制加空格
        } else if (out.length > 0) {
            out.push(" ");
        }

        out.push(t);
        prevParent = parent;
    }

    return out.join("").replace(/\s{2,}/g, " ").trim();
}

function getSentenceNearTarget(target, word) {
    let el = target instanceof Element ? target : null;
    const wLower = (word || "").toLowerCase();

    for (let i = 0; i < 10 && el; i++) {
        // ✅ 用我们自己的“智能提取”，而不是 textContent/innerText 直接整段拿
        const txt = extractWithSpaces(el);

        if (
            txt.length >= 10 &&
            txt.length <= 260 &&
            txt.toLowerCase().includes(wLower)
        ) {
            return txt;
        }
        el = el.parentElement;
    }
    return "";
}
// toast
let toastTimer = null;
function showToast(msg) {
    let t = document.getElementById("__vocab_toast");
    if (!t) {
        t = document.createElement("div");
        t.id = "__vocab_toast";
        t.style.cssText = `
      position: fixed; left: 50%; bottom: 18%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.78);
      color: #fff; padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px; z-index: 999999;
      max-width: 70vw; text-align: center;
      pointer-events: none;
    `;
        document.documentElement.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 900);
}

// 防重复保存（避免连续点同一词刷屏）
let lastSaved = { word: "", at: 0 };
function tooSoonSameWord(word) {
    const now = Date.now();
    const w = word.toLowerCase();
    if (w === lastSaved.word && now - lastSaved.at < 1200) return true;
    lastSaved = { word: w, at: now };
    return false;
}

// 核心：捕获“点词查义”这类交互（通常发生在 pointerup/click 后）
document.addEventListener(
    "pointerup",
    (e) => {
        // 给 LR/页面一点时间先更新选区
        setTimeout(() => {
            let word = getSelectionWord();
            if (!word) word = getWordAtPoint(e.clientX, e.clientY);
            word = normalize(word);

            if (!word || !isLikelyEnglishWord(word)) return;
            if (tooSoonSameWord(word)) return;

            const sentence = getSentenceNearTarget(e.target, word);
            // 找不到“整句”就不保存，避免误触页面其他文字
            if (!sentence) return;

            const video = document.querySelector("video");
            const t = video ? Math.floor(video.currentTime * 1000) : null;

            chrome.runtime.sendMessage({
                type: "addItemFromContent",
                item: {
                    id: crypto.randomUUID(),
                    word,
                    sentence,
                    url: location.href,
                    t_ms: t,
                    createdAt: Date.now()
                }
            });

            showToast(`已保存：${word}`);
        }, 0);
    },
    true
);