import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  user: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { recordDailyVisit } = await import("./record-daily-visit");

const TODAY = new Date("2026-09-15T18:00:00Z");

beforeEach(() => {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
});

describe("recordDailyVisit", () => {
  it("n'écrit rien si l'utilisateur a déjà été vu aujourd'hui", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      lastVisitDate: new Date("2026-09-15T02:00:00Z"),
      currentStreakDays: 3,
      longestStreakDays: 5,
    });

    await recordDailyVisit("user-a", TODAY);

    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("démarre une série à 1 pour une première visite", async () => {
    dbMock.user.findUnique.mockResolvedValue({ lastVisitDate: null, currentStreakDays: 0, longestStreakDays: 0 });

    await recordDailyVisit("user-a", TODAY);

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { lastVisitDate: new Date("2026-09-15T00:00:00.000Z"), currentStreakDays: 1, longestStreakDays: 1 },
    });
  });

  it("incrémente la série pour une visite le jour consécutif", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      lastVisitDate: new Date("2026-09-14T00:00:00Z"),
      currentStreakDays: 4,
      longestStreakDays: 4,
    });

    await recordDailyVisit("user-a", TODAY);

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { lastVisitDate: new Date("2026-09-15T00:00:00.000Z"), currentStreakDays: 5, longestStreakDays: 5 },
    });
  });

  it("réinitialise la série à 1 si un jour a été sauté", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      lastVisitDate: new Date("2026-09-10T00:00:00Z"),
      currentStreakDays: 8,
      longestStreakDays: 8,
    });

    await recordDailyVisit("user-a", TODAY);

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { lastVisitDate: new Date("2026-09-15T00:00:00.000Z"), currentStreakDays: 1, longestStreakDays: 8 },
    });
  });

  it("conserve le record de série la plus longue même après une réinitialisation", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      lastVisitDate: new Date("2026-09-01T00:00:00Z"),
      currentStreakDays: 2,
      longestStreakDays: 15,
    });

    await recordDailyVisit("user-a", TODAY);

    const call = dbMock.user.update.mock.calls[0][0];
    expect(call.data.currentStreakDays).toBe(1);
    expect(call.data.longestStreakDays).toBe(15);
  });
});
