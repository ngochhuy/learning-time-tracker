import { describe, expect, it } from "vitest";
import { normalizeSessionNote } from "@/lib/session-note";

describe("normalizeSessionNote", () => {
  it("trims a note and stores empty text as null", () => {
    expect(normalizeSessionNote("  Đã học React  ")).toBe("Đã học React");
    expect(normalizeSessionNote("   ")).toBeNull();
  });

  it("rejects notes longer than the database limit", () => {
    expect(() => normalizeSessionNote("x".repeat(1001))).toThrow("1.000 ký tự");
  });
});
