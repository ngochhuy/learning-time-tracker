import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { normalizeCategoryName } from "@/lib/utils";

function validateName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 50) throw new AppError("INVALID_CATEGORY_NAME");
  return { name: trimmed, normalizedName: normalizeCategoryName(trimmed) };
}

const colorKeys = ["matcha", "sage", "olive", "leaf", "tea"] as const;
export type CategoryColorKey = (typeof colorKeys)[number] | `custom:#${string}`;

function validateColorKey(value?: string): CategoryColorKey {
  if (colorKeys.includes(value as (typeof colorKeys)[number])) return value as (typeof colorKeys)[number];
  if (value && /^custom:#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase() as CategoryColorKey;
  return "matcha";
}

export async function getCategories(userId: string) {
  return db.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function createCategory(userId: string, rawName: string, colorKey?: string) {
  const { name, normalizedName } = validateName(rawName);
  try {
    return await db.category.create({ data: { userId, name, normalizedName, colorKey: validateColorKey(colorKey) } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new AppError("DUPLICATE_CATEGORY");
    }
    throw error;
  }
}

export async function renameCategory(userId: string, categoryId: string, rawName: string) {
  const { name, normalizedName } = validateName(rawName);
  const category = await db.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } });
  if (!category) throw new AppError("CATEGORY_NOT_FOUND");
  try {
    return await db.category.update({ where: { id: category.id }, data: { name, normalizedName } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new AppError("DUPLICATE_CATEGORY");
    }
    throw error;
  }
}

export async function deleteCategory(userId: string, categoryId: string) {
  const summary = await db.learningSession.aggregate({
    where: { userId, categoryId, status: "COMPLETED" },
    _count: { id: true },
    _sum: { durationSeconds: true },
  });
  const result = await db.category.deleteMany({ where: { id: categoryId, userId } });
  if (result.count !== 1) throw new AppError("CATEGORY_NOT_FOUND");
  return { transferredSessionCount: summary._count.id, transferredDurationSeconds: summary._sum.durationSeconds ?? 0 };
}

export async function getCategoryOverview(userId: string) {
  const [categories, grouped] = await Promise.all([
    db.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.learningSession.groupBy({
      by: ["categoryId"],
      where: { userId, status: "COMPLETED" },
      _count: { id: true },
      _sum: { durationSeconds: true },
      _max: { endedAt: true },
    }),
  ]);
  const totals = new Map(grouped.map((item) => [item.categoryId ?? "uncategorized", item]));
  const normalizedCategories = categories.map((category) => {
    const total = totals.get(category.id);
    return {
      id: category.id,
      name: category.name,
      colorKey: validateColorKey(category.colorKey),
      durationSeconds: total?._sum.durationSeconds ?? 0,
      sessionCount: total?._count.id ?? 0,
      lastCompletedAt: total?._max.endedAt ?? null,
    };
  }).sort((a, b) => b.durationSeconds - a.durationSeconds || a.name.localeCompare(b.name, "vi"));
  const uncategorizedTotal = totals.get("uncategorized");
  const uncategorized = {
    durationSeconds: uncategorizedTotal?._sum.durationSeconds ?? 0,
    sessionCount: uncategorizedTotal?._count.id ?? 0,
  };
  return {
    categories: normalizedCategories,
    uncategorized,
    totalSeconds: normalizedCategories.reduce((sum, category) => sum + category.durationSeconds, uncategorized.durationSeconds),
  };
}
