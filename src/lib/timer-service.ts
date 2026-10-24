import { LearningStatus, Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { assertClosedIntervalsValid, assertSessionDurationAllowed, getClosedDurationSeconds } from "@/lib/timer";
import {
  validatePauseTimestamp,
  validateFinishTimestamp,
  validateResumeTimestamp,
  validateStartTimestamp,
  type TimestampValidationContext,
} from "@/lib/timer-timestamp";
import { runSerializable } from "@/lib/transactions";
import { db } from "@/lib/db";
import { normalizeSessionNote } from "@/lib/session-note";

export const activeSessionInclude = {
  intervals: { orderBy: { startedAt: "asc" } },
  category: { select: { id: true, name: true } },
  pomodoroFocus: { select: { targetSeconds: true, taskId: true } },
} satisfies Prisma.LearningSessionInclude;

export type ActiveSession = Prisma.LearningSessionGetPayload<{
  include: typeof activeSessionInclude;
}>;

export type SessionKind = "timer" | "pomodoro";

function assertSessionKind(session: ActiveSession, expected: SessionKind) {
  const actual: SessionKind = session.pomodoroFocus ? "pomodoro" : "timer";
  if (actual !== expected) throw new AppError("INVALID_SESSION_KIND");
}

async function getOwnedSession(
  tx: Prisma.TransactionClient,
  userId: string,
  sessionId: string,
) {
  const session = await tx.learningSession.findFirst({
    where: { id: sessionId, userId },
    include: activeSessionInclude,
  });
  if (!session) throw new AppError("SESSION_NOT_FOUND");
  return session;
}

async function verifyCategory(
  tx: Prisma.TransactionClient,
  userId: string,
  categoryId?: string | null,
) {
  if (!categoryId) return null;
  const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new AppError("CATEGORY_NOT_FOUND");
  return category.id;
}

export async function getActiveSession(userId: string): Promise<ActiveSession | null> {
  return db.learningSession.findFirst({
    where: { userId, status: { in: [LearningStatus.RUNNING, LearningStatus.PAUSED] } },
    include: activeSessionInclude,
    orderBy: { startedAt: "desc" },
  });
}

export async function startLearningSession(
  userId: string,
  categoryId: string | null,
  clickedAt: string,
  note?: string | null,
  pomodoro?: { targetSeconds: number; taskId: string | null; categoryId?: string | null },
  receivedAt: Date = new Date(),
  timestampContext?: TimestampValidationContext,
) {
  const normalizedNote = normalizeSessionNote(note);
  try {
    return await runSerializable(async (tx) => {
      await verifyCategory(tx, userId, categoryId);
      const active = await tx.learningSession.findFirst({
        where: { userId, status: { in: [LearningStatus.RUNNING, LearningStatus.PAUSED] } },
        select: { id: true },
      });
      if (active) throw new AppError("ACTIVE_SESSION_EXISTS");

      let sessionCategoryId = categoryId;
      if (pomodoro?.taskId) {
        const task = await tx.pomodoroTask.findFirst({ where: { id: pomodoro.taskId, userId, archivedAt: null }, select: { id: true, categoryId: true, title: true } });
        if (!task) throw new AppError("POMODORO_TASK_NOT_FOUND");
        sessionCategoryId = pomodoro.categoryId === undefined ? task.categoryId : pomodoro.categoryId;
      }
      if (pomodoro && pomodoro.categoryId !== undefined) {
        await verifyCategory(tx, userId, pomodoro.categoryId);
      }

      const now = validateStartTimestamp(clickedAt, receivedAt, timestampContext);
      const session = await tx.learningSession.create({
        data: {
          userId,
          categoryId: sessionCategoryId ?? null,
          note: normalizedNote,
          status: LearningStatus.RUNNING,
          startedAt: now,
          intervals: { create: { startedAt: now } },
        },
        include: activeSessionInclude,
      });
      if (pomodoro) {
        await tx.pomodoroFocus.create({ data: { userId, sessionId: session.id, taskId: pomodoro.taskId, targetSeconds: pomodoro.targetSeconds } });
        return tx.learningSession.findUniqueOrThrow({ where: { id: session.id }, include: activeSessionInclude });
      }
      return session;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("ACTIVE_SESSION_EXISTS");
    }
    throw error;
  }
}

export async function pauseLearningSession(
  userId: string,
  sessionId: string,
  clickedAt: string,
  kind: SessionKind = "timer",
  receivedAt: Date = new Date(),
  timestampContext?: TimestampValidationContext,
) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    assertSessionKind(session, kind);
    if (session.status !== LearningStatus.RUNNING) throw new AppError("INVALID_SESSION_STATE");

    const openInterval = session.intervals.find((interval) => !interval.endedAt);
    if (!openInterval) throw new AppError("INVALID_SESSION_STATE");

    const endedAt = validatePauseTimestamp(clickedAt, openInterval.startedAt, receivedAt, timestampContext);
    await tx.sessionInterval.update({ where: { id: openInterval.id }, data: { endedAt } });
    return tx.learningSession.update({
      where: { id: session.id },
      data: { status: LearningStatus.PAUSED },
      include: activeSessionInclude,
    });
  });
}

