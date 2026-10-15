// Local PDF files (file://) never pass through the network rules that send
// web PDFs to the viewer, so this tiny script does it for them. Chrome only
// runs it once "Allow access to file URLs" is on for the extension.
"use strict";

if (document.contentType === "application/pdf" && location.hash !== "#jargonaut-original") {
  const file = location.href.split("#")[0];
  location.replace(`${chrome.runtime.getURL("pdfjs/web/viewer.html")}?src=${encodeURIComponent(file)}`);
}
