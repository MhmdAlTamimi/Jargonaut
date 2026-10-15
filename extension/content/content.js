// Runs on every page and inside the bundled PDF viewer. Listens for a
// double-click or the Alt+Shift+G shortcut, finds the saved term at that
// spot, and opens the card (F1, F2). Also scans the page for abbreviations
// the paper defines (F6).
"use strict";

const JargonautContent = (() => {
  const T = JargonautText;
  const M = JargonautMatcher;
  const S = JargonautStore;
  const A = JargonautAbbr;

  // Text gathered on each side of the click: plenty for ~8 words each way
  // and for the sentence that is saved as context.
  const WINDOW_CHARS = 600;
  // Elements whose text is never part of the reading flow.
  const SKIP = new Set([
    "script", "style", "noscript", "template", "textarea", "input", "select",
    "button", "svg", "annotation", "annotation-xml", "jargonaut-ui",
  ]);

  const state = {
    entries: new Map(), // id -> entry, kept in sync with storage
    index: null, // matcher index, rebuilt lazily after changes
    sourceUrl: location.href, // saved with each meaning
    tabId: undefined, // set by the PDF viewer (an extension page)
    paper: new Map(), // abbreviations this page defines: ABBR -> definition
  };
  // Inside the PDF viewer the text comes from PDF.js, not the DOM.
  const inViewer = location.protocol === "chrome-extension:";
  let ui = null;

  const alive = () => {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch {
      return false; // the extension was reloaded; this page needs a refresh
    }
  };

  // ---- the glossary, in memory ----

  const ready = S.getAll()
    .then((list) => list.forEach((e) => state.entries.set(e.id, e)))
    .catch(() => {});

  S.onChanged((updates) => {
    for (const { id, entry } of updates) {
      if (entry) state.entries.set(id, entry);
      else state.entries.delete(id);
    }
    state.index = null;
    if (ui) ui.refresh(updates);
  });

  function index() {
    if (!state.index) state.index = M.buildIndex(state.entries.values());
    return state.index;
  }

  function remember(entry, replacedId) {
    if (replacedId && replacedId !== entry.id) state.entries.delete(replacedId);
    state.entries.set(entry.id, entry);
    state.index = null;
    return entry;
  }

  const controller = {
    getEntry: (id) => state.entries.get(id) || null,
    getTags: () => S.allTags([...state.entries.values()]),
    sortMeanings: S.sortedMeanings,
    async saveNew({ term, text, tag, context }) {
      return remember(await S.addMeaning({ term, text, tag, context, sourceUrl: state.sourceUrl }));
    },
    async addMeaning(entryId, meaning) {
      return remember(await S.addMeaningTo(entryId, { ...meaning, sourceUrl: state.sourceUrl }));
    },
    async saveEdit(entryId, draft) {
      const entry = await S.updateEntry(entryId, draft);
      if (!entry) {
        state.entries.delete(entryId);
        state.index = null;
        return null;
      }
      return remember(entry, entryId);
    },
  };

  function getUi() {
    if (!ui) ui = JargonautCard.create(controller);
    return ui;
  }

  // ---- reading the text around a point ----

  function isInline(el) {
    const d = getComputedStyle(el).display;
    return d.startsWith("inline") || d === "contents" || d === "math" || d.startsWith("ruby");
  }

  // The paragraph-like element the text node belongs to. In the PDF viewer
  // every line is its own absolutely positioned span, so the whole page's
  // text layer is used instead.
  function containerOf(node) {
    let el = node.parentElement;
    const textLayer = el && el.closest(".textLayer");
    if (textLayer) return textLayer;
    while (el && el !== document.body && el !== document.documentElement && isInline(el)) {
      el = el.parentElement;
    }
    return el || document.body || document.documentElement;
  }

  function makeWalker(container) {
    return document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (SKIP.has(n.localName) || n.getAttribute("aria-hidden") === "true") {
          return NodeFilter.FILTER_REJECT;
        }
        if (n.localName === "br") return NodeFilter.FILTER_ACCEPT;
        // Hidden text, e.g. footnotes that only appear on hover.
        if (n.firstChild && getComputedStyle(n).display === "none") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      },
    });
  }

  // Joins the text nodes around (node, offset) into one string and remembers
  // where each node starts, so positions in the string map back to the page.
  function collectAround(node, offset) {
    const container = containerOf(node);
    const walker = makeWalker(container);
    const isText = (n) => n.nodeType === Node.TEXT_NODE;
    const size = (n) => (isText(n) ? n.data.length : 1);

    const before = [];
    let count = 0;
    let n;
    walker.currentNode = node;
    while (count < WINDOW_CHARS && (n = walker.previousNode())) {
      before.push(n);
      count += size(n);
    }
    before.reverse();
    const after = [];
    count = 0;
    walker.currentNode = node;
    while (count < WINDOW_CHARS && (n = walker.nextNode())) {
      after.push(n);
      count += size(n);
    }

    // Text from different blocks (list items, table cells...) gets a line
    // break between it so words from separate blocks don't glue together.
    // Not in the PDF text layer, where one word can span two spans.
    const inPdf = container.classList && container.classList.contains("textLayer");
    const blockCache = new Map();
    const blockOf = (textNode) => {
      const parent = textNode.parentElement;
      if (!blockCache.has(parent)) {
        let el = parent;
        while (el && el !== container && isInline(el)) el = el.parentElement;
        blockCache.set(parent, el);
      }
      return blockCache.get(parent);
    };

    let text = "";
    const map = [];
    let lastBlock = null;
    let clickAt = 0;
    for (const item of [...before, node, ...after]) {
      if (!isText(item)) {
        map.push({ node: item, start: text.length });
        text += "\n";
        continue;
      }
      if (!inPdf) {
        const block = blockOf(item);
        if (lastBlock && block !== lastBlock) text += "\n";
        lastBlock = block;
      }
      if (item === node) clickAt = text.length + offset;
      map.push({ node: item, start: text.length });
      text += item.data;
    }
    return { text, map, offset: clickAt };
  }

  function tokenAt(tokens, offset) {
    return tokens.findIndex((t) => t.start <= offset && offset <= t.end);
  }

  // The text node and offset for a position in collectAround's string.
  function locate(map, pos) {
    for (let i = map.length - 1; i >= 0; i--) {
      const { node, start } = map[i];
      if (node.nodeType === Node.TEXT_NODE && start <= pos) {
        return { node, offset: Math.min(pos - start, node.data.length) };
      }
    }
    return null;
  }

  function rangeFor(map, start, end) {
    const a = locate(map, start);
    const b = locate(map, end);
    const range = document.createRange();
    if (!a || !b) return range;
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return range;
  }

  // The exact spot under the mouse (document.caretRangeFromPoint), falling
  // back to the word the browser just selected.
  function hitTest(e) {
    const caret = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY);
    if (caret && caret.startContainer.nodeType === Node.TEXT_NODE) {
      return { node: caret.startContainer, offset: caret.startOffset };
    }
    const sel = getSelection();
    if (sel && sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE) {
      return { node: sel.anchorNode, offset: sel.anchorOffset };
    }
    return null;
  }

  function ignoreTarget(target) {
    const el = target && target.nodeType === Node.ELEMENT_NODE ? target : target && target.parentElement;
    if (!el) return true;
    return Boolean(el.isContentEditable || el.closest("input, textarea, select, button, jargonaut-ui"));
  }

  // ---- abbreviations the paper defines (F6) ----

  // Block-level tags: their text starts on a new line, so a heading doesn't
  // glue onto the next paragraph's first word.
  const BLOCK_TAGS = new Set([
    "p", "div", "li", "dd", "dt", "td", "th", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
    "section", "article", "blockquote", "figcaption", "caption", "pre", "header", "footer",
    "table", "br", "main", "aside", "nav",
  ]);

  function pageText() {
    const root = document.body;
    if (!root) return "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (SKIP.has(n.localName)) return NodeFilter.FILTER_REJECT;
        return BLOCK_TAGS.has(n.localName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const parts = [];
    let n;
    while ((n = walker.nextNode())) parts.push(n.nodeType === Node.TEXT_NODE ? n.data : "\n");
    return parts.join("");
  }

  let lastScanLength = -1;
  function scanPage() {
    if (inViewer) return;
    const text = pageText();
    if (text.length === lastScanLength) return;
    lastScanLength = text.length;
    A.scan(text, state.paper);
  }

  // Pages that load content later (or expand sections) get re-scanned, at
  // most every few seconds, while the browser is idle.
  const idle = (fn) =>
    "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 200);
  let rescanTimer = 0;
  function scheduleRescan() {
    if (rescanTimer) return;
    rescanTimer = setTimeout(() => {
      rescanTimer = 0;
      idle(scanPage);
    }, 3000);
  }

  if (!inViewer) {
    idle(scanPage);
    const ours = (node) => node.localName === "jargonaut-ui";
    new MutationObserver((records) => {
      if (records.some((r) => [...r.addedNodes].some((n) => !ours(n)))) scheduleRescan();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function paperDefinition(word) {
    if (lastScanLength < 0 && !inViewer) scanPage();
    return A.lookup(state.paper, word);
  }

  // ---- what to show ----

  function showEntry(entryId, anchor, context) {
    const entry = state.entries.get(entryId);
    if (!entry) return;
    getUi().showEntry(entry, anchor, context);
    S.touch(entryId).catch(() => {});
  }

  // Double-click: saved phrase around the word -> card; otherwise the
  // unobtrusive "+ Add" pill.
  async function onDoubleClick(e) {
    if (e.button !== 0 || !alive() || ignoreTarget(e.target)) return;
    const hit = hitTest(e);
    if (!hit) return;
    await ready;
    const ctx = collectAround(hit.node, hit.offset);
    const tokens = T.tokenize(ctx.text);
    const i = tokenAt(tokens, ctx.offset);
    if (i < 0) return;
    const word = tokens[i];
    const anchor = rangeFor(ctx.map, word.start, word.end);
    const context = T.sentenceAround(ctx.text, word.start, word.end);

    const match = M.matchAt(index(), tokens, i);
    if (match) return showEntry(match.entryId, anchor, context);

    const paper = paperDefinition(word.exact);
    if (paper) return getUi().showPaper(paper, anchor, { triggerText: word.exact, context });

    getUi().showPill(anchor, () => getUi().showAdd({ term: word.exact, context }, anchor));
  }

  function firstTextNode(range) {
    const start = range.startContainer;
    if (start.nodeType === Node.TEXT_NODE) return { node: start, offset: range.startOffset };
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (range.intersectsNode(n) && n.data.trim()) return { node: n, offset: 0 };
    }
    return null;
  }

  // Shortcut: the selected text is the term. Saved -> card; otherwise the
  // add form opens straight away with the selection prefilled.
  async function onShortcut() {
    if (!alive() || !document.hasFocus()) return;
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const raw = sel.toString();
    const term = T.cleanSpace(raw);
    if (!term || term.length > 300) return;
    await ready;
    const range = sel.getRangeAt(0).cloneRange();
    let context = "";
    const first = firstTextNode(range);
    if (first) {
      const ctx = collectAround(first.node, first.offset);
      context = T.sentenceAround(ctx.text, ctx.offset, ctx.offset + raw.length);
    }
    const tokens = T.tokenize(term);
    const match = M.matchExact(index(), tokens);
    if (match) return showEntry(match.entryId, range, context);

    // A single abbreviation like "RAG" or "(RAG)" that this paper defines.
    const paper = tokens.length === 1 && paperDefinition(tokens[0].exact);
    if (paper) return getUi().showPaper(paper, range, { triggerText: term, context });

    getUi().showAdd({ term, context }, range);
  }

  window.addEventListener("dblclick", onDoubleClick, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "jargonaut:lookup-selection") return;
    // Messages for the PDF viewer carry the tab they're meant for.
    if (msg.tabId !== undefined && msg.tabId !== state.tabId) return;
    onShortcut();
  });

  // Used by the PDF viewer.
  return {
    setSourceUrl(url) {
      state.sourceUrl = url;
    },
    setTabId(id) {
      state.tabId = id;
    },
    // The PDF's full text (every page, not just the rendered ones), so an
    // abbreviation defined on page 1 is known on page 9.
    setPaperText(text) {
      state.paper = A.scan(text);
    },
  };
})();
