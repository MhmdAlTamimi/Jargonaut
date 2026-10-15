// Finds abbreviations a paper defines as "Long Form (ABBR)" (F6).
//
// A simplified version of Schwartz & Hearst (2003), "A simple algorithm for
// identifying abbreviation definitions in biomedical text": take the words
// just before "(ABBR)", then walk the abbreviation's letters right to left,
// finding each one in those words right to left. The first letter must also
// start a word. What's left is the shortest long form that explains every
// letter, e.g. "Graph Neural Network (GNN)".
"use strict";

const JargonautAbbr = ((T) => {
  const PAREN_RE = /\(([^()]{1,40})\)/g;
  const isAlnum = (c) => /[\p{L}\p{N}]/u.test(c);

  // The text inside "( )" if it looks like an abbreviation: one word of 2 to
  // 10 characters with a capital letter. That skips "(2020)", "(i)",
  // "(e.g. ...)", "(see Fig. 2)" and capitalized words like "(Adam)".
  function candidate(inner) {
    const abbr = inner.split(/[,;]/)[0].trim();
    if (abbr.length < 2 || abbr.length > 10 || /\s/.test(abbr)) return null;
    if (!isAlnum(abbr[0]) || !/\p{Lu}/u.test(abbr)) return null;
    if (/^\p{Lu}\p{Ll}{2,}$/u.test(abbr)) return null;
    return abbr;
  }

  // "CNNs" is filed under "CNN".
  function baseForm(abbr) {
    const m = /^(.*\p{Lu})s$/u.exec(abbr);
    return m && m[1].length >= 2 ? m[1] : abbr;
  }

  // The Schwartz–Hearst walk. Returns the long form, or null.
  function bestLongForm(abbr, text) {
    let s = abbr.length - 1;
    let l = text.length - 1;
    while (s >= 0) {
      const c = abbr[s].toLowerCase();
      if (!isAlnum(c)) {
        s--;
        continue;
      }
      while (
        l >= 0 &&
        (text[l].toLowerCase() !== c || (s === 0 && l > 0 && isAlnum(text[l - 1])))
      ) {
        l--;
      }
      if (l < 0) return null;
      l--;
      s--;
    }
    return text.slice(text.lastIndexOf(" ", l) + 1);
  }

  // Looks back from "(" for the long form of `abbr`.
  function longFormBefore(text, parenAt, abbr) {
    // Only within the current clause: stop at sentence punctuation and
    // other brackets.
    let start = parenAt;
    const limit = Math.max(0, parenAt - 250);
    while (start > limit && !/[.!?;:()[\]]/.test(text[start - 1])) start--;
    const words = text.slice(start, parenAt).trim().split(/\s+/).filter(Boolean);
    // At most min(|A| + 5, |A| * 2) words, as in Schwartz–Hearst.
    const maxWords = Math.min(abbr.length + 5, abbr.length * 2);
    const found = bestLongForm(abbr, words.slice(-maxWords).join(" "));
    if (!found) return null;
    const longForm = found.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (longForm.length <= abbr.length) return null;
    // The abbreviation's first letter starts the long form...
    if (longForm[0].toLowerCase() !== abbr[0].toLowerCase()) return null;
    // ...and the long form doesn't just repeat the abbreviation.
    if (T.toKey(longForm).split(" ").includes(abbr.toLowerCase())) return null;
    return longForm;
  }

  // Scans text and returns Map(abbreviation -> { abbr, longForm, context }).
  // The first definition of each abbreviation wins; pass the map from a
  // previous scan to add to it.
  function scan(rawText, found = new Map()) {
    const text = T.cleanSpace(rawText);
    for (const m of text.matchAll(PAREN_RE)) {
      const abbr = candidate(m[1]);
      if (!abbr) continue;
      const key = baseForm(abbr);
      if (found.has(key)) continue;
      const longForm = longFormBefore(text, m.index, abbr);
      if (!longForm) continue;
      found.set(key, {
        abbr: key,
        longForm,
        context: T.sentenceAround(text, m.index - longForm.length, m.index + m[0].length),
      });
    }
    return found;
  }

  // The definition for a word on the page ("GNN" or plural "GNNs").
  function lookup(found, word) {
    if (!word) return null;
    return found.get(word) || (word.endsWith("s") ? found.get(word.slice(0, -1)) : null) || null;
  }

  return { scan, lookup, bestLongForm };
})(typeof JargonautText !== "undefined" ? JargonautText : require("./text.js"));

if (typeof module !== "undefined") module.exports = JargonautAbbr;
