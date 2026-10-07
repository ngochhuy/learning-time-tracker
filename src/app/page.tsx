import { redirect } from "next/navigation";
import { MatchaTimerWorkspace, type MatchaSession } from "@/components/matcha-timer-workspace";
import { getCurrentUser } from "@/lib/current-user";
import { getActiveSession } from "@/lib/timer-service";
import { getCategories } from "@/lib/category-service";
import { getDashboardData } from "@/lib/dashboard-service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

function serializeSession(session: Awaited<ReturnType<typeof getActiveSession>>): MatchaSession | null {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    category: session.category,
    intervals: session.intervals.map((interval) => ({
      startedAt: interval.startedAt.toISOString(),
      endedAt: interval.endedAt?.toISOString() ?? null,
    })),
  };
}

export default async function Home() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  let session: MatchaSession | null = null;
  let categories: Array<{ id: string; name: string }> = [];
  let timezone = "Asia/Bangkok";
  let dailyGoalMinutes = 120;
  let completedTodaySeconds = 0;
  let databaseUnavailable = false;

  try {
    const [active, userCategories, dashboard] = await Promise.all([
      getActiveSession(user.id),
      getCategories(user.id),
      getDashboardData(user.id),
    ]);
    session = serializeSession(active);
    categories = userCategories.map(({ id, name }) => ({ id, name }));
    timezone = dashboard.timezone;
    dailyGoalMinutes = dashboard.dailyGoalMinutes;
    completedTodaySeconds = dashboard.todaySeconds;
  } catch {
    databaseUnavailable = true;
  }

  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";
  return <MatchaTimerWorkspace session={session} categories={categories} user={user} developmentBypass={developmentBypass} timezone={timezone} dailyGoalMinutes={dailyGoalMinutes} completedTodaySeconds={completedTodaySeconds} databaseUnavailable={databaseUnavailable} />;
}
