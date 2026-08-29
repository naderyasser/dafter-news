#!/usr/bin/env node
/**
 * Pre-encode every image variant a reader's first paint will ask for.
 *
 * The optimizer encodes a (url, width, quality) triple on first request and
 * caches it; after a deploy with a cold cache, the first visitor's page race
 * is 40+ encodes of 400KB sources — and the below-the-fold thumbnails lose
 * that race for long enough to read as missing. This walks the landing
 * pages' HTML, collects every /_next/image URL out of src and srcset
 * (those carry the exact widths real screens will request), and fetches
 * them until the cache is hot.
 *
 * Standalone node, no deps — it must run on a box where npm install may
 * not have happened yet.
 */
const BASE = process.env.WARM_BASE || "https://aldaftarnews.com";
const PAGES = ["/", "/en", "/most-read", "/video", "/markets", "/section/egypt"];

const seen = new Set();

async function collect(path) {
  const res = await fetch(BASE + path, { headers: { "user-agent": "warm-images" } });
  const html = await res.text();
  const urls = new Set();
  // src="..." and every srcset candidate; entities arrive escaped in HTML.
  for (const m of html.matchAll(/\/_next\/image\?[^"'\s,]+/g)) {
    urls.add(m[0].replace(/&amp;/g, "&"));
  }
  return [...urls];
}

async function warm(url) {
  if (seen.has(url)) return null;
  seen.add(url);
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + url);
    await res.arrayBuffer();
    return { url, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { url, status: 0, ms: Date.now() - t0 };
  }
}

(async () => {
  let ok = 0, bad = 0, totalMs = 0;
  for (const page of PAGES) {
    let urls = [];
    try {
      urls = await collect(page);
    } catch {
      console.log(`   ✗ could not read ${page}`);
      continue;
    }
    // Small batches: the point is a warm cache, not a self-inflicted stampede.
    for (let i = 0; i < urls.length; i += 6) {
      const results = await Promise.all(urls.slice(i, i + 6).map(warm));
      for (const r of results) {
        if (!r) continue;
        totalMs += r.ms;
        if (r.status === 200) ok++;
        else {
          bad++;
          console.log(`   ✗ ${r.status} ${decodeURIComponent(r.url).slice(0, 110)}`);
        }
      }
    }
  }
  console.log(`   warmed ${ok} variants (${bad} failed) in ${(totalMs / 1000).toFixed(1)}s of encode time`);
  process.exitCode = bad > 0 && ok === 0 ? 1 : 0;
})();
