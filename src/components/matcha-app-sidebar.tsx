"use client";

import { Clock3, FolderOpen, History, Leaf, Sparkles } from "lucide-react";
import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";

type AppSection = "timer" | "dashboard" | "history" | "categories";

type MatchaAppSidebarProps = {
  active: AppSection;
  user: { name: string };
  developmentBypass: boolean;
};

const navigation: Array<{ id: AppSection; href: string; label: string; icon: typeof Clock3 }> = [
  { id: "timer", href: "/", label: "Timer", icon: Clock3 },
  { id: "dashboard", href: "/dashboard", label: "Thống kê", icon: Sparkles },
  { id: "history", href: "/history", label: "Lịch sử", icon: History },
  { id: "categories", href: "/categories", label: "Danh mục", icon: FolderOpen },
];

/** The persistent desktop navigation shared by the Timer and Dashboard workspaces. */
export function MatchaAppSidebar({ active, user, developmentBypass }: MatchaAppSidebarProps) {
  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col justify-between border-r border-[#e1e8df] bg-[#f0f4ed] p-6 lg:flex">
    <div className="flex flex-col gap-10">
      <Link href="/" className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#2e5339] text-white shadow-sm"><Leaf size={18} /></span><span className="flex flex-col"><strong className="font-[family-name:var(--font-geist)] text-lg font-semibold tracking-[-.03em] text-[#2e5339]">ForcusLearn</strong><small className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#708071]">Matcha &amp; Sage Edition</small></span></Link>
      <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return <Link key={item.id} href={item.href} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition ${isActive ? "bg-[#2e5339] font-medium text-white shadow-sm" : "font-medium text-[#3c4f41] hover:bg-[#e6ece2] hover:text-[#1b2e21]"}`}><Icon size={20} />{item.label}</Link>;
        })}
      </nav>
    </div>
    <div className="rounded-xl border border-[#e1e8df] bg-[#ffffff] p-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#dcedda] text-xs font-bold text-[#2e5339]">{user.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{user.name}</p><p className="text-[11px] text-[#708071]">{developmentBypass ? "Development" : "Học viên"}</p></div></div><span className="flex shrink-0 items-center gap-1 rounded-full bg-[#e2eee1] px-2 py-0.5 text-[10px] font-semibold text-[#2e5339]"><i className="size-1.5 rounded-full bg-[#2e5339]" />Tập trung</span></div><div className="mt-2 border-t border-[#e1e8df] pt-2"><AuthControls name="" developmentBypass={developmentBypass} /></div></div>
  </aside>;
}
