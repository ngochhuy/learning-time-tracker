"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { toActionError, type ActionResult } from "@/lib/errors";
import { serializeTimerSession, type TimerSession } from "@/lib/timer-payload";
import {
  cancelLearningSession,
  changeActiveSessionCategory,
  finishLearningSession,
  pauseLearningSession,
  resumeLearningSession,
  saveActiveSessionNote,
  startLearningSession,
} from "@/lib/timer-service";

const optionalId = z.string().min(1).nullable().optional();
const sessionIdSchema = z.string().min(1);

function refreshCompletedSessionViews() {
  revalidatePath("/");
  revalidatePath("/pomodoro");
  revalidatePath("/dashboard");
  revalidatePath("/categories");
  revalidatePath("/history");
}

export async function startSession(categoryId: string | null, clickedAt: string, note?: string | null): Promise<ActionResult<TimerSession>> {
  try {
    const user = await getCurrentUser();
    const session = await startLearningSession(user.id, optionalId.parse(categoryId) ?? null, clickedAt, note);
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function pauseSession(sessionId: string, clickedAt: string): Promise<ActionResult<TimerSession>> {
  try {
    const user = await getCurrentUser();
    const session = await pauseLearningSession(user.id, sessionIdSchema.parse(sessionId), clickedAt, "timer");
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resumeSession(sessionId: string): Promise<ActionResult<TimerSession>> {
  try {
    const user = await getCurrentUser();
    const session = await resumeLearningSession(user.id, sessionIdSchema.parse(sessionId), "timer");
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function finishSession(sessionId: string, note?: string | null): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const session = await finishLearningSession(user.id, sessionIdSchema.parse(sessionId), note, false, "timer");
    refreshCompletedSessionViews();
    return { ok: true, data: { id: session.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveSessionNote(sessionId: string, note: string | null): Promise<ActionResult<TimerSession>> {
  try {
    const user = await getCurrentUser();
    const session = await saveActiveSessionNote(user.id, sessionIdSchema.parse(sessionId), note, "timer");
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelSession(sessionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await cancelLearningSession(user.id, sessionIdSchema.parse(sessionId), "timer");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function changeSessionCategory(
  sessionId: string,
  categoryId?: string | null,
): Promise<ActionResult<TimerSession>> {
  try {
    const user = await getCurrentUser();
    const session = await changeActiveSessionCategory(
      user.id,
      sessionIdSchema.parse(sessionId),
      optionalId.parse(categoryId),
      "timer",
    );
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) {
    return toActionError(error);
  }
}
