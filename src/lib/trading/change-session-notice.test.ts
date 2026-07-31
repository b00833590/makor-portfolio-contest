import { describe, it, expect } from "vitest";
import { getClosingSoonNotice } from "./change-session-notice";

const NOW = new Date("2026-09-15T12:00:00Z");

describe("getClosingSoonNotice", () => {
  it("ne renvoie rien si la fermeture est loin (au-delà du seuil)", () => {
    const closesAt = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);
    expect(getClosingSoonNotice(closesAt, NOW)).toBeNull();
  });

  it("renvoie une notice quand la fermeture est dans le seuil par défaut (24h)", () => {
    const closesAt = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
    const notice = getClosingSoonNotice(closesAt, NOW);
    expect(notice).not.toBeNull();
    expect(notice?.hoursRemaining).toBe(5);
  });

  it("ne renvoie rien si la session est déjà fermée", () => {
    const closesAt = new Date(NOW.getTime() - 60 * 60 * 1000);
    expect(getClosingSoonNotice(closesAt, NOW)).toBeNull();
  });

  it("indique moins d'une heure quand la fermeture est imminente", () => {
    const closesAt = new Date(NOW.getTime() + 20 * 60 * 1000);
    const notice = getClosingSoonNotice(closesAt, NOW);
    expect(notice?.message).toContain("moins d'une heure");
  });

  it("respecte un seuil personnalisé", () => {
    const closesAt = new Date(NOW.getTime() + 10 * 60 * 60 * 1000);
    expect(getClosingSoonNotice(closesAt, NOW, 6)).toBeNull();
    expect(getClosingSoonNotice(closesAt, NOW, 12)).not.toBeNull();
  });
});
