// The glossary in chrome.storage.local. Each entry is stored under its own
// key ("entry:<id>") so saving one term never rewrites the whole glossary.
//
// Entry shape (see the PRD's data model):
//   { id, term, key, aliases: [], meanings: [Meaning], lastUsedAt }
//   Meaning: { id, text, tag, context, sourceUrl, updatedAt }
"use strict";

const JargonautStore = ((T) => {
  const PREFIX = "entry:";
  const EXPORT_VERSION = 1;

  const nowIso = () => new Date().toISOString();
  const newId = (prefix) =>
    `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const str = (v) => (typeof v === "string" ? v : "");
  const normText = (s) => T.cleanSpace(s).toLowerCase();

  // ---------------------------------------------------------------------
  // Pure helpers (no chrome.* calls; covered by the Node tests)
  // ---------------------------------------------------------------------

  function cleanTag(tag) {
    return T.cleanSpace(str(tag)).slice(0, 40);
  }

  function cleanAliases(aliases, term) {
    const seen = new Set([T.toKey(term)]);
    const out = [];
    for (const alias of aliases || []) {
      const clean = T.cleanSpace(str(alias));
      const key = T.toKey(clean);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
    return out;
  }

  function makeMeaning({ text, tag, context, sourceUrl }, when = nowIso()) {
    return {
      id: newId("m"),
      text: str(text).trim(),
      tag: cleanTag(tag),
      context: str(context),
      sourceUrl: str(sourceUrl),
      updatedAt: when,
    };
  }

  function makeEntry(term, meanings, aliases = []) {
    const clean = T.cleanSpace(term);
    return {
      id: newId("e"),
      term: clean,
      key: T.toKey(clean),
      aliases: cleanAliases(aliases, clean),
      meanings,
      lastUsedAt: nowIso(),
    };
  }

  // Every key an entry answers to: its term and its aliases.
  function keysOf(entry) {
    return [entry.key, ...(entry.aliases || []).map(T.toKey)].filter(Boolean);
  }

  // Meanings in display order: last added or edited first (F5).
  function sortedMeanings(entry) {
    return [...entry.meanings].sort((a, b) =>
      str(b.updatedAt).localeCompare(str(a.updatedAt))
    );
  }

  function sameMeaning(a, b) {
    return (
      a.id === b.id ||
      (normText(a.text) === normText(b.text) &&
        cleanTag(a.tag).toLowerCase() === cleanTag(b.tag).toLowerCase())
    );
  }

  // Combines two entries with the same key: meanings are unioned (the newer
  // copy of a meaning wins) and aliases are unioned.
  function mergeInto(target, incoming) {
    const meanings = target.meanings.map((m) => ({ ...m }));
    for (const m of incoming.meanings || []) {
      const i = meanings.findIndex((x) => sameMeaning(x, m));
      if (i === -1) meanings.push({ ...m });
      else if (str(m.updatedAt) > str(meanings[i].updatedAt)) {
        meanings[i] = { ...m, id: meanings[i].id };
      }
    }
    const lastUsed = [target.lastUsedAt, incoming.lastUsedAt].map(str).sort().pop();
    return {
      ...target,
      aliases: cleanAliases([...(target.aliases || []), ...(incoming.aliases || [])], target.term),
      meanings,
      lastUsedAt: lastUsed || nowIso(),
    };
  }

  // Validates one entry from an import file. Returns null if unusable.
  function normalizeEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const term = T.cleanSpace(str(raw.term));
    if (!T.toKey(term)) return null;
    const meanings = (Array.isArray(raw.meanings) ? raw.meanings : [])
      .filter((m) => m && typeof m === "object" && str(m.text).trim())
      .map((m) => ({
        id: str(m.id) || newId("m"),
        text: str(m.text).trim(),
        tag: cleanTag(m.tag),
        context: str(m.context),
        sourceUrl: str(m.sourceUrl),
        updatedAt: str(m.updatedAt) || nowIso(),
      }));
    if (!meanings.length) return null;
    return {
      id: str(raw.id) || newId("e"),
      term,
      key: T.toKey(term),
      aliases: cleanAliases(Array.isArray(raw.aliases) ? raw.aliases : [], term),
      meanings,
      lastUsedAt: typeof raw.lastUsedAt === "string" ? raw.lastUsedAt : nowIso(),
    };
  }

  // Plans an import: entries with the same key are merged and their meanings
  // combined; new keys are added. Returns the entries to write.
  function mergeImport(existing, incoming) {
    const byKey = new Map(existing.map((e) => [e.key, e]));
    const usedIds = new Set(existing.map((e) => e.id));
    const changed = new Map();
    let added = 0;
    let merged = 0;
    let skipped = 0;
    for (const raw of incoming) {
      const entry = normalizeEntry(raw);
      if (!entry) {
        skipped++;
        continue;
      }
      const current = byKey.get(entry.key);
      let result;
      if (current) {
        result = mergeInto(current, entry);
        merged++;
      } else {
        if (usedIds.has(entry.id)) entry.id = newId("e");
        result = entry;
        added++;
      }
      usedIds.add(result.id);
      byKey.set(entry.key, result);
      changed.set(entry.key, result);
    }
    return { entries: [...changed.values()], added, merged, skipped };
  }

  function parseExport(json) {
    if (!json || typeof json !== "object" || !Array.isArray(json.entries)) {
      throw new Error("This isn't a Jargonaut export file.");
    }
    if (json.version !== EXPORT_VERSION) {
      throw new Error(`Unsupported file version: ${json.version}.`);
    }
    return json.entries;
  }

  function allTags(entries) {
    const tags = new Map();
    for (const e of entries) {
      for (const m of e.meanings) {
        if (m.tag && !tags.has(m.tag.toLowerCase())) tags.set(m.tag.toLowerCase(), m.tag);
      }
    }
    return [...tags.values()].sort((a, b) => a.localeCompare(b));
  }

  // ---------------------------------------------------------------------
  // chrome.storage.local
  // ---------------------------------------------------------------------

  const area = () => chrome.storage.local;

  async function getAll() {
    const all = await area().get(null);
    return Object.keys(all)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => all[k]);
  }

  async function get(id) {
    const res = await area().get(PREFIX + id);
    return res[PREFIX + id] || null;
  }

  async function putMany(entries) {
    if (!entries.length) return;
    await area().set(Object.fromEntries(entries.map((e) => [PREFIX + e.id, e])));
  }

  async function put(entry) {
    await putMany([entry]);
    return entry;
  }

  async function remove(id) {
    await area().remove(PREFIX + id);
  }

  // Adds a definition for a term. If an entry already answers to that term
  // (by its key or an alias), the meaning joins it instead of duplicating it.
  async function addMeaning({ term, text, tag, context, sourceUrl }) {
    const key = T.toKey(term);
    if (!key) throw new Error("The term is empty.");
    if (!str(text).trim()) throw new Error("The definition is empty.");
    const all = await getAll();
    const existing =
      all.find((e) => e.key === key) || all.find((e) => keysOf(e).includes(key));
    if (!existing) {
      return put(makeEntry(term, [makeMeaning({ text, tag, context, sourceUrl })]));
    }
    return appendMeaning(existing, { text, tag, context, sourceUrl });
  }

  // "+ Meaning" on an existing card.
  async function addMeaningTo(entryId, meaning) {
    const entry = await get(entryId);
    if (!entry) throw new Error("This term was deleted.");
    if (!str(meaning.text).trim()) throw new Error("The definition is empty.");
    return appendMeaning(entry, meaning);
  }

  function appendMeaning(entry, { text, tag, context, sourceUrl }) {
    const fresh = makeMeaning({ text, tag, context, sourceUrl });
    const same = entry.meanings.find((m) => normText(m.text) === normText(fresh.text));
    if (same) {
      // Saving the same definition again just refreshes it.
      same.tag = fresh.tag || same.tag;
      same.context = fresh.context || same.context;
      same.sourceUrl = fresh.sourceUrl || same.sourceUrl;
      same.updatedAt = fresh.updatedAt;
    } else {
      entry.meanings.push(fresh);
    }
    entry.lastUsedAt = nowIso();
    return put(entry);
  }

  // Saves an edited entry. `meanings` is the full new list of
  // { id?, text, tag }; meanings left out are deleted, and an entry with no
  // meanings left is deleted (returns null). Renaming a term onto another
  // entry's key merges the two.
  async function updateEntry(id, { term, aliases, meanings }) {
    const entry = await get(id);
    if (!entry) throw new Error("This term was deleted.");
    const now = nowIso();
    const next = [];
    for (const m of meanings) {
      const text = str(m.text).trim();
      if (!text) continue;
      const old = entry.meanings.find((x) => x.id === m.id);
      if (!old) {
        next.push(makeMeaning({ ...m, text }, now));
        continue;
      }
      const tag = cleanTag(m.tag);
      const edited = old.text !== text || old.tag !== tag;
      next.push({ ...old, text, tag, updatedAt: edited ? now : old.updatedAt });
    }
    if (!next.length) {
      await remove(id);
      return null;
    }
    const newTerm = term == null ? entry.term : T.cleanSpace(term);
    if (!T.toKey(newTerm)) throw new Error("The term is empty.");
    const updated = {
      ...entry,
      term: newTerm,
      key: T.toKey(newTerm),
      aliases: cleanAliases(aliases == null ? entry.aliases : aliases, newTerm),
      meanings: next,
    };
    if (updated.key !== entry.key) {
      const other = (await getAll()).find((e) => e.id !== id && e.key === updated.key);
      if (other) {
        await remove(id);
        return put(mergeInto(other, updated));
      }
    }
    return put(updated);
  }

  async function touch(id) {
    const entry = await get(id);
    if (!entry) return;
    entry.lastUsedAt = nowIso();
    await put(entry);
  }

  async function exportData() {
    const entries = (await getAll()).sort((a, b) =>
      a.term.localeCompare(b.term, undefined, { sensitivity: "base" })
    );
    return { version: EXPORT_VERSION, exportedAt: nowIso(), entries };
  }

  async function importData(json) {
    const plan = mergeImport(await getAll(), parseExport(json));
    await putMany(plan.entries);
    return { added: plan.added, merged: plan.merged, skipped: plan.skipped };
  }

  // Calls back with [{ id, entry }] (entry is null when deleted) whenever
  // any page or tab changes the glossary.
  function onChanged(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      const updates = [];
      for (const [k, change] of Object.entries(changes)) {
        if (k.startsWith(PREFIX)) {
          updates.push({ id: k.slice(PREFIX.length), entry: change.newValue || null });
        }
      }
      if (updates.length) callback(updates);
    });
  }

  return {
    // pure
    makeEntry, makeMeaning, keysOf, sortedMeanings, mergeInto, mergeImport,
    normalizeEntry, parseExport, allTags,
    // storage
    getAll, get, put, putMany, remove, addMeaning, addMeaningTo, updateEntry,
    touch, exportData, importData, onChanged,
  };
})(typeof JargonautText !== "undefined" ? JargonautText : require("./text.js"));

if (typeof module !== "undefined") module.exports = JargonautStore;
