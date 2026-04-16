-- CreateTable
CREATE TABLE "product_cards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "workspaceOwnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_workspace_links" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_workspace_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files_service" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_cards_workspaceOwnerId_idx" ON "product_cards"("workspaceOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "card_workspace_links_cardId_workspaceId_key" ON "card_workspace_links"("cardId", "workspaceId");

-- CreateIndex
CREATE INDEX "card_workspace_links_cardId_idx" ON "card_workspace_links"("cardId");

-- CreateIndex
CREATE INDEX "card_workspace_links_workspaceId_idx" ON "card_workspace_links"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "files_service_key_key" ON "files_service"("key");

-- CreateIndex
CREATE INDEX "files_service_entityName_cid_idx" ON "files_service"("entityName", "cid");

-- AddForeignKey
ALTER TABLE "product_cards" ADD CONSTRAINT "product_cards_workspaceOwnerId_fkey" FOREIGN KEY ("workspaceOwnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_workspace_links" ADD CONSTRAINT "card_workspace_links_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "product_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_workspace_links" ADD CONSTRAINT "card_workspace_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
