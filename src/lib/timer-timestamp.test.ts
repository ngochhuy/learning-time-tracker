import { afterEach, describe, expect, it, vi } from "vitest";
import { validatePauseTimestamp, validateStartTimestamp } from "@/lib/timer-timestamp";

const startedAt = new Date("2026-10-13T10:00:00.000Z");
const receivedAt = new Date("2026-10-13T10:00:10.000Z");
const timerStartContext = {
  diagnosticId: "11111111-1111-4111-8111-111111111111",
  operation: "start" as const,
  sessionKind: "timer" as const,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function loggedJson(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
}

describe("start timestamp validation", () => {
  it("keeps the button click time instead of resetting at the server", () => {
    expect(validateStartTimestamp("2026-10-13T10:00:08.300Z", receivedAt).toISOString())
      .toBe("2026-10-13T10:00:08.300Z");
  });

  it("clamps an accepted future clock skew to the server receive time", () => {
    expect(validateStartTimestamp("2026-10-13T10:00:10.444Z", receivedAt).toISOString())
      .toBe(receivedAt.toISOString());
  });

  it("accepts both clock-skew boundaries", () => {
    expect(validateStartTimestamp("2026-10-13T10:00:15.000Z", receivedAt).toISOString())
      .toBe(receivedAt.toISOString());
    expect(validateStartTimestamp("2026-10-13T09:59:40.000Z", receivedAt).toISOString())
      .toBe("2026-10-13T09:59:40.000Z");
  });

  it("rejects timestamps outside either clock-skew boundary", () => {
    expect(() => validateStartTimestamp("2026-10-13T10:00:15.001Z", receivedAt)).toThrow();
    expect(() => validateStartTimestamp("2026-10-13T09:59:39.999Z", receivedAt)).toThrow();
  });
});

describe("pause timestamp validation", () => {
  it("keeps the click time rather than the later server receive time", () => {
    expect(validatePauseTimestamp("2026-10-13T10:00:08.300Z", startedAt, receivedAt).toISOString())
      .toBe("2026-10-13T10:00:08.300Z");
  });

  it.each([
    "not-a-date",
    "2026-10-13T10:00:00.000Z",
    "2026-10-13T09:59:59.999Z",
    "2026-10-13T10:00:15.001Z",
    "2026-10-13T10:00:08+00:00",
  ])("rejects an invalid, non-canonical or out-of-range time: %s", (value) => {
    expect(() => validatePauseTimestamp(value, startedAt, receivedAt)).toThrow("Khoảng thời gian không hợp lệ.");
  });

  it("rejects a click older than the allowed network delay", () => {
    expect(() => validatePauseTimestamp("2026-10-13T10:00:00.001Z", startedAt, new Date("2026-10-13T10:00:31.000Z")))
      .toThrow("Khoảng thời gian không hợp lệ.");
  });

  it("clamps an accepted future click before comparing it with the interval start", () => {
    expect(validatePauseTimestamp("2026-10-13T10:00:10.444Z", startedAt, receivedAt).toISOString())
      .toBe(receivedAt.toISOString());
    expect(() => validatePauseTimestamp("2026-10-13T10:00:10.444Z", receivedAt, receivedAt))
      .toThrow("Khoảng thời gian không hợp lệ.");
  });
});

describe("timestamp diagnostics", () => {
  it("logs future clock skew with the exact positive delta", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => validateStartTimestamp(
      "2026-10-13T10:00:17.000Z",
      receivedAt,
      timerStartContext,
    )).toThrow();

    expect(loggedJson(warn)).toMatchObject({
      event: "timer_timestamp_validation",
      diagnosticId: timerStartContext.diagnosticId,
      operation: "start",
      sessionKind: "timer",
      outcome: "rejected",
      reason: "future_clock_skew",
      clickedAt: "2026-10-13T10:00:17.000Z",
      receivedAt: receivedAt.toISOString(),
      deltaMs: 7_000,
      maxFutureClockSkewMs: 5_000,
      maxRequestAgeMs: 30_000,
    });
  });

  it("logs accepted validation and server clamping only when diagnostics are enabled", () => {
    vi.stubEnv("TIMESTAMP_DIAGNOSTICS", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = validateStartTimestamp(
      "2026-10-13T10:00:13.000Z",
      receivedAt,
      timerStartContext,
    );

    expect(result).toEqual(receivedAt);
    expect(loggedJson(info)).toMatchObject({
      outcome: "accepted",
      reason: "future_clock_skew_clamped",
      clickedAt: "2026-10-13T10:00:13.000Z",
      effectiveAt: receivedAt.toISOString(),
      deltaMs: 3_000,
    });
  });

  it("logs a request older than the allowed network delay", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => validateStartTimestamp(
      "2026-10-13T09:59:39.000Z",
      receivedAt,
      timerStartContext,
    )).toThrow();

    expect(loggedJson(warn)).toMatchObject({
      outcome: "rejected",
      reason: "request_too_old",
      deltaMs: -31_000,
    });
  });

  it.each([
    ["not-a-date", "invalid_format", null],
    ["2026-10-13T10:00:08+00:00", "non_canonical_iso", "2026-10-13T10:00:08.000Z"],
  ])("logs malformed input without echoing the raw value: %s", (value, reason, safeClickedAt) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => validateStartTimestamp(value, receivedAt, timerStartContext)).toThrow();

    const log = loggedJson(warn);
    expect(log).toMatchObject({ outcome: "rejected", reason, clickedAt: safeClickedAt });
    expect(JSON.stringify(log)).not.toContain("userId");
    expect(JSON.stringify(log)).not.toContain("cookie");
    expect(JSON.stringify(log)).not.toContain("token");
  });

  it("logs when Pause is not after the interval start", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const context = {
      diagnosticId: "22222222-2222-4222-8222-222222222222",
      operation: "pause" as const,
      sessionKind: "pomodoro" as const,
    };

    expect(() => validatePauseTimestamp(
      startedAt.toISOString(),
      startedAt,
      receivedAt,
      context,
    )).toThrow();

    expect(loggedJson(warn)).toMatchObject({
      diagnosticId: context.diagnosticId,
      operation: "pause",
      sessionKind: "pomodoro",
      outcome: "rejected",
      reason: "not_after_interval_start",
      intervalStartedAt: startedAt.toISOString(),
    });
  });

  it("does not log accepted timestamps when diagnostics are disabled", () => {
    vi.stubEnv("TIMESTAMP_DIAGNOSTICS", "false");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    validateStartTimestamp("2026-10-13T10:00:08.300Z", receivedAt, timerStartContext);

    expect(info).not.toHaveBeenCalled();
  });
});
