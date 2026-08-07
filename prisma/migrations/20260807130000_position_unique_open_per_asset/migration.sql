-- Empêche deux positions ouvertes simultanées sur le même actif dans le même
-- portefeuille (index unique partiel — non représentable dans le DSL Prisma,
-- donc absent de schema.prisma ; voir le commentaire sur le modèle Position).
-- Filet de sécurité au niveau base de données contre la course entre deux
-- ordres BUY concurrents sur le même actif jamais encore détenu (voir
-- src/lib/trading/execute-order.ts, verrou applicatif ajouté en complément).
CREATE UNIQUE INDEX "position_open_portfolio_asset_uidx" ON "Position" ("portfolioId", "assetId") WHERE "closedAt" IS NULL;
