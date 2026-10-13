import { describe, expect, it } from "vitest";
import { previewPauseSession, previewResumeSession, previewStartSession } from "@/lib/timer-payload";

describe("optimistic timer intervals", () => {
  it("keeps completed intervals and excludes paused time on resume", () => {
    const started = "2026-10-13T08:00:00.000Z";
    const paused = "2026-10-13T08:10:00.000Z";
    const resumed = "2026-10-13T08:20:00.000Z";
    const running = previewStartSession(null, started);

    const previewPaused = previewPauseSession(running, paused);
    const previewRunning = previewResumeSession(previewPaused, resumed);

    expect(running.intervals[0].endedAt).toBeNull();
    expect(previewPaused.status).toBe("PAUSED");
    expect(previewPaused.intervals).toEqual([{ startedAt: started, endedAt: paused }]);
    expect(previewRunning.status).toBe("RUNNING");
    expect(previewRunning.intervals).toEqual([
      { startedAt: started, endedAt: paused },
      { startedAt: resumed, endedAt: null },
    ]);
  });
});
