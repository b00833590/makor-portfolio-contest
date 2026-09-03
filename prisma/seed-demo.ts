/**
 * Seed de données de démonstration — rejouable (nettoie puis recrée).
 * Usage: npm run db:seed:demo
 *
 * Optionnel, pour le développement local uniquement (ne pas lancer en
 * production — voir prisma/seed-admin.ts pour le seed essentiel).
 *
 * N'importe volontairement AUCUN module marqué "server-only" (db.ts, les
 * services trading/gamification) : ce script tourne via tsx, hors du
 * pipeline Next.js, donc il instancie son propre PrismaClient et ne réutilise
 * que les fonctions pures (règles, critères de badges, classement).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { AssetType, ChangeSessionStatus, PromotionStatus, TransactionType, UserRole } from "../src/generated/prisma/enums";
import { defaultPromotionRules } from "../src/lib/promotion-rules";
import { BADGE_CATALOG, CLOSE_ONLY_CODES, evaluateBadgeCatalog } from "../src/lib/gamification/badges/catalog";
import type { BadgeEvaluationContext } from "../src/lib/gamification/badges/types";
import { rankEntries } from "../src/lib/gamification/ranking";

const PROMOTION_NAME = "Promotion Démo — Été 2026";
const PAST_PROMOTION_NAME = "Promotion Démo — Printemps 2026";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_PASSWORD = "demo1234";
const DEMO_NAMES = ["Admin Démo", "Alice Dupont", "Bob Martin", "Charlie Bernard"];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function cleanupPromotion(name: string) {
  const existing = await db.promotion.findFirst({ where: { name } });
  if (!existing) return;

  const portfolios = await db.portfolio.findMany({ where: { promotionId: existing.id }, select: { id: true } });
  const portfolioIds = portfolios.map((p) => p.id);

  await db.userBadge.deleteMany({ where: { promotionId: existing.id } });
  await db.performanceSnapshot.deleteMany({ where: { portfolioId: { in: portfolioIds } } });
  await db.transaction.deleteMany({ where: { portfolioId: { in: portfolioIds } } });
  await db.position.deleteMany({ where: { portfolioId: { in: portfolioIds } } });
  await db.changeUsage.deleteMany({ where: { changeSession: { promotionId: existing.id } } });
  await db.changeSession.deleteMany({ where: { promotionId: existing.id } });
  await db.portfolio.deleteMany({ where: { promotionId: existing.id } });
  await db.promotion.delete({ where: { id: existing.id } });
}

async function cleanup() {
  await cleanupPromotion(PAST_PROMOTION_NAME);
  await cleanupPromotion(PROMOTION_NAME);
  await db.user.deleteMany({ where: { name: { in: DEMO_NAMES } } });
  await db.asset.deleteMany({
    where: { symbol: { in: ["AAPL-DEMO", "MSFT-DEMO", "LVMH-DEMO", "OR-DEMO", "BTC-DEMO", "SAN-DEMO"] } },
  });
}

interface AssetSeed {
  symbol: string;
  name: string;
  type: AssetType;
  sector: string | null;
  currentPrice: number;
}

const assetSeeds: AssetSeed[] = [
  { symbol: "AAPL-DEMO", name: "Apple Inc.", type: AssetType.STOCK, sector: "Technologie", currentPrice: 195 },
  { symbol: "MSFT-DEMO", name: "Microsoft Corp.", type: AssetType.STOCK, sector: "Technologie", currentPrice: 420 },
  { symbol: "LVMH-DEMO", name: "LVMH", type: AssetType.STOCK, sector: "Luxe", currentPrice: 650 },
  { symbol: "OR-DEMO", name: "L'Oréal", type: AssetType.STOCK, sector: "Consommation", currentPrice: 380 },
  { symbol: "BTC-DEMO", name: "Bitcoin", type: AssetType.CRYPTO, sector: null, currentPrice: 55_000 },
  { symbol: "SAN-DEMO", name: "Sanofi", type: AssetType.STOCK, sector: "Santé", currentPrice: 95 },
];

interface PositionSeed {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
}

interface ParticipantSeed {
  handle: string;
  name: string;
  positions: PositionSeed[];
}

const participantSeeds: ParticipantSeed[] = [
  {
    handle: "demo-alice",
    name: "Alice Dupont",
    // Pari concentré sur la crypto avec un gros gain latent -> badge Sniper.
    positions: [{ symbol: "BTC-DEMO", quantity: 1.4, avgEntryPrice: 35_000 }],
  },
  {
    handle: "demo-bob",
    name: "Bob Martin",
    // Portefeuille diversifié sur 6 lignes (~16-17% chacune) -> badge Diversificateur,
    // avec une marge confortable sous le seuil de 20% même après arrondis.
    positions: [
      { symbol: "AAPL-DEMO", quantity: 338.5, avgEntryPrice: 195 },
      { symbol: "MSFT-DEMO", quantity: 157.1, avgEntryPrice: 420 },
      { symbol: "LVMH-DEMO", quantity: 101.5, avgEntryPrice: 650 },
      { symbol: "OR-DEMO", quantity: 146.7, avgEntryPrice: 380 },
      { symbol: "BTC-DEMO", quantity: 1.2, avgEntryPrice: 55_000 },
      { symbol: "SAN-DEMO", quantity: 694.7, avgEntryPrice: 95 },
    ],
  },
  {
    handle: "demo-charlie",
    name: "Charlie Bernard",
    // Une position en légère perte.
    positions: [{ symbol: "MSFT-DEMO", quantity: 66.7, avgEntryPrice: 450 }],
  },
];

async function main() {
  await cleanup();

  const now = new Date();

  const promotion = await db.promotion.create({
    data: {
      name: PROMOTION_NAME,
      status: PromotionStatus.ACTIVE,
      startDate: new Date(now.getTime() - 10 * DAY_MS),
      endDate: new Date(now.getTime() + 20 * DAY_MS),
      initialCapital: 1_000_000,
      rules: defaultPromotionRules,
    },
  });

  const adminPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const admin = await db.user.create({
    data: { name: "Admin Démo", passwordHash: adminPasswordHash, role: UserRole.ADMIN, promotionId: promotion.id },
  });

  const assetsBySymbol = new Map<string, { id: string; type: AssetType }>();
  for (const seed of assetSeeds) {
    const asset = await db.asset.create({
      data: { symbol: seed.symbol, name: seed.name, type: seed.type, sector: seed.sector, currency: "EUR" },
    });
    await db.price.create({ data: { assetId: asset.id, timestamp: now, price: seed.currentPrice, source: "seed" } });
    assetsBySymbol.set(seed.symbol, { id: asset.id, type: seed.type });
  }
  const priceBySymbol = new Map(assetSeeds.map((a) => [a.symbol, a.currentPrice]));

  await db.changeSession.create({
    data: {
      promotionId: promotion.id,
      weekNumber: 1,
      opensAt: new Date(now.getTime() - DAY_MS),
      closesAt: new Date(now.getTime() + DAY_MS),
      status: ChangeSessionStatus.OPEN,
      maxChangesPerParticipant: defaultPromotionRules.maxChangesPerSession,
    },
  });

  interface ParticipantState {
    userId: string;
    portfolioId: string;
    totalValue: number;
    positions: { marketValue: number; costBasis: number }[];
    lastTransactionDate: Date;
  }

  const participantStates: ParticipantState[] = [];

  const participantPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const seed of participantSeeds) {
    const user = await db.user.create({
      data: { name: seed.name, passwordHash: participantPasswordHash, role: UserRole.PARTICIPANT, promotionId: promotion.id },
    });
    const portfolio = await db.portfolio.create({ data: { userId: user.id, promotionId: promotion.id } });

    const positionContexts: { marketValue: number; costBasis: number }[] = [];
    let lastTransactionDate = new Date(now.getTime() - 9 * DAY_MS);

    for (const [index, position] of seed.positions.entries()) {
      const asset = assetsBySymbol.get(position.symbol)!;
      const currentPrice = priceBySymbol.get(position.symbol)!;
      const amount = position.quantity * position.avgEntryPrice;
      const transactionDate = new Date(now.getTime() - (8 - index) * DAY_MS);

      await db.position.create({
        data: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          quantity: position.quantity,
          avgEntryPrice: position.avgEntryPrice,
          openedAt: transactionDate,
        },
      });
      await db.transaction.create({
        data: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          type: TransactionType.BUY,
          quantity: position.quantity,
          price: position.avgEntryPrice,
          amount,
          createdAt: transactionDate,
        },
      });

      positionContexts.push({ marketValue: position.quantity * currentPrice, costBasis: amount });
      if (transactionDate > lastTransactionDate) lastTransactionDate = transactionDate;
    }

    const availableCash = 1_000_000 - positionContexts.reduce((sum, p) => sum + p.costBasis, 0);
    const totalValue = availableCash + positionContexts.reduce((sum, p) => sum + p.marketValue, 0);

    // Historique de snapshots : marche aléatoire douce entre le capital initial
    // et la valeur finale réelle, pour peupler le graphique et le classement.
    const days = 10;
    for (let i = 0; i <= days; i++) {
      const progress = i / days;
      const noise = (Math.sin(i * 1.7 + seed.handle.length) * 0.006) * 1_000_000;
      const interpolated = 1_000_000 + (totalValue - 1_000_000) * progress + (i < days ? noise : 0);
      const timestamp = new Date(now.getTime() - (days - i) * DAY_MS);
      const previous = i === 0 ? null : (await db.performanceSnapshot.findFirst({
        where: { portfolioId: portfolio.id },
        orderBy: { timestamp: "desc" },
      }));

      await db.performanceSnapshot.create({
        data: {
          portfolioId: portfolio.id,
          timestamp,
          totalValue: interpolated,
          dailyReturnPct: previous ? ((interpolated - Number(previous.totalValue)) / Number(previous.totalValue)) * 100 : 0,
          cumulativeReturnPct: ((interpolated - 1_000_000) / 1_000_000) * 100,
        },
      });
    }

    participantStates.push({
      userId: user.id,
      portfolioId: portfolio.id,
      totalValue,
      positions: positionContexts,
      lastTransactionDate,
    });
  }

  // Classement final + il y a 7 jours (pour la progression de rang et les badges).
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const currentRanked = rankEntries(
    participantStates.map((p) => ({ portfolioId: p.portfolioId, cumulativeReturnPct: ((p.totalValue - 1_000_000) / 1_000_000) * 100 })),
  );
  const previousEntries = await Promise.all(
    participantStates.map(async (p) => {
      const snapshot = await db.performanceSnapshot.findFirst({
        where: { portfolioId: p.portfolioId, timestamp: { lte: sevenDaysAgo } },
        orderBy: { timestamp: "desc" },
      });
      return { portfolioId: p.portfolioId, cumulativeReturnPct: snapshot ? Number(snapshot.cumulativeReturnPct) : null };
    }),
  );
  const previousRanked = rankEntries(
    previousEntries.filter((e): e is { portfolioId: string; cumulativeReturnPct: number } => e.cumulativeReturnPct !== null),
  );
  const previousRankByPortfolio = new Map(previousRanked.map((e) => [e.portfolioId, e.rank]));

  const badgeIdByCode = new Map<string, string>();
  for (const spec of BADGE_CATALOG) {
    const data = {
      name: spec.name,
      description: spec.description,
      condition: spec.condition,
      category: spec.category,
      rarity: spec.rarity,
      icon: spec.icon,
    };
    const badge = await db.badge.upsert({
      where: { code: spec.code },
      update: data,
      create: { code: spec.code, ...data },
    });
    badgeIdByCode.set(spec.code, badge.id);
  }

  // Contexte minimal, pur (aucun accès DB au-delà de ce que ce script suit déjà lui-même) —
  // seuls les badges dérivables de cet état simplifié peuvent être attribués ici ; c'est
  // suffisant pour peupler un jeu de démonstration visuel, pas une réplique du moteur complet
  // (voir src/lib/gamification/evaluate-badges.ts pour l'évaluation réelle en production).
  function demoContext(overrides: Partial<BadgeEvaluationContext>): BadgeEvaluationContext {
    return {
      now,
      openPositionCount: 0,
      maxPositions: defaultPromotionRules.maxPositions,
      investedValue: 0,
      positions: [],
      transactionCount: 0,
      firstTransactionDate: null,
      lastTransactionDate: null,
      closedTradesChronological: [],
      hasSuccessfulArbitrage: false,
      postBuyMaxGainPct: null,
      cumulativeReturnPct: 0,
      dailyReturnPct: null,
      currentRank: null,
      previousRank: null,
      gapToSecondPts: null,
      rankHistory: [],
      participantCount: participantStates.length,
      fieldAverageReturnPct: 0,
      hasBestWeeklyReturn: false,
      distinctAssetsTradedCount: 0,
      holdsStockAndCrypto: false,
      maxPositionConcentrationPct: null,
      hasAnchorPosition: false,
      regainedFirstPlace: false,
      weeklyChangeWindows: [],
      currentStreakDays: 0,
      longestStreakDays: 0,
      alreadyOwnedCodes: new Set(),
      totalBadgeCount: BADGE_CATALOG.length,
      evaluatableBadgeCount: BADGE_CATALOG.length - CLOSE_ONLY_CODES.size,
      initWindowClosed: true,
      ...overrides,
    };
  }

  for (const rankedEntry of currentRanked) {
    const state = participantStates.find((p) => p.portfolioId === rankedEntry.portfolioId)!;
    const previousRank = previousRankByPortfolio.get(rankedEntry.portfolioId) ?? null;

    const investedValue = state.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const earned = evaluateBadgeCatalog(
      demoContext({
        investedValue,
        openPositionCount: state.positions.length,
        positions: state.positions,
        transactionCount: state.positions.length,
        lastTransactionDate: state.lastTransactionDate,
        cumulativeReturnPct: rankedEntry.cumulativeReturnPct,
        currentRank: rankedEntry.rank,
        previousRank,
      }),
    );

    for (const code of earned) {
      const badgeId = badgeIdByCode.get(code);
      if (!badgeId) continue;
      await db.userBadge.create({ data: { userId: state.userId, badgeId, promotionId: promotion.id, seenAt: now } });
    }
  }

  // Saison passée clôturée, pour peupler le Hall of Fame dès le premier seed.
  const pastPromotion = await db.promotion.create({
    data: {
      name: PAST_PROMOTION_NAME,
      status: PromotionStatus.CLOSED,
      startDate: new Date(now.getTime() - 90 * DAY_MS),
      endDate: new Date(now.getTime() - 60 * DAY_MS),
      initialCapital: 1_000_000,
      rules: defaultPromotionRules,
    },
  });
  const pastResults: Array<{ userId: string; cumulativeReturnPct: number }> = [
    { userId: participantStates[0].userId, cumulativeReturnPct: 18 },
    { userId: participantStates[1].userId, cumulativeReturnPct: 9 },
    { userId: participantStates[2].userId, cumulativeReturnPct: 2 },
  ];
  for (const result of pastResults) {
    const portfolio = await db.portfolio.create({ data: { userId: result.userId, promotionId: pastPromotion.id } });
    await db.performanceSnapshot.create({
      data: {
        portfolioId: portfolio.id,
        timestamp: pastPromotion.endDate,
        totalValue: 1_000_000 * (1 + result.cumulativeReturnPct / 100),
        dailyReturnPct: 0,
        cumulativeReturnPct: result.cumulativeReturnPct,
      },
    });
  }

  console.log("Comptes de démonstration créés :");
  console.log(`  Admin       : ${admin.name} (mot de passe "${DEMO_PASSWORD}")`);
  for (const p of participantSeeds) console.log(`  Participant : ${p.name} (mot de passe "${DEMO_PASSWORD}")`);
  console.log(`Promotion : "${PROMOTION_NAME}" (${promotion.id})`);
  console.log(`Saison passée (Hall of Fame) : "${PAST_PROMOTION_NAME}" (${pastPromotion.id})`);

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("Échec du seed :", error);
  await db.$disconnect();
  process.exit(1);
});
