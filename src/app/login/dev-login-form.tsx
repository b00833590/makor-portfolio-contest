"use client";

import { useActionState } from "react";
import { devLogin, type DevLoginFormState } from "./dev-login-actions";
import { Button } from "@/components/ui/button";

const initialState: DevLoginFormState = {};

interface DemoAccount {
  email: string;
  name: string | null;
  role: string;
}

function DevLoginButton({ account }: { account: DemoAccount }) {
  const [state, formAction, pending] = useActionState(devLogin, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={account.email} />
      <Button type="submit" variant="outline" className="w-full justify-between" disabled={pending}>
        <span>{account.name ?? account.email}</span>
        <span className="text-xs text-muted-foreground">{account.role}</span>
      </Button>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function DevLoginSection({ accounts }: { accounts: DemoAccount[] }) {
  if (accounts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucun compte de démonstration — lancez <code>npm run db:seed</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {accounts.map((account) => (
        <DevLoginButton key={account.email} account={account} />
      ))}
    </div>
  );
}
