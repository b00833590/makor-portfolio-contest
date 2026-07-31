"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { PromotionPerformancePoint } from "@/lib/gamification/get-promotion-performance-series";

const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

export function PromotionPerformanceChart({
  points,
  participantNames,
}: {
  points: PromotionPerformancePoint[];
  participantNames: string[];
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Le graphique comparatif apparaîtra ici après quelques jours de suivi des participants.
      </p>
    );
  }

  const chartConfig = Object.fromEntries(
    participantNames.map((name, index) => [name, { label: name, color: CHART_COLORS[index % CHART_COLORS.length] }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <LineChart data={points} margin={{ left: 12, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          width={48}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {participantNames.map((name, index) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
