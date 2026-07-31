import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Concours de portefeuille Makor
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Investissez 1 000 000 € fictifs, affrontez votre promotion, suivez le classement en
          temps réel.
        </p>
        <Button render={<Link href="/login" />} className="mt-8">
          Accéder à la plateforme
        </Button>
      </div>
    </div>
  );
}
