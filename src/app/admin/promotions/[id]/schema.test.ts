import { describe, it, expect } from "vitest";
import { updateRulesTextSchema } from "./schema";

describe("updateRulesTextSchema", () => {
  it("accepts both fields empty", () => {
    const result = updateRulesTextSchema.safeParse({ rulesIntro: "", rulesCustomNotes: "" });
    expect(result.success).toBe(true);
  });

  it("accepts both fields filled and trims whitespace", () => {
    const result = updateRulesTextSchema.safeParse({
      rulesIntro: "  Bienvenue !  ",
      rulesCustomNotes: "  Note spécifique.  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rulesIntro).toBe("Bienvenue !");
      expect(result.data.rulesCustomNotes).toBe("Note spécifique.");
    }
  });

  it("rejects a text longer than the maximum allowed length", () => {
    const result = updateRulesTextSchema.safeParse({ rulesIntro: "a".repeat(10_001) });
    expect(result.success).toBe(false);
  });
});
