import { describe, it, expect } from "vitest";
import { addParticipantSchema } from "./schema";

describe("addParticipantSchema", () => {
  it("accepts a valid email and promotion id", () => {
    const result = addParticipantSchema.safeParse({
      email: "stagiaire@makorgroup.com",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = addParticipantSchema.safeParse({
      email: "not-an-email",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing promotion id", () => {
    const result = addParticipantSchema.safeParse({
      email: "stagiaire@makorgroup.com",
      promotionId: "",
    });

    expect(result.success).toBe(false);
  });
});
