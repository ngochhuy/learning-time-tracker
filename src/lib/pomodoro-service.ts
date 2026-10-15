import { DateTime } from "luxon";
import { LearningStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { runSerializable } from "@/lib/transactions";
import { activeSessionInclude } from "@/lib/timer-service";
import type { CategoryColorKey } from "@/lib/category-colors";

export const preferenceFields = {
  focusMinutes: true,
  shortBreakMinutes: true,
  longBreakMinutes: true,
  customMinutes: true,
  cyclesBeforeLongBreak: true,
  autoStartBreak: true,
  autoStartFocus: true,
  sound: true,
  volume: true,
  chime: true,
} satisfies Prisma.PomodoroPreferencesSelect;

export type PomodoroPreferencesData = Prisma.PomodoroPreferencesGetPayload<{ select: typeof preferenceFields }>;
export type PomodoroTaskData = Pick<Prisma.PomodoroTaskGetPayload<object>, "id" | "title" | "estimate" | "completedPomodoros" | "done"> & {
  plannedDate?: Date;
  categoryId?: string | null;
  archivedAt?: Date | null;
  category?: { id: string; name: string; colorKey: CategoryColorKey } | null;
};

const taskFields = { id: true, title: true, estimate: true, completedPomodoros: true, done: true, plannedDate: true, categoryId: true, archivedAt: true, category: { select: { id: true, name: true, colorKey: true } } } as const;
type PomodoroTaskRecord = Prisma.PomodoroTaskGetPayload<{ select: typeof taskFields }>;

function serializePomodoroTask(task: PomodoroTaskRecord): PomodoroTaskData {
  return {
    ...task,
    category: task.category ? { ...task.category, colorKey: task.category.colorKey as CategoryColorKey } : null,
  };
}

export async function getPomodoroData(userId: string, timezone: string, selectedDate?: string) {
  const day = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : DateTime.now().setZone(timezone).toISODate()!;
  const selectedStart = DateTime.fromISO(day, { zone: "utc" }).startOf("day").toJSDate();
  const selectedEnd = DateTime.fromISO(day, { zone: "utc" }).plus({ days: 1 }).startOf("day").toJSDate();
  const todayStart = DateTime.now().setZone(timezone).startOf("day").toUTC().toJSDate();
  const todayEnd = DateTime.now().setZone(timezone).plus({ days: 1 }).startOf("day").toUTC().toJSDate();
  const [tasks, preferences, completedTotal, todayFocuses, selectedFocuses] = await Promise.all([
    db.pomodoroTask.findMany({ where: { userId, plannedDate: selectedStart }, orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }], select: taskFields }),
    db.pomodoroPreferences.upsert({ where: { userId }, create: { userId }, update: {}, select: preferenceFields }),
    db.pomodoroFocus.count({ where: { userId, completedAt: { not: null } } }),
    db.pomodoroFocus.findMany({
      where: { userId, completedAt: { gte: todayStart, lt: todayEnd } },
      select: { session: { select: { durationSeconds: true } } },
    }),
    db.pomodoroFocus.findMany({
      where: { userId, completedAt: { gte: selectedStart, lt: selectedEnd }, taskId: { not: null } },
      select: { taskId: true },
    }),
  ]);
  const completedByTask = new Map<string, number>();
  for (const focus of selectedFocuses) if (focus.taskId) completedByTask.set(focus.taskId, (completedByTask.get(focus.taskId) ?? 0) + 1);
  const tasksWithProgress = tasks.map((task) => serializePomodoroTask({ ...task, completedPomodoros: completedByTask.get(task.id) ?? 0 }));
  const plannedPomodoros = tasksWithProgress.reduce((total, task) => total + task.estimate, 0);
  const completedPomodoros = tasksWithProgress.reduce((total, task) => total + task.completedPomodoros, 0);
  return {
    tasks: tasksWithProgress,
    preferences,
    completedTotal,
    completedToday: todayFocuses.length,
    completedTodaySeconds: todayFocuses.reduce((total, focus) => total + (focus.session.durationSeconds ?? 0), 0),
    selectedDate: day,
    progress: { plannedPomodoros, completedPomodoros, hasPlan: plannedPomodoros > 0 },
  };
}

export async function createPomodoroTask(userId: string, title: string, estimate: number, plannedDate?: string, categoryId?: string | null): Promise<PomodoroTaskData> {
  const planned = plannedDate ? DateTime.fromISO(plannedDate, { zone: "utc" }).startOf("day").toJSDate() : DateTime.now().startOf("day").toJSDate();
  if (categoryId) {
    const category = await db.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } });
    if (!category) throw new AppError("CATEGORY_NOT_FOUND");
  }
  return serializePomodoroTask(await db.pomodoroTask.create({ data: { userId, title, estimate, plannedDate: planned, categoryId: categoryId ?? null }, select: taskFields }));
}

export async function updatePomodoroTask(userId: string, taskId: string, data: { title?: string; estimate?: number; done?: boolean; plannedDate?: string; categoryId?: string | null }): Promise<PomodoroTaskData> {
  const existing = await db.pomodoroTask.findFirst({ where: { id: taskId, userId, archivedAt: null }, select: { id: true } });
  if (!existing) throw new AppError("POMODORO_TASK_NOT_FOUND");
  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, userId }, select: { id: true } });
    if (!category) throw new AppError("CATEGORY_NOT_FOUND");
  }
  const { plannedDate, ...rest } = data;
  const result = await db.pomodoroTask.updateMany({ where: { id: taskId, userId, archivedAt: null }, data: { ...rest, ...(plannedDate ? { plannedDate: DateTime.fromISO(plannedDate, { zone: "utc" }).startOf("day").toJSDate() } : {}) } });
  if (!result.count) throw new AppError("POMODORO_TASK_NOT_FOUND");
  return serializePomodoroTask(await db.pomodoroTask.findUniqueOrThrow({ where: { id: taskId }, select: taskFields }));
}

export async function deletePomodoroTask(userId: string, taskId: string) {
  const result = await db.pomodoroTask.updateMany({ where: { id: taskId, userId, archivedAt: null }, data: { archivedAt: new Date() } });
  if (!result.count) throw new AppError("POMODORO_TASK_NOT_FOUND");
}

export async function savePomodoroPreferences(userId: string, data: PomodoroPreferencesData): Promise<PomodoroPreferencesData> {
  return db.pomodoroPreferences.upsert({ where: { userId }, create: { userId, ...data }, update: data, select: preferenceFields });
}

export async function assignPomodoroTask(userId: string, sessionId: string, taskId: string | null) {
  return runSerializable(async (tx) => {
    const session = await tx.learningSession.findFirst({ where: { id: sessionId, userId, status: { in: [LearningStatus.RUNNING, LearningStatus.PAUSED] } }, include: activeSessionInclude });
    if (!session?.pomodoroFocus) throw new AppError("SESSION_NOT_FOUND");
    const task = taskId ? await tx.pomodoroTask.findFirst({ where: { id: taskId, userId, archivedAt: null }, select: { id: true, title: true, categoryId: true } }) : null;
    if (taskId && !task) throw new AppError("POMODORO_TASK_NOT_FOUND");
    await tx.pomodoroFocus.update({ where: { sessionId }, data: { taskId: task?.id ?? null } });
    return tx.learningSession.update({ where: { id: sessionId }, data: { note: task?.title ?? null, categoryId: task?.categoryId ?? null }, include: activeSessionInclude });
  });
}
