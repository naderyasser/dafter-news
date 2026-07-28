"use client";

import { useEffect, useState } from "react";

import VideoPlayer from "@/components/site/VideoPlayer";
import { API_URL, mediaUrl } from "@/lib/api";
import type { LiveStream } from "@/lib/types";

/** How often an open page re-checks whether the newsroom has started/stopped. */
const POLL_MS = 10_000;

/**
 * The reader's view of «بث مباشر», kept in step with the dashboard switch.
 *
 * Dropping the page's cache on write isn't enough here: a reader already
 * watching has nothing to re-fetch, so «إيقاف البث» in the newsroom would
 * leave their player claiming to be live until they happened to reload. This
 * polls the stream so starting and stopping — and each new update in the
 * timeline — lands on open pages within a few seconds.
 *
 * Polling pauses while the tab is hidden: a backgrounded tab left open
 * overnight would otherwise keep hitting the API for a stream nobody is
 * watching.
 */
export default function LiveStreamPanel({ initial }: { initial: LiveStream | null }) {
  const [stream, setStream] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${API_URL}/live-streams/`, { cache: "no-store" });
        if (!res.ok) return;
        const page = await res.json();
        const results: LiveStream[] = page.results ?? [];
        // Same pick as the server render: whatever is live, else the newest.
        const next = results.find((s) => s.is_live) ?? results[0] ?? null;
        if (!cancelled) setStream(next);
      } catch {
        // Offline or the API blipped — keep showing what we have rather than
        // blanking a stream the reader is watching.
      }
    };

    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  return (
    <>
      <div className="relative">
        <VideoPlayer
          externalUrl={stream?.stream_url || undefined}
          poster={mediaUrl(stream?.cover_image)}
          title={stream?.title ?? "بث مباشر"}
        />
        {stream?.is_live ? (
          <span className="absolute start-3 top-3 z-10 flex items-center gap-1.5 rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />
            مباشر
          </span>
        ) : (
          <span className="absolute start-3 top-3 z-10 rounded-badge bg-[rgba(23,26,31,.75)] px-2.5 py-1 text-xs font-bold text-paper">
            البث متوقف
          </span>
        )}
      </div>

      <h1 className="font-display-ar mb-6 mt-4.5 text-[clamp(1.375rem,1rem+1.4vw,1.75rem)] font-extrabold text-ink">
        {stream?.title ?? "لا يوجد بث حالياً"}
      </h1>

      {stream && stream.updates.length > 0 && (
        <>
          <div className="mb-5 rule-accent ps-3.5">
            <h2 className="font-display-ar m-0 text-h3 font-extrabold text-ink">التغطية لحظة بلحظة</h2>
          </div>
          <div className="relative ps-6">
            <div className="absolute bottom-1.5 top-1.5 start-[7px] w-0.5 bg-line" />
            {stream.updates.map((u) => (
              <div key={u.id} className="relative pb-7">
                <div className="absolute -start-6 top-0.5 h-4 w-4 rounded-full border-[3px] border-brand bg-paper" />
                <div className="tnum mb-1 text-[15px] font-extrabold text-brand">{u.time_label}</div>
                <div className="text-[15px] leading-[1.7] text-ink">{u.text}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
