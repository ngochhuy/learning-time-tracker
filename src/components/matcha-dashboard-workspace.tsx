"use client";

import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Flame,
  Globe2,
  Leaf,
  LoaderCircle,
  Play,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateSettings } from "@/app/actions/settings";
import { MatchaAppSidebar } from "@/components/matcha-app-sidebar";
import { MatchaAppHeader } from "@/components/matcha-app-header";
import { formatDuration } from "@/lib/utils";

type DashboardWorkspaceProps = {
  user: { name: string; image?: string | null };
  developmentBypass: boolean;
  timezone: string;
  todayLabel: string;
  dailyGoalMinutes: number;
  todaySeconds: number;
  weekSeconds: number;
  weekDays: { date: string; label: string; seconds: number; isToday: boolean }[];
  categories: { id: string | null; name: string; seconds: number }[];
  todayCategories: { id: string | null; name: string; seconds: number }[];
  recent: { id: string; startedAt: string; endedAt: string | null; durationSeconds: number | null; categoryName: string | null }[];
  completedSessionCount: number;
  averageSessionSeconds: number;
  databaseUnavailable?: boolean;
};

const timezones = ["Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "America/New_York"];
const chartColors = ["#2e5339", "#54735c", "#86af80", "#d2ddd0", "#63856b"];

function asMinutes(seconds: number) {
  return Math.floor(seconds / 60);
}

function formatClock(value: string, timezone: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

function formatSessionDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: timezone }).format(new Date(value));
}

