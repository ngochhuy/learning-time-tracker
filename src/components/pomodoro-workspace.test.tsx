// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pauseSession } from "@/app/actions/timer";
import { addPomodoroTask, startPomodoroSession } from "@/app/actions/pomodoro";
import { PomodoroWorkspace } from "@/components/pomodoro-workspace";
import type { TimerSession } from "@/lib/timer-payload";

vi.mock("@/components/matcha-app-shell", () => ({
  useAppShell: () => ({ zen: false, setZen: vi.fn() }),
}));

vi.mock("@/app/actions/timer", () => ({
  startSession: vi.fn(),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
  finishSession: vi.fn(),
  cancelSession: vi.fn(),
  saveSessionNote: vi.fn(),
}));

vi.mock("@/app/actions/pomodoro", () => ({
  addPomodoroTask: vi.fn(),
  editPomodoroTask: vi.fn(),
  removePomodoroTask: vi.fn(),
  setPomodoroTaskDone: vi.fn(),
  selectPomodoroTask: vi.fn(),
  startPomodoroSession: vi.fn(),
  completePomodoroSession: vi.fn(),
  updatePomodoroPreferences: vi.fn(),
}));

const runningSession: TimerSession = {
  id: "pomodoro-session",
  status: "RUNNING",
  category: null,
  note: "Ôn tập tích phân",
  intervals: [{ startedAt: new Date(Date.now() - 60_000).toISOString(), endedAt: null }],
  pomodoroFocus: { targetSeconds: 1500, taskId: "task-1" },
};

function renderWorkspace(session: TimerSession | null = null, overrides: Partial<React.ComponentProps<typeof PomodoroWorkspace>> = {}) {
  return render(<PomodoroWorkspace
    session={session}
    userId="test-user"
    initialTasks={[]}
    initialPreferences={null}
    initialCompletedTotal={0}
    initialCompletedToday={0}
    hasTimerSession={false}
    dailyGoalMinutes={120}
    completedTodaySeconds={0}
    {...overrides}
  />);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "documentPictureInPicture");
});

describe("PomodoroWorkspace", () => {
  it("creates a task and sends it as the persisted session note", async () => {
    vi.mocked(addPomodoroTask).mockResolvedValue({ ok: true, data: { id: "task-1", title: "Đọc tài liệu React", estimate: 2, completedPomodoros: 0, done: false } });
    vi.mocked(startPomodoroSession).mockResolvedValue({ ok: true, data: { ...runningSession, note: "Đọc tài liệu React" } });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    fireEvent.change(screen.getByPlaceholderText("Nhập tên nhiệm vụ và nhấn Enter..."), { target: { value: "Đọc tài liệu React" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    await waitFor(() => expect(screen.getAllByText("Đọc tài liệu React").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole("button", { name: "Bắt đầu" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));

    expect(startPomodoroSession).toHaveBeenCalledWith(expect.any(String), "task-1", 25);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạm dừng" })).toBeDefined());
  });

  it("pauses an active Pomodoro through the existing server action", async () => {
    const paused: TimerSession = {
      ...runningSession,
      status: "PAUSED",
      intervals: [{ ...runningSession.intervals[0], endedAt: new Date().toISOString() }],
    };
    vi.mocked(pauseSession).mockResolvedValue({ ok: true, data: paused });
    renderWorkspace(runningSession);

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));

    expect(pauseSession).toHaveBeenCalledWith("pomodoro-session", expect.any(String));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDefined());
  });

  it("does not show tasks or break state from another account", async () => {
    window.localStorage.setItem("focuslearn-pomodoro-break:first-user", JSON.stringify({ mode: "short", remaining: 120, endsAt: Date.now() + 120_000 }));
    renderWorkspace(null, { userId: "second-user", initialTasks: [] });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(screen.getByText("25:00")).toBeDefined();
    expect(screen.getByText(/Chưa có nhiệm vụ/)).toBeDefined();
  });

  it("estimates task minutes using the configured focus duration", () => {
    renderWorkspace(null, {
      initialTasks: [{ id: "task-1", title: "Read", estimate: 2, completedPomodoros: 0, done: false }],
      initialPreferences: {
        focusMinutes: 30,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        customMinutes: 45,
        cyclesBeforeLongBreak: 4,
        autoStartBreak: false,
        autoStartFocus: false,
        sound: "off",
        volume: 65,
        chime: "silent",
      },
    });

    expect(screen.getByText(/Dự kiến 60 phút/)).toBeDefined();
  });

  it("restores a running break using its deadline instead of counting interval ticks", async () => {
    window.localStorage.setItem("focuslearn-pomodoro-break:test-user", JSON.stringify({ mode: "short", remaining: 120, endsAt: Date.now() + 30_000 }));
    renderWorkspace();
    await waitFor(() => expect(screen.getByText("00:30")).toBeDefined());
  });

  it("creates a persisted focus session when auto-start follows a break", async () => {
    vi.mocked(startPomodoroSession).mockResolvedValue({ ok: true, data: runningSession });
    renderWorkspace(null, { initialPreferences: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      customMinutes: 10,
      cyclesBeforeLongBreak: 4,
      autoStartBreak: false,
      autoStartFocus: true,
      sound: "off",
      volume: 65,
      chime: "silent",
    } });

    fireEvent.click(screen.getByRole("button", { name: /Nghỉ ngắn/ }));
    fireEvent.click(screen.getByTitle("Chuyển giai đoạn"));

    await waitFor(() => expect(startPomodoroSession).toHaveBeenCalledWith(expect.any(String), null, 25));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạm dừng" })).toBeDefined());
  });

  it("renders task text safely inside Picture-in-Picture", async () => {
    const title = '<img src=x onerror="alert(1)">';
    const childDocument = document.implementation.createHTMLDocument("PiP");
    const child = { document: childDocument, closed: false, addEventListener: vi.fn(), focus: vi.fn(), close: vi.fn() };
    Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: { requestWindow: vi.fn().mockResolvedValue(child) } });
    renderWorkspace({ ...runningSession, note: title }, { initialTasks: [{ id: "task-1", title, estimate: 1, completedPomodoros: 0, done: false }] });
    await waitFor(() => expect(screen.getByRole("button", { name: /PiP/ })).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: /PiP/ }));
    await waitFor(() => expect(childDocument.getElementById("pomodoro-pip-status")?.textContent).toBe(title));
    expect(childDocument.querySelector("img")).toBeNull();
  });
});
