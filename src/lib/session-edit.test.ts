import { describe, expect, it } from "vitest";
import { adjustSessionBounds, sumIntervalSeconds } from "@/lib/session-edit";

describe("adjustSessionBounds", () => {
  it("keeps the pause between first and last interval", () => {
    const base = new Date("2026-01-01T08:00:00.000Z");
    const result = adjustSessionBounds([
      { id: "a", startedAt: base, endedAt: new Date("2026-01-01T09:00:00.000Z") },
      { id: "b", startedAt: new Date("2026-01-01T09:30:00.000Z"), endedAt: new Date("2026-01-01T10:00:00.000Z") },
    ], new Date("2026-01-01T07:45:00.000Z"), new Date("2026-01-01T10:15:00.000Z"));
    expect(result[0].startedAt.toISOString()).toBe("2026-01-01T07:45:00.000Z");
    expect(result[1].startedAt.toISOString()).toBe("2026-01-01T09:30:00.000Z");
    expect(sumIntervalSeconds(result)).toBe(7200);
  });
});
