"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-zinc-500">
        L&apos;historique de performance apparaîtra ici après quelques jours de suivi.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <LineChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k€`}
          width={56}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="totalValue"
          stroke="var(--color-totalValue)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
