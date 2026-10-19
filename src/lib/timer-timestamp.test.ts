import { describe, expect, it } from "vitest";
import { validatePauseTimestamp, validateStartTimestamp } from "@/lib/timer-timestamp";

const startedAt = new Date("2026-10-13T10:00:00.000Z");
const receivedAt = new Date("2026-10-13T10:00:10.000Z");

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
