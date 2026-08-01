/**
 * AuthSplitLayout — shared two-column shell for Login/Register.
 * ~60% image panel (brand story + feature bullets) / ~40% form panel,
 * matching this project's existing light/dark card tokens (bg-white
 * dark:bg-gray-800, border-gray-200 dark:border-gray-700, rounded-lg) rather
 * than the separate dark-glassmorphism system used by the admin console.
 * Image panel hides below lg — small screens get the form only, full width.
 */

import type { ReactNode } from "react";
import { ScrollReveal } from "./motion";

interface AuthSplitLayoutProps {
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  bullets: string[];
  children: ReactNode;
}

export function AuthSplitLayout({
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  subtitle,
  bullets,
  children,
}: AuthSplitLayoutProps) {
  return (
    // Width/horizontal padding come from the shared App.tsx page wrapper
    // (mx-auto max-w-9xl px-2 sm:px-4 xl:px-8) — same as Header/Footer, so
    // this card's edges line up with the navbar instead of nesting its own
    // narrower cap inside theirs.
    <main className="py-8 sm:py-12">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 shadow-xl dark:border-gray-700 lg:flex-row lg:min-h-[600px]">
        {/* Image panel — 60% on desktop, hidden below lg */}
        <ScrollReveal
          direction="left"
          className="relative hidden lg:block lg:w-3/5"
        >
          <img
            src={imageSrc}
            alt={imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/5" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white xl:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-medium leading-tight xl:text-4xl">
              {title}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              {subtitle}
            </p>
            <ul className="mt-6 space-y-2">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-center gap-2 text-sm text-white/85"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>

        {/* Form panel — 40% on desktop, full width below lg */}
        <div className="flex w-full items-center justify-center bg-white px-6 py-10 dark:bg-gray-800 sm:px-10 lg:w-2/5 lg:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </main>
  );
}
