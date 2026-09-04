import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { computeAvailableCash } from "@/lib/trading/execute-order";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { formatUnitPrice } from "@/lib/format-price";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AddTransactionForm } from "./add-transaction-form";
import { TransactionRowActions } from "./transaction-row-actions";
import { recalculateSnapshot } from "./actions";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

const typeLabels: Record<string, string> = {
  BUY: "Achat",
  INCREASE: "Renforcement",
  SELL_PARTIAL: "Vente partielle",
  SELL_FULL: "Vente totale",
  DECREASE: "Diminution",
};

export default async function AdminPortfolioPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;

  const portfolio = await db.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      user: { select: { name: true } },
      promotion: { select: { id: true, name: true, initialCapital: true } },
      positions: {
        where: { quantity: { gt: 0 }, closedAt: null },
        include: { asset: { select: { symbol: true, name: true } } },
      },
    },
  });

  if (!portfolio) {
    notFound();
  }

  const [availableCash, transactions] = await Promise.all([
    computeAvailableCash(portfolioId, Number(portfolio.promotion.initialCapital)),
    getTransactionHistory(portfolioId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/admin/promotions/${portfolio.promotion.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {portfolio.promotion.name}
        </Link>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Portefeuille de {portfolio.user.name}</h2>
          <form action={recalculateSnapshot.bind(null, portfolioId)}>
            <Button type="submit" variant="outline" size="sm">
              Recalculer maintenant
            </Button>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">
          Reconstruit les positions à partir de l&apos;historique des transactions et enregistre un nouvel
          instantané de performance daté d&apos;aujourd&apos;hui (ne réécrit pas l&apos;historique des jours
          passés).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capital disponible</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(availableCash)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Positions ouvertes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{portfolio.positions.length}</CardContent>
        </Card>
      </div>

      {portfolio.positions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {portfolio.positions.map((position) => (
            <Badge key={position.id} variant="secondary">
              {position.asset.symbol} · {Number(position.quantity).toFixed(4)}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ajouter une transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <AddTransactionForm portfolioId={portfolioId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune transaction pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell>{formatUnitPrice(transaction.price)}</TableCell>
                    <TableCell>{currencyFormatter.format(transaction.amount)}</TableCell>
                    <TableCell>
                      <TransactionRowActions
                        portfolioId={portfolioId}
                        transactionId={transaction.id}
                        symbol={transaction.symbol}
                        type={transaction.type}
                        quantity={transaction.quantity}
                        price={transaction.price}
                        createdAt={transaction.createdAt}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
