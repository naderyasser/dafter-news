#!/usr/bin/env bash
# Build → carry the image cache over → swap → restart → warm.
#
# Why this exists: the image optimizer's cache lives in .next/cache/images,
# so the plain build-and-swap deploy silently threw it away every time —
# and the first reader after every deploy paid for re-encoding every
# thumbnail on the site, which on a below-the-fold widget looks exactly
# like "the images never load". The client saw grey boxes in «الأكثر قراءة»
# for precisely this reason.
#
# Usage: bash scripts/deploy-frontend.sh   (from frontend/)
set -euo pipefail

cd "$(dirname "$0")/.."

echo "── building into .next-new"
# Generated route types from earlier builds (.next/types of the LIVE build,
# .next-old, .next-verify) describe routes that may no longer exist, and
# tsconfig's `.next*/types` glob pulls every one of them into the type check
# — after a route rename the next build fails on the previous build's
# validator.ts (found while forking this tree for AlexGate). Those files are
# TypeScript only; the running server never reads them, so clearing them
# before the build is safe.
rm -rf .next-old .next-new .next-verify .next/types
NEXT_DIST_DIR=.next-new npm run build

echo "── carrying the optimizer cache across"
if [ -d .next/cache/images ]; then
  mkdir -p .next-new/cache
  cp -r .next/cache/images .next-new/cache/images
  echo "   $(find .next-new/cache/images -type f | wc -l) cached variants preserved"
fi

echo "── swapping"
systemctl stop dafter-frontend
rm -rf .next-old
mv .next .next-old
mv .next-new .next
systemctl start dafter-frontend

sleep 4
systemctl is-active dafter-frontend

echo "── warming the pages a reader lands on"
# Capped heap: this runs straight after a Next build on a box shared with
# several other apps, and the kernel OOM-killed it once at exactly this step
# (exit 137) — after the swap and restart, so the site was already live and
# only the thumbnails went unwarmed. The `||` below always kept that
# non-fatal; the cap stops it happening in the first place.
node --max-old-space-size=1024 scripts/warm-images.js || echo "   (warming failed — readers will warm it instead; site is up)"

# Next rewrites next-env.d.ts and appends a tsconfig "include" entry naming
# whichever distDir it just built into (.next-new here, .next-verify under
# `make check`). Those are build artefacts, not source edits — and this
# checkout IS the production tree, so leaving them behind means `git status`
# is dirty after every deploy and the next `git add -A` commits whichever
# build ran last. The globs in tsconfig already cover every distDir, so the
# appended lines are redundant; restore both files and move on.
git -C "$(git rev-parse --show-toplevel)" checkout -- \
  frontend/tsconfig.json frontend/next-env.d.ts 2>/dev/null || true

echo "✓ deployed"
