"use client";

import { useMemo, useState } from "react";
import { Brush, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { deriveMetricSeries, PERFORMANCE_METRIC_LABELS, type PerformanceMetric } from "@/lib/gamification/derive-metric-series";
import type { PromotionPerformancePoint } from "@/lib/gamification/get-promotion-performance-series";

const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
const METRICS: PerformanceMetric[] = ["cumulativeReturnPct", "totalValue", "gainEur", "dailyReturnPct", "rank"];

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function formatValue(metric: PerformanceMetric, value: number): string {
  switch (metric) {
    case "totalValue":
      return currencyFormatter.format(value);
    case "gainEur":
      return `${value >= 0 ? "+" : ""}${currencyFormatter.format(value)}`;
    case "cumulativeReturnPct":
    case "dailyReturnPct":
      return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "rank":
      return `#${value}`;
  }
}

export function PromotionPerformanceChart({
  points,
  participantNames,
  initialCapital,
}: {
  points: PromotionPerformancePoint[];
  participantNames: string[];
  initialCapital: number;
}) {
  const [metric, setMetric] = useState<PerformanceMetric>("cumulativeReturnPct");
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(new Set());
  const [brushRange, setBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({});

  const data = useMemo(() => deriveMetricSeries(points, metric, initialCapital), [points, metric, initialCapital]);

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

  const isZoomed = brushRange.startIndex !== undefined || brushRange.endIndex !== undefined;

  function toggleName(name: string) {
    setHiddenNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={metric} onValueChange={(value) => setMetric(value as PerformanceMetric)}>
          <TabsList>
            {METRICS.map((m) => (
              <TabsTrigger key={m} value={m}>
                {PERFORMANCE_METRIC_LABELS[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {isZoomed && (
          <Button variant="outline" size="sm" onClick={() => setBrushRange({})}>
            Réinitialiser le zoom
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {participantNames.map((name, index) => {
          const isHidden = hiddenNames.has(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleName(name)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                isHidden ? "border-border text-muted-foreground opacity-50" : "border-border text-foreground"
              }`}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: isHidden ? "var(--muted-foreground)" : CHART_COLORS[index % CHART_COLORS.length] }}
              />
              {name}
            </button>
          );
        })}
      </div>

      <ChartContainer config={chartConfig} className="h-80 w-full">
        <LineChart data={data} margin={{ left: 12, right: 12, top: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            reversed={metric === "rank"}
            allowDecimals={metric !== "rank"}
            tickFormatter={(value: number) => formatValue(metric, value)}
            width={metric === "totalValue" || metric === "gainEur" ? 72 : 48}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatValue(metric, Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          {participantNames
            .filter((name) => !hiddenNames.has(name))
            .map((name) => {
              const index = participantNames.indexOf(name);
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              );
            })}
          <Brush
            dataKey="label"
            height={24}
            stroke="var(--border)"
            travellerWidth={8}
            startIndex={brushRange.startIndex}
            endIndex={brushRange.endIndex}
            onChange={(range) => setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex })}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
