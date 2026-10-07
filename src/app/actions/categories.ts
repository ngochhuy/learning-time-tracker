"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCategory, deleteCategory, renameCategory, type CategoryColorKey } from "@/lib/category-service";
import { getCurrentUser } from "@/lib/current-user";
import { toActionError, type ActionResult } from "@/lib/errors";

const idSchema = z.string().min(1);
const nameSchema = z.string().min(1).max(200);

function refreshCategoryViews() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/categories");
  revalidatePath("/history");
}

export async function addCategory(name: string, colorKey?: CategoryColorKey): Promise<ActionResult<{ id: string; colorKey: CategoryColorKey }>> {
  try {
    const user = await getCurrentUser();
    const category = await createCategory(user.id, nameSchema.parse(name), colorKey);
    refreshCategoryViews();
    return { ok: true, data: { id: category.id, colorKey: category.colorKey as CategoryColorKey } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCategory(categoryId: string, name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const category = await renameCategory(user.id, idSchema.parse(categoryId), nameSchema.parse(name));
    refreshCategoryViews();
    return { ok: true, data: { id: category.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeCategory(categoryId: string): Promise<ActionResult<{ transferredSessionCount: number; transferredDurationSeconds: number }>> {
  try {
    const user = await getCurrentUser();
    const summary = await deleteCategory(user.id, idSchema.parse(categoryId));
    refreshCategoryViews();
    return { ok: true, data: summary };
  } catch (error) {
    return toActionError(error);
  }
}
