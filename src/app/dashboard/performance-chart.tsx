"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PerformancePoint } from "@/lib/trading/performance-history";

const chartConfig = {
  totalValue: {
    label: "Valeur du portefeuille",
    color: "var(--color-line)",
  },
} satisfies ChartConfig;

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        L&apos;historique de performance apparaîtra ici après quelques jours de suivi.
      </p>
    );
  }

  const isPositive = (data.at(-1)?.cumulativeReturnPct ?? 0) >= 0;
  const lineColor = isPositive ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <ChartContainer
      config={chartConfig}
      className="h-64 w-full"
      style={{ "--color-line": lineColor } as React.CSSProperties}
    >
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 12 }}>
        <defs>
          <linearGradient id="portfolioValueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k€`}
          width={56}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="totalValue"
          stroke={lineColor}
          strokeWidth={2}
          fill="url(#portfolioValueGradient)"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
