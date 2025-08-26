"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

type EaseTuple = [number, number, number, number];
type Ease = EaseTuple | ((t: number) => number);
type EaseLike = Ease | Ease[] | "linear" | "ease-in" | "ease-out" | "ease-in-out";

type PixelRevealProps = {
  play: boolean;
  onComplete?: () => void;
  durationMs?: number;
  cols?: number;
  easing?: EaseLike;
  zIndex?: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveEase(e: EaseLike | undefined): Ease | Ease[] | undefined {
  if (!e) return undefined;
  if (typeof e === "string") {
    const map: Record<string, EaseTuple> = {
      linear: [0, 0, 1, 1],
      "ease-in": [0.42, 0, 1, 1],
      "ease-out": [0, 0, 0.58, 1],
      "ease-in-out": [0.42, 0, 0.58, 1],
    };
    return map[e] ?? [0, 0, 1, 1];
  }
  return e;
}

const PixelReveal: React.FC<PixelRevealProps> = ({
  play,
  onComplete,
  durationMs = 900,
  cols = 28,
  easing = "ease-out",
  zIndex = 60,
}) => {
  const [mounted, setMounted] = useState(false);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  const seedRef = useRef(() => Math.random());
  const rng = useMemo(() => mulberry32(Math.floor(seedRef.current() * 1e9)), []);
  const maskId = useMemo(() => `pxmask-${Math.floor(seedRef.current() * 1e9)}`, []);
  const easeResolved = resolveEase(easing);

  useEffect(() => {
    const update = () => {
      setVw(window.innerWidth || 0);
      setVh(window.innerHeight || 0);
    };
    update();
    setMounted(true);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const colsEff = Math.max(6, cols);
  const tileW = vw > 0 ? vw / colsEff : 0;
  const rows = Math.max(6, Math.ceil((vh || 0) / Math.max(tileW, 1)));
  const tileH = vh > 0 ? vh / rows : 0;
  const total = rows * colsEff;

  const delays = useMemo(() => {
    const arr = new Array<number>(total).fill(0);
    const tileAnimSec = 0.35;
    const maxDelaySec = Math.max(0, durationMs / 1000 - tileAnimSec);
    const rowDelay = rows > 1 ? maxDelaySec / (rows - 1) : 0;

    for (let i = 0; i < total; i++) {
      const c = i % colsEff;
      const r = Math.floor(i / colsEff);

      const jitter = rowDelay * 0.2 * rng();
      const colWave = (rowDelay * 0.08) * (c / Math.max(1, colsEff - 1));

      arr[i] = r * rowDelay + jitter + colWave;
    }
    return arr;
  }, [total, rows, colsEff, durationMs, rng]);

  useEffect(() => {
    if (!play) return;
    const doneIn = durationMs + 400;
    const t = setTimeout(() => onComplete?.(), doneIn);
    return () => clearTimeout(t);
  }, [play, durationMs, onComplete]);

  if (!mounted || !play) return null;

  const LIME = "rgb(132, 204, 22)";

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex }} aria-hidden>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${vw} ${vh}`}>
        <defs>
          <mask id={maskId} x="0" y="0" width={vw} height={vh} maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {Array.from({ length: total }, (_, i) => {
              const c = i % colsEff;
              const r = Math.floor(i / colsEff);
              const x = Math.floor(c * tileW);
              const y = Math.floor(r * tileH);
              const w = Math.ceil(tileW) + 1;
              const h = Math.ceil(tileH) + 1;

              return (
                <motion.rect
                  key={`m-${i}`}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="black"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: delays[i],
                    duration: 0.35,
                    ease: easeResolved,
                  }}
                />
              );
            })}
          </mask>
        </defs>

        {Array.from({ length: total }, (_, i) => {
          const c = i % colsEff;
          const r = Math.floor(i / colsEff);
          const x = Math.floor(c * tileW);
          const y = Math.floor(r * tileH);
          const w = Math.ceil(tileW) + 1;
          const h = Math.ceil(tileH) + 1;

          return (
            <motion.rect
              key={`fx-${i}`}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={LIME}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.85, 0] }}
              transition={{
                delay: delays[i],
                duration: 0.55,
                ease: resolveEase("ease-out"),
                times: [0, 0.35, 1],
              }}
              shapeRendering="crispEdges"
            />
          );
        })}

        <motion.rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="black"
          mask={`url(#${maskId})`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0.98 }}
          transition={{ duration: 0.2 }}
          shapeRendering="crispEdges"
        />
      </svg>
    </div>
  );
};

export default PixelReveal;
