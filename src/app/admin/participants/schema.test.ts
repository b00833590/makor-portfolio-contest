import { describe, it, expect } from "vitest";
import { createParticipantSchema, resetPasswordSchema, reassignPromotionSchema } from "./schema";

describe("createParticipantSchema", () => {
  it("accepts a valid name, password and promotion id", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      password: "makor2023",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a name that is too short", () => {
    const result = createParticipantSchema.safeParse({
      name: "A",
      password: "makor2023",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password that is too short", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      password: "abc",
      promotionId: "promo-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing promotion id", () => {
    const result = createParticipantSchema.safeParse({
      name: "Adam Dupont",
      password: "makor2023",
      promotionId: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a valid user id and password", () => {
    const result = resetPasswordSchema.safeParse({
      userId: "user-1",
      password: "newpassword",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a password that is too short", () => {
    const result = resetPasswordSchema.safeParse({
      userId: "user-1",
      password: "abc",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing user id", () => {
    const result = resetPasswordSchema.safeParse({
      userId: "",
      password: "newpassword",
    });

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
