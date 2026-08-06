import { describe, it, expect } from "vitest";
import { specialEventBadges } from "./special-event";
import { baseContext } from "./badge-test-context";

function spec(code: string) {
  const found = specialEventBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("PIONNIER", () => {
  it("est individuellement éligible dès le portefeuille complet (l'exclusivité est vérifiée à l'attribution)", () => {
    expect(spec("PIONNIER")(baseContext({ openPositionCount: 20, maxPositions: 20 }))).toBe(true);
  });
  it("n'est pas éligible avant un portefeuille complet", () => {
    expect(spec("PIONNIER")(baseContext({ openPositionCount: 19, maxPositions: 20 }))).toBe(false);
  });
});

describe("PATIENCE_DE_FER", () => {
  it("est attribué si une semaine close avec fenêtre disponible n'a eu aucun changement", () => {
    const ctx = baseContext({ weeklyChangeWindows: [{ hadWindow: true, changesUsed: 0 }] });
    expect(spec("PATIENCE_DE_FER")(ctx)).toBe(true);
  });
  it("n'est pas attribué si la fenêtre a été utilisée", () => {
    const ctx = baseContext({ weeklyChangeWindows: [{ hadWindow: true, changesUsed: 1 }] });
    expect(spec("PATIENCE_DE_FER")(ctx)).toBe(false);
  });
  it("n'est pas attribué si aucune fenêtre n'était disponible cette semaine-là", () => {
    const ctx = baseContext({ weeklyChangeWindows: [{ hadWindow: false, changesUsed: 0 }] });
    expect(spec("PATIENCE_DE_FER")(ctx)).toBe(false);
  });
});

describe("PERFECTION", () => {
  it("est attribué quand tous les autres badges sont déjà obtenus", () => {
    const ctx = baseContext({
      totalBadgeCount: 33,
      alreadyOwnedCodes: new Set(Array.from({ length: 32 }, (_, i) => `CODE_${i}`)),
    });
    expect(spec("PERFECTION")(ctx)).toBe(true);
  });
  it("n'est pas attribué s'il en manque plus d'un", () => {
    const ctx = baseContext({
      totalBadgeCount: 33,
      alreadyOwnedCodes: new Set(Array.from({ length: 20 }, (_, i) => `CODE_${i}`)),
    });
    expect(spec("PERFECTION")(ctx)).toBe(false);
  });
});
