-- AlterTable
ALTER TABLE "workspaces"
ADD COLUMN "countryCc" TEXT NOT NULL DEFAULT 'ru',
ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'RU';

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "chatId" BIGINT,
    "chatType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_owner_links" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_owner_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_telegramId_key" ON "clients"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "client_owner_links_clientId_ownerId_key" ON "client_owner_links"("clientId", "ownerId");

-- CreateIndex
CREATE INDEX "client_owner_links_ownerId_idx" ON "client_owner_links"("ownerId");

-- CreateIndex
CREATE INDEX "client_owner_links_clientId_idx" ON "client_owner_links"("clientId");

-- AddForeignKey
ALTER TABLE "client_owner_links"
ADD CONSTRAINT "client_owner_links_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_owner_links"
ADD CONSTRAINT "client_owner_links_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
