# Jargonaut

A Chrome extension that shows **your own definitions** of terms and abbreviations right where you read a paper. It works on web pages and PDFs, with one double-click.

## Install (once)

1. **Get the files:** on this repo's GitHub page, click **Code → Download ZIP** and unzip it.
2. In Chrome, open **`chrome://extensions`** and switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the **`extension`** folder inside the unzipped folder.
4. *(Only for PDFs saved on your computer)* On the Jargonaut card, click **Details** and turn on **Allow access to file URLs**.

Pin the Jargonaut icon (puzzle-piece menu → pin) so your glossary is one click away.

## Use it

| To… | Do this |
| --- | --- |
| **Look up** a term | **Double-click** it. If you saved it, your card opens next to the word. |
| **Add** a new term | Double-click it → click **+ Add** → type your definition → **Enter**. |
| Add a **multi-word** term or anything you highlight | Select it → press **Alt+Shift+G** (Mac: **⌥⇧G**) → type → **Enter**. |
| Use an abbreviation the **paper defines** (e.g. "RAG") | Double-click it → an amber **From this paper** card shows the expansion → **Save** to write your own definition. |
| Add another meaning, or edit | On the card: **+ Meaning** (key **N**) or **Edit** (key **E**). |
| Close the card | **Esc**, click anywhere else, or scroll away. |
| Read a **PDF** | Just open it. PDF links open in Jargonaut's viewer, where everything above works the same. |
| See, search, edit or delete all your terms | Click the **Jargonaut toolbar icon**. |
| **Back up** your glossary | On that glossary page, click **Export** (and **Import** to restore or merge). |

That's it. The sentence around a term is saved automatically as context; hover a meaning on the card to see it.

### Good to know

- **The shortcut does nothing?** Another extension may already use Alt+Shift+G. Set your own at `chrome://extensions/shortcuts`.
- **A PDF opened in Chrome's normal viewer?** Right-click the link → **Open in Jargonaut viewer**.
- **For arXiv papers**, the HTML version (`arxiv.org/html/…`) gives the best experience; the PDF works too.
- **After updating the extension** (or clicking its reload icon), refresh the tabs you already had open.
- **Short all-caps terms** like "SA" or "IT" only match in capitals, so "it" in normal text won't open them.
- **Your glossary stays on this computer** (in Chrome's local extension storage). Nothing is sent anywhere. Use **Export** to back it up or move it.

### Where it works

| Where you read | Works? |
| --- | --- |
| HTML papers (arXiv HTML, journals, blogs, Wikipedia) | Yes |
| PDF links (including `arxiv.org/pdf/…`) | Yes, in Jargonaut's PDF viewer |
| PDFs on your computer | Yes, after step 4 above |
| Scanned PDFs, equations and symbols, Google Docs | No (they aren't real text) |
| `chrome://` pages, the Chrome Web Store, Chrome on phones | No (Chrome doesn't allow extensions there) |

Paper-abbreviation detection is a heuristic: it finds most "Long Form (ABBR)" definitions, but it can miss some or pick up a wrong one.

---

## For developers

No build step and no dependencies: plain JavaScript, HTML and CSS, Manifest V3.

```
extension/            ← the folder you load in Chrome
  manifest.json
  background.js       service worker: shortcut relay, PDF redirects, right-click menu
  content/            runs on every page (and inside the PDF viewer)
    content.js          double-click / shortcut → find the term → show the card
    card.js             the card, "+ Add" pill and forms, in a closed Shadow DOM
    pdf-file.js         sends local file:// PDFs to the viewer
  shared/             used everywhere (and by the tests)
    text.js             tokenizing and normalizing ("Self-Attention" → "self attention")
    matcher.js          longest saved phrase around the clicked word
    abbreviations.js    "Long Form (ABBR)" detection
    store.js            chrome.storage.local, import/export merging
  glossary/           the glossary page (toolbar icon)
  viewer/             glue between PDF.js and the content script
  pdfjs/              Mozilla PDF.js 6.4.299 (vendored, legacy build)
scripts/vendor-pdfjs.sh   re-creates extension/pdfjs from a PDF.js build
tests/                unit tests (Node's built-in test runner)
```

- **Run the tests:** `npm test` (Node 20 or newer, nothing to install).
- **Try a change:** edit, then press the reload icon on Jargonaut in `chrome://extensions` and refresh the page you're testing.
- **Update PDF.js:** see the comments at the top of `scripts/vendor-pdfjs.sh`.

### How it works (things worth learning here)

- **Shadow DOM** (`content/card.js`): the card lives in a *closed* shadow root, so a paper's CSS can't restyle it and the page's scripts can't read your definitions.
- **`document.caretRangeFromPoint`** (`content/content.js`): turns the mouse position into an exact text node and offset. From there, a **TreeWalker** collects about 8 words on each side.
- **Longest-match lookup** (`shared/matcher.js`): saved terms are indexed by their first word. Every start position that covers the clicked word is tried, and the longest saved phrase wins, so "attention" inside "multi-head attention" opens the phrase.
- **Schwartz–Hearst (2003)** (`shared/abbreviations.js`): for "Graph Neural Network (GNN)", it walks the letters N, N, G right to left through the words before the parenthesis. The first letter must start a word. A classic, tiny bioinformatics algorithm.
- **MutationObserver** re-scans pages that load content later.
- **The PDF.js text layer:** PDF.js draws each page on a canvas and lays invisible, absolutely positioned text spans on top, one per text run. That's why selecting PDF text works, why words can be split across spans, and why the content script treats a whole page's text layer as one paragraph.
- **declarativeNetRequest vs. webRequest** (`background.js`): known PDF addresses are redirected by rules Chrome applies itself, before the request leaves the browser. Other PDFs are spotted by watching (not blocking) response headers for `application/pdf`.
