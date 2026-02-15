#!/usr/bin/env bash
set -euo pipefail
ROOT="/Users/zhangzhiyu/Desktop/zotero_openclaw"
OUT="$ROOT/zotero-openclaw.xpi"
cd "$ROOT"
rm -f "$OUT"
zip -r "$OUT" \
  bootstrap.js \
  openclaw.js \
  manifest.json \
  README.md \
  prefs.js \
  preferences.xhtml \
  preferences.js \
  locale/en-US/openclaw.ftl
printf 'Packed: %s\n' "$OUT"
