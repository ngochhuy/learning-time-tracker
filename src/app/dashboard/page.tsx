import { redirect } from "next/navigation";
import { MatchaDashboardWorkspace } from "@/components/matcha-dashboard-workspace";
import { getCurrentUser } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard-service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  let databaseUnavailable = false;
  let data: Awaited<ReturnType<typeof getDashboardData>> = {
    timezone: "Asia/Bangkok",
    todayLabel: "7/10/2026",
    dailyGoalMinutes: 120,
    todaySeconds: 0,
    weekSeconds: 0,
    weekDays: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label, index) => ({ date: `fallback-${index}`, label, seconds: 0, isToday: false })),
    categories: [],
    todayCategories: [],
    recent: [],
    completedSessionCount: 0,
    averageSessionSeconds: 0,
  };
  try {
    data = await getDashboardData(user.id);
  } catch {
    databaseUnavailable = true;
  }
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";

  return <MatchaDashboardWorkspace
    user={{ name: user.name, image: user.image }}
    developmentBypass={developmentBypass}
    timezone={data.timezone}
    todayLabel={data.todayLabel}
    dailyGoalMinutes={data.dailyGoalMinutes}
    todaySeconds={data.todaySeconds}
    weekSeconds={data.weekSeconds}
    weekDays={data.weekDays}
    categories={data.categories}
    todayCategories={data.todayCategories}
    recent={data.recent.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      durationSeconds: session.durationSeconds,
      categoryName: session.category?.name ?? null,
    }))}
    completedSessionCount={data.completedSessionCount}
    averageSessionSeconds={data.averageSessionSeconds}
    databaseUnavailable={databaseUnavailable}
  />;
}
