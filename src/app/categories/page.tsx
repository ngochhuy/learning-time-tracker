import { BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { CategoryManager } from "@/components/category-manager";
import { getCategories } from "@/lib/category-service";
import { getCurrentUser } from "@/lib/current-user";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let user;
  try { user = await getCurrentUser(); } catch (error) { if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login"); throw error; }
  const categories = await getCategories(user.id);
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";
  return <main className="category-page"><div className="category-shell"><header className="app-header"><Link className="wordmark" href="/"><span className="wordmark__mark"><BookOpenCheck size={20} /></span><span>FORCUSLEARN</span></Link><div className="header-actions"><Link className="header-link" href="/">Timer</Link><Link className="header-link" href="/dashboard">Tổng quan</Link><Link className="header-link" href="/history">Lịch sử</Link><AuthControls name={user.name} developmentBypass={developmentBypass} /></div></header><CategoryManager initialCategories={categories.map(({ id, name }) => ({ id, name }))} /></div></main>;
}
