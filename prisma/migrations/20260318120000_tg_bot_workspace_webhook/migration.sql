-- AlterTable
ALTER TABLE "tg_bots" ADD COLUMN "workspaceId" TEXT,
ADD COLUMN "webhookSecret" TEXT;

-- Backfill workspace: first workspace owned by bot's user (by createdAt)
UPDATE "tg_bots" b
SET "workspaceId" = (
  SELECT w.id
  FROM "workspaces" w
  WHERE w."ownerId" = b."userId"
  ORDER BY w."createdAt" ASC
  LIMIT 1
)
WHERE b."workspaceId" IS NULL;

-- Users with bots but no workspace (edge case): create default workspace
INSERT INTO "workspaces" (id, name, "ownerId", "ownerName", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Default', b."userId", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId" FROM "tg_bots" WHERE "workspaceId" IS NULL) b
WHERE NOT EXISTS (
  SELECT 1 FROM "workspaces" w WHERE w."ownerId" = b."userId"
);

UPDATE "tg_bots" b
SET "workspaceId" = (
  SELECT w.id FROM "workspaces" w WHERE w."ownerId" = b."userId" ORDER BY w."createdAt" ASC LIMIT 1
)
WHERE b."workspaceId" IS NULL;

INSERT INTO "workspace_members" (id, "workspaceId", "userId")
SELECT gen_random_uuid()::text, w.id, w."ownerId"
FROM "workspaces" w
WHERE w.name = 'Default'
  AND NOT EXISTS (
    SELECT 1 FROM "workspace_members" wm WHERE wm."workspaceId" = w.id AND wm."userId" = w."ownerId"
  );

-- Enforce NOT NULL
ALTER TABLE "tg_bots" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tg_bots_webhookSecret_key" ON "tg_bots"("webhookSecret");

-- CreateIndex
CREATE INDEX "tg_bots_workspaceId_idx" ON "tg_bots"("workspaceId");

-- AddForeignKey
ALTER TABLE "tg_bots" ADD CONSTRAINT "tg_bots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
