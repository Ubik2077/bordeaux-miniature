#!/bin/sh
# Regénère affiche-canele-quest.pdf (A5) à partir de affiche.html, avec Chrome ou Brave sans fenêtre.
# Repris de « Port de la Lune ». Le site doit tourner en local : python3 -m http.server 8644 --bind 127.0.0.1
set -e
cd "$(dirname "$0")/.."
for b in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
         "$(command -v chromium || true)" "$(command -v google-chrome || true)"; do
  [ -x "$b" ] && NAV="$b" && break
done
[ -n "$NAV" ] || { echo "Chrome ou Brave introuvable"; exit 1; }
TEMP_PROFIL="$(mktemp -d)"
PROFIL="${PROFIL:-$TEMP_PROFIL}"  # profil de navigateur jetable
"$NAV" --headless --no-first-run --disable-extensions --use-mock-keychain --password-store=basic --user-data-dir="$PROFIL" --no-pdf-header-footer \
  --virtual-time-budget=8000 --print-to-pdf="$PWD/affiche-canele-quest.pdf" "http://127.0.0.1:8644/affiche.html" 2>/dev/null
rm -rf "$TEMP_PROFIL"
echo "✓ affiche-canele-quest.pdf"
