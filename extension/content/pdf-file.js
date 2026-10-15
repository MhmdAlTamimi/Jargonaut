// Local PDF files (file://) never pass through the network rules that send
// web PDFs to the viewer, so this tiny script does it for them. Chrome only
// runs it once "Allow access to file URLs" is on for the extension.
//
// Firefox never lets extensions read file:// addresses, so there the PDF
// stays in Firefox's own viewer (open it in Jargonaut's viewer with the
// toolbar icon's right-click menu instead).
"use strict";

{
  const ext = globalThis.browser || globalThis.chrome;
  const viewer = ext.runtime.getURL("pdfjs/web/viewer.html");
  if (
    document.contentType === "application/pdf" &&
    location.hash !== "#jargonaut-original" &&
    !viewer.startsWith("moz-extension:")
  ) {
    const file = location.href.split("#")[0];
    location.replace(`${viewer}?src=${encodeURIComponent(file)}`);
  }
}
