import { useEffect, useState } from "react";

/**
 * Two-layer crossfade + Ken Burns rotating background — React port of
 * docs/HERO_ROTATING_BACKGROUND_SPEC.md (originally a vanilla-JS/DOM pattern).
 * Same contract: two background layers, only the active one runs the zoom
 * keyframe, next slide is swapped in on the *inactive* layer then crossfaded
 * in via opacity so there's no blink. Respects prefers-reduced-motion by
 * falling back to a plain timed swap with no zoom.
 */

const SLIDES = [
  "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=60",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1470&q=60",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-1.2.1&auto=format&fit=crop&w=1470&q=60",
  "https://images.unsplash.com/photo-1532012197267-da84d127e765?ixlib=rb-1.2.1&auto=format&fit=crop&w=1470&q=60",
];

const ROTATE_MS = 6000; // reduced-motion timer interval
const CYCLE_MS = 14000; // must match the Ken Burns keyframe duration below

interface HeroRotatingBackgroundProps {
  className?: string;
}

export function HeroRotatingBackground({ className = "" }: HeroRotatingBackgroundProps) {
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(0); // which layer (0 or 1) is on top
  const [prefersReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const interval = setInterval(
      () => {
        setIndex((prev) => (prev + 1) % SLIDES.length);
        setActive((prev) => 1 - prev);
      },
      prefersReducedMotion ? ROTATE_MS : CYCLE_MS, // reduced-motion: no Ken Burns, simple timed crossfade only
    );
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  // `active`/`index` state fully determines each layer's image on every
  // render, so both layers (current + the preloaded upcoming one) can be
  // computed directly here instead of persisted in a mutable ref.
  const nextIndex = (index + 1) % SLIDES.length;
  const layerImages: [string, string] = active === 0 ? [SLIDES[index]!, SLIDES[nextIndex]!] : [SLIDES[nextIndex]!, SLIDES[index]!];

  return (
    <div className={`hero-rotating-bg ${className}`} aria-hidden="true">
      {[0, 1].map((layer) => (
        <div key={layer} className={`hero-rotating-bg__layer ${active === layer ? "hero-rotating-bg__layer--active" : ""}`} style={{ backgroundImage: `url("${layerImages[layer as 0 | 1]}")` }} />
      ))}
    </div>
  );
}
