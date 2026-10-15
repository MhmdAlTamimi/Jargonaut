const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../extension/shared/text.js");
const M = require("../extension/shared/matcher.js");

const entries = [
  { id: "attn", term: "attention", aliases: [] },
  { id: "mha", term: "multi-head attention", aliases: [] },
  { id: "sa", term: "Self-Attention", aliases: ["SA"] },
  { id: "gnn", term: "GNN", aliases: [] },
  { id: "gnn-long", term: "graph neural network", aliases: [] },
  { id: "it", term: "IT", aliases: [] },
];
const index = M.buildIndex(entries);

// Clicks the word `word` (its `nth` occurrence) in `text`.
function clickOn(text, word, nth = 0) {
  const tokens = T.tokenize(text);
  const hits = tokens.map((t, i) => [t, i]).filter(([t]) => t.text === word);
  return M.matchAt(index, tokens, hits[nth][1]);
}

test("the longest saved phrase around the clicked word wins", () => {
  assert.equal(clickOn("we use multi-head attention here", "attention").entryId, "mha");
  assert.equal(clickOn("we use multi-head attention here", "multi").entryId, "mha");
  assert.equal(clickOn("plain attention only", "attention").entryId, "attn");
});

test("hyphens and spaces are equal", () => {
  assert.equal(clickOn("a self attention layer", "self").entryId, "sa");
  assert.equal(clickOn("a self-attention layer", "attention").entryId, "sa");
});

test("a plural s on the last word still matches", () => {
  assert.equal(clickOn("stacked graph neural networks work", "networks").entryId, "gnn-long");
  assert.equal(clickOn("two GNNs were trained", "GNNs").entryId, "gnn");
});

test("short all-caps terms match case-sensitively", () => {
  assert.equal(clickOn("the SA layer", "SA").entryId, "sa");
  assert.equal(clickOn("que sa vie", "sa"), null);
  assert.equal(clickOn("IT support", "IT").entryId, "it");
  assert.equal(clickOn("we did it twice", "it"), null);
});

test("longer terms ignore case", () => {
  assert.equal(clickOn("Multi-Head Attention is used", "Attention").entryId, "mha");
});

test("a click outside every saved phrase finds nothing", () => {
  assert.equal(clickOn("the encoder block", "encoder"), null);
});

test("matchExact needs the whole selection to be one saved form", () => {
  const exact = (s) => M.matchExact(index, T.tokenize(s));
  assert.equal(exact("Graph Neural Networks").entryId, "gnn-long");
  assert.equal(exact("SA").entryId, "sa");
  assert.equal(exact("multi head attention layer"), null);
});
