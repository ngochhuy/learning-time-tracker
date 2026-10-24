// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { finishSession, pauseSession, saveSessionNote, startSession } from "@/app/actions/timer";
import { MatchaTimerWorkspace } from "@/components/matcha-timer-workspace";
import type { ActionResult } from "@/lib/errors";
import type { TimerSession } from "@/lib/timer-payload";

vi.mock("@/components/matcha-app-shell", () => ({
  useAppShell: () => ({ zen: false, setZen: () => undefined, setTimezone: () => undefined }),
}));

vi.mock("@/app/actions/timer", () => ({
  startSession: vi.fn(),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
  finishSession: vi.fn(),
  cancelSession: vi.fn(),
  changeSessionCategory: vi.fn(),
  saveSessionNote: vi.fn(),
}));

const baseSession: TimerSession = {
  id: "saved-session",
  status: "RUNNING",
  category: null,
  note: null,
  intervals: [{ startedAt: new Date(Date.now() - 60_000).toISOString(), endedAt: null }],
};

function renderTimer(session: TimerSession | null) {
  render(<MatchaTimerWorkspace
    session={session}
    categories={[]}
    timezone="Asia/Bangkok"
    dailyGoalMinutes={120}
    completedTodaySeconds={0}
  />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe("optimistic timer controls", () => {
  it("shows pause immediately and restores running state if saving fails", async () => {
    let resolvePause!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(pauseSession).mockReturnValue(new Promise((resolve) => { resolvePause = resolve; }));
    renderTimer(baseSession);

    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(screen.getByText("Phiên học đang tạm dừng")).toBeDefined();
    expect(vi.mocked(pauseSession)).toHaveBeenCalledWith("saved-session", expect.any(String));

    await act(async () => resolvePause({ ok: false, code: "TRANSACTION_CONFLICT", message: "Vui lòng thử lại." }));
    expect(screen.getByText("Đang trong phiên học sâu")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Vui lòng thử lại.");
  });

  it("uses the server session id after an optimistic start", async () => {
    let resolveStart!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(startSession).mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    vi.mocked(pauseSession).mockResolvedValue({ ok: true, data: { ...baseSession, status: "PAUSED" } });
    renderTimer(null);

    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu học" }));
    expect(screen.getByText("Đang trong phiên học sâu")).toBeDefined();
    expect(vi.mocked(startSession)).toHaveBeenCalledWith(null, expect.any(String), "");

    await act(async () => resolveStart({ ok: true, data: baseSession }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạm dừng" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(vi.mocked(pauseSession)).toHaveBeenCalledWith("saved-session", expect.any(String));
  });

  it("does not reset the counter when the saved start replaces the optimistic start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00.000Z"));
    let resolveStart!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(startSession).mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    renderTimer(null);
    const timerDisplay = () => document.querySelector(".tabular-nums")?.textContent;

    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu học" }));
    act(() => vi.advanceTimersByTime(2_200));
    expect(timerDisplay()).toBe("00:00:02");

    await act(async () => resolveStart({ ok: true, data: {
      ...baseSession,
      intervals: [{ startedAt: "2026-10-13T10:00:00.000Z", endedAt: null }],
    } }));
    expect(timerDisplay()).toBe("00:00:02");
  });

  it("accepts pause during a pending start and saves it after the server returns the id", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00.000Z"));
    let resolveStart!: (result: ActionResult<TimerSession>) => void;
    let resolvePause!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(startSession).mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    vi.mocked(pauseSession).mockReturnValue(new Promise((resolve) => { resolvePause = resolve; }));
    renderTimer(null);

    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu học" }));
    act(() => vi.advanceTimersByTime(1_500));
    expect(screen.getByRole("button", { name: "Tạm dừng" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(screen.getByText("Phiên học đang tạm dừng")).toBeDefined();
    expect(vi.mocked(pauseSession)).not.toHaveBeenCalled();

    await act(async () => resolveStart({ ok: true, data: {
      ...baseSession,
      intervals: [{ startedAt: "2026-10-13T10:00:00.000Z", endedAt: null }],
    } }));
    expect(vi.mocked(pauseSession)).toHaveBeenCalledWith("saved-session", "2026-10-13T10:00:01.500Z");

    await act(async () => resolvePause({ ok: true, data: {
      ...baseSession,
      status: "PAUSED",
      intervals: [{ startedAt: "2026-10-13T10:00:00.000Z", endedAt: "2026-10-13T10:00:01.500Z" }],
    } }));
    expect(screen.getByText("Phiên học đang tạm dừng")).toBeDefined();
  });

  it("restores the running saved session if a queued pause fails", async () => {
    let resolveStart!: (result: ActionResult<TimerSession>) => void;
    let resolvePause!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(startSession).mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    vi.mocked(pauseSession).mockReturnValue(new Promise((resolve) => { resolvePause = resolve; }));
    renderTimer(null);

    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu học" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    await act(async () => resolveStart({ ok: true, data: baseSession }));
    await act(async () => resolvePause({ ok: false, code: "TRANSACTION_CONFLICT", message: "Vui lòng thử lại." }));

    expect(screen.getByText("Đang trong phiên học sâu")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Vui lòng thử lại.");
  });

  it("freezes the displayed seconds while pause is being saved, then uses the saved interval", async () => {
    vi.useFakeTimers();
    const initialTime = new Date("2026-10-13T10:00:00.000Z");
    vi.setSystemTime(initialTime);
    let resolvePause!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(pauseSession).mockReturnValue(new Promise((resolve) => { resolvePause = resolve; }));
    renderTimer({ ...baseSession, intervals: [{ startedAt: "2026-10-13T09:59:00.000Z", endedAt: null }] });
    const timerDisplay = () => document.querySelector(".tabular-nums")?.textContent;
    expect(timerDisplay()).toBe("00:01:00");

    vi.setSystemTime(new Date(initialTime.getTime() + 1_200));
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(timerDisplay()).toBe("00:01:00");
    expect(vi.mocked(pauseSession)).toHaveBeenCalledWith("saved-session", "2026-10-13T10:00:01.200Z");

    await act(async () => resolvePause({
      ok: true,
      data: { ...baseSession, status: "PAUSED", intervals: [{ startedAt: "2026-10-13T09:59:00.000Z", endedAt: "2026-10-13T10:00:01.200Z" }] },
    }));
    expect(timerDisplay()).toBe("00:01:01");
  });

  it("shows a saving state and restores the session when finish fails", async () => {
    let resolveFinish!: (result: ActionResult<{ id: string }>) => void;
    vi.mocked(finishSession).mockReturnValue(new Promise((resolve) => { resolveFinish = resolve; }));
    renderTimer(baseSession);

    fireEvent.click(screen.getByRole("button", { name: "Kết thúc phiên" }));
    expect(screen.getByText("Đang lưu phiên học…")).toBeDefined();
    expect(screen.getByRole("button", { name: "Đang kết thúc…" }).hasAttribute("disabled")).toBe(true);

    await act(async () => resolveFinish({ ok: false, code: "TRANSACTION_CONFLICT", message: "Vui lòng thử lại." }));
    expect(screen.getByText("Đang trong phiên học sâu")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Vui lòng thử lại.");
  });

  it("sends a draft note when starting and the latest text when finishing", async () => {
    vi.mocked(startSession).mockResolvedValue({ ok: true, data: { ...baseSession, note: "Mục tiêu ban đầu" } });
    vi.mocked(finishSession).mockResolvedValue({ ok: true, data: { id: baseSession.id } });
    renderTimer(null);

    fireEvent.change(screen.getByRole("textbox", { name: "Ghi chú phiên học" }), { target: { value: "Mục tiêu ban đầu" } });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu học" }));
    expect(vi.mocked(startSession)).toHaveBeenCalledWith(null, expect.any(String), "Mục tiêu ban đầu");
    await waitFor(() => expect(screen.getByRole("button", { name: "Kết thúc phiên" }).hasAttribute("disabled")).toBe(false));

    fireEvent.change(screen.getByRole("textbox", { name: "Ghi chú phiên học" }), { target: { value: "Đã hoàn thành bài tập" } });
    fireEvent.click(screen.getByRole("button", { name: "Kết thúc phiên" }));
    expect(vi.mocked(finishSession)).toHaveBeenCalledWith(baseSession.id, expect.any(String), "Đã hoàn thành bài tập");
  });

  it("restores the saved note on reload and auto-saves edits after a pause in typing", async () => {
    vi.mocked(saveSessionNote).mockResolvedValue({ ok: true, data: { ...baseSession, note: "Nội dung mới" } });
    renderTimer({ ...baseSession, note: "Nội dung cũ" });
    const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ghi chú phiên học" });
    expect(field.value).toBe("Nội dung cũ");

    fireEvent.change(field, { target: { value: "Nội dung mới" } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)); });
    expect(vi.mocked(saveSessionNote)).toHaveBeenCalledWith(baseSession.id, "Nội dung mới");
    expect(screen.getByText("Đã lưu ghi chú")).toBeDefined();
  });

  it("recovers a not-yet-saved edit only for the same session after reload", async () => {
    renderTimer({ ...baseSession, note: "Nội dung đã lưu" });
    fireEvent.change(screen.getByRole("textbox", { name: "Ghi chú phiên học" }), { target: { value: "Vừa gõ xong" } });
    cleanup();

    renderTimer({ ...baseSession, note: "Nội dung đã lưu" });
    await waitFor(() => expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ghi chú phiên học" }).value).toBe("Vừa gõ xong"));
    cleanup();

    renderTimer({ ...baseSession, id: "another-account-session", note: "Ghi chú khác" });
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ghi chú phiên học" }).value).toBe("Ghi chú khác");
  });

  it("saves the latest note if text is reverted while an earlier auto-save is pending", async () => {
    let resolveOldSave!: (result: ActionResult<TimerSession>) => void;
    vi.mocked(saveSessionNote)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOldSave = resolve; }))
      .mockResolvedValue({ ok: true, data: { ...baseSession, note: "A" } });
    renderTimer({ ...baseSession, note: "A" });
    const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ghi chú phiên học" });

    fireEvent.change(field, { target: { value: "B" } });
    await waitFor(() => expect(saveSessionNote).toHaveBeenCalledWith(baseSession.id, "B"));
    fireEvent.change(field, { target: { value: "A" } });
    await act(async () => resolveOldSave({ ok: true, data: { ...baseSession, note: "B" } }));
    await waitFor(() => expect(saveSessionNote).toHaveBeenCalledWith(baseSession.id, "A"));
  });
});
