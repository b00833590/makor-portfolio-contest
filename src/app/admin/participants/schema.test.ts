import { describe, it, expect } from "vitest";
import { createParticipantSchema, resetPasswordSchema, reassignPromotionSchema } from "./schema";

describe("createParticipantSchema", () => {
  it("accepts a valid name and promotion id without an email", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      email: "",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid email when provided", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      email: "adam.dupont@example.com",
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

  it("rejects an invalid email", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      email: "not-an-email",
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

describe("reassignPromotionSchema", () => {
  it("accepts a valid user id and promotion id", () => {
    const result = reassignPromotionSchema.safeParse({
      userId: "user-1",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing promotion id", () => {
    const result = reassignPromotionSchema.safeParse({
      userId: "user-1",
      promotionId: "",
    });

    expect(result.success).toBe(false);
  });
});
