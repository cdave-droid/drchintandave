"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Sparkles } from "lucide-react";
import {
  ICU_TOPICS,
  CATEGORIES,
  CATEGORY_COLORS,
  type IcuTopic,
  type TopicCategory,
} from "@/lib/icu-topics";

const ITEM_HEIGHT = 96; // px, height of one reel item
const VISIBLE = 5; // odd number so one sits dead-center
const CENTER_OFFSET = Math.floor(VISIBLE / 2);
const LOOPS = 14; // how many full passes before landing (spin length)
const SPIN_MS = 5200; // total spin duration

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SpinnerPage() {
  const [active, setActive] = useState<Record<TopicCategory, boolean>>(
    () =>
      Object.fromEntries(CATEGORIES.map((c) => [c, true])) as Record<
        TopicCategory,
        boolean
      >,
  );

  const pool = useMemo(
    () => ICU_TOPICS.filter((t) => active[t.category]),
    [active],
  );

  // The reel is a long, randomized strip of topics we translate vertically.
  const [reel, setReel] = useState<IcuTopic[]>(() => buildReel(ICU_TOPICS));
  const [offset, setOffset] = useState(0); // translateY in px (negative)
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<IcuTopic | null>(null);
  const [transition, setTransition] = useState("none");
  const reelRef = useRef<HTMLDivElement>(null);

  const spin = useCallback(() => {
    if (spinning) return;
    const p = pool.length ? pool : ICU_TOPICS;

    const strip = buildReel(p);
    // Land somewhere in the last third of the strip for a long travel.
    const landIndex =
      strip.length - p.length - 1 - Math.floor(Math.random() * p.length);
    const winner = strip[landIndex];

    // Reset to top instantly, then animate to the landing position.
    setSelected(null);
    setSpinning(true);
    setReel(strip);
    setTransition("none");
    setOffset(0);

    // Next frame: apply the eased transform so the browser animates it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = -(landIndex - CENTER_OFFSET) * ITEM_HEIGHT;
        // Custom cubic-bezier: fast start, long graceful deceleration.
        setTransition(`transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.12, 1)`);
        setOffset(target);
      });
    });

    window.setTimeout(() => {
      setSpinning(false);
      setSelected(winner);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([18, 40, 18]);
      }
    }, SPIN_MS + 80);
  }, [pool, spinning]);

  const reset = () => {
    if (spinning) return;
    setSelected(null);
    setTransition("none");
    setOffset(0);
    setReel(buildReel(pool.length ? pool : ICU_TOPICS));
  };

  const toggleCategory = (c: TopicCategory) => {
    if (spinning) return;
    setActive((prev) => {
      const next = { ...prev, [c]: !prev[c] };
      // Never allow zero categories selected.
      if (!CATEGORIES.some((k) => next[k])) return prev;
      return next;
    });
    setSelected(null);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--dave-bg-primary)] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#16213e] to-[#0a0a0f]" />
        <div className="absolute left-1/2 top-[-10%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-[var(--accent-blue)] opacity-20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] h-[40vh] w-[40vh] rounded-full bg-[var(--accent-teal)] opacity-20 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-10 sm:py-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--dave-neon-cyan)]">
            <Sparkles className="h-3.5 w-3.5" />
            ICU Physiology
          </div>
          <h1 className="bg-gradient-to-r from-[var(--dave-neon-cyan)] via-white to-[var(--dave-light-purple)] bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            Physiology Spinner
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--dave-text-muted)] sm:text-base">
            Spin the reel, land on a critical-care condition, and explain the
            core physiology in 60 seconds.
          </p>
        </motion.div>

        {/* The slot machine */}
        <div className="relative w-full max-w-md">
          <div
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-sm"
            style={{ height: ITEM_HEIGHT * VISIBLE }}
          >
            {/* Center selection window */}
            <div
              className="pointer-events-none absolute inset-x-0 z-20"
              style={{
                top: ITEM_HEIGHT * CENTER_OFFSET,
                height: ITEM_HEIGHT,
              }}
            >
              <div className="mx-3 h-full rounded-2xl border-2 border-[var(--dave-neon-cyan)]/70 shadow-[0_0_30px_rgba(0,212,255,0.35)]" />
            </div>

            {/* Top & bottom fade masks */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/3 bg-gradient-to-b from-black/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />

            {/* The moving reel */}
            <div
              ref={reelRef}
              style={{
                transform: `translateY(${offset}px)`,
                transition,
              }}
            >
              {reel.map((t, i) => {
                const color = CATEGORY_COLORS[t.category];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center px-6"
                    style={{ height: ITEM_HEIGHT }}
                  >
                    <div className="flex w-full items-center justify-center gap-3 text-center">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {t.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-7 flex items-center gap-3">
          <button
            onClick={spin}
            disabled={spinning}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-teal)] px-9 py-4 text-lg font-bold text-white shadow-lg shadow-[var(--accent-blue)]/30 transition-all hover:scale-[1.03] hover:shadow-[var(--accent-blue)]/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            <Play className="h-5 w-5 fill-current" />
            {spinning ? "Spinning…" : "Spin"}
          </button>
          <button
            onClick={reset}
            disabled={spinning}
            aria-label="Reset"
            className="inline-flex h-[58px] w-[58px] items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-all hover:bg-white/10 disabled:opacity-40"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        {/* Reveal card */}
        <div className="mt-7 w-full max-w-md">
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.full}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[selected.category]}22`,
                      color: CATEGORY_COLORS[selected.category],
                    }}
                  >
                    {selected.category}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--dave-text-muted)]">
                    Your topic
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {selected.full}
                </h2>
                <div className="mt-4 rounded-2xl border-l-2 border-[var(--dave-neon-cyan)] bg-black/20 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--dave-neon-cyan)]">
                    The concept to explain
                  </p>
                  <p className="text-[15px] leading-relaxed text-[var(--dave-text-secondary)]">
                    {selected.concept}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category filters */}
        <div className="mt-9 w-full max-w-md">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[var(--dave-text-muted)]">
            Categories ({pool.length} topics in play)
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => {
              const on = active[c];
              const color = CATEGORY_COLORS[c];
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  disabled={spinning}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
                  style={{
                    borderColor: on ? color : "rgba(255,255,255,0.12)",
                    backgroundColor: on ? `${color}22` : "transparent",
                    color: on ? color : "var(--dave-text-muted)",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

function buildReel(p: IcuTopic[]): IcuTopic[] {
  const base = p.length ? p : ICU_TOPICS;
  let strip: IcuTopic[] = [];
  for (let i = 0; i < LOOPS; i++) strip = strip.concat(shuffle(base));
  return strip;
}
