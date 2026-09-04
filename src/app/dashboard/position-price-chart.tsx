"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getPositionPriceHistory } from "./position-price-history-actions";
import { formatUnitPrice } from "@/lib/format-price";
import type { PriceHistoryPeriod } from "@/lib/prices/get-asset-price-history";

const PERIODS: { value: PriceHistoryPeriod; label: string }[] = [
  { value: "1D", label: "1 jour" },
  { value: "1W", label: "1 semaine" },
  { value: "1M", label: "1 mois" },
  { value: "SINCE_PURCHASE", label: "Depuis l'achat" },
];

function formatLabel(period: PriceHistoryPeriod, timestamp: Date): string {
  if (period === "1D") return timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (period === "1W") return timestamp.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit" });
  return timestamp.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

interface ChartPoint {
  timestamp: number;
  label: string;
  price: number;
  volume?: number;
}

const chartConfig = {
  price: { label: "Cours", color: "var(--color-line)" },
} satisfies ChartConfig;

export function PositionPriceChart({
  assetId,
  symbol,
  avgEntryPrice,
  currentPrice,
  openedAt,
  isOpen,
}: {
  assetId: string;
  symbol: string;
  avgEntryPrice: number;
  currentPrice: number;
  openedAt: string;
  isOpen: boolean;
}) {
  const [period, setPeriod] = useState<PriceHistoryPeriod>("SINCE_PURCHASE");
  const requestKey = `${assetId}:${period}`;
  const [loaded, setLoaded] = useState<{ key: string; points: ChartPoint[] } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    getPositionPriceHistory(assetId, period, openedAt).then((result) => {
      if (cancelled) return;
      const points = result.points.map((point) => {
        const timestamp = new Date(point.timestamp);
        return { timestamp: timestamp.getTime(), label: formatLabel(period, timestamp), price: point.price, volume: point.volume };
      });
      setLoaded({ key: requestKey, points });
    });

    return () => {
      cancelled = true;
    };
  }, [assetId, period, openedAt, isOpen, requestKey]);

  const isLoading = loaded?.key !== requestKey;
  const points = isLoading ? null : loaded!.points;
  const hasVolume = useMemo(() => (points ?? []).some((point) => point.volume !== undefined), [points]);
  const isPositive = currentPrice >= avgEntryPrice;
  const gainPct = avgEntryPrice > 0 ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100 : 0;
  const lineColor = isPositive ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={period} onValueChange={(value) => setPeriod(value as PriceHistoryPeriod)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Badge
          variant="outline"
          className={isPositive ? "border-gain/30 bg-gain/10 text-gain" : "border-loss/30 bg-loss/10 text-loss"}
        >
          {gainPct >= 0 ? "+" : ""}
          {gainPct.toFixed(1)}% depuis l&apos;achat
        </Badge>
      </div>

      {isLoading || !points ? (
        <p className="text-sm text-muted-foreground">Chargement du cours de {symbol}…</p>
      ) : points.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Pas assez de données de cours disponibles pour {symbol} sur cette période.
        </p>
      ) : (
        <ChartContainer config={chartConfig} className="h-72 w-full" style={{ "--color-line": lineColor } as React.CSSProperties}>
          <ComposedChart data={points} margin={{ left: 12, right: 12, top: 12 }}>
            <defs>
              <linearGradient id="positionPriceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
            <YAxis
              yAxisId="price"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={64}
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => formatUnitPrice(value)}
            />
            {hasVolume && <YAxis yAxisId="volume" orientation="right" hide domain={[0, (max: number) => max * 4]} />}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{name === "price" ? "Cours" : "Volume"}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {name === "price" ? formatUnitPrice(Number(value)) : Number(value).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {hasVolume && <Bar yAxisId="volume" dataKey="volume" fill="var(--muted-foreground)" opacity={0.15} />}
            <ReferenceLine
              yAxisId="price"
              y={avgEntryPrice}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{ value: "Achat", position: "insideBottomLeft", fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <ReferenceLine
              yAxisId="price"
              y={currentPrice}
              stroke={lineColor}
              strokeDasharray="4 4"
              label={{ value: "Actuel", position: "insideTopLeft", fill: lineColor, fontSize: 11 }}
            />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              fill="url(#positionPriceGradient)"
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </div>
  );
}
