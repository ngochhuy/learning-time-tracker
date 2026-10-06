"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCategory, deleteCategory, renameCategory } from "@/lib/category-service";
import { getCurrentUser } from "@/lib/current-user";
import { toActionError, type ActionResult } from "@/lib/errors";

const idSchema = z.string().min(1);
const nameSchema = z.string().min(1).max(200);

function refreshCategoryViews() {
  revalidatePath("/");
  revalidatePath("/categories");
}

export async function addCategory(name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const category = await createCategory(user.id, nameSchema.parse(name));
    refreshCategoryViews();
    return { ok: true, data: { id: category.id } };
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

export async function removeCategory(categoryId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await deleteCategory(user.id, idSchema.parse(categoryId));
    refreshCategoryViews();
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
