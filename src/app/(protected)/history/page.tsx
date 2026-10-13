import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenCheck, Filter, History as HistoryIcon } from "lucide-react";
import { HistoryList } from "@/components/history-list";
import { getCategories } from "@/lib/category-service";
import { AppError } from "@/lib/errors";
import { getCompletedHistory } from "@/lib/history-service";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: {
  searchParams: Promise<{ category?: string; from?: string; to?: string; page?: string }>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }

  const params = await searchParams;
  const from = params.from ? new Date(`${params.from}T00:00:00`) : undefined;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : undefined;
  const [history, categories] = await Promise.all([
    getCompletedHistory(user.id, {
      categoryId: params.category || undefined,
      from: from && !Number.isNaN(+from) ? from : undefined,
      to: to && !Number.isNaN(+to) ? to : undefined,
      page: Number(params.page) || 1,
    }),
    getCategories(user.id),
  ]);

  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f6f8f5] font-[family-name:var(--font-inter)] text-[#1b2e21] dark:bg-[#111a13] dark:text-[#e7f0e7]">
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <section className="matcha-history rounded-2xl border border-[#e1e8df] bg-white p-5 shadow-sm sm:p-8 dark:border-[#3d503f] dark:bg-[#1b251d]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[.14em] text-[#54735c] dark:text-[#b6c6b8]"><BookOpenCheck size={14} />LỊCH SỬ HỌC</p>
            <h1 className="font-[family-name:var(--font-geist)] text-3xl font-bold tracking-[-.04em] sm:text-4xl">Nhìn lại từng nhịp tập trung.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#54735c] dark:text-[#b6c6b8]">Lọc, xem và chỉnh sửa những phiên học đã hoàn thành.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#eaf2e8] px-3 py-1.5 text-xs font-semibold text-[#2e5339] dark:bg-[#263329] dark:text-[#c8dec7]"><HistoryIcon size={14} />{history.total} phiên</span>
        </div>

        <form className="mt-6 grid gap-3 rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end dark:border-[#3d503f] dark:bg-[#162019]">
          <label htmlFor="history-from" className="flex flex-col gap-1.5 text-xs font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Từ ngày<input id="history-from" className="min-h-11 rounded-lg border border-[#d2ddd0] bg-white px-3 text-sm text-[#1b2e21] outline-none transition focus:border-[#54735c] focus:ring-2 focus:ring-[#54735c]/20 dark:border-[#3d503f] dark:bg-[#1b251d] dark:text-[#e7f0e7]" type="date" name="from" defaultValue={params.from} /></label>
          <label htmlFor="history-to" className="flex flex-col gap-1.5 text-xs font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Đến ngày<input id="history-to" className="min-h-11 rounded-lg border border-[#d2ddd0] bg-white px-3 text-sm text-[#1b2e21] outline-none transition focus:border-[#54735c] focus:ring-2 focus:ring-[#54735c]/20 dark:border-[#3d503f] dark:bg-[#1b251d] dark:text-[#e7f0e7]" type="date" name="to" defaultValue={params.to} /></label>
          <label htmlFor="history-category" className="flex flex-col gap-1.5 text-xs font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Danh mục<select id="history-category" className="min-h-11 rounded-lg border border-[#d2ddd0] bg-white px-3 text-sm text-[#1b2e21] outline-none transition focus:border-[#54735c] focus:ring-2 focus:ring-[#54735c]/20 dark:border-[#3d503f] dark:bg-[#1b251d] dark:text-[#e7f0e7]" name="category" defaultValue={params.category ?? ""}><option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2e5339] px-5 text-sm font-semibold text-white transition hover:bg-[#385a3e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#54735c]"><Filter size={15} />Lọc phiên</button>
        </form>

        <div className="mt-5">
          <HistoryList categories={categories.map(({ id, name }) => ({ id, name }))} initialItems={history.items.map((item) => ({ id: item.id, startedAt: item.startedAt.toISOString(), endedAt: item.endedAt!.toISOString(), durationSeconds: item.durationSeconds!, categoryId: item.categoryId, categoryName: item.category?.name ?? null }))} />
          {history.total > history.pageSize && <nav aria-label="Phân trang lịch sử" className="mt-5 flex items-center justify-between gap-3 border-t border-[#e1e8df] pt-4 text-sm dark:border-[#3d503f]">
            {history.page > 1 ? <Link prefetch={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#d2ddd0] px-3 font-semibold text-[#2e5339] transition hover:bg-[#f0f4ed] dark:border-[#3d503f] dark:text-[#c8dec7] dark:hover:bg-[#263329]" href={{ pathname: "/history", query: { ...params, page: history.page - 1 } }}><ArrowLeft size={15} />Trước</Link> : <span />}
            <span className="text-xs font-medium text-[#54735c] dark:text-[#b6c6b8]">Trang {history.page} / {Math.ceil(history.total / history.pageSize)}</span>
            {history.page * history.pageSize < history.total ? <Link prefetch={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#d2ddd0] px-3 font-semibold text-[#2e5339] transition hover:bg-[#f0f4ed] dark:border-[#3d503f] dark:text-[#c8dec7] dark:hover:bg-[#263329]" href={{ pathname: "/history", query: { ...params, page: history.page + 1 } }}>Tiếp<ArrowRight size={15} /></Link> : <span />}
          </nav>}
        </div>
      </section>
    </div>
  </main>;
}
