import { describe, it, expect } from "vitest";
import { createDirecteurSchema, resetDirecteurPasswordSchema } from "./schema";

describe("createDirecteurSchema", () => {
  it("accepts a valid name", () => {
    const result = createDirecteurSchema.safeParse({ name: "Stéphane Chouffan" });
    expect(result.success).toBe(true);
  });

  it("rejects a name that is too short", () => {
    const result = createDirecteurSchema.safeParse({ name: "S" });
    expect(result.success).toBe(false);
  });
});

describe("resetDirecteurPasswordSchema", () => {
  it("accepts a valid user id", () => {
    const result = resetDirecteurPasswordSchema.safeParse({ userId: "user-1" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing user id", () => {
    const result = resetDirecteurPasswordSchema.safeParse({ userId: "" });
    expect(result.success).toBe(false);
  });
});
