import { describe, expect, it } from "vitest";
import { getClosedDurationSeconds, getElapsedSeconds, isLongRunning } from "./timer";

const at = (value: string) => new Date(value);

describe("timer duration", () => {
  it("cộng chính xác các interval đã hoàn thành", () => {
    expect(
      getClosedDurationSeconds([
        { startedAt: at("2026-10-06T08:00:00Z"), endedAt: at("2026-10-06T08:25:00Z") },
        { startedAt: at("2026-10-06T08:30:00Z"), endedAt: at("2026-10-06T08:50:00Z") },
      ]),
    ).toBe(2_700);
  });

  it("chỉ cộng interval đang mở khi session RUNNING", () => {
    const base = {
      id: "session-1",
      startedAt: at("2026-10-06T08:00:00Z"),
      intervals: [{ startedAt: at("2026-10-06T08:00:00Z"), endedAt: null }],
    } as const;

    expect(getElapsedSeconds({ ...base, status: "RUNNING" }, at("2026-10-06T08:10:00Z"))).toBe(600);
    expect(getElapsedSeconds({ ...base, status: "PAUSED" }, at("2026-10-06T08:10:00Z"))).toBe(0);
  });

  it("nhận diện session chạy quá tám giờ", () => {
    const session = {
      id: "session-1",
      status: "RUNNING" as const,
      startedAt: at("2026-10-06T00:00:00Z"),
      intervals: [{ startedAt: at("2026-10-06T00:00:00Z"), endedAt: null }],
    };

    expect(isLongRunning(session, at("2026-10-06T08:00:00Z"))).toBe(true);
  });
});
