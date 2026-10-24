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

const finishedAt = new Date("2026-10-25T00:00:00.000Z");
let startedAt: Date;
let savedEndAt: Date | null;

function prepareSession(durationSeconds: number) {
  startedAt = new Date(finishedAt.getTime() - durationSeconds * 1_000);
  savedEndAt = null;
  const session = {
    id: "session-1",
    userId: "user-1",
    status: "RUNNING",
    intervals: [{ id: "interval-1", startedAt, endedAt: null }],
    pomodoroFocus: null,
  };
  mocks.tx.learningSession.findFirst.mockResolvedValue(session);
  mocks.tx.sessionInterval.update.mockImplementation(async ({ data }: { data: { endedAt: Date } }) => { savedEndAt = data.endedAt; });
  mocks.tx.sessionInterval.findMany.mockImplementation(async () => [{ startedAt, endedAt: savedEndAt }]);
  mocks.tx.learningSession.update.mockImplementation(async ({ data }: { data: object }) => ({ ...session, ...data }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(finishedAt);
});

afterEach(() => vi.useRealTimers());

describe("session duration confirmation", () => {
  it("allows exactly 24 hours", async () => {
    prepareSession(24 * 60 * 60);

    await finishLearningSession("user-1", "session-1", finishedAt.toISOString());

    expect(mocks.tx.learningSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durationSeconds: 24 * 60 * 60 }),
    }));
  });

  it("asks for confirmation above 24 hours and does not complete the session", async () => {
    prepareSession(24 * 60 * 60 + 1);

    await expect(finishLearningSession("user-1", "session-1", finishedAt.toISOString()))
      .rejects.toMatchObject({ code: "SESSION_DURATION_CONFIRMATION_REQUIRED" });
    expect(mocks.tx.learningSession.update).not.toHaveBeenCalled();
  });

  it("saves the real duration after the explicit override", async () => {
    prepareSession(24 * 60 * 60 + 1);

    await finishLearningSession("user-1", "session-1", finishedAt.toISOString(), undefined, false, "timer", true);

    expect(mocks.tx.learningSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durationSeconds: 24 * 60 * 60 + 1 }),
    }));
  });
});
