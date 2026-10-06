"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

/** Fades its children up from a blur the first time they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  immediate = false,
  className,
}: {
  children: React.ReactNode;
  /** Stagger offset in ms. */
  delay?: number;
  /** Play on first paint instead of waiting for hydration and scroll, for content above the fold. */
  immediate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    const el = ref.current;
    if (immediate || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <div ref={ref} className={clsx("reveal", visible && "is-visible", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
