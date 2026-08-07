import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChangeSessionKind } from "@/generated/prisma/enums";
import { defaultPromotionRules } from "@/lib/promotion-rules";

const findFirstMock = vi.fn();
const findUniqueOrThrowMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    changeSession: { findFirst: findFirstMock, create: createMock },
    promotion: { findUniqueOrThrow: findUniqueOrThrowMock },
  },
}));

const { ensureInitializationWindow } = await import("./initialization-window");

const NOW = new Date("2026-09-01T10:00:00Z");

beforeEach(() => {
  findFirstMock.mockReset();
  findUniqueOrThrowMock.mockReset();
  createMock.mockReset();
});

describe("ensureInitializationWindow", () => {
  it("crée une fenêtre d'initialisation (status SCHEDULED, ouverte automatiquement car opensAt=now), durée = règle de la promotion", async () => {
    findFirstMock.mockResolvedValue(null);
    findUniqueOrThrowMock.mockResolvedValue({
      rules: { ...defaultPromotionRules, initializationWindowHours: 6 },
    });
    createMock.mockResolvedValue({ id: "session-init" });

    const result = await ensureInitializationWindow("promo-1", NOW);

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { promotionId: "promo-1", kind: ChangeSessionKind.INITIALIZATION },
      select: { id: true },
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        promotionId: "promo-1",
        kind: ChangeSessionKind.INITIALIZATION,
        weekNumber: 0,
        opensAt: NOW,
        closesAt: new Date("2026-09-01T16:00:00Z"),
        maxChangesPerParticipant: defaultPromotionRules.maxChangesPerSession,
      },
    });
    expect(result).toEqual({ id: "session-init" });
  });

  it("ne crée rien si une fenêtre d'initialisation existe déjà (idempotent)", async () => {
    findFirstMock.mockResolvedValue({ id: "existing-session" });

    const result = await ensureInitializationWindow("promo-1", NOW);

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
