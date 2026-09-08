import { ImageResponse } from "next/og";

import { getArticle, mediaUrl } from "@/lib/api";

/**
 * The share card an opinion piece gets when it was filed without a cover
 * photo — a 1200×630 image built around the columnist's own portrait.
 *
 * Why this exists rather than pointing og:image straight at the avatar file:
 * Facebook, WhatsApp and X all render a link preview at roughly 1.91:1 and
 * CROP whatever they are given to fit it. An avatar is square, so handing one
 * over means the crawler trims the top and bottom of it — which on a
 * head-and-shoulders portrait is the top of the head and the chin. Composing
 * the portrait onto a correctly-proportioned canvas here means the crawler
 * has nothing left to crop, and the face arrives intact.
 *
 * Deliberately WORDLESS. Satori (what ImageResponse renders through) ships no
 * system fonts and cannot lay out Arabic without a font file passed to it by
 * hand, and the headline is already carried as real text beside the picture
 * in every preview via og:title — painting it into the image too would be a
 * second copy that can only disagree with the first.
 *
 * Raw hex here rather than the design tokens the components use: this is a
 * PNG renderer, not a component, and satori resolves no Tailwind theme. The
 * three values are the brand's own — see tailwind.config.ts, where `board`
 * (#101820) and `brand` (#B01F2E) are defined.
 */
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

const BOARD = "#101820";
const BOARD_STAGE = "#0A0A0B";
const BRAND = "#B01F2E";

/** Fetched as bytes and inlined rather than passed to satori as a URL: the
 *  renderer would otherwise make its own request back into this same server
 *  mid-render, which deadlocks a single-worker deployment under a crawl. */
async function inlineImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(decodeURIComponent(slug));
  const avatarUrl = mediaUrl(article?.author?.avatar ?? null);
  const avatar = avatarUrl ? await inlineImage(avatarUrl) : null;

  // No portrait to build the card around — the caller (lib/seo.ts) only ever
  // points at this route when there is one, so this is the race where the
  // avatar was removed between the two. A branded panel is still a better
  // preview than a broken image.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BOARD,
          position: "relative",
        }}
      >
        {/* The notebook-margin rule the whole identity is built on, at the
            scale of a share card: a brand-red bar down the leading edge. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: 18,
            background: BRAND,
            display: "flex",
          }}
        />
        {avatar ? (
          // A plain <img>, deliberately: this JSX is rendered by next/og's
          // Satori into a PNG, where next/image does not exist. Decorative —
          // the card's text carries the name.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={avatar}
            width={470}
            height={470}
            style={{
              width: 470,
              height: 470,
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "top",
              border: `10px solid ${BRAND}`,
              background: BOARD_STAGE,
            }}
          />
        ) : (
          <div
            style={{
              width: 470,
              height: 470,
              borderRadius: "50%",
              background: BOARD_STAGE,
              border: `10px solid ${BRAND}`,
              display: "flex",
            }}
          />
        )}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Crawlers refetch a card on every reshare; the portrait behind it
        // changes about never.
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
