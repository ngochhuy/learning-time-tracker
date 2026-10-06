import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { normalizeCategoryName } from "@/lib/utils";

function validateName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 50) throw new AppError("INVALID_CATEGORY_NAME");
  return { name: trimmed, normalizedName: normalizeCategoryName(trimmed) };
}

export async function getCategories(userId: string) {
  return db.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function createCategory(userId: string, rawName: string) {
  const { name, normalizedName } = validateName(rawName);
  try {
    return await db.category.create({ data: { userId, name, normalizedName } });
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
  const result = await db.category.deleteMany({ where: { id: categoryId, userId } });
  if (result.count !== 1) throw new AppError("CATEGORY_NOT_FOUND");
}
