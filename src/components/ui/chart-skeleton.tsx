/**
 * ChartSkeleton — Suspense fallback for the lazy-loaded Recharts-based chart
 * components (recharts/d3 is a large dependency, split into its own chunk;
 * this fills the exact chart footprint (300px, matching each chart's
 * ResponsiveContainer height) so there's no layout shift while it loads.
 */
import { Card } from "./card";

export function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <div className="h-[300px] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    </Card>
  );
}
