import { redirect } from "next/navigation";
import { MatchaTimerWorkspace } from "@/components/matcha-timer-workspace";
import { getCurrentUser } from "@/lib/current-user";
import { getActiveSession } from "@/lib/timer-service";
import { getCategories } from "@/lib/category-service";
import type { CategoryColorKey } from "@/lib/category-colors";
import { getTimerSummary } from "@/lib/dashboard-service";
import { AppError } from "@/lib/errors";
import { serializeTimerSession, type TimerSession } from "@/lib/timer-payload";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  let session: TimerSession | null = null;
  let hasPomodoroSession = false;
  let categories: Array<{ id: string; name: string; colorKey: CategoryColorKey }> = [];
  let timezone = "Asia/Bangkok";
  let dailyGoalMinutes = 120;
  let completedTodaySeconds = 0;
  let databaseUnavailable = false;

  try {
    const [active, userCategories, timerSummary] = await Promise.all([
      getActiveSession(user.id),
      getCategories(user.id),
      getTimerSummary(user.id),
    ]);
    hasPomodoroSession = Boolean(active?.pomodoroFocus);
    session = active && !active.pomodoroFocus ? serializeTimerSession(active) : null;
    categories = userCategories.map(({ id, name, colorKey }) => ({ id, name, colorKey: colorKey as CategoryColorKey }));
    timezone = timerSummary.timezone;
    dailyGoalMinutes = timerSummary.dailyGoalMinutes;
    completedTodaySeconds = timerSummary.todaySeconds;
  } catch {
    databaseUnavailable = true;
  }

  return <MatchaTimerWorkspace session={session} hasPomodoroSession={hasPomodoroSession} categories={categories} timezone={timezone} dailyGoalMinutes={dailyGoalMinutes} completedTodaySeconds={completedTodaySeconds} databaseUnavailable={databaseUnavailable} />;
}
