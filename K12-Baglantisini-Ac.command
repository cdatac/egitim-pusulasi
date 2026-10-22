#!/bin/sh
set -eu
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: Node.js 24 veya üzeri bulunamadı." >&2
  echo "Resmi indirme adresi: https://nodejs.org/en/download" >&2
  exit 1
fi

exec node scripts/open-k12-browser.mjs "$@"
