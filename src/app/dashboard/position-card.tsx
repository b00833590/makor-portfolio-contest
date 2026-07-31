"use client";

import { useActionState, useState } from "react";
import { increasePosition, sellPartial, sellFull, type TradeFormState } from "./actions";
import type { PositionView } from "@/lib/trading/portfolio-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AssetLogo } from "./asset-logo";

const initialState: TradeFormState = {};
const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function PerformanceBadge({ pct }: { pct: number }) {
  return (
    <Badge
      variant="outline"
      className={pct >= 0 ? "border-gain/30 bg-gain/10 text-gain" : "border-loss/30 bg-loss/10 text-loss"}
    >
      {signed(pct)}
    </Badge>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${className ?? ""}`}>{value}</span>
    </div>
  );
}

export function PositionCard({ position }: { position: PositionView }) {
  const [mode, setMode] = useState<"idle" | "increase" | "sell">("idle");

  const [increaseState, increaseFormAction, increasePending] = useActionState(increasePosition, initialState);
  const [sellState, sellFormAction, sellPending] = useActionState(sellPartial, initialState);
  const sellFullAction = sellFull.bind(null, position.assetId);
  const [sellFullState, sellFullFormAction, sellFullPending] = useActionState(sellFullAction, initialState);

  const isPositive = position.pnl >= 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <AssetLogo symbol={position.symbol} logoUrl={position.logoUrl} className="size-9" />
          <div>
            <CardTitle>
              {position.symbol} <span className="text-sm font-normal text-muted-foreground">{position.name}</span>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {position.quantity.toFixed(4)} unités · {position.allocationPct.toFixed(1)}% du portefeuille
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold tabular-nums ${isPositive ? "text-gain" : "text-loss"}`}>
            {currencyFormatter.format(position.actualValue)}
          </p>
          <div className="mt-1 flex items-center justify-end gap-2">
            {position.dailyChangePct !== null && (
              <span className={`text-xs tabular-nums ${position.dailyChangePct >= 0 ? "text-gain" : "text-loss"}`}>
                {signed(position.dailyChangePct)} 24h
              </span>
            )}
            <PerformanceBadge pct={position.pnlPct} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-4">
          <Stat label="Prix moyen" value={currencyFormatter.format(position.avgEntryPrice)} />
          <Stat label="Prix actuel" value={currencyFormatter.format(position.currentPrice)} />
          <Stat label="Valeur d'entrée" value={currencyFormatter.format(position.entryValue)} />
          <Stat
            label="Plus/moins-value"
            value={`${isPositive ? "+" : ""}${currencyFormatter.format(position.pnl)}`}
            className={isPositive ? "text-gain" : "text-loss"}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode(mode === "increase" ? "idle" : "increase")}>
            Renforcer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode(mode === "sell" ? "idle" : "sell")}>
            Vendre une partie
          </Button>
          <form action={sellFullFormAction}>
            <Button type="submit" variant="destructive" size="sm" disabled={sellFullPending}>
              Vendre tout
            </Button>
          </form>
        </div>

        {mode === "increase" && (
          <form action={increaseFormAction} className="flex items-end gap-2">
            <input type="hidden" name="assetId" value={position.assetId} />
            <Input name="amount" type="number" placeholder="Montant (€)" required className="w-40" />
            <Button type="submit" size="sm" disabled={increasePending}>
              Confirmer
            </Button>
          </form>
        )}
        {mode === "sell" && (
          <form action={sellFormAction} className="flex items-end gap-2">
            <input type="hidden" name="assetId" value={position.assetId} />
            <Input name="quantity" type="number" step="any" placeholder="Quantité" required className="w-40" />
            <Button type="submit" size="sm" disabled={sellPending}>
              Confirmer
            </Button>
          </form>
        )}

        {(increaseState.error || sellState.error || sellFullState.error) && (
          <p className="text-sm text-destructive">
            {increaseState.error ?? sellState.error ?? sellFullState.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
