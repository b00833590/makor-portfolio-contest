import { describe, it, expect } from "vitest";
import { performanceBadges } from "./performance";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = performanceBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("PREMIER_ENVOL", () => {
  it("attribué à +3%", () => expect(ev("PREMIER_ENVOL")(baseContext({ cumulativeReturnPct: 3 }))).toBe(true));
  it("pas attribué à +2.9%", () => expect(ev("PREMIER_ENVOL")(baseContext({ cumulativeReturnPct: 2.9 }))).toBe(false));
});

describe("DANS_LE_VERT", () => {
  it("attribué à +8%", () => expect(ev("DANS_LE_VERT")(baseContext({ cumulativeReturnPct: 8 }))).toBe(true));
  it("pas attribué à +7.9%", () => expect(ev("DANS_LE_VERT")(baseContext({ cumulativeReturnPct: 7.9 }))).toBe(false));
});

describe("SURPERFORMANCE", () => {
  it("attribué à +18%", () => expect(ev("SURPERFORMANCE")(baseContext({ cumulativeReturnPct: 18 }))).toBe(true));
  it("pas attribué à +17%", () => expect(ev("SURPERFORMANCE")(baseContext({ cumulativeReturnPct: 17 }))).toBe(false));
});

describe("AUTRE_GALAXIE", () => {
  it("attribué à +28%", () => expect(ev("AUTRE_GALAXIE")(baseContext({ cumulativeReturnPct: 28 }))).toBe(true));
  it("pas attribué à +27%", () => expect(ev("AUTRE_GALAXIE")(baseContext({ cumulativeReturnPct: 27 }))).toBe(false));
});

describe("ALPHA", () => {
  it("attribué si +12 pts au-dessus de la moyenne (min 3 participants)", () =>
    expect(ev("ALPHA")(baseContext({ cumulativeReturnPct: 15, fieldAverageReturnPct: 3, participantCount: 3 }))).toBe(true));
  it("pas attribué sous +12 pts d'écart", () =>
    expect(ev("ALPHA")(baseContext({ cumulativeReturnPct: 14, fieldAverageReturnPct: 3, participantCount: 3 }))).toBe(false));
  it("pas attribué à moins de 3 participants", () =>
    expect(ev("ALPHA")(baseContext({ cumulativeReturnPct: 20, fieldAverageReturnPct: 3, participantCount: 2 }))).toBe(false));
});
