// Finds the longest saved phrase around a clicked word (F2).
"use strict";

const JargonautMatcher = ((T) => {
  // Index: first word of each saved form (term or alias) -> the forms that
  // start with it, longest first. A form is the list of its words.
  function buildIndex(entries) {
    const byFirst = new Map();
    let maxLength = 1;
    for (const entry of entries) {
      const seen = new Set();
      for (const form of [entry.term, ...(entry.aliases || [])]) {
        const tokens = T.tokenize(form || "");
        if (!tokens.length) continue;
        const caseSensitive = T.isShortCaps(form);
        const words = tokens.map((t) => (caseSensitive ? t.exact : t.norm));
        const signature = (caseSensitive ? "C " : "I ") + words.join(" ");
        if (seen.has(signature)) continue;
        seen.add(signature);
        const first = tokens[0].norm;
        if (!byFirst.has(first)) byFirst.set(first, []);
        byFirst.get(first).push({ entryId: entry.id, words, caseSensitive });
        maxLength = Math.max(maxLength, words.length);
      }
    }
    for (const list of byFirst.values()) {
      list.sort((a, b) => b.words.length - a.words.length);
    }
    return { byFirst, maxLength };
  }

  // Does page token `token` match word j of `form`? The last word may carry a
  // plural "s": "networks" matches "network", "GNNs" matches "GNN".
  function wordMatches(form, j, token) {
    const want = form.words[j];
    const have = form.caseSensitive ? token.exact : token.norm;
    if (have === want) return true;
    return j === form.words.length - 1 && have === want + "s";
  }

  function formMatches(form, tokens, start) {
    if (start + form.words.length > tokens.length) return false;
    for (let j = 0; j < form.words.length; j++) {
      if (!wordMatches(form, j, tokens[start + j])) return false;
    }
    return true;
  }

  // Forms that could start at this token. "gnns" also looks up "gnn" so a
  // plural single word still finds its entry.
  function candidates(index, token) {
    const list = index.byFirst.get(token.norm) || [];
    if (!token.norm.endsWith("s")) return list;
    return list.concat(index.byFirst.get(token.norm.slice(0, -1)) || []);
  }

  // Tries every start position that covers the clicked token and returns the
  // longest saved phrase found, or null.
  //   tokens:  words around the click (from JargonautText.tokenize)
  //   clicked: index of the clicked word in tokens
  function matchAt(index, tokens, clicked) {
    let best = null;
    const from = Math.max(0, clicked - index.maxLength + 1);
    for (let start = from; start <= clicked; start++) {
      for (const form of candidates(index, tokens[start])) {
        const end = start + form.words.length - 1;
        if (end < clicked) continue;
        if (best && form.words.length <= best.end - best.start + 1) continue;
        if (formMatches(form, tokens, start)) {
          best = { entryId: form.entryId, start, end };
        }
      }
    }
    return best;
  }

  // The whole selection must be one saved form (used by the shortcut).
  function matchExact(index, tokens) {
    if (!tokens.length) return null;
    for (const form of candidates(index, tokens[0])) {
      if (form.words.length === tokens.length && formMatches(form, tokens, 0)) {
        return { entryId: form.entryId, start: 0, end: tokens.length - 1 };
      }
    }
    return null;
  }

  return { buildIndex, matchAt, matchExact };
})(typeof JargonautText !== "undefined" ? JargonautText : require("./text.js"));

if (typeof module !== "undefined") module.exports = JargonautMatcher;
