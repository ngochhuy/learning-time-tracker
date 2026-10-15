-- Backfill legacy tasks from their creation date rather than the migration date.
UPDATE "pomodoro_tasks"
SET "planned_date" = ("created_at" AT TIME ZONE 'UTC')::date
WHERE "created_at" < TIMESTAMP '2026-10-16 00:00:00';
