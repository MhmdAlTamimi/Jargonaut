// Text helpers shared by the content script, the PDF viewer, the glossary
// page and the Node tests. Plain script (no modules) so Chrome can load it as
// a content script; the last line exports it for Node.
"use strict";

const JargonautText = (() => {
  // One "word": letters, digits and combining marks. Apostrophes inside a word
  // ("don't") and a hyphen at a line end followed by a lowercase letter
  // ("transfor-\nmer", a word split by hyphenation) stay inside it.
  // Everything else, including ordinary hyphens, separates words, which is
  // what makes "self-attention" and "self attention" equal. A line-end
  // hyphen before a capital ("Retrieval-\nAugmented") is a real hyphen.
  const WORD_RE =
    /[\p{L}\p{N}\p{M}­]+(?:(?:['’]|-[^\S\n]*\n\s*(?=\p{Ll}))[\p{L}\p{N}\p{M}­]+)*/gu;

  // Words that end in a period but rarely end a sentence.
  const NOT_SENTENCE_END = new Set([
    "e.g", "i.e", "al", "fig", "figs", "eq", "eqs", "sec", "ref", "refs",
    "vs", "cf", "no", "dr", "mr", "ms", "approx", "resp", "tab", "ch",
  ]);

  // The page's spelling of a word, made comparable: NFKC turns PDF ligatures
  // like "ﬁ" into "fi", soft hyphens and line-end hyphens are dropped, and a
  // possessive "'s" is removed.
  function cleanWord(raw) {
    return raw
      .normalize("NFKC")
      .replace(/­/g, "")
      .replace(/-[^\S\n]*\n\s*/g, "")
      .replace(/’/g, "'")
      .replace(/'s$/i, "");
  }

  // Splits text into words, keeping where each one sits in the original
  // string so a match can be mapped back to the page.
  //   exact: cleaned, original case (for short all-caps terms)
  //   norm:  cleaned and lowercased (for everything else)
  function tokenize(text) {
    const tokens = [];
    for (const m of text.matchAll(WORD_RE)) {
      const exact = cleanWord(m[0]);
      if (!exact) continue;
      tokens.push({
        text: m[0],
        start: m.index,
        end: m.index + m[0].length,
        exact,
        norm: exact.toLowerCase(),
      });
    }
    return tokens;
  }

  // The stored matching key: lowercase, hyphens and punctuation as spaces,
  // whitespace collapsed. "Self-Attention" -> "self attention".
  function toKey(term) {
    return tokenize(term || "").map((t) => t.norm).join(" ");
  }

  // Terms of 3 characters or fewer saved in all caps ("IT", "SA") match only
  // with the same case, so "it" and "sa" in running text don't trigger them.
  function isShortCaps(term) {
    const letters = tokenize(term || "").map((t) => t.exact).join("");
    return (
      letters.length > 0 &&
      letters.length <= 3 &&
      letters === letters.toUpperCase() &&
      letters !== letters.toLowerCase()
    );
  }

  // Collapses whitespace and rejoins words split by a hyphen at a line end
  // ("transfor-\nmer" -> "transformer", "Retrieval-\nAugmented" ->
  // "Retrieval-Augmented").
  function cleanSpace(text) {
    return (text || "")
      .replace(/­/g, "")
      .replace(/(\p{L})-[^\S\n]*\n\s*(\p{L})/gu, (_, a, b) =>
        /\p{Ll}/u.test(b) ? a + b : `${a}-${b}`
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSentenceEnd(text, i) {
    const ch = text[i];
    if (ch === "\n" && text[i + 1] === "\n") return true;
    if (ch !== "." && ch !== "!" && ch !== "?") return false;
    if (i + 1 < text.length && !/\s/.test(text[i + 1])) return false;
    if (ch !== ".") return true;
    const word = /([\p{L}.]+)$/u.exec(text.slice(Math.max(0, i - 12), i));
    if (!word) return true;
    const w = word[1].toLowerCase();
    // Single letters are initials ("J. Smith") or list markers.
    return w.length > 1 && !NOT_SENTENCE_END.has(w);
  }

  // The sentence containing text[start..end], cleaned up, at most ~maxLen
  // characters. Saved as the meaning's context.
  function sentenceAround(text, start, end = start, maxLen = 320) {
    let from = start;
    while (from > 0 && start - from < maxLen && !isSentenceEnd(text, from - 1)) from--;
    let to = end;
    while (to < text.length && to - end < maxLen && !isSentenceEnd(text, to)) to++;
    if (to < text.length && text[to] !== "\n") to++; // keep the final period
    let sentence = cleanSpace(text.slice(from, to));
    if (sentence.length > maxLen) {
      // Trim around the term instead of returning a wall of text.
      const mid = cleanSpace(text.slice(from, start)).length;
      const half = Math.floor(maxLen / 2);
      const s = Math.max(0, mid - half);
      sentence =
        (s > 0 ? "…" : "") +
        sentence.slice(s, s + maxLen).trim() +
        (s + maxLen < sentence.length ? "…" : "");
    }
    return sentence;
  }

  return { tokenize, toKey, isShortCaps, cleanWord, cleanSpace, sentenceAround };
})();

if (typeof module !== "undefined") module.exports = JargonautText;