export function MatchaDashboardWorkspace({
  user,
  developmentBypass,
  timezone,
  todayLabel,
  dailyGoalMinutes,
  todaySeconds,
  weekSeconds,
  weekDays,
  categories,
  todayCategories,
  recent,
  completedSessionCount,
  averageSessionSeconds,
  databaseUnavailable = false,
}: DashboardWorkspaceProps) {
  const router = useRouter();
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [range, setRange] = useState<"week" | "month">("week");
  const [categoryRange, setCategoryRange] = useState<"day" | "week">("week");
  const [isPending, startTransition] = useTransition();
  const goalSeconds = dailyGoalMinutes * 60;
  const rawGoalPercent = goalSeconds ? Math.round((todaySeconds / goalSeconds) * 100) : 0;
  const goalPercent = Math.min(100, rawGoalPercent);
  const weeklyTarget = goalSeconds * 7;
  const weeklyPercent = weeklyTarget ? Math.min(100, Math.round((weekSeconds / weeklyTarget) * 100)) : 0;
  const chartMax = Math.max(...weekDays.map((day) => day.seconds), goalSeconds / 3, 60);
  const visibleCategories = categoryRange === "day" ? todayCategories : categories;
  const categorySeconds = visibleCategories.reduce((sum, category) => sum + category.seconds, 0);
  const donutSegments = useMemo(() => {
    const circumference = 238.76;
    return visibleCategories.slice(0, 4).map((category, index, visibleItems) => {
      const length = categorySeconds ? (category.seconds / categorySeconds) * circumference : 0;
      const precedingSeconds = visibleItems.slice(0, index).reduce((sum, item) => sum + item.seconds, 0);
      const offset = categorySeconds ? -(precedingSeconds / categorySeconds) * circumference : 0;
      return { ...category, color: chartColors[index]!, length, offset };
    });
  }, [visibleCategories, categorySeconds]);

  function saveSettings(nextTimezone: string, nextGoal = dailyGoalMinutes) {
    startTransition(async () => {
      const result = await updateSettings(nextTimezone, nextGoal);
      if (result.ok) {
        setTimezoneOpen(false);
        setGoalOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <main className="min-h-screen bg-[#f6f8f5] font-[family-name:var(--font-inter)] text-[#1b2e21] lg:pl-72">
      <MatchaAppSidebar active="dashboard" user={user} developmentBypass={developmentBypass} />
      <div>
        <MatchaAppHeader
          left={<><Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-geist)] font-bold text-[#2e5339] lg:hidden"><Leaf size={20} /> ForcusLearn</Link><span className="hidden text-sm font-medium text-[#3c4f41] lg:block">Thống kê tiến độ học tập</span></>}
          right={<span className="rounded-full bg-[#e2eee1] px-3 py-1 text-xs font-semibold text-[#2e5339]">Nhịp học của bạn</span>}
        />

        <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10">
          {databaseUnavailable && <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-[#ead5a6] bg-[#fff9e8] px-4 py-3 text-sm text-[#7b5d19]"><Clock3 size={16} /> Chưa thể tải dữ liệu học từ database. Bạn vẫn có thể dùng điều hướng; hãy kiểm tra lại cấu hình database rồi tải lại trang.</div>}
          <section className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-[#54735c]"><span className="size-2 rounded-full bg-[#2e5339]" /> THỐNG KÊ CÁ NHÂN</div>
              <h1 className="font-[family-name:var(--font-geist)] text-3xl font-bold tracking-[-0.05em] text-[#1b2e21] sm:text-4xl">Bảng thống kê <span className="text-[#54735c]">&amp; Mục tiêu</span></h1>
              <p className="mt-2 text-sm text-[#3c4f41]">Theo dõi nhịp học của bạn từ thứ Hai đến hôm nay.</p>
            </div>
            <div className="relative self-start xl:self-auto">
              <button type="button" onClick={() => setTimezoneOpen((open) => !open)} className="flex items-center gap-2 rounded-xl border border-[#d2ddd0] bg-white px-3 py-2 text-sm font-semibold text-[#2e5339] shadow-sm transition hover:bg-[#f0f4ed]">
                <Globe2 size={16} /> {timezone} <ChevronDown size={15} />
              </button>
              {timezoneOpen && <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[#d2ddd0] bg-white p-1.5 shadow-xl">
                {timezones.map((zone) => <button key={zone} type="button" disabled={isPending} onClick={() => saveSettings(zone)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[#f0f4ed] ${zone === timezone ? "bg-[#d8e8d6] font-semibold text-[#2e5339]" : "text-[#3c4f41]"}`}>{zone}{zone === timezone && <CheckCircle2 size={15} />}</button>)}
              </div>}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={<Clock3 size={18} />} label="Thời gian học hôm nay" caption={todayLabel} value={formatDuration(todaySeconds)} footer={<><span className="inline-flex items-center gap-2"><Flame size={15} />Chuỗi 5 ngày</span><span className="rounded bg-[#ebd9c8] px-1.5 py-0.5 text-[10px] font-bold text-[#73563d]">MINH HOẠ</span></>} />
            <MetricCard icon={<TrendingUp size={18} />} label="Tổng thời gian tuần này" value={formatDuration(weekSeconds)} footer={<><span>{weeklyPercent}% mục tiêu tuần</span><span className="font-semibold text-[#2e5339]">{formatDuration(weeklyTarget)}</span></>} progress={weeklyPercent} />
            <MetricCard icon={<Sparkles size={18} />} label="Phiên học trung bình" value={formatDuration(averageSessionSeconds)} suffix="/ phiên" footer={<><span className="inline-flex items-center gap-1 text-[#2e5339]"><Sparkles size={14} />94% Focus score</span><span className="rounded bg-[#ebd9c8] px-1.5 py-0.5 text-[10px] font-bold text-[#73563d]">MINH HOẠ</span></>} bottom={`Tổng cộng ${completedSessionCount} phiên hoàn tất`} />
          </section>

          <section className="relative mt-5 overflow-visible rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-sm lg:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span className="size-2.5 animate-pulse rounded-full bg-[#2e5339]" /><h2 className="font-[family-name:var(--font-geist)] text-lg font-bold tracking-[-0.03em]">Mục tiêu học hôm nay</h2>{rawGoalPercent > 100 && <span className="rounded-full bg-[#d8e8d6] px-2.5 py-1 text-[11px] font-bold text-[#2e5339]">🎉 Vượt {rawGoalPercent}% chỉ tiêu</span>}</div>
                  <div className="relative"><button type="button" onClick={() => setGoalOpen((open) => !open)} className="flex items-center gap-2 rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] px-3 py-2 text-sm font-semibold transition hover:bg-[#e1e8df]"><Target size={15} className="text-[#2e5339]" /> Cấu hình mục tiêu</button>
                    {goalOpen && <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#d2ddd0] bg-white p-3 shadow-xl"><p className="mb-2 text-sm font-bold">Điều chỉnh mục tiêu ngày</p><div className="space-y-1">{[120, 180, 240].map((goal) => <button type="button" key={goal} disabled={isPending} onClick={() => saveSettings(timezone, goal)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${goal === dailyGoalMinutes ? "bg-[#d8e8d6] font-bold text-[#2e5339]" : "hover:bg-[#f0f4ed]"}`}>{goal === 120 ? "Chuẩn" : goal === 180 ? "Chuyên sâu" : "Kỷ luật cao"}: {goal} phút {goal === dailyGoalMinutes && <CheckCircle2 size={15} />}</button>)}</div></div>}
                  </div>
                </div>
                <div className="mt-6 flex items-baseline justify-between gap-3"><div><span className="font-[family-name:var(--font-geist)] text-4xl font-bold tracking-[-0.06em] text-[#2e5339] sm:text-5xl">{asMinutes(todaySeconds)}</span><span className="ml-2 text-base text-[#3c4f41]">/ {dailyGoalMinutes} phút</span></div><span className="font-[family-name:var(--font-geist)] text-xl font-bold text-[#2e5339]">{rawGoalPercent}%</span></div>
                <div className="mt-3 h-3.5 overflow-hidden rounded-full border border-[#d2ddd0] bg-[#f0f4ed] p-0.5"><div className="h-full rounded-full bg-gradient-to-r from-[#2e5339] via-[#4b7752] to-[#86af80] transition-all duration-700" style={{ width: `${goalPercent}%` }} /></div>
                <div className="mt-2 flex justify-between text-[11px] font-medium text-[#54735c]"><span>Khởi đầu (0p)</span><span>Ngưỡng cơ sở ({dailyGoalMinutes}p)</span><span className="font-bold text-[#2e5339]">{rawGoalPercent > 100 ? `Vượt mức (+${asMinutes(todaySeconds) - dailyGoalMinutes}p)` : "Đang tiến gần"}</span></div>
              </div>
              <div className="flex max-w-md items-center gap-4 rounded-xl border border-[#d2ddd0] bg-[#f0f4ed] p-4 lg:w-80"><div className="grid size-20 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#d8e8d6] to-[#86af80] text-[#2e5339] shadow-sm"><Leaf size={33} /></div><div><span className="text-[11px] font-bold tracking-[0.12em] text-[#2e5339]">THÔNG ĐIỆP NGÀY</span><p className="mt-1 text-sm leading-5 text-[#3c4f41]">“Sự kiên định vượt qua động lực tạm thời. Cứ học thêm một phiên nữa nhé.”</p><span className="mt-2 inline-block rounded bg-[#ebd9c8] px-1.5 py-0.5 text-[9px] font-bold text-[#73563d]">MINH HOẠ</span></div></div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-12">
            <article className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-sm lg:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-[family-name:var(--font-geist)] text-lg font-bold tracking-[-0.03em]">Diễn biến thời gian học</h2><p className="mt-1 text-xs font-medium text-[#54735c]">Dữ liệu thực theo múi giờ đã chọn</p></div><div className="flex rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] p-1 text-xs font-bold"><button onClick={() => setRange("week")} className={`rounded-md px-3 py-1.5 ${range === "week" ? "bg-white text-[#2e5339] shadow-sm" : "text-[#54735c]"}`}>Tuần này</button><button onClick={() => setRange("month")} className={`rounded-md px-3 py-1.5 ${range === "month" ? "bg-white text-[#2e5339] shadow-sm" : "text-[#54735c]"}`}>Tháng này</button></div></div>
              {range === "month" && <p className="mt-3 rounded-lg bg-[#ebd9c8] px-3 py-2 text-xs text-[#73563d]">Chế độ tháng là bản xem trước; biểu đồ hiện hiển thị dữ liệu tuần thực tế.</p>}
              <div className="mt-7 flex h-52 items-end justify-between gap-2 border-b border-[#d2ddd0] px-1 pb-1 sm:gap-4">{weekDays.map((day) => <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-bold text-[#54735c]">{day.seconds ? `${Math.round(day.seconds / 60)}p` : ""}</span><div className={`w-full max-w-10 rounded-t-lg transition-all ${day.isToday ? "bg-[#2e5339]" : "bg-[#86af80]"}`} style={{ height: `${Math.max(day.seconds ? 9 : 3, (day.seconds / chartMax) * 100)}%` }} /><span className={`text-xs font-bold ${day.isToday ? "text-[#2e5339]" : "text-[#54735c]"}`}>{day.label}</span></div>)}</div>
            </article>
            <article className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-sm lg:col-span-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-[family-name:var(--font-geist)] text-lg font-bold tracking-[-0.03em]">Phân bổ theo môn học</h2><p className="mt-1 text-xs font-medium text-[#54735c]">{formatDuration(categorySeconds)} {categoryRange === "day" ? `hôm nay · ${todayLabel}` : "tuần này"}</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] p-1 text-[11px] font-bold"><button type="button" aria-pressed={categoryRange === "day"} onClick={() => setCategoryRange("day")} className={`rounded-md px-2.5 py-1.5 transition ${categoryRange === "day" ? "bg-white text-[#2e5339] shadow-sm" : "text-[#54735c]"}`}>Hôm nay</button><button type="button" aria-pressed={categoryRange === "week"} onClick={() => setCategoryRange("week")} className={`rounded-md px-2.5 py-1.5 transition ${categoryRange === "week" ? "bg-white text-[#2e5339] shadow-sm" : "text-[#54735c]"}`}>Tuần này</button></div><BarChart3 size={21} className="text-[#2e5339]" /></div></div>
              <div className="relative mx-auto my-5 grid size-44 place-items-center"><svg className="size-44 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="transparent" stroke="#f0f4ed" strokeWidth="12" />{donutSegments.map((segment) => <circle key={segment.id ?? "uncategorized"} cx="50" cy="50" r="38" fill="transparent" stroke={segment.color} strokeDasharray={`${segment.length} 238.76`} strokeDashoffset={segment.offset} strokeLinecap="round" strokeWidth="12" />)}</svg><div className="absolute text-center"><strong className="block font-[family-name:var(--font-geist)] text-xl tracking-[-0.05em]">{formatDuration(categorySeconds)}</strong><span className="text-[11px] font-medium text-[#54735c]">{visibleCategories.length} danh mục</span></div></div>
              <div className="space-y-2">{visibleCategories.length === 0 ? <p className="rounded-xl bg-[#f0f4ed] p-4 text-sm text-[#54735c]">Chưa có phiên hoàn thành trong khoảng thời gian này.</p> : visibleCategories.slice(0, 4).map((category, index) => { const percentage = categorySeconds ? Math.round((category.seconds / categorySeconds) * 100) : 0; return <div key={category.id ?? "uncategorized"} className="rounded-xl border border-[#d2ddd0] bg-[#f0f4ed] p-2.5"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 font-semibold"><i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index] }} /> <span className="truncate">{category.name}</span></span><span className="shrink-0 font-bold">{formatDuration(category.seconds)} <small className="font-medium text-[#54735c]">({percentage}%)</small></span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e1e8df]"><div className="h-full rounded-full" style={{ backgroundColor: chartColors[index], width: `${percentage}%` }} /></div></div>})}</div>
            </article>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-12">
            <article className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-sm lg:col-span-8"><div className="flex items-start justify-between gap-3"><div><h2 className="font-[family-name:var(--font-geist)] text-lg font-bold tracking-[-0.03em]">Phiên học hoàn thành gần đây</h2><p className="mt-1 text-xs font-medium text-[#54735c]">5 phiên học gần nhất được ghi nhận</p></div><Link href="/history" className="inline-flex items-center gap-1 text-sm font-bold text-[#2e5339] hover:underline">Xem toàn bộ <ArrowRight size={15} /></Link></div>
              <div className="mt-3 divide-y divide-[#d2ddd0]">{recent.length === 0 ? <div className="py-10 text-center text-sm text-[#54735c]">Chưa có phiên hoàn thành. Bắt đầu phiên đầu tiên từ Timer nhé.</div> : recent.map((session) => <div key={session.id} className="flex items-center justify-between gap-3 px-2 py-3 transition hover:bg-[#f0f4ed]/70"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d2ddd0] bg-[#d8e8d6] text-[#2e5339]"><Code2 size={18} /></div><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-bold">{session.categoryName ? `Phiên học ${session.categoryName}` : "Phiên học chưa phân loại"}</span><span className="hidden rounded bg-[#d8e8d6] px-2 py-0.5 text-[10px] font-bold text-[#2e5339] sm:inline">{session.categoryName ?? "Chưa phân loại"}</span></div><p className="mt-0.5 flex items-center gap-1 text-xs text-[#54735c]"><Clock3 size={12} /> {formatSessionDate(session.startedAt, timezone)}, {formatClock(session.startedAt, timezone)}{session.endedAt ? ` – ${formatClock(session.endedAt, timezone)}` : ""}<span className="ml-1 rounded bg-[#ebd9c8] px-1 py-0.5 text-[9px] font-bold text-[#73563d]">KHÔNG CÓ GHI CHÚ</span></p></div></div><div className="shrink-0 text-right"><strong className="block font-[family-name:var(--font-geist)] text-base">{formatDuration(session.durationSeconds ?? 0)}</strong><span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#2e5339]"><CheckCircle2 size={11} /> Hoàn thành</span></div></div>)}</div>
              <div className="mt-4 flex flex-col justify-between gap-3 border-t border-[#d2ddd0] pt-4 text-sm text-[#54735c] sm:flex-row sm:items-center"><span>Hiển thị tối đa 5 phiên gần nhất</span><Link href="/" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2e5339] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#385a3e]"><Play size={15} /> Bắt đầu phiên học mới</Link></div>
            </article>
            <aside className="flex flex-col justify-between rounded-2xl border border-[#d2ddd0] bg-[#f0f4ed] p-5 shadow-sm lg:col-span-4"><div><div className="grid size-12 place-items-center rounded-xl bg-[#d8e8d6] text-[#2e5339]"><Leaf size={24} /></div><p className="mt-5 font-[family-name:var(--font-geist)] text-xl font-bold leading-tight tracking-[-0.04em]">Kỷ luật là cầu nối giữa mục tiêu và thành tựu.</p><p className="mt-3 text-sm leading-6 text-[#54735c]">Dành một khoảng tập trung cho điều quan trọng nhất của bạn hôm nay.</p></div><div className="mt-8 flex items-center justify-between"><span className="rounded bg-[#ebd9c8] px-2 py-1 text-[10px] font-bold text-[#73563d]">MINH HOẠ</span><Link href="/categories" className="text-sm font-bold text-[#2e5339] hover:underline">Quản lý danh mục <ArrowRight size={14} className="inline" /></Link></div></aside>
          </section>
        </div>
      </div>
      {isPending && <div className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-xl bg-[#1b2e21] px-4 py-3 text-sm font-bold text-white shadow-xl"><LoaderCircle size={16} className="animate-spin" /> Đang lưu cài đặt...</div>}
    </main>
  );
}

function MetricCard({ icon, label, caption, value, suffix, footer, progress, bottom }: { icon: React.ReactNode; label: string; caption?: string; value: string; suffix?: string; footer: React.ReactNode; progress?: number; bottom?: string }) {
  return <article className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><span className="block text-xs font-bold uppercase tracking-[0.1em] text-[#54735c]">{label}</span>{caption && <span className="mt-1 block text-lg font-semibold leading-tight tracking-[-0.02em] text-[#54735c]">{caption}</span>}</div><span className="grid size-8 place-items-center rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] text-[#2e5339]">{icon}</span></div><div className="my-3"><strong className="font-[family-name:var(--font-geist)] text-3xl font-bold tracking-[-0.05em] text-[#1b2e21]">{value}</strong>{suffix && <span className="ml-1 text-sm text-[#54735c]">{suffix}</span>}</div>{typeof progress === "number" && <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#e1e8df]"><div className="h-full rounded-full bg-[#2e5339]" style={{ width: `${progress}%` }} /></div>}<div className="flex min-h-5 items-center justify-between gap-2 text-xs font-semibold text-[#54735c]">{footer}</div>{bottom && <div className="mt-4 border-t border-[#d2ddd0] pt-3 text-xs text-[#54735c]">{bottom}</div>}</article>;
}
