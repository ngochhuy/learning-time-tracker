import type { LearningStatus } from "@/generated/prisma/client";
import type { ActiveSession } from "@/lib/timer-service";

export type TimerSession = {
  id: string;
  status: LearningStatus;
  intervals: Array<{ startedAt: string; endedAt: string | null }>;
  category: { id: string; name: string } | null;
  note: string | null;
  pomodoroFocus?: { targetSeconds: number; taskId: string | null } | null;
};

export function serializeTimerSession(session: ActiveSession): TimerSession {
  return {
    id: session.id,
    status: session.status,
    category: session.category,
    note: session.note,
    pomodoroFocus: session.pomodoroFocus,
    intervals: session.intervals.map((interval) => ({
      startedAt: interval.startedAt.toISOString(),
      endedAt: interval.endedAt?.toISOString() ?? null,
    })),
  };
}

export function previewStartSession(category: TimerSession["category"], now: string, note: string | null = null): TimerSession {
  return {
    id: "pending-start",
    status: "RUNNING",
    category,
    note,
    intervals: [{ startedAt: now, endedAt: null }],
  };
}

export function previewPauseSession(session: TimerSession, now: string): TimerSession {
  return {
    ...session,
    status: "PAUSED",
    intervals: session.intervals.map((interval) => interval.endedAt ? interval : { ...interval, endedAt: now }),
  };
}

export function previewResumeSession(session: TimerSession, now: string): TimerSession {
  return {
    ...session,
    status: "RUNNING",
    intervals: [...session.intervals, { startedAt: now, endedAt: null }],
  };
}
