// Glue between Mozilla's PDF.js viewer and Jargonaut (F8). Loaded by
// pdfjs/web/viewer.html right after the content script, before PDF.js starts.
//
//   viewer.html?src=<PDF address>
//
// Chrome's own PDF viewer doesn't let extensions in, so PDFs open here
// instead, and the same content script as on web pages handles lookups on
// PDF.js's text layer.
"use strict";

(() => {
  // The PDF's address. The redirect rule appends it raw ("?src=https://…"),
  // our own links encode it; both are accepted.
  function readSource() {
    const href = location.href.slice(0, location.href.length - location.hash.length);
    const at = href.indexOf("?src=");
    if (at < 0) return "";
    let src = href.slice(at + 5);
    if (/^[a-z][a-z0-9+.-]*%3A/i.test(src)) {
      try {
        src = decodeURIComponent(src);
      } catch {}
    }
    return src;
  }

  const src = readSource();
  if (src) {
    // Store it encoded, so a "&file=…" inside the PDF's own address can't be
    // mistaken for one of PDF.js's parameters.
    history.replaceState(
      history.state,
      "",
      `${location.pathname}?src=${encodeURIComponent(src)}${location.hash}`
    );
    JargonautContent.setSourceUrl(src);
  }

  if (chrome.tabs && chrome.tabs.getCurrent) {
    chrome.tabs.getCurrent((tab) => tab && JargonautContent.setTabId(tab.id));
  }

  // PDF.js fires this once its files are loaded, before it initializes:
  // the documented moment to change its options.
  document.addEventListener("webviewerloaded", () => {
    const options = window.PDFViewerApplicationOptions;
    options.set("disablePreferences", true); // keep these settings
    options.set("defaultUrl", ""); // no demo PDF; we open src ourselves
    options.set("enableScripting", false); // no JavaScript inside PDFs
    options.set("isEvalSupported", false); // the extension's CSP forbids eval
    start(window.PDFViewerApplication);
  });

  async function start(app) {
    await app.initializedPromise;
    app.eventBus.on("documentloaded", () => {
      // A file opened with PDF.js's own Open button has no address to save.
      const url = app.url && !app.url.startsWith("blob:") ? app.url : "";
      JargonautContent.setSourceUrl(url);
      readAllText(app.pdfDocument);
    });
    if (!src) return;
    try {
      await app.open({ url: src });
    } catch {
      offerOriginal(src);
    }
  }

  // The abbreviation scan needs every page's text, not just the pages
  // currently drawn, so "RAG" defined on page 1 is known on page 9.
  let scanToken = 0;
  async function readAllText(pdf) {
    const token = ++scanToken;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      if (token !== scanToken) return; // another document was opened
      for (const item of content.items) {
        parts.push(item.str || "");
        if (item.hasEOL) parts.push("\n");
      }
      parts.push("\n\n");
      // Early pages are usable while later ones are still being read.
      if (i === 3 || i % 20 === 0) JargonautContent.setPaperText(parts.join(""));
    }
    JargonautContent.setPaperText(parts.join(""));
  }

  // If the address turned out not to be a PDF (a login page, say), offer
  // the original page without sending it straight back here.
  function offerOriginal(url) {
    const bar = document.createElement("div");
    bar.className = "jargonaut-fallback";
    bar.setAttribute("role", "alert");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Open the original page";
    button.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "jargonaut:bypass", url }).catch(() => {});
      location.href = url.startsWith("file:") ? `${url}#jargonaut-original` : url;
    });
    bar.append("Jargonaut couldn't open this as a PDF. ", button);
    document.body.append(bar);
  }
})();
