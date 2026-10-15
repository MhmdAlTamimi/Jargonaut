const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../extension/shared/store.js");

const meaning = (text, tag = "", updatedAt = "2026-10-01T00:00:00Z", id = undefined) => ({
  id: id || `m_${text.slice(0, 6)}`, text, tag, context: "", sourceUrl: "", updatedAt,
});

test("sortedMeanings: last added or edited first", () => {
  const entry = {
    meanings: [
      meaning("old", "", "2026-01-01T00:00:00Z"),
      meaning("newest", "", "2026-10-15T00:00:00Z"),
      meaning("middle", "", "2026-05-01T00:00:00Z"),
    ],
  };
  assert.deepEqual(S.sortedMeanings(entry).map((m) => m.text), ["newest", "middle", "old"]);
});

test("mergeImport merges entries with the same key and combines meanings", () => {
  const existing = [
    { id: "e1", term: "Self-Attention", key: "self attention", aliases: [], meanings: [meaning("Each token attends to every other token.", "ML")], lastUsedAt: "2026-10-01T00:00:00Z" },
  ];
  const incoming = [
    // same key, different spelling; one duplicate meaning and one new one
    { id: "x1", term: "self attention", aliases: ["SA"], meanings: [
      meaning("Each token attends to every other token.", "ML", "2026-09-01T00:00:00Z", "other-id"),
      meaning("Intra-attention.", "ML"),
    ] },
    { id: "x2", term: "GNN", meanings: [meaning("Graph neural network.")] },
    { term: "", meanings: [meaning("no term")] },
    { term: "No meanings", meanings: [] },
  ];
  const plan = S.mergeImport(existing, incoming);
  assert.equal(plan.added, 1);
  assert.equal(plan.merged, 1);
  assert.equal(plan.skipped, 2);
  const sa = plan.entries.find((e) => e.key === "self attention");
  assert.equal(sa.id, "e1", "keeps the existing entry");
  assert.equal(sa.term, "Self-Attention", "keeps the existing spelling");
  assert.deepEqual(sa.aliases, ["SA"]);
  assert.equal(sa.meanings.length, 2, "duplicate meaning not repeated");
});

test("an export re-imports into an empty glossary with nothing lost", () => {
  const exported = {
    version: 1,
    exportedAt: "2026-10-15T10:00:00Z",
    entries: [
      { id: "e_01", term: "Self-Attention", key: "self attention", aliases: ["SA"],
        meanings: [{ id: "m_01", text: "Each token attends to every other token in the same sequence.", tag: "ML",
          context: "We replace recurrence with self-attention layers...", sourceUrl: "https://arxiv.org/html/x", updatedAt: "2026-10-15T10:00:00Z" }],
        lastUsedAt: "2026-10-15T10:00:00Z" },
    ],
  };
  const plan = S.mergeImport([], S.parseExport(exported));
  assert.deepEqual(plan.entries, exported.entries);
});

test("parseExport rejects other files", () => {
  assert.throws(() => S.parseExport({ hello: 1 }), /isn't a Jargonaut export/);
  assert.throws(() => S.parseExport({ version: 2, entries: [] }), /Unsupported file version/);
});

test("newer copy of the same meaning wins when merging", () => {
  const a = { id: "e", term: "GNN", key: "gnn", aliases: [], meanings: [meaning("Graph net", "ML", "2026-01-01T00:00:00Z", "m1")], lastUsedAt: "" };
  const b = { id: "e", term: "GNN", key: "gnn", aliases: [], meanings: [meaning("Graph neural network", "ML", "2026-10-01T00:00:00Z", "m1")], lastUsedAt: "" };
  const merged = S.mergeInto(a, b);
  assert.equal(merged.meanings.length, 1);
  assert.equal(merged.meanings[0].text, "Graph neural network");
});

test("allTags lists each tag once, sorted", () => {
  const entries = [
    { meanings: [meaning("a", "ML"), meaning("b", "Optim")] },
    { meanings: [meaning("c", "ml"), meaning("d", "")] },
  ];
  assert.deepEqual(S.allTags(entries), ["ML", "Optim"]);
});
