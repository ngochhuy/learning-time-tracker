import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  startLearningSession: vi.fn(),
  pauseLearningSession: vi.fn(),
  resumeLearningSession: vi.fn(),
  finishLearningSession: vi.fn(),
  saveActiveSessionNote: vi.fn(),
  cancelLearningSession: vi.fn(),
  changeActiveSessionCategory: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/timer-service", () => ({
  startLearningSession: mocks.startLearningSession,
  pauseLearningSession: mocks.pauseLearningSession,
  resumeLearningSession: mocks.resumeLearningSession,
  finishLearningSession: mocks.finishLearningSession,
  saveActiveSessionNote: mocks.saveActiveSessionNote,
  cancelLearningSession: mocks.cancelLearningSession,
  changeActiveSessionCategory: mocks.changeActiveSessionCategory,
}));

import { pauseSession, startSession } from "@/app/actions/timer";
import { pausePomodoroSession, startPomodoroSession } from "@/app/actions/pomodoro";
import { AppError } from "@/lib/errors";

const serverReceivedAt = new Date("2026-10-19T01:39:26.237Z");
const afterAuthentication = new Date("2026-10-19T01:39:27.000Z");
const clickedAt = "2026-10-19T01:39:26.681Z";
const session = {
  id: "session-1",
  status: "RUNNING",
  intervals: [],
  category: null,
  note: null,
  pomodoroFocus: null,
};

describe("timer action receive timestamps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(serverReceivedAt);
    mocks.getCurrentUser.mockImplementation(async () => {
      vi.setSystemTime(afterAuthentication);
      return { id: "user-1" };
    });
    mocks.startLearningSession.mockResolvedValue(session);
    mocks.pauseLearningSession.mockResolvedValue(session);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("captures the Timer receive time before authentication", async () => {
    await startSession(null, clickedAt, "");
    expect(mocks.startLearningSession).toHaveBeenCalledWith(
      "user-1",
      null,
      clickedAt,
      "",
      undefined,
      serverReceivedAt,
      expect.objectContaining({
        diagnosticId: expect.any(String),
        operation: "start",
        sessionKind: "timer",
      }),
    );

    vi.setSystemTime(serverReceivedAt);
    await pauseSession("session-1", clickedAt);
    expect(mocks.pauseLearningSession).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      clickedAt,
      "timer",
      serverReceivedAt,
      expect.objectContaining({
        diagnosticId: expect.any(String),
        operation: "pause",
        sessionKind: "timer",
      }),
    );
  });

  it("captures the Pomodoro receive time before authentication", async () => {
    await startPomodoroSession(clickedAt, null, 25);
    expect(mocks.startLearningSession).toHaveBeenCalledWith(
      "user-1",
      null,
      clickedAt,
      null,
      { taskId: null, targetSeconds: 1_500 },
      serverReceivedAt,
      expect.objectContaining({
        diagnosticId: expect.any(String),
        operation: "start",
        sessionKind: "pomodoro",
      }),
    );

    vi.setSystemTime(serverReceivedAt);
    await pausePomodoroSession("session-1", clickedAt);
    expect(mocks.pauseLearningSession).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      clickedAt,
      "pomodoro",
      serverReceivedAt,
      expect.objectContaining({
        diagnosticId: expect.any(String),
        operation: "pause",
        sessionKind: "pomodoro",
      }),
    );
  });

  it("returns a diagnostic ID when Timer timestamp validation fails", async () => {
    mocks.startLearningSession.mockRejectedValueOnce(new AppError("INVALID_TIME_RANGE"));

    const result = await startSession(null, clickedAt, "");

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_TIME_RANGE",
      diagnosticId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("returns a diagnostic ID when Pomodoro timestamp validation fails", async () => {
    mocks.pauseLearningSession.mockRejectedValueOnce(new AppError("INVALID_TIME_RANGE"));

    const result = await pausePomodoroSession("session-1", clickedAt);

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_TIME_RANGE",
      diagnosticId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
});
