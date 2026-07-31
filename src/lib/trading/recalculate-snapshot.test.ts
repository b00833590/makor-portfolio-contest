import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  portfolio: { findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
};
const recomputePortfolioPositionsMock = vi.fn();
const snapshotPortfolioMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("./recompute-portfolio", () => ({ recomputePortfolioPositions: recomputePortfolioPositionsMock }));
vi.mock("./snapshot-service", () => ({ snapshotPortfolio: snapshotPortfolioMock }));

const { recalculatePortfolioSnapshot, recalculateAllPortfolioSnapshots } = await import("./recalculate-snapshot");

beforeEach(() => {
  dbMock.portfolio.findUniqueOrThrow.mockReset();
  dbMock.portfolio.findMany.mockReset();
  recomputePortfolioPositionsMock.mockReset();
  snapshotPortfolioMock.mockReset();
});

describe("recalculatePortfolioSnapshot", () => {
  it("recomputes positions then snapshots the portfolio with its promotion's initial capital", async () => {
    dbMock.portfolio.findUniqueOrThrow.mockResolvedValue({
      id: "portfolio-1",
      promotion: { initialCapital: 1_000_000 },
    });
    const now = new Date("2026-01-01T00:00:00Z");

    await recalculatePortfolioSnapshot("portfolio-1", now);

    expect(recomputePortfolioPositionsMock).toHaveBeenCalledWith("portfolio-1");
    expect(snapshotPortfolioMock).toHaveBeenCalledWith("portfolio-1", 1_000_000, now);
  });
});

describe("recalculateAllPortfolioSnapshots", () => {
  it("recalculates every portfolio of the promotion", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-1" }, { id: "portfolio-2" }]);
    dbMock.portfolio.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, promotion: { initialCapital: 1_000_000 } }),
    );

    await recalculateAllPortfolioSnapshots("promo-1");

    expect(recomputePortfolioPositionsMock).toHaveBeenCalledTimes(2);
    expect(snapshotPortfolioMock).toHaveBeenCalledTimes(2);
  });
});
