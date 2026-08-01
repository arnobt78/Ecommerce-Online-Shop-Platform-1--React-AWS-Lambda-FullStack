/**
 * AdminMetricsCard Component
 *
 * Reusable KPI card for the admin dashboard/analytics pages — gradient +
 * colored-border card per docs/UI_STYLING_GUIDE.md's "Card Styling" system,
 * adapted from that doc's dark-glassmorphism base to this app's light-first
 * theme (same gradient/border/shadow *recipe*, light-mode-appropriate
 * opacities + dark: overrides instead of white-on-transparent text).
 */

import type { LucideIcon } from "lucide-react";

type MetricsCardColor = "sky" | "emerald" | "amber" | "rose" | "violet" | "blue";

interface MetricsCardBreakdownItem {
  label: string;
  value: string | number;
}

interface AdminMetricsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  color?: MetricsCardColor;
  subtitle?: string;
  breakdown?: MetricsCardBreakdownItem[];
}

const COLOR_VARIANTS: Record<MetricsCardColor, { card: string; icon: string; pill: string }> = {
  sky: {
    card: "border-sky-200 dark:border-sky-800/60 bg-gradient-to-br from-sky-50 via-sky-50/40 to-white dark:from-sky-900/30 dark:via-sky-900/10 dark:to-gray-900 shadow-[0_20px_50px_rgba(2,132,199,0.12)] dark:shadow-[0_20px_50px_rgba(2,132,199,0.25)] hover:border-sky-300 dark:hover:border-sky-700",
    icon: "bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300",
    pill: "bg-sky-100/80 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  },
  emerald: {
    card: "border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 via-emerald-50/40 to-white dark:from-emerald-900/30 dark:via-emerald-900/10 dark:to-gray-900 shadow-[0_20px_50px_rgba(16,185,129,0.12)] dark:shadow-[0_20px_50px_rgba(16,185,129,0.25)] hover:border-emerald-300 dark:hover:border-emerald-700",
    icon: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300",
    pill: "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  },
  amber: {
    card: "border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 via-amber-50/40 to-white dark:from-amber-900/30 dark:via-amber-900/10 dark:to-gray-900 shadow-[0_20px_50px_rgba(245,158,11,0.12)] dark:shadow-[0_20px_50px_rgba(245,158,11,0.25)] hover:border-amber-300 dark:hover:border-amber-700",
    icon: "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300",
    pill: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  },
  rose: {
    card: "border-rose-200 dark:border-rose-800/60 bg-gradient-to-br from-rose-50 via-rose-50/40 to-white dark:from-rose-900/30 dark:via-rose-900/10 dark:to-gray-900 shadow-[0_20px_50px_rgba(225,29,72,0.12)] dark:shadow-[0_20px_50px_rgba(225,29,72,0.25)] hover:border-rose-300 dark:hover:border-rose-700",
    icon: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300",
    pill: "bg-rose-100/80 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  },
  violet: {
    card: "border-violet-200 dark:border-violet-800/60 bg-gradient-to-br from-violet-50 via-violet-50/40 to-white dark:from-violet-900/30 dark:via-violet-900/10 dark:to-gray-900 shadow-[0_20px_50px_rgba(139,92,246,0.12)] dark:shadow-[0_20px_50px_rgba(139,92,246,0.25)] hover:border-violet-300 dark:hover:border-violet-700",
    icon: "bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300",
    pill: "bg-violet-100/80 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  },
  blue: {
    card: "border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 via-blue-50/40 to-white dark:from-blue-900/30 dark:via-blue-900/10 dark:to-gray-900 shadow-[0_20px_50px_rgba(59,130,246,0.12)] dark:shadow-[0_20px_50px_rgba(59,130,246,0.25)] hover:border-blue-300 dark:hover:border-blue-700",
    icon: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300",
    pill: "bg-blue-100/80 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  },
};

export const AdminMetricsCard = ({ title, value, icon: Icon, color = "blue", subtitle, breakdown = [] }: AdminMetricsCardProps) => {
  const variant = COLOR_VARIANTS[color] || COLOR_VARIANTS.blue;

  return (
    <div className={`group rounded-2xl border p-5 sm:p-6 backdrop-blur-sm transition-all ${variant.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-800 dark:text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${variant.icon}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        )}
      </div>

      {breakdown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {breakdown.map((item) => (
            <span key={item.label} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variant.pill}`}>
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
