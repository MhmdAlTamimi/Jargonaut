// The floating definition card, the "+ Add" pill and the inline add/edit
// forms (F1, F3, F4, F5). Everything lives in a closed Shadow DOM so the
// paper's own CSS can't change how it looks, and the page can't read it.
"use strict";

const JargonautCard = (() => {
  const WIDTH = 340; // px
  const GAP = 8; // between the word and the card
  const MARGIN = 8; // from the viewport edges
  const PILL_MS = 2000; // the "+ Add" pill fades after this

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .card, .pill {
      --bg: #ffffff; --fg: #1f2328; --muted: #6b7280; --line: #e5e7eb; --hover: #f3f4f6;
      --accent: #4f46e5; --accent-soft: #eef2ff; --accent-line: #c7d2fe; --on-accent: #ffffff;
      --amber: #b45309; --amber-soft: #fffbeb; --amber-line: #fcd34d; --danger: #b91c1c;
      --shadow: 0 10px 30px rgba(15, 23, 42, .14), 0 2px 6px rgba(15, 23, 42, .08);
      font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      letter-spacing: normal; text-transform: none; text-align: left;
    }
    @media (prefers-color-scheme: dark) {
      .card, .pill {
        --bg: #1f2024; --fg: #e8e8ea; --muted: #9a9ba3; --line: #34363c; --hover: #2a2c31;
        --accent: #a5b4fc; --accent-soft: rgba(129, 140, 248, .16); --accent-line: rgba(165, 180, 252, .45);
        --on-accent: #1e1b4b; --amber: #fbbf24; --amber-soft: rgba(251, 191, 36, .12);
        --amber-line: rgba(251, 191, 36, .45); --danger: #f87171;
        --shadow: 0 10px 30px rgba(0, 0, 0, .5), 0 2px 6px rgba(0, 0, 0, .3);
      }
    }
    .card {
      position: fixed; width: ${WIDTH}px; background: var(--bg); color: var(--fg);
      border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow);
      outline: none; animation: jg-in 150ms ease-out; transform-origin: top left;
    }
    .card.above { transform-origin: bottom left; }
    @keyframes jg-in { from { opacity: 0; transform: scale(.96); } }
    header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px 10px; border-bottom: 1px solid var(--line);
    }
    .term { font-size: 16px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
    .term.placeholder { color: var(--muted); font-weight: 500; }
    .badge {
      flex: none; font-size: 12px; font-weight: 600; line-height: 20px; padding: 0 10px;
      border-radius: 999px; border: 1px solid var(--accent-line); background: var(--accent-soft);
      color: var(--accent);
    }
    .badge.paper { border-color: var(--amber-line); background: var(--amber-soft); color: var(--amber); }
    .body { padding: 6px 14px; max-height: min(320px, 50vh); overflow: auto; }
    ol { list-style: none; margin: 0; padding: 0; }
    .meaning { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 2px 8px; padding: 6px 0; }
    .num { flex: none; min-width: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .text { flex: 1 1 0; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .tag {
      flex: none; font-size: 12px; line-height: 20px; padding: 0 8px; margin-top: 1px;
      border-radius: 999px; border: 1px solid var(--accent-line); color: var(--accent);
    }
    .context {
      display: none; flex-basis: 100%; padding-left: 20px; font-size: 12px; font-style: italic;
      color: var(--muted); overflow-wrap: anywhere;
    }
    ol.single .context { padding-left: 0; }
    .meaning:hover .context, .meaning:focus-within .context { display: block; }
    .icon-btn {
      flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px;
      padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted);
      cursor: pointer;
    }
    .icon-btn:hover { background: var(--hover); color: var(--fg); }
    .icon-btn svg { width: 15px; height: 15px; }
    footer { display: flex; align-items: center; gap: 2px; padding: 6px 8px; border-top: 1px solid var(--line); }
    .spacer { flex: 1; }
    button.act {
      font: inherit; font-weight: 600; color: var(--fg); background: transparent; border: 0;
      border-radius: 8px; padding: 5px 10px; cursor: pointer;
    }
    button.act:hover { background: var(--hover); }
    button.act.primary { background: var(--accent); color: var(--on-accent); }
    button.act.primary:hover { filter: brightness(1.08); }
    button:disabled { opacity: .6; cursor: default; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .card:focus-visible { outline: none; }
    form { display: grid; gap: 8px; padding: 6px 0 4px; }
    label { display: grid; gap: 3px; font-size: 12px; font-weight: 600; color: var(--muted); }
    input, textarea {
      font: inherit; font-size: 14px; font-weight: 400; color: var(--fg); background: var(--bg); width: 100%;
      border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; margin: 0;
    }
    input:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    textarea { resize: vertical; min-height: 60px; }
    .edit-row { display: grid; grid-template-columns: 1fr 24px; gap: 6px; align-items: start; }
    .edit-row + .edit-row { padding-top: 8px; border-top: 1px dashed var(--line); }
    .edit-row .fields { display: grid; gap: 6px; }
    .hint { margin: 0; font-size: 12px; color: var(--muted); }
    .hint.paper { color: var(--amber); }
    .hint.paper b { font-weight: 600; }
    .error { margin: 0; font-size: 12px; color: var(--danger); }
    .clip { position: fixed; opacity: 0; pointer-events: none; }
    .pill {
      position: fixed; display: inline-flex; align-items: center; font-size: 12px; font-weight: 600;
      line-height: 1; padding: 6px 10px; border: 0; border-radius: 999px; cursor: pointer;
      background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow);
      animation: jg-in 150ms ease-out; transition: opacity 300ms ease;
    }
    .pill.fading { opacity: 0; }
    @media (prefers-reduced-motion: reduce) {
      .card, .pill { animation: none; transition: none; }
    }
  `;

  // ---- tiny DOM helpers (no innerHTML: definitions and page text are data) ----

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "value") el.value = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const child of children.flat()) {
      if (child != null && child !== false) el.append(child);
    }
    return el;
  }

  const ICONS = {
    copy: [
      ["rect", { x: "9", y: "9", width: "12", height: "12", rx: "2" }],
      ["path", { d: "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" }],
    ],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    remove: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
  };

  function icon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const attrs = {
      viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2",
      "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
    };
    for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
    for (const [tag, partAttrs] of ICONS[name]) {
      const part = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(partAttrs)) part.setAttribute(k, v);
      svg.append(part);
    }
    return svg;
  }

  function rectOf(range) {
    if (!range) return null;
    try {
      const r = range.getBoundingClientRect();
      return r.width || r.height ? r : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // create(controller) -> the UI for one page
  //
  // controller:
  //   getEntry(id)                          latest copy of an entry, or null
  //   getTags()                             tags used so far (autocomplete)
  //   sortMeanings(entry)                   meanings in display order
  //   saveNew({ term, text, tag, context }) -> entry
  //   addMeaning(entryId, { text, tag, context }) -> entry
  //   saveEdit(entryId, { term, meanings }) -> entry, or null if deleted
  // ---------------------------------------------------------------------

  function create(ctl) {
    let host = null;
    let root = null;
    let card = null;
    let pill = null;
    let pillTimer = 0;
    let tagList = null;
    let s = null; // what the card is showing; null when closed
    let listening = false;
    let frame = 0;

    function mount() {
      if (host && host.isConnected) return;
      host = document.createElement("jargonaut-ui");
      const hostStyle = {
        all: "initial", position: "fixed", top: "0", left: "0", width: "0", height: "0",
        "z-index": "2147483647",
      };
      for (const [k, v] of Object.entries(hostStyle)) host.style.setProperty(k, v, "important");
      root = host.attachShadow({ mode: "closed" });
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        root.adoptedStyleSheets = [sheet];
      } catch {
        root.append(h("style", { text: CSS }));
      }
      // Keys typed in the card must not reach the page's own shortcuts
      // (in the PDF viewer, "n" would otherwise turn the page).
      for (const type of ["keydown", "keyup", "keypress"]) {
        root.addEventListener(type, (e) => e.stopPropagation());
      }
      tagList = h("datalist", { id: "jg-tags" });
      root.append(tagList);
      card = h("div", { class: "card", role: "dialog", tabindex: "-1" });
      card.addEventListener("keydown", onCardKey);
      document.documentElement.append(host);
    }

    // ---- open / close ----

    function open(state) {
      mount();
      hidePill();
      s = { above: false, lastRect: null, ...state };
      if (!card.isConnected) root.append(card);
      render(true);
      listen(true);
    }

    function close() {
      hidePill();
      if (!s) return;
      s = null;
      card.remove();
      listen(false);
    }

    function listen(on) {
      if (on === listening) return;
      listening = on;
      const method = on ? "addEventListener" : "removeEventListener";
      window[method]("scroll", onScroll, true);
      window[method]("resize", onScroll, true);
      document[method]("mousedown", onOutside, true);
      document[method]("keydown", onDocKey, true);
    }

    const inUi = (e) => host && e.composedPath().includes(host);

    function onOutside(e) {
      if (!inUi(e)) close();
    }

    function onDocKey(e) {
      if (e.key === "Escape" && !inUi(e)) close();
    }

    // Follow the word while it's on screen; close once it scrolls away
    // (forms stay open so a half-typed definition isn't lost).
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!s) return;
        const r = rectOf(s.anchor);
        const offscreen = !r || r.bottom < 0 || r.top > window.innerHeight;
        if (offscreen && !isForm()) close();
        else place(false);
      });
    }

    const isForm = () => s && (s.mode === "add" || s.mode === "meaning" || s.mode === "edit");

    // ---- positioning: 8 px below the word, flipped above near the bottom ----

    function place(decide) {
      const r = rectOf(s.anchor) || s.lastRect;
      if (!r) return;
      s.lastRect = r;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(WIDTH, vw - 2 * MARGIN);
      card.style.width = width + "px";
      card.style.left = Math.max(MARGIN, Math.min(r.left, vw - width - MARGIN)) + "px";
      const height = card.offsetHeight;
      if (decide) {
        const fitsBelow = r.bottom + GAP + height <= vh - MARGIN;
        const fitsAbove = r.top - GAP - height >= MARGIN;
        s.above = !fitsBelow && fitsAbove;
        card.classList.toggle("above", s.above);
      }
      if (s.above) {
        // Anchored by its bottom edge, so the card grows upward.
        card.style.top = "auto";
        card.style.bottom = Math.min(vh - r.top + GAP, vh - height - MARGIN) + "px";
      } else {
        card.style.bottom = "auto";
        card.style.top = Math.max(MARGIN, Math.min(r.bottom + GAP, vh - height - MARGIN)) + "px";
      }
    }

    // ---- rendering ----

    function render(decide) {
      const parts = build();
      card.replaceChildren(...parts);
      card.setAttribute("aria-label", s.label || "Jargonaut");
      place(decide);
      focusForMode();
    }

    function build() {
      switch (s.mode) {
        case "view": return buildView();
        case "paper": return buildPaper();
        case "add": return buildAdd();
        case "meaning": return buildMeaning();
        case "edit": return buildEdit();
      }
      return [];
    }

    function header(term, badge) {
      return h("header", null,
        h("div", { class: "term", text: term }),
        badge === "mine" && h("span", { class: "badge", text: "Mine" }),
        badge === "paper" && h("span", { class: "badge paper", text: "From this paper" })
      );
    }

    function footer(...buttons) {
      return h("footer", null, ...buttons);
    }

    function act(label, onclick, opts = {}) {
      return h("button", {
        class: "act" + (opts.primary ? " primary" : ""), type: "button",
        title: opts.title, onclick,
      }, label);
    }

    function copyButton(text) {
      const btn = h("button", {
        class: "icon-btn", type: "button", title: "Copy", "aria-label": "Copy this meaning",
      }, icon("copy"));
      btn.addEventListener("click", async () => {
        const ok = await copyText(text);
        btn.replaceChildren(icon(ok ? "check" : "copy"));
        btn.title = ok ? "Copied" : "Copy failed";
        setTimeout(() => {
          btn.replaceChildren(icon("copy"));
          btn.title = "Copy";
        }, 1200);
      });
      return btn;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // navigator.clipboard needs a secure page; fall back to execCommand.
        const area = h("textarea", { class: "clip", value: text });
        root.append(area);
        area.select();
        let ok = false;
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
        area.remove();
        card.focus({ preventScroll: true });
        return ok;
      }
    }

    function meaningList(meanings) {
      const numbered = meanings.length > 1;
      return h("ol", { class: numbered ? "" : "single" },
        meanings.map((m, i) =>
          h("li", { class: "meaning" },
            numbered && h("span", { class: "num", text: String(i + 1) }),
            h("div", { class: "text", text: m.text }),
            m.tag && h("span", { class: "tag", text: m.tag }),
            copyButton(m.text),
            m.context && h("div", { class: "context", text: `“${m.context}”` })
          )
        )
      );
    }

    function buildView() {
      const entry = ctl.getEntry(s.entryId);
      if (!entry) return [header(s.term || "", null), h("div", { class: "body" }, h("p", { class: "hint", text: "This term was deleted." }))];
      s.term = entry.term;
      s.label = `${entry.term}: your definition`;
      s.signature = signature(entry);
      return [
        header(entry.term, "mine"),
        h("div", { class: "body" }, meaningList(ctl.sortMeanings(entry))),
        footer(
          act("Edit", startEdit, { title: "Edit (E)" }),
          act("+ Meaning", startMeaning, { title: "Add another meaning (N)" })
        ),
      ];
    }

    function buildPaper() {
      const { paper } = s;
      s.label = `${paper.abbr}: defined in this paper`;
      return [
        header(paper.abbr, "paper"),
        h("div", { class: "body" }, meaningList([{ text: paper.longForm, context: paper.context }])),
        footer(act("Save", startSaveFromPaper, { title: "Save to your glossary" })),
      ];
    }

    function field(label, control) {
      return h("label", null, label, control);
    }

    function definitionBox(value = "") {
      return h("textarea", {
        name: "text", rows: "3", placeholder: "Your definition", value,
        "aria-label": "Definition",
      });
    }

    function tagInput(value = "") {
      return h("input", {
        name: "tag", list: "jg-tags", placeholder: "e.g. ML", autocomplete: "off", value,
        "aria-label": "Tag",
      });
    }

    const keysHint = () =>
      h("p", { class: "hint", text: "Enter saves · Shift+Enter new line · Esc cancels" });

    function formFooter() {
      return footer(
        act("Save", submit, { primary: true, title: "Save (Enter)" }),
        act("Cancel", cancel, { title: "Cancel (Esc)" })
      );
    }

    function refreshTags() {
      tagList.replaceChildren(...ctl.getTags().map((t) => h("option", { value: t })));
    }

    function buildAdd() {
      refreshTags();
      s.label = "Add a term";
      const title = h("div", { class: "term" + (s.draftTerm ? "" : " placeholder"), text: s.draftTerm || "New term" });
      const termInput = h("input", {
        name: "term", value: s.draftTerm || "", autocomplete: "off", "aria-label": "Term",
      });
      termInput.addEventListener("input", () => {
        s.draftTerm = termInput.value;
        title.textContent = termInput.value.trim() || "New term";
        title.classList.toggle("placeholder", !termInput.value.trim());
      });
      return [
        h("header", null, title),
        h("div", { class: "body" },
          h("form", { onsubmit: (e) => e.preventDefault() },
            s.paperHint && h("p", { class: "hint paper" }, "This paper says: ", h("b", { text: s.paperHint })),
            field("Term", termInput),
            field("Definition", definitionBox()),
            field("Tag (optional)", tagInput()),
            keysHint(),
            h("p", { class: "error", hidden: true })
          )
        ),
        formFooter(),
      ];
    }

    function buildMeaning() {
      refreshTags();
      const entry = ctl.getEntry(s.entryId);
      s.label = `Add a meaning to ${entry ? entry.term : ""}`;
      return [
        header(entry ? entry.term : s.term, "mine"),
        h("div", { class: "body" },
          h("form", { onsubmit: (e) => e.preventDefault() },
            field("New meaning", definitionBox()),
            field("Tag (optional)", tagInput()),
            keysHint(),
            h("p", { class: "error", hidden: true })
          )
        ),
        formFooter(),
      ];
    }

    function buildEdit() {
      refreshTags();
      const d = s.draft;
      s.label = `Edit ${d.term}`;
      const termInput = h("input", { name: "term", value: d.term, autocomplete: "off", "aria-label": "Term" });
      termInput.addEventListener("input", () => (d.term = termInput.value));
      const rows = d.meanings.map((m, i) => {
        const text = definitionBox(m.text);
        text.addEventListener("input", () => (m.text = text.value));
        const tag = tagInput(m.tag);
        tag.addEventListener("input", () => (m.tag = tag.value));
        const remove = h("button", {
          class: "icon-btn", type: "button", title: "Remove this meaning",
          "aria-label": `Remove meaning ${i + 1}`,
        }, icon("remove"));
        remove.addEventListener("click", () => {
          d.meanings.splice(i, 1);
          render(false);
        });
        return h("div", { class: "edit-row" }, h("div", { class: "fields" }, text, tag), remove);
      });
      return [
        header(d.term || " ", "mine"),
        h("div", { class: "body" },
          h("form", { onsubmit: (e) => e.preventDefault() },
            field("Term", termInput),
            rows.length
              ? h("div", { class: "fields" }, rows)
              : h("p", { class: "hint", text: "No meanings left: saving deletes this term." }),
            keysHint(),
            h("p", { class: "error", hidden: true })
          )
        ),
        formFooter(),
      ];
    }

    function focusForMode() {
      const target =
        s.mode === "edit" ? card.querySelector("textarea") || card.querySelector("input")
        : isForm() ? card.querySelector("textarea")
        : card;
      if (!target) return;
      target.focus({ preventScroll: true });
      if (target.setSelectionRange && s.mode === "edit") {
        target.setSelectionRange(target.value.length, target.value.length);
      }
    }

    // ---- actions ----

    function startEdit() {
      const entry = ctl.getEntry(s.entryId);
      if (!entry) return;
      s.draft = {
        term: entry.term,
        meanings: ctl.sortMeanings(entry).map((m) => ({ id: m.id, text: m.text, tag: m.tag || "" })),
      };
      s.mode = "edit";
      render(true);
    }

    function startMeaning() {
      if (!ctl.getEntry(s.entryId)) return;
      s.mode = "meaning";
      render(true);
    }

    function startSaveFromPaper() {
      // The term is exactly what you double-clicked or highlighted; you write
      // the definition yourself. The paper's expansion is shown for reference.
      s.returnTo = "paper";
      s.draftTerm = s.triggerText;
      s.paperHint = s.paper.longForm;
      s.mode = "add";
      render(true);
    }

    function cancel() {
      if (!s) return;
      if (s.mode === "view" || s.mode === "paper") close();
      else if (s.mode === "add") {
        if (s.returnTo) {
          s.mode = s.returnTo;
          render(true);
        } else close();
      } else {
        s.mode = "view";
        render(true);
      }
    }

    function showError(message) {
      const el = card.querySelector(".error");
      if (!el) return;
      el.textContent = message;
      el.hidden = false;
    }

    let saving = false;
    async function submit() {
      if (!s || saving || !isForm()) return;
      const value = (name) => (card.querySelector(`[name="${name}"]`) || {}).value || "";
      const { mode } = s;
      try {
        let entry;
        if (mode === "add") {
          const term = value("term").trim();
          if (!term) return showError("Type the term first.");
          if (!value("text").trim()) return showError("Write a definition first.");
          saving = true;
          entry = await ctl.saveNew({ term, text: value("text"), tag: value("tag"), context: s.context });
        } else if (mode === "meaning") {
          if (!value("text").trim()) return showError("Write a definition first.");
          saving = true;
          entry = await ctl.addMeaning(s.entryId, { text: value("text"), tag: value("tag"), context: s.context });
        } else {
          if (!s.draft.term.trim()) return showError("The term can't be empty.");
          saving = true;
          entry = await ctl.saveEdit(s.entryId, s.draft);
          if (!entry) return close();
        }
        if (!s) return;
        s.mode = "view";
        s.entryId = entry.id;
        s.returnTo = null;
        render(true);
      } catch (err) {
        showError(err && err.message ? err.message : "Couldn't save. Reload the page and try again.");
      } finally {
        saving = false;
      }
    }

    function onCardKey(e) {
      if (e.isComposing || !s) return;
      const t = e.target;
      const inField = t && (t.localName === "input" || t.localName === "textarea");
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (isForm()) {
        if (e.key === "Enter" && inField && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          submit();
        }
        return;
      }
      if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
      if (s.mode === "view" && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        startEdit();
      } else if (s.mode === "view" && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        startMeaning();
      }
    }

    function signature(entry) {
      return entry.term + "\u0000" + JSON.stringify(entry.meanings);
    }

    // ---- the "+ Add" pill for unknown words ----

    function showPill(anchor, onClick) {
      close();
      mount();
      const r = rectOf(anchor);
      if (!r) return;
      pill = h("button", { class: "pill", type: "button", title: "Add to your glossary" }, "+ Add");
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        hidePill();
        onClick();
      });
      pill.addEventListener("mouseenter", () => {
        clearTimeout(pillTimer);
        pill && pill.classList.remove("fading");
      });
      pill.addEventListener("mouseleave", () => fadePill(800));
      root.append(pill);
      const vh = window.innerHeight;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const ph = pill.offsetHeight;
      const top = r.bottom + 4 + ph > vh - MARGIN ? r.top - 4 - ph : r.bottom + 4;
      pill.style.top = Math.max(MARGIN, top) + "px";
      pill.style.left = Math.max(MARGIN, Math.min(r.left, vw - pill.offsetWidth - MARGIN)) + "px";
      window.addEventListener("scroll", hidePill, { capture: true, once: true });
      fadePill(PILL_MS);
    }

    function fadePill(ms) {
      clearTimeout(pillTimer);
      pillTimer = setTimeout(() => {
        if (!pill) return;
        pill.classList.add("fading");
        pillTimer = setTimeout(hidePill, 320);
      }, ms);
    }

    function hidePill() {
      clearTimeout(pillTimer);
      if (pill) pill.remove();
      pill = null;
    }

    // ---- public API ----

    return {
      // A saved term: every meaning, newest first.
      showEntry(entry, anchor, context) {
        open({ mode: "view", entryId: entry.id, term: entry.term, anchor, context });
      },
      // An abbreviation this paper defines. triggerText is what you
      // double-clicked or highlighted; Save uses it as the term.
      showPaper(paper, anchor, { triggerText, context }) {
        open({ mode: "paper", paper, anchor, triggerText, context });
      },
      // The add form for a new term, with the term prefilled.
      showAdd({ term, context }, anchor) {
        open({ mode: "add", draftTerm: term, anchor, context });
      },
      showPill,
      // Storage changed (maybe in another tab): redraw if it affects the card.
      refresh(updates) {
        if (!s || s.mode !== "view") return;
        const hit = updates.find((u) => u.id === s.entryId);
        if (!hit) return;
        if (!hit.entry) return close();
        if (signature(hit.entry) !== s.signature) render(false);
      },
      close,
      isOpen: () => !!s,
    };
  }

  return { create };
})();
