/**
 * Sparkline — minimal inline trend indicator (no axes/legend/tooltip), for
 * compact spots like a detail-page stat card where the full Recharts-based
 * analytics-charts.tsx components would be too heavy. Pure SVG, no chart lib.
 */

interface SparklinePoint {
  label: string;
  value: number;
}

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
}

export function Sparkline({ data, width = 160, height = 40, className = "", strokeClassName = "stroke-blue-500 dark:stroke-blue-400" }: SparklineProps) {
  if (data.length === 0) {
    return <div className={`flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 ${className}`} style={{ width, height }} />;
  }

  const values = data.map((point) => point.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padding = 4;

  const points = data
    .map((point, index) => {
      const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`Trend over ${data.length} periods`}>
      <polyline points={points} fill="none" strokeWidth={2} className={strokeClassName} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
