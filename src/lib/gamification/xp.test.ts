import { describe, it, expect } from "vitest";
import { computeXp, computeLevel } from "./xp";

describe("computeXp", () => {
  it("somme l'XP de chaque badge selon sa rareté", () => {
    const xp = computeXp([{ rarity: "COMMON" }, { rarity: "RARE" }, { rarity: "EPIC" }, { rarity: "LEGENDARY" }]);
    expect(xp).toBe(10 + 25 + 60 + 150);
  });

  it("retourne 0 sans aucun badge", () => {
    expect(computeXp([])).toBe(0);
  });
});

describe("computeLevel", () => {
  it("niveau 1 (Débutant) à 0 XP", () => {
    const level = computeLevel(0);
    expect(level.level).toBe(1);
    expect(level.label).toBe("Débutant");
    expect(level.xpForNextLevel).toBe(50);
  });

  it("passe au palier suivant exactement au seuil", () => {
    const level = computeLevel(50);
    expect(level.level).toBe(2);
    expect(level.label).toBe("Analyste");
  });

  it("reste au palier précédent juste avant le seuil", () => {
    const level = computeLevel(49);
    expect(level.level).toBe(1);
  });

  it("atteint le dernier palier sans XP requis pour la suite", () => {
    const level = computeLevel(1500);
    expect(level.level).toBe(7);
    expect(level.label).toBe("Légende du concours");
    expect(level.xpForNextLevel).toBe(null);
    expect(level.progressPct).toBe(100);
  });

  it("dépasse largement le dernier palier sans erreur", () => {
    const level = computeLevel(5000);
    expect(level.level).toBe(7);
    expect(level.progressPct).toBe(100);
  });

  it("calcule la progression vers le palier suivant", () => {
    const level = computeLevel(100); // entre Analyste (50) et Trader confirmé (150)
    expect(level.xpIntoLevel).toBe(50);
    expect(level.xpForNextLevel).toBe(100);
    expect(level.progressPct).toBe(50);
  });
});
