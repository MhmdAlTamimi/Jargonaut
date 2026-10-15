const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../extension/shared/abbreviations.js");

const longForms = (text) =>
  Object.fromEntries([...A.scan(text).values()].map((d) => [d.abbr, d.longForm]));

test("finds Long Form (ABBR) definitions", () => {
  const text =
    "We study the Graph Neural Network (GNN) family and Retrieval-Augmented Generation (RAG) " +
    "for question answering. Long Short-Term Memory (LSTM) networks and Convolutional Neural " +
    "Networks (CNNs) are baselines. A self-attention (SA) block follows.";
  assert.deepEqual(longForms(text), {
    GNN: "Graph Neural Network",
    RAG: "Retrieval-Augmented Generation",
    LSTM: "Long Short-Term Memory",
    CNN: "Convolutional Neural Networks",
    SA: "self-attention",
  });
});

test("keeps only the shortest long form that explains every letter", () => {
  assert.deepEqual(longForms("In this paper we propose a new Bidirectional Encoder Representations from Transformers (BERT) model."), {
    BERT: "Bidirectional Encoder Representations from Transformers",
  });
  assert.deepEqual(longForms("Results use the mean squared error (MSE) loss."), {
    MSE: "mean squared error",
  });
});

test("ignores parentheses that aren't abbreviations", () => {
  const text =
    "Results (2020) are shown (see Fig. 2) for (i) small and (ii) large models (e.g. GPT). " +
    "We train with an optimizer (Adam) and a scheduler (cosine).";
  assert.deepEqual(longForms(text), {});
});

test("rejects when the letters can't be found in order", () => {
  assert.deepEqual(longForms("The baseline model (XYZ) is weak."), {});
});

test("the first definition per abbreviation wins", () => {
  const text = "Graph Neural Network (GNN) here. Later, Generalized Nearest Neighbour (GNN) there.";
  assert.equal(A.scan(text).get("GNN").longForm, "Graph Neural Network");
});

test("context is the defining sentence", () => {
  const found = A.scan("Intro text. We use Retrieval-Augmented Generation (RAG) for QA. More text.");
  assert.equal(found.get("RAG").context, "We use Retrieval-Augmented Generation (RAG) for QA.");
});

test("works across PDF line breaks", () => {
  const found = A.scan("we use a Graph\nNeural Net-\nwork (GNN) and Retrieval-\nAugmented Generation (RAG)");
  assert.equal(found.get("GNN").longForm, "Graph Neural Network");
  assert.equal(found.get("RAG").longForm, "Retrieval-Augmented Generation");
});

test("lookup accepts a plural", () => {
  const found = A.scan("Graph Neural Network (GNN) models.");
  assert.equal(A.lookup(found, "GNNs").longForm, "Graph Neural Network");
  assert.equal(A.lookup(found, "gnn"), null);
});
