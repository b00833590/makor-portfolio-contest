import { describe, it, expect } from "vitest";
import { specialEventBadges } from "./special-event";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = specialEventBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("specialEventBadges", () => {
  it("contient 4 badges SPECIAL_EVENT", () => {
    expect(specialEventBadges).toHaveLength(4);
    expect(specialEventBadges.every((b) => b.category === "SPECIAL_EVENT")).toBe(true);
  });
  it("STRATEGE_ASSIDU est close-only (pas de evaluate)", () => {
    expect(specialEventBadges.find((b) => b.code === "STRATEGE_ASSIDU")?.evaluate).toBeUndefined();
  });
});

describe("LEVE_TOT", () => {
  it("condition individuelle : portefeuille complet", () =>
    expect(ev("LEVE_TOT")(baseContext({ openPositionCount: 20, maxPositions: 20 }))).toBe(true));
  it("pas rempli si portefeuille incomplet", () =>
    expect(ev("LEVE_TOT")(baseContext({ openPositionCount: 19, maxPositions: 20 }))).toBe(false));
});

describe("ZEN", () => {
  it("attribué si une semaine avec fenêtre a 0 changement", () =>
    expect(ev("ZEN")(baseContext({ weeklyChangeWindows: [{ hadWindow: true, changesUsed: 0 }] }))).toBe(true));
  it("pas attribué si tous les changements ont été utilisés", () =>
    expect(ev("ZEN")(baseContext({ weeklyChangeWindows: [{ hadWindow: true, changesUsed: 2 }] }))).toBe(false));
});

describe("HABITUE", () => {
  it("attribué à 10 jours de série (courante)", () =>
    expect(ev("HABITUE")(baseContext({ currentStreakDays: 10 }))).toBe(true));
  it("attribué à 10 jours de série (record)", () =>
    expect(ev("HABITUE")(baseContext({ currentStreakDays: 3, longestStreakDays: 10 }))).toBe(true));
  it("pas attribué à 9", () =>
    expect(ev("HABITUE")(baseContext({ currentStreakDays: 9, longestStreakDays: 9 }))).toBe(false));
});
