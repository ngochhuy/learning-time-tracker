import { AppError } from "@/lib/errors";

const MAX_TIMER_REQUEST_AGE_MS = 30_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5_000;

function parseRecentClientTimestamp(value: string, receivedAt: Date): Date {
  const clickedAt = new Date(value);
  if (
    !Number.isFinite(clickedAt.getTime()) ||
    clickedAt.toISOString() !== value ||
    clickedAt.getTime() - receivedAt.getTime() > MAX_FUTURE_CLOCK_SKEW_MS ||
    receivedAt.getTime() - clickedAt.getTime() > MAX_TIMER_REQUEST_AGE_MS
  ) {
    throw new AppError("INVALID_TIME_RANGE");
  }
  return new Date(Math.min(clickedAt.getTime(), receivedAt.getTime()));
}

export function validateStartTimestamp(value: string, receivedAt: Date): Date {
  return parseRecentClientTimestamp(value, receivedAt);
}

export function validatePauseTimestamp(value: string, intervalStartedAt: Date, receivedAt: Date): Date {
  const clickedAt = parseRecentClientTimestamp(value, receivedAt);
  if (clickedAt.getTime() <= intervalStartedAt.getTime()) {
    throw new AppError("INVALID_TIME_RANGE");
  }
  return clickedAt;
}
