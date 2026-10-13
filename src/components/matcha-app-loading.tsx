export type LoadingSection = "timer" | "dashboard" | "history" | "categories";

const sectionLabels: Record<LoadingSection, string> = {
  timer: "Timer",
  dashboard: "Thống kê",
  history: "Lịch sử",
  categories: "Danh mục",
};

function Pulse({ className }: { className: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-[#e1e8df] ${className}`} />;
}

function TimerSkeleton() {
  return <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10">
    <div className="mx-auto h-[620px] max-w-4xl animate-pulse rounded-3xl border border-[#d2ddd0] bg-white p-8">
      <div className="flex justify-between"><Pulse className="h-10 w-48 rounded-full" /><Pulse className="h-10 w-36 rounded-full" /></div>
      <div className="mx-auto mt-16 grid size-80 place-items-center rounded-full border-[6px] border-[#dbe5d8]">
        <div className="space-y-5"><Pulse className="h-16 w-64" /><Pulse className="mx-auto h-8 w-48 rounded-full" /></div>
      </div>
      <div className="mt-14 flex justify-center gap-4"><Pulse className="h-14 w-56 rounded-xl" /><Pulse className="h-14 w-48 rounded-xl" /></div>
    </div>
  </div>;
}

function DashboardSkeleton() {
  return <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10">
    <div className="space-y-3"><Pulse className="h-3 w-32" /><Pulse className="h-10 w-72 rounded-lg" /><Pulse className="h-4 w-96 max-w-[70vw]" /></div>
    <section className="mt-8 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white p-5"><div className="flex justify-between"><Pulse className="h-3 w-32" /><Pulse className="size-8 rounded-lg" /></div><Pulse className="mt-6 h-9 w-28" /><Pulse className="mt-6 h-2 w-full rounded-full" /></div>)}</section>
    <section className="mt-5 h-56 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white p-6"><Pulse className="h-4 w-48" /><Pulse className="mt-7 h-11 w-64" /><Pulse className="mt-5 h-3 w-full rounded-full" /></section>
    <section className="mt-5 grid gap-5 lg:grid-cols-12"><div className="h-72 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white lg:col-span-7" /><div className="h-72 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white lg:col-span-5" /></section>
  </div>;
}

function HistorySkeleton() {
  return <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10">
    <div className="space-y-3"><Pulse className="h-3 w-28" /><Pulse className="h-10 w-80 rounded-lg" /></div>
    <section className="mt-8 grid gap-4 rounded-2xl border border-[#d2ddd0] bg-white p-5 sm:grid-cols-4"><Pulse className="h-12 w-full rounded-lg" /><Pulse className="h-12 w-full rounded-lg" /><Pulse className="h-12 w-full rounded-lg" /><Pulse className="h-12 w-full rounded-lg" /></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#d2ddd0] bg-white">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="grid grid-cols-[1fr_auto] gap-5 border-b border-[#e8eee6] p-5 last:border-0"><div className="space-y-3"><Pulse className="h-4 w-44" /><Pulse className="h-3 w-64 max-w-full" /></div><Pulse className="h-9 w-24 rounded-lg" /></div>)}</section>
  </div>;
}

function CategoriesSkeleton() {
  return <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10">
    <div className="space-y-3"><Pulse className="h-3 w-28" /><Pulse className="h-10 w-72 rounded-lg" /><Pulse className="h-4 w-96 max-w-[70vw]" /></div>
    <section className="mt-8 rounded-2xl border border-[#d2ddd0] bg-white p-6"><Pulse className="h-5 w-52" /><div className="mt-5 flex flex-col gap-4 sm:flex-row"><Pulse className="h-12 flex-1 rounded-lg" /><Pulse className="h-12 w-56 rounded-lg" /><Pulse className="h-12 w-40 rounded-lg" /></div></section>
    <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white p-6"><Pulse className="h-7 w-36 rounded-full" /><Pulse className="mt-8 h-4 w-48" /><Pulse className="mt-4 h-10 w-32" /><Pulse className="mt-8 h-2 w-full rounded-full" /></div>)}</section>
  </div>;
}

const skeletons: Record<LoadingSection, () => React.ReactNode> = {
  timer: TimerSkeleton,
  dashboard: DashboardSkeleton,
  history: HistorySkeleton,
  categories: CategoriesSkeleton,
};

/** Route-aware loading shell shown while a Server Component page is streaming. */
export function MatchaAppLoading({ active }: { active: LoadingSection }) {
  const Content = skeletons[active];

  return <div className="min-h-[calc(100dvh-4rem)] font-[family-name:var(--font-inter)] text-[#1b2e21]" aria-busy="true" aria-describedby="route-loading-status">
      <p id="route-loading-status" className="sr-only" role="status">Đang tải trang {sectionLabels[active]}...</p>
      <Content />
  </div>;
}
