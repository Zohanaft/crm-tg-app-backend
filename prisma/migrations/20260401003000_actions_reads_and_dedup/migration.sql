-- Add dedup key for action-level de-duplication
ALTER TABLE "actions"
ADD COLUMN "dedupKey" TEXT;

-- Create read receipts for notifications
CREATE TABLE "action_reads" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "action_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "actions_workspaceId_type_dedupKey_key"
ON "actions"("workspaceId", "type", "dedupKey");

CREATE UNIQUE INDEX "action_reads_actionId_userId_key"
ON "action_reads"("actionId", "userId");

CREATE INDEX "action_reads_userId_readAt_idx"
ON "action_reads"("userId", "readAt");

ALTER TABLE "action_reads"
ADD CONSTRAINT "action_reads_actionId_fkey"
FOREIGN KEY ("actionId") REFERENCES "actions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "action_reads"
ADD CONSTRAINT "action_reads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
