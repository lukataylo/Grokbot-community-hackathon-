#!/usr/bin/env bash
# Builds the browser-only demo (mock Grok + localStorage) into ./out for GitHub Pages.
# Route handlers can't be statically exported, so they are removed from a temporary copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
tar -C "$ROOT" --exclude=./node_modules --exclude=./.next --exclude=./out --exclude=./data --exclude=./.git -cf - . | tar -C "$TMP" -xf -
ln -s "$ROOT/node_modules" "$TMP/node_modules"
rm -rf "$TMP/src/app/api" "$TMP/src/app/scene" "$TMP/src/app/uploads" "$TMP/src/lib/services.ts" "$TMP/src/lib/store.ts" "$TMP/src/lib/session.ts"
(cd "$TMP" && NEXT_PUBLIC_STATIC_DEMO=1 NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}" npx next build)
rm -rf "$ROOT/out" && cp -r "$TMP/out" "$ROOT/out"
touch "$ROOT/out/.nojekyll"
rm -rf "$TMP"
echo "Static demo written to $ROOT/out"
