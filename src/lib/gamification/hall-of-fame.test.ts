import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionStatus } from "@/generated/prisma/enums";

const dbMock = {
  promotion: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  portfolio: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getHallOfFame } = await import("./hall-of-fame");

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
}

beforeEach(() => {
  resetMocks();
});

describe("getHallOfFame", () => {
  it("ne retient que les promotions terminées et désigne le vainqueur de chacune", async () => {
    dbMock.promotion.findMany.mockResolvedValue([
      {
        id: "promo-1",
        name: "Saison 1",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        initialCapital: 1_000_000,
      },
    ]);
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({
      id: "promo-1",
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice", email: "alice@makor.com" } },
      { id: "portfolio-b", user: { id: "user-b", name: "Bob", email: "bob@makor.com" } },
    ]);
    dbMock.performanceSnapshot.findFirst.mockImplementation(({ where }: { where: { portfolioId: string } }) => {
      if (where.portfolioId === "portfolio-a") {
        return Promise.resolve({ totalValue: 1_200_000, cumulativeReturnPct: 20 });
      }
      return Promise.resolve({ totalValue: 1_050_000, cumulativeReturnPct: 5 });
    });

    const results = await getHallOfFame();

    expect(dbMock.promotion.findMany).toHaveBeenCalledWith({
      where: { status: PromotionStatus.CLOSED },
      orderBy: { endDate: "desc" },
    });
    expect(results).toEqual([
      {
        promotionId: "promo-1",
        name: "Saison 1",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        winner: { userId: "user-a", name: "Alice", cumulativeReturnPct: 20 },
      },
    ]);
  });

  it("renvoie une liste vide s'il n'y a aucune saison terminée", async () => {
    dbMock.promotion.findMany.mockResolvedValue([]);

    const results = await getHallOfFame();

    expect(results).toEqual([]);
  });
});
