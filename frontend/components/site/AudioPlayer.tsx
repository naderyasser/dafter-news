"use client";

import { useEffect, useRef, useState } from "react";

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = audioSrc ? (audioRef.current?.duration || durationSeconds) : durationSeconds;

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const togglePlay = () => {
    if (audioSrc && audioRef.current) {
      if (playing) audioRef.current.pause();
      else audioRef.current.play();
      return;
    }
    if (playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlaying(false);
      return;
    }
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + (100 / durationSeconds) * 0.25 * speed);
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
    <div className="my-5 flex items-center gap-3.5 rounded-pill border border-line bg-surface px-[18px] py-2.5">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setProgress(((e.currentTarget.currentTime || 0) / (e.currentTarget.duration || total)) * 100)}
          onEnded={() => setPlaying(false)}
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
  );
}
