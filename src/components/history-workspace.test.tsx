// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryWorkspace } from "@/components/history-workspace";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/actions/history", () => ({ updateSession: vi.fn(), deleteSession: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HistoryWorkspace", () => {
  const props = {
    params: {},
    overview: {
      total: 1,
      totalSeconds: 3600,
      averageSeconds: 3600,
      goalRate: 0,
      week: [],
      weekChange: null,
      peak: null,
      timezone: "Asia/Bangkok",
    },
    categories: [{ id: "coding", name: "Lập trình" }],
    page: 1,
    pageSize: 10,
    total: 1,
    items: [{ id: "session-1", startedAt: "2026-10-12T08:00:00.000Z", endedAt: "2026-10-12T09:00:00.000Z", durationSeconds: 3600, categoryId: "coding", categoryName: "Lập trình" }],
  };

  it("renders saved sessions and filters by category without using mock rows", () => {
    render(<HistoryWorkspace {...props} />);

    expect(screen.getByRole("heading", { name: "Lịch sử học tập" })).toBeDefined();
    expect(screen.getByText("12/10/2026")).toBeDefined();
    expect(screen.getAllByText("Lập trình").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("combobox", { name: "Lọc danh mục" }), { target: { value: "coding" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(push).toHaveBeenCalledWith("/history?category=coding");
  });

  it("opens the real edit form and keeps unsupported notes read-only", () => {
    render(<HistoryWorkspace {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Chỉnh sửa phiên 12\/10\/2026/ }));

    expect(screen.getByRole("dialog", { name: "Chỉnh sửa phiên học" })).toBeDefined();
    expect(screen.getByPlaceholderText("Chưa hỗ trợ lưu ghi chú").hasAttribute("disabled")).toBe(true);
  });
});
