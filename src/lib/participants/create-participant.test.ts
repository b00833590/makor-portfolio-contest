import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: findUniqueMock, create: createMock } },
}));

const { createParticipantWithTempPassword } = await import("./create-participant");

beforeEach(() => {
  findUniqueMock.mockReset();
  createMock.mockReset();
});

describe("createParticipantWithTempPassword", () => {
  it("creates a new participant with a generated temp password and mustChangePassword", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({});

    const result = await createParticipantWithTempPassword({ name: "Adam Dupont", promotionId: "promo-1" });

    expect(result.status).toBe("created");
    expect(result).toHaveProperty("tempPassword");
    if (result.status === "created") {
      expect(result.tempPassword).toHaveLength(10);
    }
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Adam Dupont",
          promotionId: "promo-1",
          mustChangePassword: true,
        }),
      }),
    );
  });

  it("does not create a duplicate account when the name already exists", async () => {
    findUniqueMock.mockResolvedValue({ id: "existing-user" });

    const result = await createParticipantWithTempPassword({ name: "Adam Dupont", promotionId: "promo-1" });

    expect(result).toEqual({ name: "Adam Dupont", status: "exists" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("trims the provided name before checking and creating", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({});

    await createParticipantWithTempPassword({ name: "  Adam Dupont  ", promotionId: null });

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { name: "Adam Dupont" } });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Adam Dupont", promotionId: null }) }),
    );
  });
});
