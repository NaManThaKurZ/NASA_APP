"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number counting up from its previous value to `value` whenever
 * `value` changes, over ~500ms. Used for stats that land after a pipeline
 * stage completes (events retrieved, findings count) so numbers feel like
 * they're arriving live rather than just appearing.
 */
export default function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const settled = display === value;

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const duration = 500;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={`${className ?? ""} ${settled ? "" : "value-settle"}`}>{display}</span>;
}
