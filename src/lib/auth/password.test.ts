import { describe, it, expect } from "vitest";
import { generateTempPassword } from "./password";

describe("generateTempPassword", () => {
  it("generates a password of the requested length", () => {
    expect(generateTempPassword(10)).toHaveLength(10);
    expect(generateTempPassword(6)).toHaveLength(6);
  });

  it("never includes visually ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTempPassword(20);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it("generates different passwords across calls", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
