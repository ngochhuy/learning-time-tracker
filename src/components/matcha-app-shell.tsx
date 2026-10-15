"use client";

import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Folder, History, Leaf, Settings2, TimerReset, Volume2, VolumeX } from "lucide-react";
import { MatchaAppHeader } from "@/components/matcha-app-header";
import { MatchaAppSidebar } from "@/components/matcha-app-sidebar";

type UserSummary = { name: string; image?: string | null };
type ShellState = {
  zen: boolean;
  setZen: Dispatch<SetStateAction<boolean>>;
  focusSound: boolean;
  setFocusSound: Dispatch<SetStateAction<boolean>>;
  timezone: string;
  setTimezone: Dispatch<SetStateAction<string>>;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
};

const ShellContext = createContext<ShellState | null>(null);

export function useAppShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useAppShell must be used inside MatchaAppShell");
  return context;
}

export function useZenMode() {
  const { zen, setZen } = useAppShell();
  return { zen, setZen };
}

function getHeaderContent(pathname: string, state: ShellState) {
  if (pathname === "/") return {
    left: <div className="flex items-center gap-2 text-xs font-medium text-[#3c4f41]"><Leaf size={16} className="text-[#2e5339]" /><span>{state.timezone || "Múi giờ tài khoản"}</span><span className="text-[#a5b0a4]">•</span><span className="hidden sm:inline">Chế độ học sâu thảo mộc</span></div>,
    right: <>
      <button type="button" aria-pressed={state.focusSound} className="hidden items-center gap-2 rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#e6ece2] hover:shadow-xs active:scale-95 sm:inline-flex" onClick={() => state.setFocusSound((value) => !value)}>{state.focusSound ? <Volume2 size={15} className="text-[#2e5339]" /> : <VolumeX size={15} className="text-[#2e5339]" />}Âm thanh {state.focusSound ? "bật" : "tắt"}<span className="rounded bg-[#dcedda] px-1 text-[9px]">mock</span></button>
      <button type="button" className="rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#e6ece2] hover:text-[#2e5339] hover:shadow-xs active:scale-95" onClick={() => state.setZen(true)}>Chế độ Zen</button>
    </>,
  };
  if (pathname === "/dashboard") return {
    left: <div className="flex items-center gap-2 text-sm font-semibold text-[#2e5339]"><BarChart3 size={17} /><span>Thống kê tiến độ học tập</span></div>,
    right: <button type="button" aria-expanded={state.settingsOpen} onClick={() => { if (!state.settingsOpen) document.getElementById("dashboard-goal-settings")?.scrollIntoView({ behavior: "smooth", block: "center" }); state.setSettingsOpen((open) => !open); }} className="inline-flex items-center gap-2 rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] px-3 py-1.5 text-xs font-semibold text-[#2e5339] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c2cec0] hover:bg-[#e6ece2] hover:shadow-xs active:scale-95"><Settings2 size={15} />Mục tiêu</button>,
  };
  if (pathname.startsWith("/pomodoro")) return {
    left: <div className="flex items-center gap-2 text-sm font-semibold text-[#2e5339]"><TimerReset size={17} /><span>Pomodoro</span></div>,
    right: <span className="rounded-full bg-[#e2eee1] px-3 py-1 text-xs font-semibold text-[#2e5339]">Tập trung theo chu kỳ</span>,
  };
  if (pathname === "/history") return {
    left: <div className="flex items-center gap-2 text-sm font-semibold text-[#2e5339]"><History size={17} /><span>Lịch sử học tập</span></div>,
    right: <span className="rounded-full bg-[#e2eee1] px-3 py-1 text-xs font-semibold text-[#2e5339]">Các phiên đã hoàn thành</span>,
  };
  return {
    left: <div className="flex items-center gap-2 text-sm font-semibold text-[#2e5339]"><Folder size={17} /><span>Danh mục học tập</span></div>,
    right: <span className="rounded-full bg-[#e2eee1] px-3 py-1 text-xs font-semibold text-[#2e5339]">Quản lý môn học</span>,
  };
}

export function MatchaAppShell({ children, user, developmentBypass }: {
  children: ReactNode;
  user: UserSummary;
  developmentBypass: boolean;
}) {
  const pathname = usePathname();
  const [zenRoute, setZenRoute] = useState<string | null>(null);
  const [focusSound, setFocusSound] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const supportsZenMode = pathname === "/" || pathname.startsWith("/pomodoro");
  const zen = supportsZenMode && zenRoute === pathname;
  const setZen = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
    setZenRoute((current) => {
      const enabled = typeof value === "function" ? value(current === pathname) : value;
      return enabled ? pathname : null;
    });
  }, [pathname]);
  const state = useMemo(() => ({ zen, setZen, focusSound, setFocusSound, timezone, setTimezone, settingsOpen, setSettingsOpen }), [zen, setZen, focusSound, timezone, settingsOpen]);
  const zenModeEnabled = supportsZenMode && zen;
  const header = getHeaderContent(pathname, state);

  return <ShellContext.Provider value={state}>
    {!zenModeEnabled && <MatchaAppSidebar user={user} developmentBypass={developmentBypass} />}
    <div className={`min-h-dvh bg-[#f6f8f5] transition-[padding] duration-200 ${zenModeEnabled ? "" : "pb-24 lg:pl-72 lg:pb-0"}`}>
      {!zenModeEnabled && <MatchaAppHeader left={header.left} right={header.right} />}
      {children}
    </div>
  </ShellContext.Provider>;
}
