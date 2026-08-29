"use client";

import { useEffect, useRef, useState } from "react";

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A freshly generated narration file (edge-tts's raw streamed MP3, written
 * straight to disk with no VBR/Xing header) reports `duration: Infinity` in
 * Chromium until the browser has scanned enough of the file — sometimes not
 * until a seek forces it to. `Infinity` is truthy, so the plain `||`
 * fallback this used to be (`audioRef.current?.duration || durationSeconds`)
 * never caught it: the transport silently adopted an infinite total, the
 * progress bar sat frozen at 0% forever (any finite time ÷ Infinity is 0),
 * and the "0:00 / Infinity:NaN" reading looked exactly like "nothing is
 * happening" — audio could be playing the whole time and there was no way
 * to tell. `durationSeconds` (the real, known-good length from the server,
 * computed once by mutagen when the file was generated) is always the
 * correct value to fall back to; a *finite*, positive browser-reported
 * duration is only ever preferred because it's occasionally a few
 * milliseconds more exact.
 */
function finiteDuration(d: number | undefined, fallback: number): number {
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : fallback;
}

/**
 * "استمع للمقال" — matches Article.dc.html's player. Plays real audio when
 * the article has a TTS file (tts_audio); otherwise the transport still
 * works against a simulated duration so the interaction is demonstrable
 * even before a real narration has been generated.
 */
export default function AudioPlayer({ lang, audioSrc, durationSeconds = 255 }: { lang: "ar" | "en"; audioSrc?: string | null; durationSeconds?: number }) {
  const isAr = lang === "ar";
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  // A play() call — or the file itself — can fail (a network blip, a
  // browser that refuses the codec, a load error on a bad file) with
  // nothing else in this component's state changing: onPlay simply never
  // fires, so the button silently does nothing. That read as "the feature
  // is broken" rather than "this one request failed" — surfacing it here is
  // what tells the two apart.
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The simulated-progress interval below is created once per play() and its
  // callback closes over whatever `speed` was at that moment. Without this
  // ref, cycling the speed while already playing would keep advancing
  // progress at the old rate until the reader paused and resumed.
  const speedRef = useRef(speed);
  const total = audioSrc ? finiteDuration(audioRef.current?.duration, durationSeconds) : durationSeconds;

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const togglePlay = () => {
    if (audioSrc && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        setError(false);
        // play() returns a promise that rejects on a real failure (a
        // network error, an unsupported/corrupt file) — unhandled, that
        // rejection is invisible: the button just never flips to "playing"
        // and nothing tells a reader why.
        audioRef.current.play().catch(() => setError(true));
      }
      return;
    }
    if (playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlaying(false);
      return;
    }
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + (100 / durationSeconds) * 0.25 * speedRef.current);
        if (next >= 100 && timerRef.current) clearInterval(timerRef.current);
        return next;
      });
    }, 250);
    setPlaying(true);
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = isAr ? (rect.right - e.clientX) / rect.width : (e.clientX - rect.left) / rect.width;
    const pct = Math.max(0, Math.min(100, ratio * 100));
    setProgress(pct);
    if (audioSrc && audioRef.current) audioRef.current.currentTime = (pct / 100) * total;
  };

  const elapsed = (progress / 100) * total;

  return (
    <div className="my-5">
      {/* The transport alone never said what it was for — a bare play button
          under a headline reads as a video that failed to load. The label is
          the secondary blue so it registers as a feature being offered, not
          as another red control. */}
      <div className={`${isAr ? "font-display-ar" : "font-display-en"} mb-2 flex items-center gap-2 text-[14px] font-bold text-accent`}>
        <span aria-hidden>🎧</span>
        {isAr ? "استمع للمقال" : "Listen to this article"}
      </div>
      <div className="flex items-center gap-3.5 rounded-pill border border-line bg-surface px-[18px] py-2.5">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setProgress(((e.currentTarget.currentTime || 0) / finiteDuration(e.currentTarget.duration, total)) * 100)}
          onEnded={() => setPlaying(false)}
          // The file itself can fail to load (a bad upload, a network drop
          // mid-fetch) after play() already resolved — this is the other
          // half of the same "don't fail silently" fix.
          onError={() => setError(true)}
        />
      )}
      <button
        onClick={togglePlay}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-none bg-brand text-[15px] text-paper"
        aria-label={isAr ? "تشغيل" : "Play"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div onClick={seek} className="relative h-1.5 cursor-pointer rounded-pill bg-line">
          <div className="absolute inset-y-0 start-0 rounded-pill bg-brand" style={{ width: `${progress}%` }} />
        </div>
        <div className="tnum flex justify-between text-xs text-ink-3">
          <span>{fmt(elapsed)}</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
      <button
        onClick={cycleSpeed}
        className="tnum flex-shrink-0 whitespace-nowrap rounded-pill border border-line-strong bg-paper px-3 py-1.5 text-xs font-bold text-ink"
      >
        x{speed}
      </button>
      </div>
      {error && (
        <div role="alert" className="mt-1.5 text-xs font-semibold text-down">
          {isAr ? "تعذّر تشغيل الصوت — حاول مرة أخرى." : "Couldn't play the audio — try again."}
        </div>
      )}
    </div>
  );
}
