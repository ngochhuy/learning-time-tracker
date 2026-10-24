import { afterEach, describe, expect, it, vi } from "vitest";
import {
  validateFinishTimestamp,
  validatePauseTimestamp,
  validateResumeTimestamp,
  validateStartTimestamp,
} from "@/lib/timer-timestamp";

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

describe("client-authoritative timestamp validation", () => {
  it("keeps the exact click time even when it is ahead of the server", () => {
    expect(validateStartTimestamp("2026-10-13T10:00:17.000Z", receivedAt).toISOString())
      .toBe("2026-10-13T10:00:17.000Z");
  });

  it("keeps a click older than the server receive time", () => {
    expect(validateStartTimestamp("2026-10-13T09:59:39.000Z", receivedAt).toISOString())
      .toBe("2026-10-13T09:59:39.000Z");
  });

  it.each([
    "not-a-date",
    "2026-10-13T10:00:08+00:00",
  ])("rejects an invalid or non-canonical ISO timestamp: %s", (value) => {
    expect(() => validateStartTimestamp(value, receivedAt)).toThrow();
  });
});

describe("interval ordering", () => {
  it("requires Pause to be after the open interval start", () => {
    expect(() => validatePauseTimestamp(startedAt.toISOString(), startedAt, receivedAt)).toThrow();
    expect(validatePauseTimestamp("2026-10-13T10:00:00.001Z", startedAt, receivedAt).toISOString())
      .toBe("2026-10-13T10:00:00.001Z");
  });

  it("requires Resume to be after the previous interval end", () => {
    const previousEndedAt = new Date("2026-10-13T10:00:20.000Z");
    expect(() => validateResumeTimestamp(previousEndedAt.toISOString(), previousEndedAt, receivedAt)).toThrow();
    expect(validateResumeTimestamp("2026-10-13T10:00:20.001Z", previousEndedAt, receivedAt).toISOString())
      .toBe("2026-10-13T10:00:20.001Z");
  });

  it("requires Finish to be after the last interval boundary", () => {
    const previousEndedAt = new Date("2026-10-13T10:00:20.000Z");
    const context = { diagnosticId: "22222222-2222-4222-8222-222222222222", operation: "finish" as const, sessionKind: "timer" as const };
    expect(() => validateFinishTimestamp(previousEndedAt.toISOString(), previousEndedAt, receivedAt, context)).toThrow();
    expect(validateFinishTimestamp("2026-10-13T10:00:20.001Z", previousEndedAt, receivedAt, context).toISOString())
      .toBe("2026-10-13T10:00:20.001Z");
  });
});

describe("timestamp diagnostics", () => {
  it("logs accepted client and server times without rejecting clock skew", () => {
    vi.stubEnv("TIMESTAMP_DIAGNOSTICS", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = validateStartTimestamp("2026-10-13T10:00:17.000Z", receivedAt, timerStartContext);

    expect(result.toISOString()).toBe("2026-10-13T10:00:17.000Z");
    expect(loggedJson(info)).toMatchObject({
      event: "timer_timestamp_validation",
      diagnosticId: timerStartContext.diagnosticId,
      operation: "start",
      sessionKind: "timer",
      outcome: "accepted",
      reason: "client_time_authoritative",
      clickedAt: "2026-10-13T10:00:17.000Z",
      receivedAt: receivedAt.toISOString(),
      deltaMs: 7_000,
    });
  });

  it("logs malformed timestamps without echoing the raw value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => validateStartTimestamp("not-a-date", receivedAt, timerStartContext)).toThrow();

    const log = loggedJson(warn);
    expect(log).toMatchObject({ outcome: "rejected", reason: "invalid_format", clickedAt: null });
    expect(JSON.stringify(log)).not.toContain("userId");
    expect(JSON.stringify(log)).not.toContain("cookie");
    expect(JSON.stringify(log)).not.toContain("token");
  });

  it("logs ordering failures with the interval boundary", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const context = { diagnosticId: "33333333-3333-4333-8333-333333333333", operation: "pause" as const, sessionKind: "pomodoro" as const };

    expect(() => validatePauseTimestamp(startedAt.toISOString(), startedAt, receivedAt, context)).toThrow();

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
