const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../extension/shared/text.js");

test("toKey: lowercase, hyphens as spaces, whitespace collapsed, trailing punctuation removed", () => {
  assert.equal(T.toKey("Self-Attention"), "self attention");
  assert.equal(T.toKey("  Graph   Neural Network. "), "graph neural network");
  assert.equal(T.toKey("multi-head attention,"), "multi head attention");
  assert.equal(T.toKey("(RAG)"), "rag");
  assert.equal(T.toKey("Retrieval-Augmented Generation (RAG)"), "retrieval augmented generation rag");
});

test("toKey: PDF ligatures and soft hyphens normalize away", () => {
  assert.equal(T.toKey("ﬁne-tuning"), "fine tuning");
  assert.equal(T.toKey("trans­former"), "transformer");
});

test("tokenize keeps offsets into the original text", () => {
  const text = "We use a GNN's layers.";
  const tokens = T.tokenize(text);
  const gnn = tokens.find((t) => t.norm === "gnn");
  assert.equal(text.slice(gnn.start, gnn.end), "GNN's");
  assert.equal(gnn.exact, "GNN");
});

test("tokenize joins words split by a hyphen at a line end", () => {
  const tokens = T.tokenize("the transfor-\nmer model");
  assert.deepEqual(tokens.map((t) => t.norm), ["the", "transformer", "model"]);
});

test("a line-end hyphen before a capital is a real hyphen", () => {
  const tokens = T.tokenize("Retrieval-\nAugmented Generation");
  assert.deepEqual(tokens.map((t) => t.norm), ["retrieval", "augmented", "generation"]);
  assert.equal(T.cleanSpace("Retrieval-\nAugmented Generation"), "Retrieval-Augmented Generation");
});

test("isShortCaps: 3 characters or fewer, saved in all caps", () => {
  assert.equal(T.isShortCaps("SA"), true);
  assert.equal(T.isShortCaps("IT"), true);
  assert.equal(T.isShortCaps("(RAG)"), true);
  assert.equal(T.isShortCaps("LSTM"), false);
  assert.equal(T.isShortCaps("Sa"), false);
  assert.equal(T.isShortCaps("gnn"), false);
});

test("sentenceAround returns the sentence holding the term", () => {
  const text =
    "Intro sentence here. We replace recurrence with self-attention layers, e.g. in the encoder. Next one.";
  const at = text.indexOf("self-attention");
  assert.equal(
    T.sentenceAround(text, at, at + 14),
    "We replace recurrence with self-attention layers, e.g. in the encoder."
  );
});

test("cleanSpace collapses whitespace and rejoins line-end hyphens", () => {
  assert.equal(T.cleanSpace("  a   transfor-\n mer \n model "), "a transformer model");
});
