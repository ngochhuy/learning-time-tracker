import { Clock3, FolderOpen, History, Leaf, Sparkles } from "lucide-react";

const navItems = [
  { label: "Timer", icon: Clock3 },
  { label: "Thống kê", icon: Sparkles },
  { label: "Lịch sử", icon: History },
  { label: "Danh mục", icon: FolderOpen },
];

/** A lightweight skeleton matching the Dashboard shell during route streaming. */
export function MatchaDashboardLoading() {
  return <main className="min-h-dvh bg-[#f6f8f5] font-[family-name:var(--font-inter)] text-[#1b2e21] lg:pl-72" aria-busy="true" aria-label="Đang tải thống kê">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col justify-between border-r border-[#e1e8df] bg-[#f0f4ed] p-6 lg:flex">
      <div className="flex flex-col gap-10">
        <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#2e5339] text-white shadow-sm"><Leaf size={18} /></span><span className="flex flex-col"><strong className="font-[family-name:var(--font-geist)] text-lg font-semibold tracking-[-.03em] text-[#2e5339]">ForcusLearn</strong><small className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#708071]">Matcha &amp; Sage Edition</small></span></div>
        <nav aria-label="Đang tải điều hướng" className="flex flex-col gap-1">{navItems.map((item, index) => { const Icon = item.icon; return <div key={item.label} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm ${index === 1 ? "bg-[#2e5339] font-medium text-white shadow-sm" : "font-medium text-[#3c4f41]"}`}><Icon size={20} />{item.label}</div>; })}</nav>
      </div>
      <div className="rounded-xl border border-[#e1e8df] bg-white p-3 shadow-sm"><div className="flex items-center gap-3"><span className="size-8 rounded-full bg-[#dcedda]" /><span className="h-3 w-24 animate-pulse rounded bg-[#e1e8df]" /></div></div>
    </aside>
    <div>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e1e8df] bg-[#f6f8f5]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-10"><div className="flex items-center gap-2"><span className="size-5 animate-pulse rounded-md bg-[#d8e8d6]" /><span className="h-3 w-40 animate-pulse rounded bg-[#e1e8df]" /></div><span className="h-7 w-28 animate-pulse rounded-full bg-[#e2eee1]" /></header>
      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10">
        <div className="flex items-end justify-between gap-5"><div className="space-y-3"><div className="h-3 w-32 animate-pulse rounded bg-[#d8e8d6]" /><div className="h-10 w-72 animate-pulse rounded-lg bg-[#e1e8df]" /><div className="h-4 w-96 max-w-[70vw] animate-pulse rounded bg-[#e1e8df]" /></div><div className="hidden h-10 w-44 animate-pulse rounded-xl bg-white sm:block" /></div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white p-5"><div className="flex justify-between"><span className="h-3 w-32 rounded bg-[#e1e8df]" /><span className="size-8 rounded-lg bg-[#f0f4ed]" /></div><div className="mt-6 h-9 w-28 rounded bg-[#e1e8df]" /><div className="mt-6 h-2 w-full rounded-full bg-[#f0f4ed]" /></div>)}</section>
        <section className="mt-5 h-56 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white p-6"><div className="h-4 w-48 rounded bg-[#e1e8df]" /><div className="mt-7 h-11 w-64 rounded bg-[#e1e8df]" /><div className="mt-5 h-3 w-full rounded-full bg-[#f0f4ed]" /></section>
        <section className="mt-5 grid gap-5 lg:grid-cols-12"><div className="h-72 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white lg:col-span-7" /><div className="h-72 animate-pulse rounded-2xl border border-[#d2ddd0] bg-white lg:col-span-5" /></section>
        <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#54735c]"><span className="flex gap-1"><i className="size-2 animate-bounce rounded-full bg-[#2e5339]" /><i className="size-2 animate-bounce rounded-full bg-[#54735c] [animation-delay:150ms]" /><i className="size-2 animate-bounce rounded-full bg-[#86af80] [animation-delay:300ms]" /></span> Đang tải dữ liệu học tập...</p>
      </div>
    </div>
  </main>;
}
