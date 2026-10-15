"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { toActionError, type ActionResult } from "@/lib/errors";
import { deleteAllCompletedSessions, deleteCompletedSession, updateCompletedSession } from "@/lib/history-service";

const id = z.string().min(1);
const timestamp = z.string().datetime({ offset: true }).transform((value) => new Date(value));

function revalidateLearningViews() { for (const path of ["/history", "/dashboard", "/", "/pomodoro", "/categories"]) revalidatePath(path); }

export async function updateSession(sessionId: string, startedAt: string, endedAt: string, categoryId?: string | null, note?: string | null): Promise<ActionResult<{ startedAt: string; endedAt: string; durationSeconds: number; note: string | null }>> {
  try {
    const user = await getCurrentUser();
    const session = await updateCompletedSession(user.id, id.parse(sessionId), timestamp.parse(startedAt), timestamp.parse(endedAt), categoryId ? id.parse(categoryId) : null, note);
    revalidateLearningViews();
    return { ok: true, data: { startedAt: session.startedAt.toISOString(), endedAt: session.endedAt!.toISOString(), durationSeconds: session.durationSeconds!, note: session.note } };
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

export async function deleteAllSessions(): Promise<ActionResult<{ deleted: number }>> {
  try {
    const user = await getCurrentUser();
    const result = await deleteAllCompletedSessions(user.id);
    revalidateLearningViews();
    return { ok: true, data: { deleted: result.count } };
  } catch (error) { return toActionError(error); }
}
