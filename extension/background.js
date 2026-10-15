// Service worker: relays the Alt+Shift+G shortcut to the page and opens
// the glossary from the toolbar icon.
"use strict";

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

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
