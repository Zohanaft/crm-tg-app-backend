-- Backfill: create default workspace "Рабочее пространство" for users who have none
WITH users_without_workspace AS (
  SELECT u.id, u.username
  FROM "users" u
  WHERE NOT EXISTS (
    SELECT 1 FROM "workspace_members" wm WHERE wm."userId" = u.id
  )
),
inserted AS (
  INSERT INTO "workspaces" (id, name, "ownerId", "ownerName", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, 'Рабочее пространство', id, username, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM users_without_workspace
  RETURNING id, "ownerId"
)
INSERT INTO "workspace_members" (id, "workspaceId", "userId")
SELECT gen_random_uuid()::text, inserted.id, inserted."ownerId"
FROM inserted;
