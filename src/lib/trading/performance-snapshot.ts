export interface SnapshotPosition {
  quantity: number;
  currentPrice: number;
}

export interface ComputeSnapshotInput {
  availableCash: number;
  positions: SnapshotPosition[];
  initialCapital: number;
  previousSnapshot: { totalValue: number } | null;
}

export interface ComputedSnapshot {
  totalValue: number;
  dailyReturnPct: number;
  cumulativeReturnPct: number;
}

function percentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

export function computeSnapshot(input: ComputeSnapshotInput): ComputedSnapshot {
  const positionsValue = input.positions.reduce(
    (total, position) => total + position.quantity * position.currentPrice,
    0,
  );
  const totalValue = input.availableCash + positionsValue;

  return {
    totalValue,
    cumulativeReturnPct: percentChange(input.initialCapital, totalValue),
    dailyReturnPct: input.previousSnapshot ? percentChange(input.previousSnapshot.totalValue, totalValue) : 0,
  };
}
