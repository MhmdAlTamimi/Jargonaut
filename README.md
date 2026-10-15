# Jargonaut

A browser extension for **Chrome and Firefox** that shows **your own definitions** of terms and abbreviations right where you read a paper. It works on web pages and PDFs, with one double-click.

## Install (once)

First, **get the files:** on this repo's GitHub page, click **Code → Download ZIP** and unzip it.

### Chrome (also Edge, Brave and other Chromium browsers)

1. Open **`chrome://extensions`** and switch on **Developer mode** (top right).
2. Click **Load unpacked** and choose the **`extension`** folder inside the unzipped folder.
3. *(Only for PDFs saved on your computer)* On the Jargonaut card, click **Details** and turn on **Allow access to file URLs**.

Pin the icon: puzzle-piece menu → pin Jargonaut.

### Firefox (version 140 or newer)

Firefox only keeps add-ons that Mozilla has signed, so there are two ways in:

**Quick try (stays until you quit Firefox):**

1. Open **`about:debugging#/runtime/this-firefox`**.
2. Click **Load Temporary Add-on…** and choose **`manifest.json`** inside the `extension` folder.

**Keep it installed (free, once, about 5 minutes):**

1. Zip the *contents* of the `extension` folder, so `manifest.json` sits at the top of the zip. On Mac or Linux: `cd extension && zip -r ../jargonaut.zip .`
2. Sign in at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/), choose **Submit a New Add-on → On your own**, and upload the zip. This is private: it is not published in the add-on store.
3. Mozilla signs it automatically. Download the signed **`.xpi`** file and drag it into Firefox → **Add**.

Pin the icon: puzzle-piece menu → gear next to Jargonaut → **Pin to Toolbar**.

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
| Read a PDF **from your computer** | Chrome: just open it (after install step 3). Firefox: right-click the Jargonaut toolbar icon → **Open a PDF from your computer**, then drag the file in. |
| See, search, edit or delete all your terms | Click the **Jargonaut toolbar icon**. |
| **Back up** your glossary | On that glossary page, click **Export** (and **Import** to restore or merge). |

That's it. The sentence around a term is saved automatically as context; hover a meaning on the card to see it.

### Good to know

- **The shortcut does nothing?** Another extension may already use Alt+Shift+G. Set your own: in Chrome at `chrome://extensions/shortcuts`; in Firefox at `about:addons` → gear icon → **Manage Extension Shortcuts**.
- **A PDF opened in the browser's normal viewer?** Right-click the link → **Open in Jargonaut viewer**.
- **For arXiv papers**, the HTML version (`arxiv.org/html/…`) gives the best experience; the PDF works too.
- **After updating the extension** (or reloading it), refresh the tabs you already had open.
- **Short all-caps terms** like "SA" or "IT" only match in capitals, so "it" in normal text won't open them.
- **Your glossary stays on this computer**, in the browser's local extension storage. Nothing is sent anywhere. Chrome and Firefox each keep their own glossary; use **Export** and **Import** to back it up or move it between them.
- **Firefox quick try:** Firefox may clear a temporary add-on's data when it removes it, so **Export** before quitting, or use the signed install.
- **Firefox: double-clicking does nothing?** Open `about:addons` → Jargonaut → **Permissions** and allow access to all websites.

### Where it works

| Where you read | Works? |
| --- | --- |
| HTML papers (arXiv HTML, journals, blogs, Wikipedia) | Yes |
| PDF links (including `arxiv.org/pdf/…`) | Yes, in Jargonaut's PDF viewer |
| PDFs on your computer | Chrome: yes, after install step 3. Firefox: yes, through the toolbar icon's right-click menu (Firefox doesn't let add-ons open local files by themselves) |
| Scanned PDFs, equations and symbols, Google Docs | No (they aren't real text) |
| Browser pages (`chrome://`, `about:`), the add-on stores, phones | No (browsers don't allow extensions there) |

Paper-abbreviation detection is a heuristic: it finds most "Long Form (ABBR)" definitions, but it can miss some or pick up a wrong one.

---

## For developers

No build step and no dependencies: plain JavaScript, HTML and CSS, Manifest V3. The same `extension` folder loads in Chrome and Firefox: the manifest lists the background script for both (`service_worker` for Chrome, `scripts` for Firefox), and the code uses Firefox's promise-based `browser.*` API where it exists, falling back to Chrome's `chrome.*`.

```
extension/            ← the folder you load (Chrome) or zip/point to (Firefox)
  manifest.json
  background.js       background script: shortcut relay, PDF redirects, right-click menus
  content/            runs on every page (and inside the PDF viewer)
    content.js          double-click / shortcut → find the term → show the card
    card.js             the card, "+ Add" pill and forms, in a closed Shadow DOM
    pdf-file.js         sends local file:// PDFs to the viewer (Chrome)
  shared/             used everywhere (and by the tests)
    text.js             tokenizing and normalizing ("Self-Attention" → "self attention")
    matcher.js          longest saved phrase around the clicked word
    abbreviations.js    "Long Form (ABBR)" detection
    store.js            storage.local, import/export merging
  glossary/           the glossary page (toolbar icon)
  viewer/             glue between PDF.js and the content script
  pdfjs/              Mozilla PDF.js 6.4.299 (vendored, legacy build)
scripts/vendor-pdfjs.sh   re-creates extension/pdfjs from a PDF.js build
tests/                unit tests (Node's built-in test runner)
```

- **Run the tests:** `npm test` (Node 20 or newer, nothing to install).
- **Try a change:** edit, then press the reload icon on Jargonaut in `chrome://extensions` (or **Reload** in Firefox's `about:debugging`) and refresh the page you're testing.
- **Check it for Firefox:** `npx web-ext lint --source-dir extension` runs Mozilla's add-on linter (the same checks as signing). `npx web-ext run --source-dir extension` starts Firefox with Jargonaut loaded.
- **Update PDF.js:** see the comments at the top of `scripts/vendor-pdfjs.sh`.

### How it works (things worth learning here)

- **Shadow DOM** (`content/card.js`): the card lives in a *closed* shadow root, so a paper's CSS can't restyle it and the page's scripts can't read your definitions.
- **`document.caretPositionFromPoint`** (`content/content.js`): turns the mouse position into an exact text node and offset. It's the web standard (Firefox, and Chrome since 128); Chrome's older `caretRangeFromPoint` is the fallback. From there, a **TreeWalker** collects about 8 words on each side.
- **Longest-match lookup** (`shared/matcher.js`): saved terms are indexed by their first word. Every start position that covers the clicked word is tried, and the longest saved phrase wins, so "attention" inside "multi-head attention" opens the phrase.
- **Schwartz–Hearst (2003)** (`shared/abbreviations.js`): for "Graph Neural Network (GNN)", it walks the letters N, N, G right to left through the words before the parenthesis. The first letter must start a word. A classic, tiny bioinformatics algorithm.
- **MutationObserver** re-scans pages that load content later.
- **The PDF.js text layer:** PDF.js draws each page on a canvas and lays invisible, absolutely positioned text spans on top, one per text run. That's why selecting PDF text works, why words can be split across spans, and why the content script treats a whole page's text layer as one paragraph.
- **declarativeNetRequest vs. webRequest** (`background.js`): known PDF addresses are redirected by rules Chrome applies itself, before the request leaves the browser. Other PDFs are spotted by watching (not blocking) response headers for `application/pdf`.
