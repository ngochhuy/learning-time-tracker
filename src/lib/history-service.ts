import { LearningStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { adjustSessionBounds, sumIntervalSeconds } from "@/lib/session-edit";
import { runSerializable } from "@/lib/transactions";

const completedInclude = {
  category: { select: { id: true, name: true } },
  intervals: { orderBy: { startedAt: "asc" } },
} satisfies Prisma.LearningSessionInclude;

export type HistoryFilters = { categoryId?: string; from?: Date; to?: Date; page?: number; pageSize?: number };

export async function getCompletedHistory(userId: string, filters: HistoryFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  const where: Prisma.LearningSessionWhereInput = {
    userId,
    status: LearningStatus.COMPLETED,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.from || filters.to ? { startedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    db.learningSession.findMany({ where, include: completedInclude, orderBy: { startedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.learningSession.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function verifyOwnedCategory(tx: Prisma.TransactionClient, userId: string, categoryId: string | null) {
  if (!categoryId) return null;
  const category = await tx.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } });
  if (!category) throw new AppError("CATEGORY_NOT_FOUND");
  return category.id;
}

export async function updateCompletedSession(
  userId: string,
  sessionId: string,
  startedAt: Date,
  endedAt: Date,
  categoryId: string | null,
) {
  if (startedAt >= endedAt || endedAt > new Date()) throw new AppError("INVALID_TIME_RANGE");
  return runSerializable(async (tx) => {
    const session = await tx.learningSession.findFirst({
      where: { id: sessionId, userId, status: LearningStatus.COMPLETED },
      include: { intervals: { orderBy: { startedAt: "asc" } } },
    });
    if (!session) throw new AppError("SESSION_NOT_FOUND");
    const conflict = await tx.learningSession.findFirst({
      where: { userId, id: { not: sessionId }, status: LearningStatus.COMPLETED, startedAt: { lt: endedAt }, endedAt: { gt: startedAt } },
      select: { id: true },
    });
    if (conflict) throw new AppError("SESSION_TIME_CONFLICT");
    const revised = adjustSessionBounds(session.intervals, startedAt, endedAt);
    const validCategoryId = await verifyOwnedCategory(tx, userId, categoryId);
    for (const interval of revised) {
      await tx.sessionInterval.update({ where: { id: interval.id }, data: { startedAt: interval.startedAt, endedAt: interval.endedAt } });
    }
    const durationSeconds = sumIntervalSeconds(revised);
    if (durationSeconds < 1) throw new AppError("INVALID_TIME_RANGE");
    return tx.learningSession.update({
      where: { id: sessionId },
      data: { startedAt, endedAt, categoryId: validCategoryId, durationSeconds },
      include: completedInclude,
    });
  });
}

export async function deleteCompletedSession(userId: string, sessionId: string) {
  const result = await db.learningSession.deleteMany({ where: { id: sessionId, userId, status: LearningStatus.COMPLETED } });
  if (result.count !== 1) throw new AppError("SESSION_NOT_FOUND");
}
