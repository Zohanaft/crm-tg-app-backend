-- CreateTable
CREATE TABLE "plans" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "maxWorkspaces" INTEGER NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- Seed plans: 1=free(3), 2=premium(5), 3=prime(10)
INSERT INTO "plans" ("id", "name", "maxWorkspaces") VALUES (1, 'free', 3), (2, 'premium', 5), (3, 'prime', 10);

-- Rename User to users and add plan columns
ALTER TABLE "User" RENAME TO "users";

ALTER TABLE "users" ADD COLUMN "planId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "planExpiresAt" TIMESTAMP(3);

ALTER TABLE "users" ADD CONSTRAINT "users_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default workspace for every existing user
WITH inserted AS (
  INSERT INTO "workspaces" (id, name, "ownerId", "ownerName", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, 'Рабочее пространство', id, username, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "users"
  RETURNING id, "ownerId"
)
INSERT INTO "workspace_members" (id, "workspaceId", "userId")
SELECT gen_random_uuid()::text, inserted.id, inserted."ownerId"
FROM inserted;
