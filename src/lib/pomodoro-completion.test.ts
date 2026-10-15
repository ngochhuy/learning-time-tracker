import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    learningSession: { findFirst: vi.fn(), update: vi.fn() },
    sessionInterval: { update: vi.fn(), findMany: vi.fn() },
    pomodoroFocus: { update: vi.fn() },
    pomodoroTask: { update: vi.fn() },
  };
  return { tx };
});

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/transactions", () => ({ runSerializable: (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx) }));

import { finishLearningSession } from "@/lib/timer-service";

const now = new Date("2026-10-15T09:00:00.000Z");
let savedEndAt: Date | null;

function prepareSession(elapsedSeconds: number) {
  const startedAt = new Date(now.getTime() - elapsedSeconds * 1_000);
  const session = {
    id: "session-1",
    userId: "user-1",
    status: "RUNNING",
    intervals: [{ id: "interval-1", startedAt, endedAt: null }],
    pomodoroFocus: { targetSeconds: 1500, taskId: "task-1" },
  };
  mocks.tx.learningSession.findFirst.mockResolvedValue(session);
  mocks.tx.sessionInterval.update.mockImplementation(async ({ data }: { data: { endedAt: Date } }) => { savedEndAt = data.endedAt; });
  mocks.tx.sessionInterval.findMany.mockImplementation(async () => [{ startedAt, endedAt: savedEndAt }]);
  mocks.tx.learningSession.update.mockImplementation(async ({ data }: { data: object }) => ({ ...session, ...data }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  savedEndAt = null;
});

afterEach(() => vi.useRealTimers());

describe("Pomodoro completion transaction", () => {
  it("rejects an early completion without incrementing the task", async () => {
    prepareSession(1490);

    await expect(finishLearningSession("user-1", "session-1", undefined, true)).rejects.toMatchObject({ code: "POMODORO_NOT_READY" });
    expect(mocks.tx.learningSession.update).not.toHaveBeenCalled();
    expect(mocks.tx.pomodoroFocus.update).not.toHaveBeenCalled();
    expect(mocks.tx.pomodoroTask.update).not.toHaveBeenCalled();
  });

  it("caps overrun time and increments the linked task once", async () => {
    prepareSession(1800);

    await finishLearningSession("user-1", "session-1", undefined, true);

    expect(savedEndAt).toEqual(new Date(now.getTime() - 300_000));
    expect(mocks.tx.learningSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ durationSeconds: 1500 }) }));
    expect(mocks.tx.pomodoroFocus.update).toHaveBeenCalledOnce();
    expect(mocks.tx.pomodoroTask.update).toHaveBeenCalledWith({ where: { id: "task-1" }, data: { completedPomodoros: { increment: 1 } } });
  });
});
