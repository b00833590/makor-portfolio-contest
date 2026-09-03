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
  it("crée un compte avec mot de passe temporaire et renvoie son id", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "user-x" });

    const result = await createParticipantWithTempPassword({ name: "Adam Dupont" });

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.id).toBe("user-x");
      expect(result.tempPassword).toHaveLength(10);
    }
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Adam Dupont", mustChangePassword: true }),
      }),
    );
    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data).not.toHaveProperty("promotionId");
  });

  it("ne crée pas de doublon si le nom existe déjà", async () => {
    findUniqueMock.mockResolvedValue({ id: "existing-user" });

    const result = await createParticipantWithTempPassword({ name: "Adam Dupont" });

    expect(result).toEqual({ name: "Adam Dupont", status: "exists" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("nettoie le nom (trim) avant vérification et création", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "user-y" });

    await createParticipantWithTempPassword({ name: "  Adam Dupont  " });

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { name: "Adam Dupont" } });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Adam Dupont" }) }),
    );
  });
});
