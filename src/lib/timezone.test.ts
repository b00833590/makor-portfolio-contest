import { describe, it, expect } from "vitest";
import { parseParisDateTimeLocal, toParisDateTimeLocalValue, parisDateTimeLocalSchema } from "./timezone";

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

  it("returns an invalid Date for a string that isn't the exact datetime-local shape", () => {
    expect(Number.isNaN(parseParisDateTimeLocal("not-a-date").getTime())).toBe(true);
    expect(Number.isNaN(parseParisDateTimeLocal("2026/07/31 21:38").getTime())).toBe(true);
    expect(Number.isNaN(parseParisDateTimeLocal("").getTime())).toBe(true);
  });
});

describe("toParisDateTimeLocalValue", () => {
  it("formats a UTC instant as its Paris wall-clock datetime-local value (summer)", () => {
    const value = toParisDateTimeLocalValue(new Date("2026-07-31T19:38:00.000Z"));
    expect(value).toBe("2026-07-31T21:38");
  });

  it("formats a UTC instant as its Paris wall-clock datetime-local value (winter)", () => {
    const value = toParisDateTimeLocalValue(new Date("2026-01-15T09:00:00.000Z"));
    expect(value).toBe("2026-01-15T10:00");
  });

  it("round-trips through parseParisDateTimeLocal", () => {
    const original = "2026-07-31T21:38";
    const roundTripped = toParisDateTimeLocalValue(parseParisDateTimeLocal(original));
    expect(roundTripped).toBe(original);
  });
});

describe("parisDateTimeLocalSchema", () => {
  it("parses a valid datetime-local value into a Date", () => {
    const result = parisDateTimeLocalSchema.safeParse("2026-07-31T21:38");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toISOString()).toBe("2026-07-31T19:38:00.000Z");
    }
  });

  it("rejects a malformed value", () => {
    const result = parisDateTimeLocalSchema.safeParse("not-a-date");
    expect(result.success).toBe(false);
  });
});
