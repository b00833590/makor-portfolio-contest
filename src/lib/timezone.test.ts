import { describe, it, expect } from "vitest";
import { parseParisDateTimeLocal } from "./timezone";

describe("parseParisDateTimeLocal", () => {
  it("interprets a summer (CEST, UTC+2) datetime-local value as Paris time", () => {
    // 31/07/2026 21:38 heure de Paris (été, UTC+2) == 19:38 UTC
    const result = parseParisDateTimeLocal("2026-07-31T21:38");
    expect(result.toISOString()).toBe("2026-07-31T19:38:00.000Z");
  });

  it("interprets a winter (CET, UTC+1) datetime-local value as Paris time", () => {
    // 15/01/2026 10:00 heure de Paris (hiver, UTC+1) == 09:00 UTC
    const result = parseParisDateTimeLocal("2026-01-15T10:00");
    expect(result.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("handles values that already include seconds", () => {
    const result = parseParisDateTimeLocal("2026-07-31T21:38:15");
    expect(result.toISOString()).toBe("2026-07-31T19:38:15.000Z");
  });
});
