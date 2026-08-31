import { describe, it, expect } from "vitest";
import { riskManagementBadges } from "./risk-management";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = riskManagementBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}
const pos = (marketValue: number, costBasis: number) => ({ marketValue, costBasis });

describe("SANG_FROID", () => {
  it("attribué : 5 positions, aucune sous -5%", () =>
    expect(ev("SANG_FROID")(baseContext({ positions: [pos(96, 100), pos(100, 100), pos(120, 100), pos(101, 100), pos(98, 100)] }))).toBe(true));
  it("pas attribué : une position à -6%", () =>
    expect(ev("SANG_FROID")(baseContext({ positions: [pos(94, 100), pos(100, 100), pos(120, 100), pos(101, 100), pos(98, 100)] }))).toBe(false));
  it("pas attribué : moins de 5 positions", () =>
    expect(ev("SANG_FROID")(baseContext({ positions: [pos(100, 100), pos(100, 100), pos(100, 100), pos(100, 100)] }))).toBe(false));
});

describe("TOUT_AU_VERT", () => {
  it("attribué : 5 positions toutes en gain", () =>
    expect(ev("TOUT_AU_VERT")(baseContext({ positions: [pos(101, 100), pos(102, 100), pos(120, 100), pos(101, 100), pos(150, 100)] }))).toBe(true));
  it("pas attribué : une position à l'équilibre négatif", () =>
    expect(ev("TOUT_AU_VERT")(baseContext({ positions: [pos(99, 100), pos(102, 100), pos(120, 100), pos(101, 100), pos(150, 100)] }))).toBe(false));
});

describe("PIERRE_ANGULAIRE", () => {
  it("attribué si le contexte signale une position ancre", () =>
    expect(ev("PIERRE_ANGULAIRE")(baseContext({ hasAnchorPosition: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("PIERRE_ANGULAIRE")(baseContext({ hasAnchorPosition: false }))).toBe(false));
});