export async function resumeLearningSession(
  userId: string,
  sessionId: string,
  clickedAt: string,
  kind: SessionKind = "timer",
  receivedAt: Date = new Date(),
  timestampContext?: TimestampValidationContext,
) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    assertSessionKind(session, kind);
    if (session.status !== LearningStatus.PAUSED) throw new AppError("INVALID_SESSION_STATE");
    const previousInterval = session.intervals.at(-1);
    if (!previousInterval?.endedAt || session.intervals.some((interval) => !interval.endedAt)) {
      throw new AppError("INVALID_SESSION_STATE");
    }

    const now = validateResumeTimestamp(clickedAt, previousInterval.endedAt, receivedAt, timestampContext);
    return tx.learningSession.update({
      where: { id: session.id },
      data: {
        status: LearningStatus.RUNNING,
        intervals: { create: { startedAt: now } },
      },
      include: activeSessionInclude,
    });
  });
}

export async function finishLearningSession(
  userId: string,
  sessionId: string,
  clickedAt: string,
  note?: string | null,
  completePomodoro = false,
  kind: SessionKind = completePomodoro ? "pomodoro" : "timer",
  allowLongSession = false,
  receivedAt: Date = new Date(),
  timestampContext?: TimestampValidationContext,
) {
  const normalizedNote = note === undefined ? undefined : normalizeSessionNote(note);
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    assertSessionKind(session, kind);
    if (session.status !== LearningStatus.RUNNING && session.status !== LearningStatus.PAUSED) {
      throw new AppError("INVALID_SESSION_STATE");
    }

    const openInterval = session.intervals.find((interval) => !interval.endedAt);
    const lastClosedInterval = session.intervals.at(-1);
    const finishBoundary = openInterval?.startedAt ?? lastClosedInterval?.endedAt;
    if (!finishBoundary) throw new AppError("INVALID_SESSION_STATE");
    const now = validateFinishTimestamp(
      clickedAt,
      finishBoundary,
      receivedAt,
      timestampContext,
      openInterval ? "intervalStartedAt" : "previousIntervalEndedAt",
    );
    if (openInterval) {
      const closedSeconds = getClosedDurationSeconds(session.intervals);
      const targetEndAt = completePomodoro && session.pomodoroFocus && closedSeconds < session.pomodoroFocus.targetSeconds
        ? new Date(Math.min(now.getTime(), openInterval.startedAt.getTime() + (session.pomodoroFocus.targetSeconds - closedSeconds) * 1_000))
        : now;
      await tx.sessionInterval.update({ where: { id: openInterval.id }, data: { endedAt: targetEndAt } });
    }

    const intervals = await tx.sessionInterval.findMany({
      where: { sessionId: session.id },
      orderBy: { startedAt: "asc" },
    });
    assertClosedIntervalsValid(intervals);
    const durationSeconds = getClosedDurationSeconds(intervals);
    if (durationSeconds < 1) throw new AppError("INVALID_TIME_RANGE");
    assertSessionDurationAllowed(durationSeconds, allowLongSession);
    if (completePomodoro && (!session.pomodoroFocus || durationSeconds < session.pomodoroFocus.targetSeconds - 1)) {
      throw new AppError("POMODORO_NOT_READY");
    }

    const completed = await tx.learningSession.update({
      where: { id: session.id },
      data: { status: LearningStatus.COMPLETED, endedAt: now, durationSeconds, ...(normalizedNote === undefined ? {} : { note: normalizedNote }) },
      include: activeSessionInclude,
    });
    if (completePomodoro && session.pomodoroFocus) {
      await tx.pomodoroFocus.update({ where: { sessionId }, data: { completedAt: now } });
      // Completion is derived from PomodoroFocus.completedAt. The legacy counter
      // remains untouched so old records stay compatible.
      if (session.pomodoroFocus.taskId) {
        await tx.pomodoroTask.update({ where: { id: session.pomodoroFocus.taskId }, data: { completedPomodoros: { increment: 1 } } });
      }
    }
    return completed;
  });
}

export async function saveActiveSessionNote(userId: string, sessionId: string, note: string | null, kind: SessionKind = "timer") {
  const normalizedNote = normalizeSessionNote(note);
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    assertSessionKind(session, kind);
    if (session.status !== LearningStatus.RUNNING && session.status !== LearningStatus.PAUSED) {
      throw new AppError("INVALID_SESSION_STATE");
    }
    return tx.learningSession.update({ where: { id: session.id }, data: { note: normalizedNote }, include: activeSessionInclude });
  });
}

export async function cancelLearningSession(userId: string, sessionId: string, kind: SessionKind = "timer") {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    assertSessionKind(session, kind);
    if (session.status !== LearningStatus.RUNNING && session.status !== LearningStatus.PAUSED) {
      throw new AppError("INVALID_SESSION_STATE");
    }
    await tx.learningSession.delete({ where: { id: session.id } });
  });
}

export async function changeActiveSessionCategory(
  userId: string,
  sessionId: string,
  categoryId?: string | null,
  kind: SessionKind = "timer",
) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    assertSessionKind(session, kind);
    if (session.status !== LearningStatus.RUNNING && session.status !== LearningStatus.PAUSED) {
      throw new AppError("INVALID_SESSION_STATE");
    }
    const verifiedCategoryId = await verifyCategory(tx, userId, categoryId);
    return tx.learningSession.update({
      where: { id: session.id },
      data: { categoryId: verifiedCategoryId },
      include: activeSessionInclude,
    });
  });
}
