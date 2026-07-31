import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType, ChangeSessionStatus, PromotionStatus, TransactionType } from "@/generated/prisma/enums";
import { defaultPromotionRules } from "@/lib/promotion-rules";

const dbMock = {
  user: { findUnique: vi.fn() },
  portfolio: { findUnique: vi.fn() },
  promotion: { findUniqueOrThrow: vi.fn() },
  asset: { findUnique: vi.fn() },
  changeSession: { findFirst: vi.fn() },
  changeUsage: { findUnique: vi.fn(), upsert: vi.fn() },
  position: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirstOrThrow: vi.fn() },
  transaction: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<void>) => callback(dbMock)),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { buildTradeContext, executeOrder } = await import("./execute-order");

const NOW = new Date("2026-09-15T12:00:00Z");

function resetMocks() {
  Object.values(dbMock).forEach((group) => {
    if (typeof group === "function") {
      group.mockReset();
    } else {
      Object.values(group).forEach((fn) => fn.mockReset());
    }
  });
  dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<void>) => callback(dbMock));
}

function mockHappyPath() {
  dbMock.user.findUnique.mockResolvedValue({ id: "user-1", promotionId: "promo-1" });
  dbMock.portfolio.findUnique.mockResolvedValue({ id: "portfolio-1" });
  dbMock.promotion.findUniqueOrThrow.mockResolvedValue({
    id: "promo-1",
    status: PromotionStatus.ACTIVE,
    endDate: new Date("2026-09-30T00:00:00Z"),
    initialCapital: 1_000_000,
    rules: defaultPromotionRules,
  });
  dbMock.asset.findUnique.mockResolvedValue({
    id: "asset-aapl",
    type: AssetType.STOCK,
    isActive: true,
    prices: [{ price: 100 }],
  });
  dbMock.changeSession.findFirst.mockResolvedValue({
    id: "session-1",
    status: ChangeSessionStatus.OPEN,
    opensAt: new Date("2026-09-15T00:00:00Z"),
    closesAt: new Date("2026-09-16T00:00:00Z"),
    maxChangesPerParticipant: 4,
  });
  dbMock.changeUsage.findUnique.mockResolvedValue(null);
  dbMock.position.findMany.mockResolvedValue([]);
  dbMock.transaction.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  resetMocks();
});

describe("buildTradeContext", () => {
  it("calcule le capital disponible à partir du grand livre des transactions", async () => {
    mockHappyPath();
    dbMock.transaction.findMany.mockResolvedValue([
      { type: TransactionType.BUY, amount: 60_000 },
      { type: TransactionType.SELL_FULL, amount: 20_000 },
    ]);

    const result = await buildTradeContext("user-1", "asset-aapl", NOW);

    expect("context" in result).toBe(true);
    if ("context" in result) {
      expect(result.context.availableCash).toBe(1_000_000 - 60_000 + 20_000);
    }
  });

  it("retourne une erreur si l'utilisateur n'a pas de promotion", async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: "user-1", promotionId: null });

    const result = await buildTradeContext("user-1", "asset-aapl", NOW);

    expect(result).toEqual({ error: expect.stringContaining("promotion") });
  });

  it("retourne une erreur si aucun prix n'est disponible pour l'actif", async () => {
    mockHappyPath();
    dbMock.asset.findUnique.mockResolvedValue({
      id: "asset-aapl",
      type: AssetType.STOCK,
      isActive: true,
      prices: [],
    });

    const result = await buildTradeContext("user-1", "asset-aapl", NOW);

    expect(result).toEqual({ error: expect.stringContaining("prix") });
  });
});

describe("executeOrder", () => {
  it("exécute un achat valide : crée la position, la transaction, et incrémente le quota", async () => {
    mockHappyPath();

    const result = await executeOrder("user-1", { type: "BUY", assetId: "asset-aapl", amount: 50_000 }, NOW);

    expect(result).toEqual({ ok: true });
    expect(dbMock.position.create).toHaveBeenCalledWith({
      data: {
        portfolioId: "portfolio-1",
        assetId: "asset-aapl",
        quantity: 500,
        avgEntryPrice: 100,
      },
    });
    expect(dbMock.transaction.create).toHaveBeenCalledWith({
      data: {
        portfolioId: "portfolio-1",
        assetId: "asset-aapl",
        type: "BUY",
        quantity: 500,
        price: 100,
        amount: 50_000,
        changeSessionId: "session-1",
      },
    });
    expect(dbMock.changeUsage.upsert).toHaveBeenCalledWith({
      where: { changeSessionId_userId: { changeSessionId: "session-1", userId: "user-1" } },
      create: { changeSessionId: "session-1", userId: "user-1", changesUsed: 1 },
      update: { changesUsed: { increment: 1 } },
    });
  });

  it("rejette un ordre invalide sans écrire en base", async () => {
    mockHappyPath();
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({
      id: "promo-1",
      status: PromotionStatus.DRAFT,
      endDate: new Date("2026-09-30T00:00:00Z"),
      initialCapital: 1_000_000,
      rules: defaultPromotionRules,
    });

    const result = await executeOrder("user-1", { type: "BUY", assetId: "asset-aapl", amount: 50_000 }, NOW);

    expect(result.ok).toBe(false);
    expect(dbMock.position.create).not.toHaveBeenCalled();
    expect(dbMock.transaction.create).not.toHaveBeenCalled();
  });
});
