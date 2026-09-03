import { describe, it, expect } from "vitest";
import { createParticipantSchema, resetPasswordSchema, addToPromotionSchema } from "./schema";

describe("createParticipantSchema", () => {
  it("accepts a valid name and promotion id", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a name that is too short", () => {
    const result = createParticipantSchema.safeParse({
      name: "A",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing promotion id", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      promotionId: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a valid user id", () => {
    const result = resetPasswordSchema.safeParse({ userId: "user-1" });

    expect(result.success).toBe(true);
  });

  it("rejects a missing user id", () => {
    const result = resetPasswordSchema.safeParse({ userId: "" });

    expect(result.success).toBe(false);
  });
});

describe("addToPromotionSchema", () => {
  it("accepte un userId et un promotionId valides", () => {
    const result = addToPromotionSchema.safeParse({ userId: "user-1", promotionId: "promo-1" });
    expect(result.success).toBe(true);
  });

  it("rejette un promotionId manquant", () => {
    const result = addToPromotionSchema.safeParse({ userId: "user-1", promotionId: "" });
    expect(result.success).toBe(false);
  });
});
