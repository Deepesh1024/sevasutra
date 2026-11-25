"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface TickerItem { href: string; text: string; tag?: string }

/** Scrolling text banner. Pauses on hover/focus and has an explicit pause button (WCAG 2.2.2). */
export function Ticker({ items, label, pauseLabel, playLabel }: { items: TickerItem[]; label: string; pauseLabel: string; playLabel: string }) {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(items.length * 20);
  useEffect(() => {
    // Constant reading speed (~60 px/s) regardless of how many items there are.
    const w = trackRef.current?.scrollWidth ?? 0;
    if (w > 0) setDuration(Math.max(30, w / 2 / 60));
  }, [items]);
  if (items.length === 0) return null;
  const row = (hidden: boolean) =>
    items.map((it, i) => (
      <span key={`${hidden ? "b" : "a"}${i}`} className="inline-flex items-center gap-2" aria-hidden={hidden || undefined}>
        <span aria-hidden className="text-accent">◆</span>
        {it.tag && <span className="badge text-accent bg-accent-soft">{it.tag}</span>}
        <Link href={it.href} tabIndex={hidden ? -1 : undefined} className="text-ink hover:text-primary no-underline hover:underline">{it.text}</Link>
      </span>
    ));
  return (
    <div className="border-b border-line bg-accent-soft">
      <div className="mx-auto max-w-6xl px-4 flex items-center gap-3 py-1.5 text-sm">
        <span className="shrink-0 rounded-md bg-primary text-primary-ink px-2 py-0.5 font-semibold">{label}</span>
        <div className="ticker flex-1" data-paused={paused} role="region" aria-label={label} style={{ ["--ticker-duration" as string]: `${duration}s` }}>
          <div className="ticker-track" ref={trackRef}>{row(false)}{row(true)}</div>
        </div>
        <button type="button" className="btn btn-sm shrink-0" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? `▶ ${playLabel}` : `❚❚ ${pauseLabel}`}
        </button>
      </div>
    </div>
  );
}
