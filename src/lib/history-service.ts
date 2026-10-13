import { LearningStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { adjustSessionBounds, sumIntervalSeconds } from "@/lib/session-edit";
import { runSerializable } from "@/lib/transactions";
import { DateTime } from "luxon";
import { allocateIntervalsByDay } from "@/lib/dashboard-service";

const completedInclude = {
  category: { select: { id: true, name: true } },
  intervals: { orderBy: { startedAt: "asc" } },
} satisfies Prisma.LearningSessionInclude;

export type HistoryFilters = { categoryId?: string; uncategorized?: boolean; from?: Date; to?: Date; query?: string; page?: number; pageSize?: number };

function historyWhere(userId: string, filters: HistoryFilters): Prisma.LearningSessionWhereInput {
  return {
    userId,
    status: LearningStatus.COMPLETED,
    ...(filters.uncategorized ? { categoryId: null } : filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.from || filters.to ? { startedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    ...(filters.query ? { category: { name: { contains: filters.query, mode: "insensitive" } } } : {}),
  };
}

export async function getCompletedHistory(userId: string, filters: HistoryFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  const where = historyWhere(userId, filters);
  const [items, total] = await Promise.all([
    db.learningSession.findMany({ where, include: completedInclude, orderBy: { startedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.learningSession.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getHistoryExport(userId: string, filters: HistoryFilters) {
  return db.learningSession.findMany({
    where: historyWhere(userId, filters),
    select: { startedAt: true, endedAt: true, durationSeconds: true, category: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
    take: 20_001,
  });
}

export async function getHistoryOverview(userId: string) {
  const settings = await db.userSettings.findUnique({ where: { userId }, select: { timezone: true, dailyGoalMinutes: true } });
  const zone = settings?.timezone ?? "Asia/Bangkok";
  const now = DateTime.now().setZone(zone);
  const firstDay = now.minus({ days: 13 }).startOf("day");
  const [aggregate, intervals] = await Promise.all([
    db.learningSession.aggregate({ where: { userId, status: LearningStatus.COMPLETED }, _count: { id: true }, _sum: { durationSeconds: true }, _avg: { durationSeconds: true } }),
    db.sessionInterval.findMany({
      where: { endedAt: { gte: firstDay.toUTC().toJSDate(), not: null }, session: { userId, status: LearningStatus.COMPLETED } },
      select: { startedAt: true, endedAt: true, session: { select: { category: { select: { id: true, name: true } } } } },
    }),
  ]);
  const days = allocateIntervalsByDay(intervals, zone).dayTotals;
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = now.minus({ days: 6 - index });
    return { date: day.toISODate()!, label: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][day.weekday % 7]!, seconds: days.get(day.toISODate()!) ?? 0 };
  });
  const previous = Array.from({ length: 7 }, (_, index) => days.get(now.minus({ days: 13 - index }).toISODate()!) ?? 0);
  const thisTotal = week.reduce((sum, day) => sum + day.seconds, 0);
  const lastTotal = previous.reduce((sum, seconds) => sum + seconds, 0);
  const peak = week.reduce<(typeof week)[number] | null>((best, day) => !best || day.seconds > best.seconds ? day : best, null);
  return {
    total: aggregate._count.id,
    totalSeconds: aggregate._sum.durationSeconds ?? 0,
    averageSeconds: Math.round(aggregate._avg.durationSeconds ?? 0),
    goalRate: Math.round(week.filter((day) => day.seconds >= (settings?.dailyGoalMinutes ?? 120) * 60).length / 7 * 1_000) / 10,
    week,
    weekChange: lastTotal > 0 ? Math.round((thisTotal - lastTotal) / lastTotal * 100) : null,
    peak: peak && peak.seconds > 0 ? peak : null,
    timezone: zone,
  };
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
