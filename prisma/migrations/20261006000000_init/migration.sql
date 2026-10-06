CREATE TYPE "LearningStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "refresh_token_expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verifications" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  "timezone_initialized" BOOLEAN NOT NULL DEFAULT false,
  "daily_goal_minutes" INTEGER NOT NULL DEFAULT 120,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_settings_goal_range" CHECK ("daily_goal_minutes" BETWEEN 1 AND 1440)
);

CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "categories_name_length" CHECK (char_length("name") BETWEEN 1 AND 50)
);

CREATE TABLE "learning_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category_id" TEXT,
  "status" "LearningStatus" NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3),
  "duration_seconds" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learning_sessions_duration_positive" CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0),
  CONSTRAINT "learning_sessions_time_order" CHECK ("ended_at" IS NULL OR "ended_at" > "started_at")
);

CREATE TABLE "session_intervals" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_intervals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_intervals_time_order" CHECK ("ended_at" IS NULL OR "ended_at" > "started_at")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX "accounts_provider_account_key" ON "accounts"("provider_id", "account_id");
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");
CREATE UNIQUE INDEX "categories_user_id_normalized_name_key" ON "categories"("user_id", "normalized_name");
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");
CREATE INDEX "learning_sessions_user_id_started_at_idx" ON "learning_sessions"("user_id", "started_at");
CREATE INDEX "learning_sessions_category_id_idx" ON "learning_sessions"("category_id");
CREATE INDEX "session_intervals_session_id_started_at_idx" ON "session_intervals"("session_id", "started_at");

CREATE UNIQUE INDEX "one_active_session_per_user"
  ON "learning_sessions"("user_id")
  WHERE "status" IN ('RUNNING', 'PAUSED');

CREATE UNIQUE INDEX "one_open_interval_per_session"
  ON "session_intervals"("session_id")
  WHERE "ended_at" IS NULL;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "session_intervals" ADD CONSTRAINT "session_intervals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
