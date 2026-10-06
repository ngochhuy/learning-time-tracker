import { AppError } from "@/lib/errors";

export type ClosedInterval = { id: string; startedAt: Date; endedAt: Date | null };

/**
 * Changes the outer bounds of a completed session while retaining every pause
 * between its intervals. The returned values are deliberately data-only, so
 * they can be validated independently from Prisma.
 */
export function adjustSessionBounds(
  intervals: ClosedInterval[],
  startedAt: Date,
  endedAt: Date,
) {
  if (startedAt >= endedAt || intervals.length === 0) throw new AppError("INVALID_TIME_RANGE");
  if (intervals.some((item) => !item.endedAt)) throw new AppError("INVALID_SESSION_STATE");

  const ordered = [...intervals].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const first = ordered[0];
  const last = ordered.at(-1)!;
  if (startedAt >= first.endedAt! || endedAt <= last.startedAt) {
    throw new AppError("INVALID_TIME_RANGE");
  }

  return ordered.map((item, index) => ({
    id: item.id,
    startedAt: index === 0 ? startedAt : item.startedAt,
    endedAt: index === ordered.length - 1 ? endedAt : item.endedAt!,
  }));
}

export function sumIntervalSeconds(intervals: Array<{ startedAt: Date; endedAt: Date }>) {
  return intervals.reduce((total, interval) => total + Math.floor((interval.endedAt.getTime() - interval.startedAt.getTime()) / 1000), 0);
}
