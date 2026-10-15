// Service worker: relays the Alt+Shift+G shortcut to the page, opens the
// glossary from the toolbar icon, and sends PDFs to the bundled viewer (F8).
"use strict";

const VIEWER = chrome.runtime.getURL("pdfjs/web/viewer.html");
const viewerUrl = (url) => `${VIEWER}?src=${encodeURIComponent(url)}`;

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ---- the shortcut ----

// The shortcut is handled by Chrome, not the page, so it arrives here first.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "lookup-selection") return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  const msg = { type: "jargonaut:lookup-selection" };
  // Normal pages: the content script in each frame (the one with the
  // selection answers).
  chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  // The PDF viewer is an extension page, which only hears runtime messages.
  chrome.runtime.sendMessage({ ...msg, tabId: tab.id }).catch(() => {});
});

// ---- PDFs ----

// 1. Known PDF addresses (*.pdf, arxiv.org/pdf/*) are redirected before the
//    request is even sent. "\0" is the whole matched address.
const PDF_RULES = [
  "^https?://[^?#]*\\.pdf([?#].*)?$",
  "^https?://(www\\.|export\\.)?arxiv\\.org/pdf/.+$",
].map((regexFilter, i) => ({
  id: i + 1,
  priority: 1,
  action: { type: "redirect", redirect: { regexSubstitution: `${VIEWER}?src=\\0` } },
  condition: { regexFilter, resourceTypes: ["main_frame"], isUrlFilterCaseSensitive: false },
}));

async function installPdfRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: PDF_RULES.map((r) => r.id),
    addRules: PDF_RULES,
  });
}

// 2. Anything else served as a PDF: watch response headers (observe only)
//    and move the tab to the viewer.
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0 || details.statusCode < 200 || details.statusCode >= 300) return;
    const header = (name) =>
      ((details.responseHeaders || []).find((h) => h.name.toLowerCase() === name) || {}).value || "";
    if (!/^\s*application\/(x-)?pdf\b/i.test(header("content-type"))) return;
    if (/^\s*attachment/i.test(header("content-disposition"))) return; // a download
    isBypassed(details.url).then((skip) => {
      if (!skip) chrome.tabs.update(details.tabId, { url: viewerUrl(details.url) });
    });
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
  ["responseHeaders"]
);

// 3. A right-click menu item for anything both of those miss.
function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "open-link",
      title: "Open in Jargonaut viewer",
      contexts: ["link"],
    });
    chrome.contextMenus.create({
      id: "open-page",
      title: "Open in Jargonaut viewer",
      contexts: ["page"],
      documentUrlPatterns: ["*://*/*pdf*", "*://*/*PDF*", "file:///*"],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-link" && info.linkUrl) {
    chrome.tabs.create({
      url: viewerUrl(info.linkUrl),
      index: tab ? tab.index + 1 : undefined,
      openerTabId: tab ? tab.id : undefined,
    });
  } else if (info.menuItemId === "open-page" && tab) {
    chrome.tabs.update(tab.id, { url: viewerUrl(info.pageUrl || tab.url) });
  }
});

// "Open the original page" from the viewer (the address wasn't a PDF):
// let that one address through for the rest of this browser session.
async function isBypassed(url) {
  const { bypass = [] } = await chrome.storage.session.get("bypass");
  return bypass.includes(url);
}

async function bypass(url) {
  const { bypass = [] } = await chrome.storage.session.get("bypass");
  if (!bypass.includes(url)) bypass.push(url);
  await chrome.storage.session.set({ bypass });
  const id = 1000 + bypass.indexOf(url);
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [id],
    addRules: [{
      id,
      priority: 2, // beats the redirect rules
      action: { type: "allow" },
      condition: { regexFilter: `^${escaped}$`, resourceTypes: ["main_frame"] },
    }],
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "jargonaut:bypass" || !sender.url || !sender.url.startsWith(VIEWER)) return;
  bypass(String(msg.url)).then(() => sendResponse(true), () => sendResponse(false));
  return true; // answering asynchronously
});

chrome.runtime.onInstalled.addListener(() => {
  installPdfRules();
  createMenus();
});
chrome.runtime.onStartup.addListener(installPdfRules);
