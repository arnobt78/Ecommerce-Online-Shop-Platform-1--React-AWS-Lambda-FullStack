/**
 * ProductReel — smooth, continuous "ticker-tape" row of ProductCards, looping
 * forever (TV-lower-third style), with manual left/right nudge buttons. Auto-
 * drift pauses on hover so the user can read/click a card, and resumes on
 * mouse-leave from wherever it left off.
 *
 * Implementation notes:
 * - The product list is rendered twice back-to-back. Once the reel has
 *   drifted exactly one copy's width, the offset wraps back to 0 — since
 *   copy two is pixel-identical to copy one, the wrap is invisible and the
 *   loop reads as infinite.
 * - Position is driven by a single requestAnimationFrame loop writing a CSS
 *   `transform` directly to the track element (no React state per frame),
 *   which is what makes the drift perfectly smooth instead of the old
 *   discrete "scroll a chunk, wait, scroll again" jump. Manual chevrons and
 *   the auto-drift both just adjust the same offset, so they never fight.
 */

import { useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { ProductCard } from "../Elements/ProductCard";
import type { Product } from "../../types";

interface ProductReelProps {
  products: Product[];
  /** Drift speed in pixels/second — kept slow for a readable, ambient ticker. */
  speed?: number;
  /** Pixels to jump per manual chevron click. */
  nudgeAmount?: number;
}

export const ProductReel = ({ products, speed = 32, nudgeAmount = 320 }: ProductReelProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const secondCopyStartRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const halfWidthRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const prefersReducedMotion = useReducedMotion();

  // Measure where the duplicate copy begins — that x position is exactly one
  // full loop, i.e. where the offset should wrap back to 0.
  useEffect(() => {
    const measure = () => {
      halfWidthRef.current = secondCopyStartRef.current?.offsetLeft || 0;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [products]);

  // Normalizes any offset into (-halfWidth, 0] so the visible window always
  // falls inside the duplicated track, regardless of drift or manual nudges.
  const wrap = useCallback((x: number) => {
    const half = halfWidthRef.current;
    if (half <= 0) return x;
    let wrapped = x % half;
    if (wrapped > 0) wrapped -= half;
    return wrapped;
  }, []);

  const applyTransform = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || products.length === 0) return;

    const step = (time: number) => {
      if (lastTimeRef.current === undefined) lastTimeRef.current = time;
      const deltaSeconds = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (!pausedRef.current) {
        offsetRef.current = wrap(offsetRef.current - speed * deltaSeconds);
        applyTransform();
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = undefined;
    };
  }, [prefersReducedMotion, products.length, speed, wrap, applyTransform]);

  const nudge = useCallback(
    (direction: 1 | -1) => {
      offsetRef.current = wrap(offsetRef.current - direction * nudgeAmount);
      applyTransform();
    },
    [wrap, applyTransform, nudgeAmount]
  );

  if (products.length === 0) return null;

  return (
    <div
      className="group/reel relative overflow-hidden"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => nudge(-1)}
        className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700 opacity-0 shadow-md transition-opacity group-hover/reel:opacity-100 hover:bg-white dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => nudge(1)}
        className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700 opacity-0 shadow-md transition-opacity group-hover/reel:opacity-100 hover:bg-white dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </button>

      <div ref={trackRef} className="flex gap-2 pb-2 will-change-transform">
        {products.map((product) => (
          <div key={`a-${product.id}`} className="shrink-0">
            <ProductCard product={product} />
          </div>
        ))}
        {/* Duplicate copy for the seamless loop — hidden from assistive tech
            since it's a visual repeat of the row above, not new content. */}
        {products.map((product, index) => (
          <div key={`b-${product.id}`} ref={index === 0 ? secondCopyStartRef : undefined} className="shrink-0" aria-hidden="true">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
};
