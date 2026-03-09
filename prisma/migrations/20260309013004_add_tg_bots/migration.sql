-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tg_bots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "isBot" BOOLEAN,
    "firstName" TEXT,
    "username" TEXT,
    "canJoinGroups" BOOLEAN,
    "canReadAllGroupMessages" BOOLEAN,
    "supportsInlineQueries" BOOLEAN,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tg_bots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tg_bots_botId_key" ON "tg_bots"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "tg_bots_token_key" ON "tg_bots"("token");

-- CreateIndex
CREATE INDEX "tg_bots_userId_idx" ON "tg_bots"("userId");

-- AddForeignKey
ALTER TABLE "tg_bots" ADD CONSTRAINT "tg_bots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
