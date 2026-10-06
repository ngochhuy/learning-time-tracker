"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { toActionError, type ActionResult } from "@/lib/errors";
import { deleteCompletedSession, updateCompletedSession } from "@/lib/history-service";

const id = z.string().min(1);
const timestamp = z.string().datetime({ offset: true }).transform((value) => new Date(value));

function revalidateLearningViews() { revalidatePath("/history"); revalidatePath("/dashboard"); revalidatePath("/"); }

export async function updateSession(sessionId: string, startedAt: string, endedAt: string, categoryId?: string | null): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await updateCompletedSession(user.id, id.parse(sessionId), timestamp.parse(startedAt), timestamp.parse(endedAt), categoryId ? id.parse(categoryId) : null);
    revalidateLearningViews();
    return { ok: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function deleteSession(sessionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await deleteCompletedSession(user.id, id.parse(sessionId));
    revalidateLearningViews();
    return { ok: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
