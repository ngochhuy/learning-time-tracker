import { redirect } from "next/navigation";
import { HistoryWorkspace } from "@/components/history-workspace";
import { getCategories } from "@/lib/category-service";
import { getCurrentUser } from "@/lib/current-user";
import { AppError } from "@/lib/errors";
import { parseHistoryFilters, type HistoryQuery } from "@/lib/history-filters";
import { getCompletedHistory, getHistoryOverview } from "@/lib/history-service";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<HistoryQuery> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  const params = await searchParams;
  const [overview, categories] = await Promise.all([getHistoryOverview(user.id), getCategories(user.id)]);
  const history = await getCompletedHistory(user.id, parseHistoryFilters(params, overview.timezone));

  return <HistoryWorkspace
    key={JSON.stringify(params)}
    params={params}
    overview={overview}
    categories={categories.map(({ id, name }) => ({ id, name }))}
    page={history.page}
    pageSize={history.pageSize}
    total={history.total}
    items={history.items.map((item) => ({
      id: item.id,
      startedAt: item.startedAt.toISOString(),
      endedAt: item.endedAt!.toISOString(),
      durationSeconds: item.durationSeconds!,
      categoryId: item.categoryId,
      categoryName: item.category?.name ?? null,
      note: item.note,
      sessionType: item.pomodoroFocus ? "Pomodoro" : "Timer",
      pomodoroTargetSeconds: item.pomodoroFocus?.targetSeconds ?? null,
      pomodoroCompleted: Boolean(item.pomodoroFocus?.completedAt),
      taskTitle: item.pomodoroFocus?.task?.title ?? null,
    }))}
  />;
}
