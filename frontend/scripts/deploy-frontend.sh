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
node scripts/warm-images.js || echo "   (warming failed — readers will warm it instead; site is up)"

echo "✓ deployed"
