"use client";

import { useEffect, useState } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  dur: number;
  min: number;
  max: number;
}

/**
 * Purely decorative ambient background. Generated client-side after mount
 * (not during render) so server and client HTML match on first paint —
 * Math.random() during SSR would otherwise cause a hydration mismatch.
 */
export default function Starfield() {
  const [stars, setStars] = useState<Star[] | null>(null);

  useEffect(() => {
    const count = 70;
    const generated: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() < 0.85 ? 1 : 2,
      dur: 2.5 + Math.random() * 3.5,
      min: 0.1 + Math.random() * 0.2,
      max: 0.5 + Math.random() * 0.5,
    }));
    setStars(generated);
  }, []);

  if (!stars) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {stars.map((s, i) => (
        <div
          key={i}
          className="star absolute rounded-full bg-[#d9e2ec]"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--star-dur" as any]: `${s.dur}s`,
            ["--star-min" as any]: s.min,
            ["--star-max" as any]: s.max,
          }}
        />
      ))}
    </div>
  );
}
