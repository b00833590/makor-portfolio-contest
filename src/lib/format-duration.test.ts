import { describe, it, expect } from "vitest";
import { formatTimeRemaining } from "./format-duration";

describe("formatTimeRemaining", () => {
  const now = new Date("2026-09-09T12:00:00Z");

  it("says Terminé when the end date is in the past", () => {
    expect(formatTimeRemaining(new Date("2026-09-08T12:00:00Z"), now)).toBe("Terminé");
  });

  it("pluralizes correctly for multiple days", () => {
    expect(formatTimeRemaining(new Date("2026-09-14T12:00:00Z"), now)).toBe("5 jours restants");
  });

  it("uses the singular for exactly one day", () => {
    expect(formatTimeRemaining(new Date("2026-09-10T13:00:00Z"), now)).toBe("1 jour restant");
  });

  it("falls back to hours under one day remaining", () => {
    expect(formatTimeRemaining(new Date("2026-09-09T18:00:00Z"), now)).toBe("6 heures restantes");
  });

  it("never reports zero hours remaining", () => {
    expect(formatTimeRemaining(new Date("2026-09-09T12:30:00Z"), now)).toBe("1 heure restante");
  });
});
