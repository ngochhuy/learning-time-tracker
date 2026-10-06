import { describe, expect, it } from "vitest";
import { formatDuration, normalizeCategoryName } from "./utils";

describe("normalizeCategoryName", () => {
  it("chuẩn hóa khoảng trắng và chữ hoa", () => {
    expect(normalizeCategoryName("  Lập   TRÌNH ")).toBe("lập trình");
  });
});

describe("formatDuration", () => {
  it("hiển thị giờ và phút", () => {
    expect(formatDuration(5_460)).toBe("1g 31p");
  });
});
