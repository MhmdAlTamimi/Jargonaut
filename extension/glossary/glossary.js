// The glossary page (F7): search, inline edit, delete with Undo, filter by
// tag, export and import a JSON file.
"use strict";

(() => {
  const T = JargonautText;
  const S = JargonautStore;
  const PAGE_SIZE = 300; // rows drawn before "Show all"
  const UNDO_MS = 5000;

  const $ = (id) => document.getElementById(id);
  const els = {
    count: $("count"), search: $("search"), tags: $("tags"), list: $("list"),
    empty: $("empty"), exportBtn: $("export"), importBtn: $("import"), file: $("file"),
    toast: $("toast"),
  };

  const state = {
    entries: new Map(),
    query: "",
    tag: null, // lowercase tag being filtered on
    editingId: null,
    draft: null,
    limit: PAGE_SIZE,
  };

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

  const byTerm = (a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" });
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // ---- filtering ----

  function haystack(entry) {
    return [entry.term, ...(entry.aliases || []), ...entry.meanings.map((m) => `${m.text} ${m.tag}`)]
      .join("\n")
      .toLowerCase()
      .replace(/-/g, " ");
  }

  function visibleEntries() {
    const words = state.query.toLowerCase().replace(/-/g, " ").split(/\s+/).filter(Boolean);
    return [...state.entries.values()]
      .filter((e) => {
        if (state.tag && !e.meanings.some((m) => (m.tag || "").toLowerCase() === state.tag)) return false;
        if (!words.length) return true;
        const text = haystack(e);
        return words.every((w) => text.includes(w));
      })
      .sort(byTerm);
  }

  // ---- drawing ----

  function render() {
    const all = [...state.entries.values()];
    els.count.textContent = all.length ? plural(all.length, "term") : "";
    renderTags(all);

    const rows = visibleEntries();
    const items = rows.slice(0, state.limit).map((e) =>
      h("li", { "data-id": e.id }, e.id === state.editingId ? editor(e) : row(e))
    );
    if (rows.length > state.limit) {
      items.push(h("li", null, h("button", {
        class: "more", type: "button", text: `Show all ${rows.length} terms`,
        onclick: () => { state.limit = Infinity; render(); },
      })));
    }
    els.list.replaceChildren(...items);

    if (!all.length) {
      showEmpty(
        h("strong", { text: "No terms yet." }),
        h("br"),
        "Double-click a word on any page and press ", h("strong", { text: "+ Add" }),
        ", or select text and press ", h("strong", { text: "Alt+Shift+G" }), "."
      );
    } else if (!rows.length) {
      showEmpty("Nothing matches your search.");
    } else {
      els.empty.hidden = true;
    }

    if (state.editingId) {
      const first = els.list.querySelector(".editor textarea, .editor input");
      if (first && !els.list.contains(document.activeElement)) first.focus();
    }
  }

  function showEmpty(...content) {
    els.empty.replaceChildren(...content);
    els.empty.hidden = false;
  }

  function renderTags(all) {
    const tags = S.allTags(all);
    if (state.tag && !tags.some((t) => t.toLowerCase() === state.tag)) state.tag = null;
    if (!tags.length) return els.tags.replaceChildren();
    const chip = (label, value) =>
      h("button", {
        class: "chip", type: "button", text: label,
        "aria-pressed": String(state.tag === value),
        onclick: () => {
          state.tag = state.tag === value ? null : value;
          state.limit = PAGE_SIZE;
          render();
        },
      });
    els.tags.replaceChildren(chip("All", null), ...tags.map((t) => chip(t, t.toLowerCase())));
  }

  function row(entry) {
    const meanings = S.sortedMeanings(entry);
    const tags = [...new Set(meanings.map((m) => m.tag).filter(Boolean))];
    return h("button", {
      class: "row", type: "button", title: "Click to edit",
      onclick: () => startEdit(entry.id),
    },
      h("span", { class: "term" },
        entry.term,
        entry.aliases && entry.aliases.length ? h("span", { class: "aliases", text: `  · also ${entry.aliases.join(", ")}` }) : null
      ),
      h("span", { class: "count", text: plural(meanings.length, "meaning") }),
      h("span", { class: "preview", text: meanings[0] ? meanings[0].text : "" }),
      h("span", { class: "tags" }, tags.slice(0, 3).map((t) => h("span", { class: "tag", text: t })))
    );
  }

  function editor(entry) {
    const d = state.draft;
    const termInput = h("input", { value: d.term, "aria-label": "Term", autocomplete: "off" });
    termInput.addEventListener("input", () => (d.term = termInput.value));
    const aliasInput = h("input", {
      value: d.aliases, placeholder: "e.g. SA, self attention", autocomplete: "off",
      "aria-label": "Also called",
    });
    aliasInput.addEventListener("input", () => (d.aliases = aliasInput.value));

    const meaningRows = d.meanings.map((m, i) => {
      const text = h("textarea", { rows: "2", value: m.text, "aria-label": `Meaning ${i + 1}` });
      text.addEventListener("input", () => (m.text = text.value));
      const tag = h("input", {
        class: "tag-input", value: m.tag, placeholder: "Tag", list: "tag-list",
        autocomplete: "off", "aria-label": `Tag for meaning ${i + 1}`,
      });
      tag.addEventListener("input", () => (m.tag = tag.value));
      const remove = h("button", {
        class: "icon-btn", type: "button", text: "×", title: "Remove this meaning",
        "aria-label": `Remove meaning ${i + 1}`,
        onclick: () => { d.meanings.splice(i, 1); render(); },
      });
      return h("div", { class: "meaning-edit" }, text, tag, remove, meta(m));
    });

    const error = h("p", { class: "error", hidden: true });
    const box = h("div", { class: "editor" },
      h("div", { class: "two" },
        h("label", null, "Term", termInput),
        h("label", null, "Also called (comma-separated)", aliasInput)
      ),
      h("datalist", { id: "tag-list" }, S.allTags([...state.entries.values()]).map((t) => h("option", { value: t }))),
      h("div", { class: "meanings-edit" },
        meaningRows.length ? meaningRows : h("p", { class: "hint", text: "No meanings left: saving deletes this term." })
      ),
      h("div", null, h("button", {
        class: "btn link", type: "button", text: "+ Meaning",
        onclick: () => { d.meanings.push({ text: "", tag: "" }); render(); focusLastMeaning(); },
      })),
      error,
      h("div", { class: "editor-actions" },
        h("button", { class: "btn primary", type: "button", text: "Save", onclick: () => save(entry.id, error) }),
        h("button", { class: "btn", type: "button", text: "Cancel", onclick: cancelEdit }),
        h("span", { class: "hint", text: "Enter saves · Shift+Enter new line · Esc cancels" }),
        h("span", { class: "spacer" }),
        h("button", { class: "btn danger", type: "button", text: "Delete term", onclick: () => remove(entry.id) })
      )
    );
    box.addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      const inField = e.target.localName === "input" || e.target.localName === "textarea";
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === "Enter" && inField && !e.shiftKey) {
        e.preventDefault();
        save(entry.id, error);
      }
    });
    return box;
  }

  // Where a meaning came from: the saved sentence and the page.
  function meta(m) {
    if (!m.context && !m.sourceUrl) return null;
    let link = null;
    if (/^(https?|file):/i.test(m.sourceUrl || "")) {
      let label = m.sourceUrl;
      try {
        const u = new URL(m.sourceUrl);
        label = u.protocol === "file:" ? decodeURIComponent(u.pathname.split("/").pop()) : u.hostname;
      } catch {}
      link = h("a", { href: m.sourceUrl, target: "_blank", rel: "noopener", text: label });
    }
    return h("p", { class: "meta" },
      m.context ? `“${m.context}”` : "",
      m.context && link ? " — " : "",
      link
    );
  }

  function focusLastMeaning() {
    const boxes = els.list.querySelectorAll(".editor textarea");
    if (boxes.length) boxes[boxes.length - 1].focus();
  }

  // ---- editing ----

  function startEdit(id) {
    const entry = state.entries.get(id);
    if (!entry) return;
    state.editingId = id;
    state.draft = {
      term: entry.term,
      aliases: (entry.aliases || []).join(", "),
      meanings: S.sortedMeanings(entry).map((m) => ({ ...m })),
    };
    render();
    const li = els.list.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    if (li) li.scrollIntoView({ block: "nearest" });
  }

  function cancelEdit() {
    const id = state.editingId;
    state.editingId = null;
    state.draft = null;
    render();
    focusRow(id);
  }

  function focusRow(id) {
    const btn = id && els.list.querySelector(`li[data-id="${CSS.escape(id)}"] .row`);
    if (btn) btn.focus();
  }

  async function save(id, errorEl) {
    const d = state.draft;
    if (!T.toKey(d.term)) {
      errorEl.textContent = "The term can't be empty.";
      errorEl.hidden = false;
      return;
    }
    const before = state.entries.get(id);
    try {
      const saved = await S.updateEntry(id, {
        term: d.term,
        aliases: d.aliases.split(",").map((a) => a.trim()).filter(Boolean),
        meanings: d.meanings,
      });
      state.editingId = null;
      state.draft = null;
      if (!saved) {
        state.entries.delete(id);
        render();
        offerUndo(`Deleted “${before.term}”.`, before);
        return;
      }
      if (saved.id !== id) state.entries.delete(id);
      state.entries.set(saved.id, saved);
      render();
      focusRow(saved.id);
      if (saved.id !== id) toast(`Merged into the existing “${saved.term}”.`);
    } catch (err) {
      errorEl.textContent = err.message || "Couldn't save.";
      errorEl.hidden = false;
    }
  }

  async function remove(id) {
    const entry = state.entries.get(id);
    if (!entry) return;
    await S.remove(id);
    state.entries.delete(id);
    state.editingId = null;
    state.draft = null;
    render();
    offerUndo(`Deleted “${entry.term}”.`, entry);
  }

  function offerUndo(message, entry) {
    toast(message, {
      action: "Undo",
      ms: UNDO_MS,
      onAction: async () => {
        await S.put(entry);
        state.entries.set(entry.id, entry);
        render();
        focusRow(entry.id);
      },
    });
  }

  // ---- toast ----

  let toastTimer = 0;
  function toast(message, { action, onAction, ms = 4000 } = {}) {
    clearTimeout(toastTimer);
    const parts = [h("span", { text: message })];
    if (action) {
      parts.push(h("button", {
        type: "button", text: action,
        onclick: () => { hideToast(); onAction(); },
      }));
    }
    els.toast.replaceChildren(...parts);
    els.toast.hidden = false;
    toastTimer = setTimeout(hideToast, ms);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    els.toast.hidden = true;
  }

  // ---- export / import ----

  async function exportFile() {
    const data = await S.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = h("a", { href: url, download: `jargonaut-glossary-${date}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${plural(data.entries.length, "term")}.`);
  }

  async function importFile(file) {
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      toast("That file isn't valid JSON.");
      return;
    }
    try {
      const r = await S.importData(json);
      await load();
      const parts = [`${r.added} new`, `${r.merged} merged`];
      if (r.skipped) parts.push(`${r.skipped} skipped`);
      toast(`Imported: ${parts.join(", ")}.`);
    } catch (err) {
      toast(err.message || "Import failed.");
    }
  }

  // ---- wiring ----

  async function load() {
    const list = await S.getAll();
    state.entries = new Map(list.map((e) => [e.id, e]));
    render();
  }

  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    state.limit = PAGE_SIZE;
    if (state.editingId) {
      state.editingId = null;
      state.draft = null;
    }
    render();
  });

  els.exportBtn.addEventListener("click", exportFile);
  els.importBtn.addEventListener("click", () => els.file.click());
  els.file.addEventListener("change", () => {
    const file = els.file.files && els.file.files[0];
    els.file.value = "";
    if (file) importFile(file);
  });

  document.addEventListener("keydown", (e) => {
    const typing = /^(input|textarea)$/.test(document.activeElement && document.activeElement.localName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      els.search.focus();
    }
  });

  // Changes made in other tabs (or by the card) show up live.
  S.onChanged((updates) => {
    for (const { id, entry } of updates) {
      if (entry) state.entries.set(id, entry);
      else state.entries.delete(id);
    }
    // Don't redraw under an open editor; saving or cancelling redraws.
    if (!state.editingId) render();
  });

  load();
})();
