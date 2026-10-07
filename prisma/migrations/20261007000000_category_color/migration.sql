-- Persist the Matcha & Sage palette selected when a category is created.
ALTER TABLE "categories" ADD COLUMN "color_key" TEXT NOT NULL DEFAULT 'matcha';
