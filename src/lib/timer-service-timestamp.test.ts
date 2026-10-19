import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    category: { findFirst: vi.fn() },
    learningSession: { findFirst: vi.fn(), create: vi.fn() },
    pomodoroTask: { findFirst: vi.fn() },
    pomodoroFocus: { create: vi.fn() },
  };
  return { tx, validationTimes: [] as Date[] };
});

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/transactions", () => ({
  runSerializable: async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
    await callback(mocks.tx);
    vi.setSystemTime(new Date("2026-10-19T01:39:30.000Z"));
    return callback(mocks.tx);
  },
}));

import { startLearningSession } from "@/lib/timer-service";

const receivedAt = new Date("2026-10-19T01:39:26.237Z");
const clickedAt = "2026-10-19T01:39:26.681Z";

describe("timer service receive timestamp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(receivedAt);
    mocks.validationTimes.length = 0;
    mocks.tx.learningSession.findFirst.mockResolvedValue(null);
    mocks.tx.learningSession.create.mockImplementation(async ({ data }: { data: { startedAt: Date } }) => {
      mocks.validationTimes.push(data.startedAt);
      return {
        id: "session-1",
        status: "RUNNING",
        intervals: [{ startedAt: data.startedAt, endedAt: null }],
        category: null,
        note: null,
        pomodoroFocus: null,
      };
    });
  });

  afterEach(() => vi.useRealTimers());

  it("reuses one receive time if a serializable transaction is retried", async () => {
    await startLearningSession("user-1", null, clickedAt);

    expect(mocks.validationTimes).toEqual([receivedAt, receivedAt]);
  });
});
