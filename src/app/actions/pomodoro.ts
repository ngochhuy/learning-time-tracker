"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { toActionError, type ActionResult } from "@/lib/errors";
import { assignPomodoroTask, createPomodoroTask, deletePomodoroTask, savePomodoroPreferences, updatePomodoroTask, type PomodoroPreferencesData, type PomodoroTaskData } from "@/lib/pomodoro-service";
import { serializeTimerSession, type TimerSession } from "@/lib/timer-payload";
import { cancelLearningSession, finishLearningSession, pauseLearningSession, resumeLearningSession, startLearningSession } from "@/lib/timer-service";

const id = z.string().min(1);
const taskInput = z.object({ title: z.string().trim().min(1).max(200), estimate: z.number().int().min(1).max(10), plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), categoryId: z.string().min(1).nullable().optional() });
const preferenceInput = z.object({
  focusMinutes: z.number().int().min(15).max(60),
  shortBreakMinutes: z.number().int().min(3).max(15),
  longBreakMinutes: z.number().int().min(10).max(35),
  customMinutes: z.number().int().min(1).max(120),
  cyclesBeforeLongBreak: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
  autoStartBreak: z.boolean(),
  autoStartFocus: z.boolean(),
  sound: z.enum(["off", "rain", "tea", "ocean", "bowl"]),
  volume: z.number().int().min(0).max(100),
  chime: z.enum(["ceramic", "tibetan", "rain", "silent"]),
});

function revalidatePomodoroViews() {
  for (const path of ["/", "/pomodoro", "/dashboard", "/history", "/categories"]) revalidatePath(path);
}

export async function addPomodoroTask(title: string, estimate: number, plannedDate?: string, categoryId?: string | null): Promise<ActionResult<PomodoroTaskData>> {
  try {
    const user = await getCurrentUser();
    const input = taskInput.parse({ title, estimate, plannedDate, categoryId });
    const task = await createPomodoroTask(user.id, input.title, input.estimate, input.plannedDate, input.categoryId);
    revalidatePomodoroViews();
    return { ok: true, data: task };
  } catch (error) { return toActionError(error); }
}

export async function editPomodoroTask(taskId: string, title: string, estimate: number, plannedDate?: string, categoryId?: string | null): Promise<ActionResult<PomodoroTaskData>> {
  try {
    const user = await getCurrentUser();
    const input = taskInput.parse({ title, estimate, plannedDate, categoryId });
    const task = await updatePomodoroTask(user.id, id.parse(taskId), input);
    revalidatePomodoroViews();
    return { ok: true, data: task };
  } catch (error) { return toActionError(error); }
}

export async function setPomodoroTaskDone(taskId: string, done: boolean): Promise<ActionResult<PomodoroTaskData>> {
  try {
    const user = await getCurrentUser();
    const task = await updatePomodoroTask(user.id, id.parse(taskId), { done: z.boolean().parse(done) });
    revalidatePomodoroViews();
    return { ok: true, data: task };
  } catch (error) { return toActionError(error); }
}

export async function removePomodoroTask(taskId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await deletePomodoroTask(user.id, id.parse(taskId));
    revalidatePomodoroViews();
    return { ok: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function updatePomodoroPreferences(data: PomodoroPreferencesData): Promise<ActionResult<PomodoroPreferencesData>> {
  try {
    const user = await getCurrentUser();
    const preferences = await savePomodoroPreferences(user.id, preferenceInput.parse(data));
    revalidatePomodoroViews();
    return { ok: true, data: preferences };
  } catch (error) { return toActionError(error); }
}

export async function startPomodoroSession(clickedAt: string, taskId: string | null, targetMinutes: number): Promise<ActionResult<TimerSession>> {
  const receivedAt = new Date();
  try {
    const user = await getCurrentUser();
    const targetSeconds = z.number().int().min(15).max(60).parse(targetMinutes) * 60;
    const session = await startLearningSession(user.id, null, clickedAt, null, { taskId: taskId ? id.parse(taskId) : null, targetSeconds }, receivedAt);
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) { return toActionError(error); }
}

export async function completePomodoroSession(sessionId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const session = await finishLearningSession(user.id, id.parse(sessionId), undefined, true, "pomodoro");
    revalidatePomodoroViews();
    return { ok: true, data: { id: session.id } };
  } catch (error) { return toActionError(error); }
}

export async function pausePomodoroSession(sessionId: string, clickedAt: string): Promise<ActionResult<TimerSession>> {
  const receivedAt = new Date();
  try { const user = await getCurrentUser(); const session = await pauseLearningSession(user.id, id.parse(sessionId), clickedAt, "pomodoro", receivedAt); revalidatePomodoroViews(); return { ok: true, data: serializeTimerSession(session) }; } catch (error) { return toActionError(error); }
}

export async function resumePomodoroSession(sessionId: string): Promise<ActionResult<TimerSession>> {
  try { const user = await getCurrentUser(); const session = await resumeLearningSession(user.id, id.parse(sessionId), "pomodoro"); revalidatePomodoroViews(); return { ok: true, data: serializeTimerSession(session) }; } catch (error) { return toActionError(error); }
}

export async function finishPomodoroEarly(sessionId: string): Promise<ActionResult<{ id: string }>> {
  try { const user = await getCurrentUser(); const session = await finishLearningSession(user.id, id.parse(sessionId), undefined, false, "pomodoro"); for (const path of ["/", "/pomodoro", "/dashboard", "/history", "/categories"]) revalidatePath(path); return { ok: true, data: { id: session.id } }; } catch (error) { return toActionError(error); }
}

export async function cancelPomodoroSession(sessionId: string): Promise<ActionResult> {
  try { const user = await getCurrentUser(); await cancelLearningSession(user.id, id.parse(sessionId), "pomodoro"); revalidatePomodoroViews(); return { ok: true, data: undefined }; } catch (error) { return toActionError(error); }
}

export async function selectPomodoroTask(sessionId: string, taskId: string | null): Promise<ActionResult<TimerSession>> {
  try {
    const user = await getCurrentUser();
    const session = await assignPomodoroTask(user.id, id.parse(sessionId), taskId === null ? null : id.parse(taskId));
    revalidatePomodoroViews();
    return { ok: true, data: serializeTimerSession(session) };
  } catch (error) { return toActionError(error); }
}
