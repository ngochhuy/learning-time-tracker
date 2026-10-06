import type { LearningStatus } from "@/generated/prisma/client";

export type IntervalLike = {
  startedAt: Date;
  endedAt: Date | null;
};

export type ActiveSessionLike = {
  id: string;
  status: LearningStatus;
  startedAt: Date;
  intervals: readonly IntervalLike[];
};

export function getClosedDurationSeconds(intervals: readonly IntervalLike[]) {
  return intervals.reduce((total, interval) => {
    if (!interval.endedAt) return total;
    return total + Math.max(0, Math.floor((interval.endedAt.getTime() - interval.startedAt.getTime()) / 1000));
  }, 0);
}

export function getElapsedSeconds(session: ActiveSessionLike, now = new Date()) {
  const closedSeconds = getClosedDurationSeconds(session.intervals);
  if (session.status !== "RUNNING") return closedSeconds;

  const openInterval = session.intervals.find((interval) => !interval.endedAt);
  if (!openInterval) return closedSeconds;

  return closedSeconds + Math.max(0, Math.floor((now.getTime() - openInterval.startedAt.getTime()) / 1000));
}

export function isLongRunning(session: ActiveSessionLike, now = new Date()) {
  return getElapsedSeconds(session, now) >= 8 * 60 * 60;
}
