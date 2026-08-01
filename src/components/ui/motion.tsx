/**
 * Reusable Framer Motion primitives — ported from docs/PARALLAX_SCROLL_REVEAL_SYSTEM.md.
 * One shared reveal system so every animated page/section uses the same
 * duration/ease/distance tokens instead of ad-hoc per-component tuning.
 */

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.64, 0, 0.78, 0] as const;

export type RevealDirection = "left" | "right" | "top" | "bottom";

// Fade/translate/blur reveal variants for a single element, direction-aware.
export function revealVariants(direction: RevealDirection = "bottom", distance = 24): Variants {
  const axis =
    direction === "left"
      ? { x: -distance, y: 0 }
      : direction === "right"
        ? { x: distance, y: 0 }
        : direction === "bottom"
          ? { x: 0, y: distance }
          : { x: 0, y: 0 };

  return {
    hidden: { opacity: 0, ...axis, scale: 0.985 },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.55, ease: EASE_OUT },
    },
    exit: {
      opacity: 0,
      ...axis,
      scale: 0.99,
      transition: { duration: 0.28, ease: EASE_IN },
    },
  };
}

interface ScrollRevealProps {
  children?: ReactNode;
  direction?: RevealDirection;
  distance?: number;
  once?: boolean;
  delay?: number;
  className?: string;
}

/**
 * Wraps children in a fade/translate reveal that plays once the element
 * scrolls into view (or immediately, for above-the-fold content via `once`).
 */
export function ScrollReveal({
  children,
  direction = "bottom",
  distance = 24,
  once = true,
  delay = 0,
  className = "",
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={revealVariants(direction, distance)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.3, margin: "0px 0px -10% 0px" }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

// Parent/child variants for one-by-one stagger reveal of lists, form fields, cards, etc.
export const staggerParent: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT },
  },
};

interface StaggerContainerProps {
  children?: ReactNode;
  className?: string;
  once?: boolean;
}

/**
 * Drop-in stagger wrapper — renders `motion.div` with staggerParent/Child
 * already wired. Wrap the parent, apply `StaggerItem` (or motion.* with
 * `variants={staggerChild}`) to each child.
 */
export function StaggerContainer({ children, className = "", once = true }: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children?: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className = "" }: StaggerItemProps) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}
