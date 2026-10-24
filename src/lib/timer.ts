import type { LearningStatus } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";

export const MAX_SESSION_DURATION_SECONDS = 24 * 60 * 60;

export function assertSessionDurationAllowed(durationSeconds: number, allowLongSession = false) {
  if (durationSeconds > MAX_SESSION_DURATION_SECONDS && !allowLongSession) {
    throw new AppError("SESSION_DURATION_CONFIRMATION_REQUIRED");
  }
}

export type IntervalLike = {
  startedAt: Date;
  endedAt: Date | null;
};

/** Ensures a persisted session has only strictly positive, closed intervals. */
export function assertClosedIntervalsValid(intervals: readonly IntervalLike[]) {
  if (intervals.some((interval) => !interval.endedAt || interval.endedAt.getTime() <= interval.startedAt.getTime())) {
    throw new AppError("INVALID_TIME_RANGE");
  }
}

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
