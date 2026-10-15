CREATE TABLE "pomodoro_tasks" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "estimate" INTEGER NOT NULL DEFAULT 1,
  "completed_pomodoros" INTEGER NOT NULL DEFAULT 0,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pomodoro_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pomodoro_tasks_estimate_check" CHECK ("estimate" BETWEEN 1 AND 10),
  CONSTRAINT "pomodoro_tasks_completed_check" CHECK ("completed_pomodoros" >= 0)
);

CREATE TABLE "pomodoro_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "focus_minutes" INTEGER NOT NULL DEFAULT 25,
  "short_break_minutes" INTEGER NOT NULL DEFAULT 5,
  "long_break_minutes" INTEGER NOT NULL DEFAULT 15,
  "custom_minutes" INTEGER NOT NULL DEFAULT 45,
  "cycles_before_long_break" INTEGER NOT NULL DEFAULT 4,
  "auto_start_break" BOOLEAN NOT NULL DEFAULT true,
  "auto_start_focus" BOOLEAN NOT NULL DEFAULT false,
  "sound" TEXT NOT NULL DEFAULT 'off',
  "volume" INTEGER NOT NULL DEFAULT 65,
  "chime" TEXT NOT NULL DEFAULT 'ceramic',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pomodoro_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pomodoro_preferences_focus_check" CHECK ("focus_minutes" BETWEEN 15 AND 60),
  CONSTRAINT "pomodoro_preferences_short_check" CHECK ("short_break_minutes" BETWEEN 3 AND 15),
  CONSTRAINT "pomodoro_preferences_long_check" CHECK ("long_break_minutes" BETWEEN 10 AND 35),
  CONSTRAINT "pomodoro_preferences_custom_check" CHECK ("custom_minutes" BETWEEN 1 AND 120),
  CONSTRAINT "pomodoro_preferences_cycles_check" CHECK ("cycles_before_long_break" IN (2, 4, 6, 8)),
  CONSTRAINT "pomodoro_preferences_volume_check" CHECK ("volume" BETWEEN 0 AND 100)
);

CREATE TABLE "pomodoro_focuses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "task_id" TEXT,
  "target_seconds" INTEGER NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pomodoro_focuses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pomodoro_focuses_target_check" CHECK ("target_seconds" > 0)
);

CREATE INDEX "pomodoro_tasks_user_id_created_at_idx" ON "pomodoro_tasks"("user_id", "created_at");
CREATE UNIQUE INDEX "pomodoro_preferences_user_id_key" ON "pomodoro_preferences"("user_id");
CREATE UNIQUE INDEX "pomodoro_focuses_session_id_key" ON "pomodoro_focuses"("session_id");
CREATE INDEX "pomodoro_focuses_user_id_completed_at_idx" ON "pomodoro_focuses"("user_id", "completed_at");
ALTER TABLE "pomodoro_tasks" ADD CONSTRAINT "pomodoro_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pomodoro_preferences" ADD CONSTRAINT "pomodoro_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pomodoro_focuses" ADD CONSTRAINT "pomodoro_focuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pomodoro_focuses" ADD CONSTRAINT "pomodoro_focuses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pomodoro_focuses" ADD CONSTRAINT "pomodoro_focuses_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "pomodoro_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
