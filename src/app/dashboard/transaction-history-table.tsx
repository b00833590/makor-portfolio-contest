import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { TransactionHistoryItem } from "@/lib/trading/transaction-history";

const typeLabels: Record<TransactionHistoryItem["type"], string> = {
  BUY: "Achat",
  INCREASE: "Renforcement",
  SELL_PARTIAL: "Vente partielle",
  SELL_FULL: "Vente totale",
  DECREASE: "Diminution",
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export function TransactionHistoryTable({ transactions }: { transactions: TransactionHistoryItem[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-zinc-500">Aucune transaction pour le moment.</p>;
  }

  return (
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
            <TableCell>{dateFormatter.format(transaction.createdAt)}</TableCell>
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
  );
}
