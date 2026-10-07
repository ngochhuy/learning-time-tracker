import { DateTime, Interval } from "luxon";
import { db } from "@/lib/db";

type IntervalInput = { startedAt: Date; endedAt: Date | null; session: { category: { id: string; name: string } | null } };

export type CategoryTotal = { id: string | null; name: string; seconds: number };
export type WeekDayTotal = { date: string; label: string; seconds: number; isToday: boolean };

/** Allocate real study intervals to local calendar days, including DST days. */
export function allocateIntervalsByDay(intervals: IntervalInput[], timezone: string) {
  const totals = new Map<string, number>();
  const categories = new Map<string, CategoryTotal>();
  for (const item of intervals) {
    if (!item.endedAt) continue;
    const start = DateTime.fromJSDate(item.startedAt, { zone: "utc" }).setZone(timezone);
    const end = DateTime.fromJSDate(item.endedAt, { zone: "utc" }).setZone(timezone);
    let cursor = start;
    while (cursor < end) {
      const nextDay = cursor.plus({ days: 1 }).startOf("day");
      const boundary = nextDay < end ? nextDay : end;
      const seconds = Math.max(0, Math.floor(Interval.fromDateTimes(cursor, boundary).length("seconds")));
      const day = cursor.toISODate()!;
      totals.set(day, (totals.get(day) ?? 0) + seconds);
      const key = item.session.category?.id ?? "uncategorized";
      const current = categories.get(key) ?? { id: item.session.category?.id ?? null, name: item.session.category?.name ?? "Chưa phân loại", seconds: 0 };
      current.seconds += seconds;
      categories.set(key, current);
      cursor = boundary;
    }
  }
  return { dayTotals: totals, categories: [...categories.values()].sort((a, b) => b.seconds - a.seconds) };
}

export async function getDashboardData(userId: string) {
  const settings = await db.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { timezone: true, dailyGoalMinutes: true },
  });
  const zone = settings.timezone;
  const now = DateTime.now().setZone(zone);
  const today = now.toISODate()!;
  const weekStart = now.startOf("week").toISODate()!;
  // A completed session can begin before this week, hence fetch the small
  // boundary cushion and let allocation decide its local day contributions.
  const from = now.startOf("week").toUTC().toJSDate();
  const intervals = await db.sessionInterval.findMany({
    where: { endedAt: { not: null }, session: { userId, status: "COMPLETED", endedAt: { gte: from } } },
    include: { session: { select: { category: { select: { id: true, name: true } } } } },
    orderBy: { startedAt: "desc" },
  });
  const rangeStart = now.startOf("week").toUTC().toJSDate();
  const rangeEnd = now.toUTC().toJSDate();
  const weeklyIntervals = intervals.map((interval) => ({
    ...interval,
    startedAt: interval.startedAt < rangeStart ? rangeStart : interval.startedAt,
    endedAt: interval.endedAt! > rangeEnd ? rangeEnd : interval.endedAt!,
  })).filter((interval) => interval.endedAt > interval.startedAt);
  const weeklyAllocation = allocateIntervalsByDay(weeklyIntervals, zone);
  const weekSeconds = [...weeklyAllocation.dayTotals.entries()].filter(([day]) => day >= weekStart && day <= today).reduce((sum, [, seconds]) => sum + seconds, 0);
  const todayStart = now.startOf("day").toUTC().toJSDate();
  const todayEnd = now.toUTC().toJSDate();
  const todayIntervals = intervals.map((interval) => ({
    ...interval,
    startedAt: interval.startedAt < todayStart ? todayStart : interval.startedAt,
    endedAt: interval.endedAt! > todayEnd ? todayEnd : interval.endedAt!,
  })).filter((interval) => interval.endedAt > interval.startedAt);
  const todayAllocation = allocateIntervalsByDay(todayIntervals, zone);
  const todaySeconds = todayAllocation.dayTotals.get(today) ?? 0;
  const weekDays: WeekDayTotal[] = Array.from({ length: 7 }, (_, index) => {
    const date = now.startOf("week").plus({ days: index });
    const isoDate = date.toISODate()!;
    return {
      date: isoDate,
      label: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index]!,
      seconds: weeklyAllocation.dayTotals.get(isoDate) ?? 0,
      isToday: isoDate === today,
    };
  });
  const [recent, sessionAggregate] = await Promise.all([
    db.learningSession.findMany({
    where: { userId, status: "COMPLETED" },
    include: { category: { select: { name: true } } },
    orderBy: { endedAt: "desc" },
    take: 5,
    }),
    db.learningSession.aggregate({
      where: { userId, status: "COMPLETED" },
      _avg: { durationSeconds: true },
      _count: { id: true },
    }),
  ]);
  return {
    timezone: zone,
    todayLabel: now.setLocale("vi").toFormat("d/M/yyyy"),
    dailyGoalMinutes: settings.dailyGoalMinutes,
    todaySeconds,
    weekSeconds,
    weekDays,
    categories: weeklyAllocation.categories,
    todayCategories: todayAllocation.categories,
    recent,
    completedSessionCount: sessionAggregate._count.id,
    averageSessionSeconds: Math.round(sessionAggregate._avg.durationSeconds ?? 0),
  };
}
