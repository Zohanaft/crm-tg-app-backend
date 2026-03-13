-- Create trigger function and trigger for plan_expired notification
CREATE OR REPLACE FUNCTION notify_plan_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."planId" = 1 AND (OLD."planId" IS NULL OR OLD."planId" != 1) THEN
    PERFORM pg_notify(
      'plan_expired',
      json_build_object('user_id', NEW.id)::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_expired_trigger ON "users";
CREATE TRIGGER plan_expired_trigger
  AFTER UPDATE OF "planId" ON "users"
  FOR EACH ROW
  EXECUTE FUNCTION notify_plan_expired();
