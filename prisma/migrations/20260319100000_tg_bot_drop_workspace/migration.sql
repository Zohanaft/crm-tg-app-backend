-- DropForeignKey
ALTER TABLE "tg_bots" DROP CONSTRAINT IF EXISTS "tg_bots_workspaceId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "tg_bots_workspaceId_idx";

-- AlterTable
ALTER TABLE "tg_bots" DROP COLUMN IF EXISTS "workspaceId";
