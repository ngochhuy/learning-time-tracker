import { describe, expect, it } from "vitest";
import { allocateIntervalsByDay } from "@/lib/dashboard-service";

describe("allocateIntervalsByDay", () => {
  it("splits an interval at local midnight", () => {
    const data = allocateIntervalsByDay([{ startedAt: new Date("2026-01-01T16:30:00Z"), endedAt: new Date("2026-01-01T17:30:00Z"), session: { category: null } }], "Asia/Bangkok");
    expect(data.dayTotals.get("2026-01-01")).toBe(1800);
    expect(data.dayTotals.get("2026-01-02")).toBe(1800);
  });

  it("keeps elapsed seconds correct across a DST transition", () => {
    const data = allocateIntervalsByDay([{ startedAt: new Date("2026-03-08T06:30:00Z"), endedAt: new Date("2026-03-08T07:30:00Z"), session: { category: null } }], "America/New_York");
    expect([...data.dayTotals.values()]).toEqual([3600]);
  });
});
