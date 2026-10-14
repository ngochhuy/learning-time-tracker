// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/app/actions/history";
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
    items: [{ id: "session-1", startedAt: "2026-10-12T08:00:00.000Z", endedAt: "2026-10-12T09:00:00.000Z", durationSeconds: 3600, categoryId: "coding", categoryName: "Lập trình", note: "Đã giải hai bài thuật toán" }],
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

  it("opens the real edit form with the saved note", () => {
    render(<HistoryWorkspace {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Chỉnh sửa phiên 12\/10\/2026/ }));

    expect(screen.getByRole("dialog", { name: "Chỉnh sửa phiên học" })).toBeDefined();
    expect(screen.getByPlaceholderText<HTMLTextAreaElement>("Ghi lại nội dung đã học…").value).toBe("Đã giải hai bài thuật toán");
  });

  it("saves a note without rounding the original session timestamps", async () => {
    vi.mocked(updateSession).mockResolvedValue({ ok: true, data: {
      startedAt: "2026-10-12T08:00:23.000Z",
      endedAt: "2026-10-12T09:00:47.000Z",
      durationSeconds: 3624,
      note: "Ôn lại thuật toán",
    } });
    render(<HistoryWorkspace {...props} items={[{ ...props.items[0], startedAt: "2026-10-12T08:00:23.000Z", endedAt: "2026-10-12T09:00:47.000Z", durationSeconds: 3624 }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Chỉnh sửa phiên 12\/10\/2026/ }));
    fireEvent.change(screen.getByPlaceholderText("Ghi lại nội dung đã học…"), { target: { value: "Ôn lại thuật toán" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateSession).toHaveBeenCalledWith(
      "session-1", "2026-10-12T08:00:23.000Z", "2026-10-12T09:00:47.000Z", "coding", "Ôn lại thuật toán",
    ));
  });
});
