import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const MAX_TIMER_REQUEST_AGE_MS = 30_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5_000;

export type TimestampValidationContext = {
  diagnosticId: string;
  operation: "start" | "pause";
  sessionKind: "timer" | "pomodoro";
};

type TimestampRejectionReason =
  | "invalid_format"
  | "non_canonical_iso"
  | "future_clock_skew"
  | "request_too_old"
  | "not_after_interval_start";

type ParsedTimestamp = {
  clickedAt: Date;
  effectiveAt: Date;
  deltaMs: number;
  acceptedReason: "within_bounds" | "future_clock_skew_clamped";
};

function baseLogContext(context: TimestampValidationContext, receivedAt: Date) {
  return {
    diagnosticId: context.diagnosticId,
    operation: context.operation,
    sessionKind: context.sessionKind,
    receivedAt: receivedAt.toISOString(),
    maxFutureClockSkewMs: MAX_FUTURE_CLOCK_SKEW_MS,
    maxRequestAgeMs: MAX_TIMER_REQUEST_AGE_MS,
  };
}

function logRejection(
  context: TimestampValidationContext | undefined,
  receivedAt: Date,
  reason: TimestampRejectionReason,
  details: Record<string, unknown>,
) {
  if (!context) return;
  logger.warn("timer_timestamp_validation", {
    ...baseLogContext(context, receivedAt),
    outcome: "rejected",
    reason,
    ...details,
  });
}

function logAcceptance(
  context: TimestampValidationContext | undefined,
  receivedAt: Date,
  parsed: ParsedTimestamp,
  details: Record<string, unknown> = {},
) {
  if (!context) return;
  logger.diagnostic("timer_timestamp_validation", {
    ...baseLogContext(context, receivedAt),
    outcome: "accepted",
    reason: parsed.acceptedReason,
    clickedAt: parsed.clickedAt.toISOString(),
    effectiveAt: parsed.effectiveAt.toISOString(),
    deltaMs: parsed.deltaMs,
    ...details,
  });
}

function parseRecentClientTimestamp(
  value: string,
  receivedAt: Date,
  context?: TimestampValidationContext,
): ParsedTimestamp {
  const clickedAt = new Date(value);
  if (!Number.isFinite(clickedAt.getTime())) {
    logRejection(context, receivedAt, "invalid_format", { clickedAt: null, deltaMs: null });
    throw new AppError("INVALID_TIME_RANGE");
  }

  const canonicalClickedAt = clickedAt.toISOString();
  const deltaMs = clickedAt.getTime() - receivedAt.getTime();
  if (canonicalClickedAt !== value) {
    logRejection(context, receivedAt, "non_canonical_iso", {
      clickedAt: canonicalClickedAt,
      deltaMs,
    });
    throw new AppError("INVALID_TIME_RANGE");
  }

  if (deltaMs > MAX_FUTURE_CLOCK_SKEW_MS) {
    logRejection(context, receivedAt, "future_clock_skew", {
      clickedAt: canonicalClickedAt,
      deltaMs,
    });
    throw new AppError("INVALID_TIME_RANGE");
  }

  if (deltaMs < -MAX_TIMER_REQUEST_AGE_MS) {
    logRejection(context, receivedAt, "request_too_old", {
      clickedAt: canonicalClickedAt,
      deltaMs,
    });
    throw new AppError("INVALID_TIME_RANGE");
  }

  return {
    clickedAt,
    effectiveAt: new Date(Math.min(clickedAt.getTime(), receivedAt.getTime())),
    deltaMs,
    acceptedReason: deltaMs > 0 ? "future_clock_skew_clamped" : "within_bounds",
  };
}

export function validateStartTimestamp(
  value: string,
  receivedAt: Date,
  context?: TimestampValidationContext,
): Date {
  const parsed = parseRecentClientTimestamp(value, receivedAt, context);
  logAcceptance(context, receivedAt, parsed);
  return parsed.effectiveAt;
}

export function validatePauseTimestamp(
  value: string,
  intervalStartedAt: Date,
  receivedAt: Date,
  context?: TimestampValidationContext,
): Date {
  const parsed = parseRecentClientTimestamp(value, receivedAt, context);
  if (parsed.effectiveAt.getTime() <= intervalStartedAt.getTime()) {
    logRejection(context, receivedAt, "not_after_interval_start", {
      clickedAt: parsed.clickedAt.toISOString(),
      effectiveAt: parsed.effectiveAt.toISOString(),
      deltaMs: parsed.deltaMs,
      intervalStartedAt: intervalStartedAt.toISOString(),
    });
    throw new AppError("INVALID_TIME_RANGE");
  }
  logAcceptance(context, receivedAt, parsed, {
    intervalStartedAt: intervalStartedAt.toISOString(),
  });
  return parsed.effectiveAt;
}
