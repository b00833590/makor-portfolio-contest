import Link from "next/link";
import { Button } from "@/components/ui/button";

const proofPoints = [
  { label: "Capital de départ", value: "1 000 000 €" },
  { label: "Classement", value: "Temps réel" },
  { label: "Univers", value: "Actions · Crypto" },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
      />
      <div className="relative flex flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-gain" />
          Concours en cours
        </span>
        <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-balance">
          Concours de portefeuille <span className="text-primary">Makor</span>
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Investissez 1 000 000 € fictifs, affrontez votre promotion, suivez le classement en
          temps réel.
        </p>
        <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="mt-8">
          Accéder à la plateforme
        </Button>

        <dl className="mt-14 grid grid-cols-3 gap-8 border-t border-border pt-8">
          {proofPoints.map((point) => (
            <div key={point.label}>
              <dt className="text-xs text-muted-foreground">{point.label}</dt>
              <dd className="mt-1 text-sm font-semibold">{point.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
