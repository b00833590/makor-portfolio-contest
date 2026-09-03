import { describe, it, expect, vi, beforeEach } from "vitest";

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const promotionFindUniqueOrThrow = vi.fn();
const ppFindUnique = vi.fn();
const ppCreate = vi.fn();
const ppDeleteMany = vi.fn();
const provisionIfActive = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: userFindUnique, update: userUpdate },
    promotion: { findUniqueOrThrow: promotionFindUniqueOrThrow },
    promotionParticipant: { findUnique: ppFindUnique, create: ppCreate, deleteMany: ppDeleteMany },
  },
}));
vi.mock("@/lib/portfolio-provisioning", () => ({
  provisionPortfolioIfPromotionActive: provisionIfActive,
}));

const { registerParticipants, unregisterParticipant } = await import("./promotion-membership");

beforeEach(() => {
  [userFindUnique, userUpdate, promotionFindUniqueOrThrow, ppFindUnique, ppCreate, ppDeleteMany, provisionIfActive].forEach(
    (m) => m.mockReset(),
  );
});

describe("registerParticipants", () => {
  it("inscrit un participant : crée la ligne de liaison et synchronise le pointeur actif", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", name: "Alice", promotionId: null, promotion: null });
    ppFindUnique.mockResolvedValue(null);

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).toHaveBeenCalledWith({ data: { userId: "u1", promotionId: "promo-2" } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { promotionId: "promo-2" } });
    expect(results).toEqual([{ userId: "u1", name: "Alice", status: "registered" }]);
  });

  it("provisionne les portefeuilles une seule fois pour plusieurs inscriptions", async () => {
    userFindUnique.mockResolvedValue({ name: "Alice", promotionId: null, promotion: null });
    ppFindUnique.mockResolvedValue(null);

    await registerParticipants("promo-2", ["u1", "u2"]);

    expect(ppCreate).toHaveBeenCalledTimes(2);
    expect(provisionIfActive).toHaveBeenCalledTimes(1);
    expect(provisionIfActive).toHaveBeenCalledWith("promo-2");
  });

  it("dédoublonne les userId répétés dans un même appel", async () => {
    userFindUnique.mockResolvedValue({ name: "Alice", promotionId: null, promotion: null });
    ppFindUnique.mockResolvedValue(null);

    await registerParticipants("promo-2", ["u1", "u1"]);

    expect(ppCreate).toHaveBeenCalledTimes(1);
  });

  it("already-registered : ne recrée pas la ligne mais garde le pointeur si déjà correct", async () => {
    userFindUnique.mockResolvedValue({ name: "Alice", promotionId: "promo-2", promotion: { status: "DRAFT", name: "P2" } });
    ppFindUnique.mockResolvedValue({ id: "pp1" });

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(results).toEqual([{ userId: "u1", name: "Alice", status: "already-registered" }]);
  });

  it("already-registered : re-synchronise un pointeur détaché (bug « Retirer » puis remettre)", async () => {
    userFindUnique.mockResolvedValue({ name: "Léonard", promotionId: null, promotion: null });
    ppFindUnique.mockResolvedValue({ id: "pp1" });

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { promotionId: "promo-2" } });
    expect(provisionIfActive).toHaveBeenCalledWith("promo-2");
    expect(results).toEqual([{ userId: "u1", name: "Léonard", status: "already-registered" }]);
  });

  it("bloque un participant dont la promotion actuelle est ACTIVE et différente", async () => {
    userFindUnique.mockResolvedValue({
      id: "u1", name: "Alice", promotionId: "promo-1",
      promotion: { status: "ACTIVE", name: "Saison 1" },
    });

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).not.toHaveBeenCalled();
    expect(results).toEqual([
      { userId: "u1", name: "Alice", status: "blocked-active-elsewhere", promotionName: "Saison 1" },
    ]);
    expect(provisionIfActive).not.toHaveBeenCalled();
  });

  it("autorise la ré-inscription à la même promotion ACTIVE", async () => {
    userFindUnique.mockResolvedValue({
      id: "u1", name: "Alice", promotionId: "promo-2",
      promotion: { status: "ACTIVE", name: "Saison 2" },
    });
    ppFindUnique.mockResolvedValue(null);

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(results[0].status).toBe("registered");
  });

  it("ignore silencieusement un userId inconnu", async () => {
    userFindUnique.mockResolvedValue(null);

    const results = await registerParticipants("promo-2", ["ghost"]);

    expect(results).toEqual([]);
    expect(provisionIfActive).not.toHaveBeenCalled();
  });
});

describe("unregisterParticipant", () => {
  it("supprime la ligne et remet le pointeur à null si la promotion est DRAFT", async () => {
    promotionFindUniqueOrThrow.mockResolvedValue({ status: "DRAFT" });
    userFindUnique.mockResolvedValue({ promotionId: "promo-2" });

    await unregisterParticipant("promo-2", "u1");

    expect(ppDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1", promotionId: "promo-2" } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { promotionId: null } });
  });

  it("ne touche pas au pointeur s'il vise une autre promotion", async () => {
    promotionFindUniqueOrThrow.mockResolvedValue({ status: "DRAFT" });
    userFindUnique.mockResolvedValue({ promotionId: "promo-1" });

    await unregisterParticipant("promo-2", "u1");

    expect(ppDeleteMany).toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("refuse si la promotion n'est pas DRAFT", async () => {
    promotionFindUniqueOrThrow.mockResolvedValue({ status: "ACTIVE" });

    await expect(unregisterParticipant("promo-2", "u1")).rejects.toThrow(/brouillon/);
    expect(ppDeleteMany).not.toHaveBeenCalled();
  });
});
