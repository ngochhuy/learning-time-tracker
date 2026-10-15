import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PomodoroWorkspace } from "@/components/pomodoro-workspace";
import { getCurrentUser } from "@/lib/current-user";
import { getTimerSummary } from "@/lib/dashboard-service";
import { getPomodoroData } from "@/lib/pomodoro-service";
import { AppError } from "@/lib/errors";
import { serializeTimerSession, type TimerSession } from "@/lib/timer-payload";
import { getActiveSession } from "@/lib/timer-service";
import { getCategories } from "@/lib/category-service";
import type { CategoryColorKey } from "@/lib/category-colors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pomodoro",
  description: "Không gian học sâu theo chu kỳ Pomodoro.",
};

export default async function PomodoroPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  let session: TimerSession | null = null;
  let dailyGoalMinutes = 120;
  let completedTodaySeconds = 0;
  let databaseUnavailable = false;
  let pomodoroData: Awaited<ReturnType<typeof getPomodoroData>> | null = null;
  let hasTimerSession = false;
  let categories: Array<{ id: string; name: string; colorKey: CategoryColorKey }> = [];
  const params = searchParams ? await searchParams : {};
  const rawDate = params.date;
  const selectedDate = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  try {
    const [active, summary, userCategories] = await Promise.all([
      getActiveSession(user.id),
      getTimerSummary(user.id),
      getCategories(user.id),
    ]);
    categories = userCategories.map(({ id, name, colorKey }) => ({ id, name, colorKey: colorKey as CategoryColorKey }));
    hasTimerSession = Boolean(active && !active.pomodoroFocus);
    session = active?.pomodoroFocus ? serializeTimerSession(active) : null;
    dailyGoalMinutes = summary.dailyGoalMinutes;
    pomodoroData = await getPomodoroData(user.id, summary.timezone, selectedDate);
    completedTodaySeconds = summary.todaySeconds;
  } catch {
    databaseUnavailable = true;
  }

  return <PomodoroWorkspace
    session={session}
    userId={user.id}
    initialTasks={pomodoroData?.tasks ?? []}
    initialPreferences={pomodoroData?.preferences ?? null}
    initialCompletedTotal={pomodoroData?.completedTotal ?? 0}
    initialCompletedToday={pomodoroData?.completedToday ?? 0}
    hasTimerSession={hasTimerSession}
    dailyGoalMinutes={dailyGoalMinutes}
    completedTodaySeconds={completedTodaySeconds}
    categories={categories}
    selectedDate={pomodoroData?.selectedDate ?? selectedDate ?? new Date().toISOString().slice(0, 10)}
    progress={pomodoroData?.progress ?? { plannedPomodoros: 0, completedPomodoros: 0, hasPlan: false }}
    databaseUnavailable={databaseUnavailable}
  />;
}
