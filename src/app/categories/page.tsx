import { redirect } from "next/navigation";
import { MatchaCategoryWorkspace } from "@/components/matcha-category-workspace";
import { getCategoryOverview } from "@/lib/category-service";
import { getCurrentUser } from "@/lib/current-user";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  const overview = await getCategoryOverview(user.id);
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";
  return <MatchaCategoryWorkspace
    user={{ name: user.name, image: user.image }}
    developmentBypass={developmentBypass}
    initialCategories={overview.categories.map((category) => ({ ...category, lastCompletedAt: category.lastCompletedAt?.toISOString() ?? null }))}
    initialUncategorized={overview.uncategorized}
    initialTotalSeconds={overview.totalSeconds}
  />;
}
