import { AppError } from "@/lib/errors";

const MAX_TIMER_REQUEST_AGE_MS = 30_000;

function parseRecentClientTimestamp(value: string, receivedAt: Date): Date {
  const clickedAt = new Date(value);

  console.info("timer_timestamp_check", {
    clickedAt: value,
    receivedAt: receivedAt.toISOString(),
    differenceMs: clickedAt.getTime() - receivedAt.getTime(),
    canonical: Number.isFinite(clickedAt.getTime())
      ? clickedAt.toISOString() === value
      : false,
  });

  if (
    !Number.isFinite(clickedAt.getTime()) ||
    clickedAt.toISOString() !== value ||
    clickedAt.getTime() > receivedAt.getTime() ||
    receivedAt.getTime() - clickedAt.getTime() > MAX_TIMER_REQUEST_AGE_MS
  ) {
    throw new AppError("INVALID_TIME_RANGE");
  }
  return clickedAt;
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
