import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
const createManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: findManyMock },
    portfolio: { createMany: createManyMock },
  },
}));

const { provisionPortfolios } = await import("./portfolio-provisioning");

beforeEach(() => {
  findManyMock.mockReset();
  createManyMock.mockReset();
});

describe("provisionPortfolios", () => {
  it("crée un portefeuille pour chaque participant assigné à la promotion", async () => {
    findManyMock.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    createManyMock.mockResolvedValue({ count: 2 });

    const count = await provisionPortfolios("promo-1");

    expect(findManyMock).toHaveBeenCalledWith({ where: { promotionId: "promo-1" }, select: { id: true } });
    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", promotionId: "promo-1" },
        { userId: "user-2", promotionId: "promo-1" },
      ],
      skipDuplicates: true,
    });
    expect(count).toBe(2);
  });

  it("ne crée rien si aucun participant n'est assigné", async () => {
    findManyMock.mockResolvedValue([]);
    createManyMock.mockResolvedValue({ count: 0 });

    const count = await provisionPortfolios("promo-1");

    expect(count).toBe(0);
  });
});
