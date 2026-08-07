import { describe, it, expect } from "vitest";
import { ChangeSessionStatus } from "@/generated/prisma/enums";
import { computeChangeSessionStatus, sessionsOverlap } from "./change-session-status";

const opensAt = new Date("2026-08-10T08:00:00Z");
const closesAt = new Date("2026-08-10T17:00:00Z");

describe("computeChangeSessionStatus", () => {
  describe("mode automatique (status SCHEDULED, jamais touché par l'admin)", () => {
    it("est SCHEDULED avant l'heure d'ouverture", () => {
      const now = new Date("2026-08-10T07:59:59Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt, closesAt }, now)).toBe(
        "SCHEDULED",
      );
    });

    it("passe à OPEN pile à l'heure d'ouverture, sans action admin", () => {
      const now = new Date("2026-08-10T08:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt, closesAt }, now)).toBe(
        "OPEN",
      );
    });

    it("reste OPEN à l'intérieur de la fenêtre", () => {
      const now = new Date("2026-08-10T12:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt, closesAt }, now)).toBe(
        "OPEN",
      );
    });

    it("reste OPEN pile à l'heure de fermeture", () => {
      const now = new Date("2026-08-10T17:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt, closesAt }, now)).toBe(
        "OPEN",
      );
    });

    it("passe à CLOSED juste après l'heure de fermeture, sans action admin", () => {
      const now = new Date("2026-08-10T17:00:01Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt, closesAt }, now)).toBe(
        "CLOSED",
      );
    });
  });

  describe("dérogation admin : ouverture immédiate (status forcé à OPEN)", () => {
    it("est OPEN même avant l'heure d'ouverture prévue", () => {
      const now = new Date("2026-08-10T07:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.OPEN, opensAt, closesAt }, now)).toBe("OPEN");
    });

    it("expire quand même à closesAt, la dérogation ne prolonge pas la fenêtre", () => {
      const now = new Date("2026-08-10T18:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.OPEN, opensAt, closesAt }, now)).toBe("CLOSED");
    });
  });

  describe("dérogation admin : fermeture immédiate (status forcé à CLOSED)", () => {
    it("est CLOSED même pendant la fenêtre normalement ouverte", () => {
      const now = new Date("2026-08-10T12:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.CLOSED, opensAt, closesAt }, now)).toBe(
        "CLOSED",
      );
    });

    it("reste CLOSED même avant l'heure d'ouverture prévue", () => {
      const now = new Date("2026-08-10T01:00:00Z");
      expect(computeChangeSessionStatus({ status: ChangeSessionStatus.CLOSED, opensAt, closesAt }, now)).toBe(
        "CLOSED",
      );
    });
  });

  describe("changement d'heure été/hiver (passage à l'heure d'été, dernier dimanche de mars)", () => {
    // Nuit du 28 au 29 mars 2026 (Europe/Paris) : à 01:00 UTC (02:00 CET), les horloges
    // locales sautent directement à 03:00 CEST — 02h-03h locale n'existe pas ce jour-là.
    // La session est délibérément à cheval sur ce saut, en instants UTC (comme tout est
    // stocké/comparé en base) : 23h Paris (CET) la veille jusqu'à 05h Paris (CEST) le
    // lendemain. Le calcul ne fait aucune arithmétique en heure locale, donc ce saut ne
    // doit avoir strictement aucun effet sur le résultat.
    const dstOpensAt = new Date("2026-03-28T22:00:00Z"); // 23:00 CET (UTC+1)
    const dstClosesAt = new Date("2026-03-29T03:00:00Z"); // 05:00 CEST (UTC+2)

    it("est SCHEDULED juste avant l'ouverture, quel que soit le décalage local", () => {
      const now = new Date("2026-03-28T21:59:59Z");
      expect(
        computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt: dstOpensAt, closesAt: dstClosesAt }, now),
      ).toBe("SCHEDULED");
    });

    it("reste OPEN pendant tout le saut d'heure (minuit à 3h UTC)", () => {
      const now = new Date("2026-03-29T01:30:00Z"); // exactement l'instant du saut d'heure local
      expect(
        computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt: dstOpensAt, closesAt: dstClosesAt }, now),
      ).toBe("OPEN");
    });

    it("passe à CLOSED juste après la fermeture, sans dérive liée au changement d'heure", () => {
      const now = new Date("2026-03-29T03:00:01Z");
      expect(
        computeChangeSessionStatus({ status: ChangeSessionStatus.SCHEDULED, opensAt: dstOpensAt, closesAt: dstClosesAt }, now),
      ).toBe("CLOSED");
    });
  });
});

describe("sessionsOverlap", () => {
  const a = { opensAt: new Date("2026-08-10T08:00:00Z"), closesAt: new Date("2026-08-10T17:00:00Z") };

  it("détecte un chevauchement partiel", () => {
    const b = { opensAt: new Date("2026-08-10T16:00:00Z"), closesAt: new Date("2026-08-10T20:00:00Z") };
    expect(sessionsOverlap(a, b)).toBe(true);
  });

  it("détecte une fenêtre entièrement incluse dans l'autre", () => {
    const b = { opensAt: new Date("2026-08-10T10:00:00Z"), closesAt: new Date("2026-08-10T12:00:00Z") };
    expect(sessionsOverlap(a, b)).toBe(true);
  });

  it("ne considère pas deux sessions bout à bout comme un chevauchement", () => {
    const b = { opensAt: new Date("2026-08-10T17:00:00Z"), closesAt: new Date("2026-08-10T20:00:00Z") };
    expect(sessionsOverlap(a, b)).toBe(false);
  });

  it("ne détecte rien pour deux fenêtres disjointes", () => {
    const b = { opensAt: new Date("2026-08-11T08:00:00Z"), closesAt: new Date("2026-08-11T17:00:00Z") };
    expect(sessionsOverlap(a, b)).toBe(false);
  });
});
