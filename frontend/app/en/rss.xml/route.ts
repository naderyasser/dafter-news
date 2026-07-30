import { buildFeed } from "@/lib/rss";

export const revalidate = 300;

export async function GET() {
  return new Response(await buildFeed("en"), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
