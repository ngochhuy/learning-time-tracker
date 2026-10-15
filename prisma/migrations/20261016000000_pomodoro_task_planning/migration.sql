ALTER TABLE "pomodoro_tasks"
  ADD COLUMN "planned_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "category_id" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "pomodoro_tasks_user_id_planned_date_archived_at_idx"
  ON "pomodoro_tasks"("user_id", "planned_date", "archived_at");
CREATE INDEX "pomodoro_tasks_category_id_idx"
  ON "pomodoro_tasks"("category_id");

ALTER TABLE "pomodoro_tasks"
  ADD CONSTRAINT "pomodoro_tasks_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
