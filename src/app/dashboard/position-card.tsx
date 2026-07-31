"use client";

import { useActionState, useState } from "react";
import { increasePosition, sellPartial, sellFull, type TradeFormState } from "./actions";
import type { PositionView } from "@/lib/trading/portfolio-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: TradeFormState = {};
const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function PositionCard({ position }: { position: PositionView }) {
  const [mode, setMode] = useState<"idle" | "increase" | "sell">("idle");

  const increaseAction = increasePosition;
  const [increaseState, increaseFormAction, increasePending] = useActionState(increaseAction, initialState);

  const sellPartialAction = sellPartial;
  const [sellState, sellFormAction, sellPending] = useActionState(sellPartialAction, initialState);

  const sellFullAction = sellFull.bind(null, position.assetId);
  const [sellFullState, sellFullFormAction, sellFullPending] = useActionState(sellFullAction, initialState);

  const isPositive = position.pnl >= 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>
            {position.symbol} <span className="text-sm font-normal text-muted-foreground">{position.name}</span>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {position.quantity.toFixed(4)} unités · prix moyen {currencyFormatter.format(position.avgEntryPrice)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium">{currencyFormatter.format(position.marketValue)}</p>
          <Badge variant={isPositive ? "default" : "destructive"}>
            {isPositive ? "+" : ""}
            {position.pnlPct.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
