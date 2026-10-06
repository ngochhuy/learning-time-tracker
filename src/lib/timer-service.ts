import { LearningStatus, Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { getClosedDurationSeconds } from "@/lib/timer";
import { runSerializable } from "@/lib/transactions";
import { db } from "@/lib/db";

const activeSessionInclude = {
  intervals: { orderBy: { startedAt: "asc" } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.LearningSessionInclude;

export type ActiveSession = Prisma.LearningSessionGetPayload<{
  include: typeof activeSessionInclude;
}>;

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

export async function startLearningSession(userId: string, categoryId?: string | null) {
  try {
    return await runSerializable(async (tx) => {
      await verifyCategory(tx, userId, categoryId);
      const active = await tx.learningSession.findFirst({
        where: { userId, status: { in: [LearningStatus.RUNNING, LearningStatus.PAUSED] } },
        select: { id: true },
      });
      if (active) throw new AppError("ACTIVE_SESSION_EXISTS");

      const now = new Date();
      return tx.learningSession.create({
        data: {
          userId,
          categoryId: categoryId ?? null,
          status: LearningStatus.RUNNING,
          startedAt: now,
          intervals: { create: { startedAt: now } },
        },
        include: activeSessionInclude,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("ACTIVE_SESSION_EXISTS");
    }
    throw error;
  }
}

export async function pauseLearningSession(userId: string, sessionId: string) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    if (session.status !== LearningStatus.RUNNING) throw new AppError("INVALID_SESSION_STATE");

    const openInterval = session.intervals.find((interval) => !interval.endedAt);
    if (!openInterval) throw new AppError("INVALID_SESSION_STATE");

    const now = new Date();
    await tx.sessionInterval.update({ where: { id: openInterval.id }, data: { endedAt: now } });
    return tx.learningSession.update({
      where: { id: session.id },
      data: { status: LearningStatus.PAUSED },
      include: activeSessionInclude,
    });
  });
}

export async function resumeLearningSession(userId: string, sessionId: string) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    if (session.status !== LearningStatus.PAUSED) throw new AppError("INVALID_SESSION_STATE");
    if (session.intervals.some((interval) => !interval.endedAt)) {
      throw new AppError("INVALID_SESSION_STATE");
    }

    const now = new Date();
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

export async function finishLearningSession(userId: string, sessionId: string) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
    if (session.status !== LearningStatus.RUNNING && session.status !== LearningStatus.PAUSED) {
      throw new AppError("INVALID_SESSION_STATE");
    }

    const now = new Date();
    const openInterval = session.intervals.find((interval) => !interval.endedAt);
    if (openInterval) {
      await tx.sessionInterval.update({ where: { id: openInterval.id }, data: { endedAt: now } });
    }

    const intervals = await tx.sessionInterval.findMany({
      where: { sessionId: session.id },
      orderBy: { startedAt: "asc" },
    });
    const durationSeconds = getClosedDurationSeconds(intervals);
    if (durationSeconds < 1) throw new AppError("INVALID_TIME_RANGE");

    return tx.learningSession.update({
      where: { id: session.id },
      data: { status: LearningStatus.COMPLETED, endedAt: now, durationSeconds },
      include: activeSessionInclude,
    });
  });
}

export async function cancelLearningSession(userId: string, sessionId: string) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
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
) {
  return runSerializable(async (tx) => {
    const session = await getOwnedSession(tx, userId, sessionId);
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
