import { describe, expect, it } from "vitest";
import { parseHistoryFilters } from "@/lib/history-filters";

describe("history filters", () => {
  it("uses the account timezone for a full local-day range", () => {
    const filters = parseHistoryFilters({ from: "2026-10-07", to: "2026-10-07" }, "Asia/Bangkok");
    expect(filters.from?.toISOString()).toBe("2026-10-06T17:00:00.000Z");
    expect(filters.to?.toISOString()).toBe("2026-10-07T16:59:59.999Z");
  });

  it("supports uncategorized sessions and bounded page sizes", () => {
    expect(parseHistoryFilters({ category: "uncategorized", page: "3", pageSize: "50" }, "Asia/Bangkok"))
      .toMatchObject({ uncategorized: true, page: 3, pageSize: 50 });
    expect(parseHistoryFilters({ page: "-5", pageSize: "999" }, "Asia/Bangkok"))
      .toMatchObject({ page: 1, pageSize: 10 });
  });
});
