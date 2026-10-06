import { BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { HistoryList } from "@/components/history-list";
import { getCategories } from "@/lib/category-service";
import { AppError } from "@/lib/errors";
import { getCompletedHistory } from "@/lib/history-service";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ category?: string; from?: string; to?: string; page?: string }> }) {
  let user; try { user = await getCurrentUser(); } catch (error) { if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login"); throw error; }
  const params = await searchParams;
  const from = params.from ? new Date(`${params.from}T00:00:00`) : undefined;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : undefined;
  const [history, categories] = await Promise.all([getCompletedHistory(user.id, { categoryId: params.category || undefined, from: from && !Number.isNaN(+from) ? from : undefined, to: to && !Number.isNaN(+to) ? to : undefined, page: Number(params.page) || 1 }), getCategories(user.id)]);
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";
  return <main className="app-page"><div className="app-shell"><header className="app-header"><Link className="wordmark" href="/"><span className="wordmark__mark"><BookOpenCheck size={20} /></span><span>NHỊP HỌC</span></Link><div className="header-actions"><Link className="header-link" href="/dashboard">Tổng quan</Link><Link className="header-link" href="/categories">Danh mục</Link><AuthControls name={user.name} developmentBypass={developmentBypass} /></div></header><section className="content-panel"><p className="eyebrow eyebrow--mint">LỊCH SỬ HỌC</p><h1>Nhìn lại từng <em>nhịp tập trung.</em></h1><form className="history-filter"><label>Từ ngày<input type="date" name="from" defaultValue={params.from} /></label><label>Đến ngày<input type="date" name="to" defaultValue={params.to} /></label><label>Danh mục<select name="category" defaultValue={params.category ?? ""}><option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button button--secondary">Lọc</button></form><HistoryList categories={categories.map(({ id, name }) => ({ id, name }))} initialItems={history.items.map((item) => ({ id: item.id, startedAt: item.startedAt.toISOString(), endedAt: item.endedAt!.toISOString(), durationSeconds: item.durationSeconds!, categoryId: item.categoryId, categoryName: item.category?.name ?? null }))} />{history.total > history.pageSize && <div className="pagination">{history.page > 1 && <Link href={{ pathname: "/history", query: { ...params, page: history.page - 1 } }}>← Trước</Link>}<span>Trang {history.page} / {Math.ceil(history.total / history.pageSize)}</span>{history.page * history.pageSize < history.total && <Link href={{ pathname: "/history", query: { ...params, page: history.page + 1 } }}>Sau →</Link>}</div>}</section></div></main>;
}
