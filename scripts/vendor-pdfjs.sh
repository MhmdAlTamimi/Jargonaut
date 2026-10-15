#!/usr/bin/env bash
# Copies Mozilla's PDF.js viewer into extension/pdfjs and wires in
# Jargonaut. Run it again to upgrade PDF.js.
#
# Use the "legacy" build (the pdfjs-<version>-legacy-dist.zip release, or
# `gulp generic-legacy`): the modern build skips transpiling and only runs
# on the very latest browsers, so a Chrome a few versions behind would show
# a blank viewer.
#
#   unzip pdfjs-6.4.299-legacy-dist.zip -d pdfjs-dist
#   scripts/vendor-pdfjs.sh pdfjs-dist
#
# or build it from source:
#
#   git clone --branch v6.4.299 https://github.com/mozilla/pdf.js
#   cd pdf.js && npm ci && npx gulp generic-legacy && cd -
#   scripts/vendor-pdfjs.sh pdf.js/build/generic-legacy
set -euo pipefail

SRC="${1:?usage: scripts/vendor-pdfjs.sh <path to the PDF.js legacy build>}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/extension/pdfjs"

rm -rf "$DEST"
mkdir -p "$DEST/build" "$DEST/web"
cp "$SRC/LICENSE" "$DEST/"
cp "$SRC/build/pdf.mjs" "$SRC/build/pdf.worker.mjs" "$DEST/build/"
for item in viewer.html viewer.mjs viewer.css images locale cmaps standard_fonts iccs wasm; do
  cp -r "$SRC/web/$item" "$DEST/web/"
done
# Left out: source maps, the debugger, the demo PDF, and the JavaScript
# sandbox for scripted PDFs (Jargonaut turns PDF scripting off).
rm -f "$DEST/web/wasm/quickjs-eval."*

sed -n 's/.*pdfjsVersion = \([0-9.]*\).*/\1/p' "$DEST/build/pdf.mjs" | head -1 > "$DEST/VERSION"

# viewer.html: allow loading local files, and load Jargonaut's content
# script plus the glue before PDF.js starts.
node - "$DEST/web/viewer.html" <<'JS'
const fs = require("fs");
const file = process.argv[2];
let html = fs.readFileSync(file, "utf8");
const replace = (from, to) => {
  if (!html.includes(from)) throw new Error(`viewer.html: can't find ${from}`);
  html = html.replace(from, to);
};
replace("connect-src * blob: data:;", "connect-src * blob: data: file:;");
replace(
  '<link rel="resource" type="application/l10n" href="locale/locale.json" />',
  `<!-- Jargonaut: the same content script as on web pages, plus the glue -->
<link rel="stylesheet" href="../../viewer/pdf-glue.css" />
<script src="../../shared/text.js"></script>
<script src="../../shared/matcher.js"></script>
<script src="../../shared/abbreviations.js"></script>
<script src="../../shared/store.js"></script>
<script src="../../content/card.js"></script>
<script src="../../content/content.js"></script>
<script src="../../viewer/pdf-glue.js"></script>

<link rel="resource" type="application/l10n" href="locale/locale.json" />`
);
fs.writeFileSync(file, html);
JS

echo "PDF.js $(cat "$DEST/VERSION") copied to $DEST ($(du -sh "$DEST" | cut -f1))"
