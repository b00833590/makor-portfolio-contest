import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatParisDateTime } from "@/lib/timezone";
import type { TransactionHistoryItem } from "@/lib/trading/transaction-history";

const typeLabels: Record<TransactionHistoryItem["type"], string> = {
  BUY: "Achat",
  INCREASE: "Renforcement",
  SELL_PARTIAL: "Vente partielle",
  SELL_FULL: "Vente totale",
  DECREASE: "Diminution",
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function TransactionHistoryTable({ transactions }: { transactions: TransactionHistoryItem[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune transaction pour le moment.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:hidden">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant={transaction.type.startsWith("SELL") ? "destructive" : "default"}>
                  {typeLabels[transaction.type]}
                </Badge>
                <span className="min-w-0 truncate font-medium">{transaction.symbol}</span>
              </div>
              <span className="shrink-0 font-medium tabular-nums">{currencyFormatter.format(transaction.amount)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{formatParisDateTime(transaction.createdAt)}</span>
              <span className="tabular-nums">
                {transaction.quantity.toFixed(4)} × {currencyFormatter.format(transaction.price)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead>Quantité</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatParisDateTime(transaction.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={transaction.type.startsWith("SELL") ? "destructive" : "default"}>
                    {typeLabels[transaction.type]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{transaction.symbol}</TableCell>
                <TableCell>{transaction.quantity.toFixed(4)}</TableCell>
                <TableCell>{currencyFormatter.format(transaction.price)}</TableCell>
                <TableCell className="text-right">{currencyFormatter.format(transaction.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
