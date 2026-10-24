"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Columns3, Download, Filter, Lightbulb, Pencil, RefreshCw, RotateCcw, Search, Trash2, X, Zap, BadgeCheck } from "lucide-react";
import { deleteAllSessions, deleteSession, updateSession } from "@/app/actions/history";
import type { HistoryQuery } from "@/lib/history-filters";
import { MAX_SESSION_NOTE_LENGTH } from "@/lib/session-note";

type Item = { id: string; startedAt: string; endedAt: string; durationSeconds: number; categoryId: string | null; categoryName: string | null; note: string | null; sessionType?: "Timer" | "Pomodoro"; pomodoroTargetSeconds?: number | null; pomodoroCompleted?: boolean; taskTitle?: string | null };
type Category = { id: string; name: string };
type Overview = {
  total: number;
  totalSeconds: number;
  averageSeconds: number;
  goalRate: number;
  week: { date: string; label: string; seconds: number }[];
  weekChange: number | null;
  peak: { date: string; label: string; seconds: number } | null;
  timezone: string;
};
type Props = { params: HistoryQuery; overview: Overview; categories: Category[]; page: number; pageSize: number; total: number; items: Item[] };

const icon = "size-[20px] shrink-0";
const control = "min-w-0 bg-transparent font-body-sm text-body-sm font-medium text-[#1b2e21] outline-none dark:text-[#e7f0e7]";
const input = "w-full rounded-lg border border-[#e1e8df] bg-[#ebf1e8] px-3 py-2 font-body-sm text-body-sm text-[#1b2e21] outline-none focus:ring-2 focus:ring-[#2c4a32] dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#e7f0e7]";

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}g ${String(minutes % 60).padStart(2, "0")}p` : minutes ? `${minutes} phút` : `${Math.max(0, seconds)} giây`;
}

function localDate(iso: string, zone: string) {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);
}

function activePreset(params: HistoryQuery, zone: string) {
  if (!params.from && !params.to) return "all";
  const now = DateTime.now().setZone(zone);
  if (params.from === now.toISODate() && params.to === now.toISODate()) return "today";
  if (params.from === now.minus({ days: 6 }).toISODate() && params.to === now.toISODate()) return "week";
  if (params.from === now.startOf("month").toISODate() && params.to === now.toISODate()) return "month";
  return "custom";
}

export function HistoryWorkspace({ params, overview, categories, page, pageSize, total, items: serverItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(serverItems);
  const [previousServerItems, setPreviousServerItems] = useState(serverItems);
  if (serverItems !== previousServerItems) { setPreviousServerItems(serverItems); setItems(serverItems); }
  const [from, setFrom] = useState(params.from ?? "");
  const [to, setTo] = useState(params.to ?? "");
  const [category, setCategory] = useState(params.category ?? "");
  const [query, setQuery] = useState(params.q ?? "");
  const [editing, setEditing] = useState<Item | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") { setEditing(null); setExportOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams();
    Object.entries({ ...params, ...changes }).forEach(([key, value]) => { if (value) next.set(key, value); });
    startTransition(() => router.push(`/history${next.size ? `?${next}` : ""}`));
  }

  function preset(value: "today" | "week" | "month" | "all") {
    const now = DateTime.now().setZone(overview.timezone);
    const start = value === "today" ? now : value === "week" ? now.minus({ days: 6 }) : value === "month" ? now.startOf("month") : null;
    const newFrom = start?.toISODate() ?? "";
    const newTo = start ? now.toISODate()! : "";
    setFrom(newFrom);
    setTo(newTo);
    navigate({ from: newFrom, to: newTo, page: null });
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ from, to, category, q: query.trim(), page: null });
  }

  function reset() {
    setFrom(""); setTo(""); setCategory(""); setQuery("");
    startTransition(() => router.push("/history"));
  }

  function remove(item: Item) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa phiên học này khỏi nhật ký?")) return;
    startTransition(async () => {
      const result = await deleteSession(item.id);
      if (!result.ok) { setToast({ text: result.message, error: true }); return; }
      setItems((current) => current.filter(({ id }) => id !== item.id));
      setToast({ text: "Đã xóa phiên học khỏi lịch sử." });
      router.refresh();
    });
  }

  function removeAll() {
    if (!overview.total) return;
    const confirmation = window.prompt(`Thao tác này sẽ xóa vĩnh viễn ${overview.total} phiên học đã hoàn thành của tài khoản hiện tại. Nhập XÓA để xác nhận:`);
    if (confirmation !== "XÓA") {
      if (confirmation !== null) setToast({ text: "Chưa xóa dữ liệu: nội dung xác nhận không đúng.", error: true });
      return;
    }
    setClearingAll(true);
    startTransition(async () => {
      const result = await deleteAllSessions();
      setClearingAll(false);
      if (!result.ok) { setToast({ text: result.message, error: true }); return; }
      setItems([]);
      setToast({ text: `Đã xóa ${result.data.deleted} phiên học.` });
      router.refresh();
    });
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const day = String(form.get("date"));
    const startTime = String(form.get("startTime"));
    const endTime = String(form.get("endTime"));
    const originalStart = localDate(editing.startedAt, overview.timezone);
    const originalEnd = localDate(editing.endedAt, overview.timezone);
    const dayOffset = Math.round(originalEnd.startOf("day").diff(originalStart.startOf("day"), "days").days);
    const start = day === originalStart.toISODate() && startTime === originalStart.toFormat("HH:mm")
      ? originalStart : DateTime.fromISO(`${day}T${startTime}`, { zone: overview.timezone });
    const endOnSameDay = DateTime.fromISO(`${day}T${endTime}`, { zone: overview.timezone });
    const end = day === originalStart.toISODate() && endTime === originalEnd.toFormat("HH:mm")
      ? originalEnd : endOnSameDay.plus({ days: dayOffset || (endOnSameDay <= start ? 1 : 0) });
    if (!start.isValid || !end.isValid || end <= start) { setToast({ text: "Thời gian kết thúc phải sau thời gian bắt đầu.", error: true }); return; }
    const categoryId = String(form.get("categoryId") || "") || null;
    const note = String(form.get("note") ?? "");
    startTransition(async () => {
      const startIso = start.toUTC().toISO()!;
      const endIso = end.toUTC().toISO()!;
      let result = await updateSession(editing.id, startIso, endIso, categoryId, note);
      if (!result.ok && result.code === "SESSION_DURATION_CONFIRMATION_REQUIRED") {
        if (!window.confirm(result.message)) return;
        result = await updateSession(editing.id, startIso, endIso, categoryId, note, true);
      }
      if (!result.ok) { setToast({ text: result.message, error: true }); return; }
      setItems((current) => current.map((item) => item.id === editing.id ? {
        ...item,
        startedAt: result.data.startedAt,
        endedAt: result.data.endedAt,
        durationSeconds: result.data.durationSeconds,
        categoryId,
        categoryName: categories.find(({ id }) => id === categoryId)?.name ?? null,
        note: result.data.note,
      } : item));
      setEditing(null);
      setToast({ text: "Đã cập nhật phiên học thành công." });
      router.refresh();
    });
  }

  const presetValue = activePreset(params, overview.timezone);
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const maxDay = Math.max(...overview.week.map(({ seconds }) => seconds), 1);
  const exportQuery = new URLSearchParams();
  Object.entries({ category: params.category, from: params.from, to: params.to, q: params.q }).forEach(([key, value]) => { if (value) exportQuery.set(key, value); });

  return <main className="history-stitch min-h-[calc(100dvh-4rem)] bg-[#f6f8f5] font-body-md text-body-md text-[#1b2e21] dark:bg-[#101712] dark:text-[#e7f0e7]">
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-space-lg px-4 py-space-lg sm:px-space-xl">
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-12">
        <section className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#e1e8df] bg-white p-space-lg shadow-sm md:col-span-8 dark:border-[#3d503f] dark:bg-[#1b251d]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#d8e8d6]/40 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs"><span className="size-2 rounded-full bg-[#2c4a32]" /><span className="font-label-xs text-xs leading-4 font-semibold uppercase tracking-[0.1em] text-[#2c4a32] dark:text-[#c8dec7]">Nhật ký tiến trình học sâu thảo mộc</span></div>
            <h1 className="font-headline-lg text-[28px] leading-[36px] font-bold tracking-[-0.025em] text-[#1b2e21] sm:text-[32px] sm:leading-[40px] dark:text-[#e7f0e7]">Lịch sử học tập</h1>
            <p className="max-w-xl font-body-md text-[15px] leading-6 font-normal text-[#3c4f41] dark:text-[#b6c6b8]">Tổng cộng <span className="font-label-lg font-semibold text-[#2c4a32] dark:text-[#c8dec7]">{overview.total} phiên học</span> đã được lưu trữ tự động. Phân tích chu kỳ tập trung, thời lượng tích luỹ và ghi chú thực hành qua từng mốc thời gian.</p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-space-md pt-space-lg">
            <Stat icon={<Clock3 className={icon} />} label="Tổng thời gian ghi nhận" value={duration(overview.totalSeconds)} />
            <Stat icon={<BadgeCheck className={icon} />} label="Tỉ lệ hoàn thành mục tiêu" value={`${overview.goalRate}%`} title="Tỉ lệ ngày đạt mục tiêu hiện tại trong 7 ngày gần đây" />
            <Stat icon={<Zap className={icon} />} label="Trung bình phiên" value={duration(overview.averageSeconds)} />
          </div>
        </section>
        <section className="flex flex-col justify-between rounded-xl border border-[#e1e8df] bg-white p-space-lg shadow-sm md:col-span-4 dark:border-[#3d503f] dark:bg-[#1b251d]">
          <div className="flex items-center justify-between gap-2"><span className="font-label-md text-label-md font-medium uppercase tracking-wider text-[#3c4f41] dark:text-[#b6c6b8]">Mật độ 7 ngày gần đây</span><span className="rounded bg-[#d8e8d6] px-2 py-0.5 font-label-xs text-label-xs font-semibold text-[#2c4a32] dark:bg-[#2a3a2c] dark:text-[#c8dec7]">{overview.weekChange === null ? "Tuần đầu" : `${overview.weekChange >= 0 ? "+" : ""}${overview.weekChange}% so tuần trước`}</span></div>
          <div className="py-space-sm"><div className="flex h-16 items-end justify-between gap-2 px-2">{overview.week.map((day) => <div key={day.date} className="w-[22px] rounded-t bg-[#86af80] transition-[height] duration-500 odd:bg-[#d8e8d6] dark:odd:bg-[#54735c]" style={{ height: `${Math.max(4, day.seconds / maxDay * 56)}px` }} title={`${day.date}: ${duration(day.seconds)}`} />)}</div><div className="flex justify-between px-2 pt-1 font-label-xs text-label-xs font-medium text-[#3c4f41] dark:text-[#b6c6b8]">{overview.week.map((day) => <span key={day.date}>{day.label}</span>)}</div></div>
          <div className="flex items-center justify-between pt-space-xs text-[#3c4f41] dark:text-[#b6c6b8]"><span className="font-body-sm text-body-sm">{overview.peak ? `Cao điểm: ${overview.peak.label} (${duration(overview.peak.seconds)})` : "Chưa có phiên học gần đây"}</span><CalendarDays size={19} className="text-[#2c4a32] dark:text-[#c8dec7]" /></div>
        </section>
      </div>

      <form onSubmit={applyFilters} className="flex flex-col gap-space-md rounded-xl border border-[#e1e8df] bg-white p-space-lg shadow-sm dark:border-[#3d503f] dark:bg-[#1b251d]">
        <div className="flex flex-wrap items-center justify-between gap-space-sm"><div className="flex flex-wrap items-center gap-space-xs"><span className="mr-1 font-label-md text-label-md font-medium text-[#3c4f41] dark:text-[#b6c6b8]">Lọc nhanh:</span>{(["today", "week", "month", "all"] as const).map((value) => <button key={value} type="button" onClick={() => preset(value)} className={`rounded-full border px-3 py-1 font-label-md text-label-md transition-all duration-200 cursor-pointer ${presetValue === value ? "border-[#2c4a32] bg-[#2c4a32] font-medium text-white shadow-sm hover:bg-[#385a3e] hover:-translate-y-0.5 active:translate-y-0 active:scale-95" : "border-[#e1e8df] bg-[#f0f4ed] text-[#1b2e21] hover:bg-[#ebf1e8] hover:border-[#2c4a32]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#e7f0e7] dark:hover:bg-[#263329]"}`}>{value === "today" ? "Hôm nay" : value === "week" ? "7 ngày qua" : value === "month" ? "Tháng này" : "Tất cả"}</button>)}</div>
          <div className="ml-auto flex items-center gap-space-sm"><button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-label-md text-[#3c4f41] transition-all duration-200 hover:bg-[#ffdad6]/50 hover:text-[#ba1a1a] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 dark:text-[#b6c6b8]"><RotateCcw size={16} />Xóa bộ lọc</button><div className="relative"><button type="button" aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)} className="flex items-center gap-1.5 rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3.5 py-1.5 font-label-md text-label-md text-[#1b2e21] transition-all duration-200 hover:bg-[#ebf1e8] hover:border-[#2c4a32]/40 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95 dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#e7f0e7]"><Download size={16} className="text-[#2c4a32] dark:text-[#c8dec7]" /><span className="font-medium">Xuất dữ liệu</span><ChevronDown size={12} className="ml-0.5" /></button>{exportOpen && <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-[#e1e8df] bg-white p-1 shadow-xl dark:border-[#3d503f] dark:bg-[#1b251d]"><a onClick={() => setExportOpen(false)} href={`/api/history/export?${exportQuery}&format=csv`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-body-sm text-body-sm transition-colors duration-150 hover:bg-[#ebf1e8] hover:text-[#2c4a32] dark:hover:bg-[#263329] dark:hover:text-[#c8dec7]">Xuất file CSV (.csv)</a><a onClick={() => setExportOpen(false)} href={`/api/history/export?${exportQuery}&format=json`} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-body-sm text-body-sm transition-colors duration-150 hover:bg-[#ebf1e8] hover:text-[#2c4a32] dark:hover:bg-[#263329] dark:hover:text-[#c8dec7]">Xuất file JSON (.json)</a></div>}</div></div></div>
        <div className="grid grid-cols-1 gap-space-sm pt-space-xs md:grid-cols-12">
          <div className="flex items-center gap-2 rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3 py-2 md:col-span-4 dark:border-[#3d503f] dark:bg-[#162019]"><CalendarDays size={18} className="shrink-0 text-[#3c4f41] dark:text-[#b6c6b8]" /><div className="flex w-full min-w-0 items-center gap-2"><input aria-label="Từ ngày" title="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${control} w-full`} /><span className="text-[#3c4f41]">→</span><input aria-label="Đến ngày" title="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${control} w-full`} /></div></div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3 py-2 md:col-span-3 dark:border-[#3d503f] dark:bg-[#162019]"><Filter size={18} className="shrink-0 text-[#3c4f41] dark:text-[#b6c6b8]" /><select aria-label="Lọc danh mục" value={category} onChange={(event) => setCategory(event.target.value)} className={`${control} w-full cursor-pointer`}><option value="">Tất cả danh mục</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}<option value="uncategorized">Chưa phân loại</option></select></div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3 py-2 md:col-span-5 dark:border-[#3d503f] dark:bg-[#162019]"><Search size={18} className="shrink-0 text-[#3c4f41] dark:text-[#b6c6b8]" /><input ref={searchRef} aria-label="Tìm theo ghi chú hoặc danh mục" value={query} onChange={(event) => setQuery(event.target.value)} className={`${control} w-full placeholder:text-[#3c4f41]/70`} placeholder="Tìm theo ghi chú hoặc danh mục..." type="search" /><kbd className="hidden rounded border border-[#e1e8df] bg-[#ebf1e8] px-1.5 py-0.5 font-mono text-[10px] text-[#3c4f41] sm:inline-block dark:border-[#3d503f] dark:bg-[#263329]">⌘K</kbd></div>
        </div>
        <button disabled={pending} className="self-end rounded-lg bg-[#2c4a32] px-4 py-2 font-label-md text-label-md font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#385a3e] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50">Áp dụng bộ lọc</button>
      </form>

      {overview.total > 0 && <div className="flex justify-end"><button type="button" disabled={pending || clearingAll} onClick={removeAll} className="flex items-center gap-1.5 rounded-lg border border-[#f0b8b2] bg-white px-3 py-1.5 font-label-md text-label-md font-medium text-[#ba1a1a] shadow-sm transition-all duration-200 hover:bg-[#ffdad6]/60 hover:border-[#ba1a1a] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#7d3c37] dark:bg-[#1b251d]" title="Xóa tất cả phiên đã hoàn thành"><Trash2 size={15} />{clearingAll ? "Đang xóa…" : "Xóa tất cả phiên"}</button></div>}
      <section className="flex flex-col overflow-hidden rounded-xl border border-[#e1e8df] bg-white shadow-sm dark:border-[#3d503f] dark:bg-[#1b251d]">
        <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-[#e1e8df] bg-[#f0f4ed] px-space-lg py-space-md dark:border-[#3d503f] dark:bg-[#162019]"><div className="flex items-center gap-2"><h2 className="font-headline-sm text-headline-sm font-semibold">Danh sách phiên học</h2><span className="rounded-full bg-[#d8e8d6] px-2.5 py-0.5 font-label-xs text-label-xs font-semibold text-[#2c4a32] dark:bg-[#2a3a2c] dark:text-[#c8dec7]">Mới nhất lên đầu</span></div><div className="flex items-center gap-space-sm"><button type="button" title="Làm mới danh sách" aria-label="Làm mới danh sách" onClick={() => router.refresh()} className="rounded-lg p-1.5 text-[#3c4f41] transition-all duration-200 hover:bg-[#ebf1e8] hover:text-[#2c4a32] hover:scale-110 active:scale-95 dark:text-[#b6c6b8]"><RefreshCw size={18} /></button><button type="button" title="Tuỳ biến cột hiển thị" aria-label="Ẩn hoặc hiện cột ghi chú" aria-pressed={showNotes} onClick={() => setShowNotes((show) => !show)} className="rounded-lg p-1.5 text-[#3c4f41] transition-all duration-200 hover:bg-[#ebf1e8] hover:text-[#2c4a32] hover:scale-110 active:scale-95 dark:text-[#b6c6b8]"><Columns3 size={18} /></button></div></div>
        <div className="w-full overflow-x-auto"><table className="w-full min-w-[960px] border-collapse text-left"><thead><tr className="history-table-head select-none border-b border-[#e1e8df] bg-[#f0f4ed] uppercase text-[#2c4a32] dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#d5e5d3]"><th scope="col" className="px-space-lg py-3.5">Bắt đầu &amp; Thời điểm</th><th scope="col" className="px-space-md py-3.5">Kết thúc</th><th scope="col" className="px-space-md py-3.5">Thời lượng</th><th scope="col" className="px-space-md py-3.5">Danh mục môn</th>{showNotes && <th scope="col" className="px-space-lg py-3.5">Ghi chú &amp; Tác vụ</th>}<th scope="col" className="px-space-lg py-3.5 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-[#e1e8df] font-body-md text-body-md dark:divide-[#3d503f]">{items.length === 0 ? <tr><td colSpan={showNotes ? 6 : 5} className="px-space-lg py-12 text-center text-[#3c4f41] dark:text-[#b6c6b8]">Chưa có phiên học nào khớp với bộ lọc.</td></tr> : items.map((item) => {
            const start = localDate(item.startedAt, overview.timezone);
            const end = localDate(item.endedAt, overview.timezone);
            return <tr key={item.id} className="group transition-colors hover:bg-[#f0f4ed]/70 dark:hover:bg-[#263329]"><td className="px-space-lg py-4"><div className="flex items-center gap-space-sm"><span className="size-2 rounded-full bg-[#2c4a32]" /><div className="flex flex-col"><span className="font-label-lg text-label-lg font-semibold">{start.toFormat("dd/MM/yyyy")}</span><span className="font-label-xs text-label-xs text-[#3c4f41] dark:text-[#b6c6b8]">{start.toFormat("HH:mm")}</span></div></div></td><td className="px-space-md py-4 font-label-md text-label-md font-medium text-[#3c4f41] dark:text-[#b6c6b8]">{end.toFormat("HH:mm")}{end.toISODate() !== start.toISODate() && <span className="ml-1 text-[10px]">+1 ngày</span>}</td><td className="px-space-md py-4"><span className="inline-flex rounded-md bg-[#d8e8d6] px-2.5 py-1 font-label-md text-label-md font-semibold text-[#2c4a32] dark:bg-[#2a3a2c] dark:text-[#c8dec7]">{duration(item.durationSeconds)}</span></td><td className="px-space-md py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#d8e8d6]/80 px-2.5 py-0.5 font-label-xs text-label-xs font-semibold text-[#2c4a32] dark:bg-[#2a3a2c] dark:text-[#c8dec7]"><span className="size-1.5 rounded-full bg-[#2c4a32] dark:bg-[#86af80]" />{item.categoryName ?? "Chưa phân loại"}</span></td>{showNotes && <td className="px-space-lg py-4"><div className="flex max-w-md flex-col"><span className="line-clamp-2 font-body-sm text-body-sm text-[#3c4f41] dark:text-[#b6c6b8]">{item.note || "Chưa có ghi chú"}</span></div></td>}<td className="px-space-lg py-4 text-right"><div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100"><button type="button" disabled={pending} onClick={() => setEditing(item)} title="Chỉnh sửa phiên" aria-label={`Chỉnh sửa phiên ${start.toFormat("dd/MM/yyyy HH:mm")}`} className="rounded-lg p-1.5 text-[#3c4f41] transition-all duration-200 hover:scale-115 hover:bg-[#ebf1e8] hover:text-[#2c4a32] active:scale-95 disabled:opacity-50 dark:text-[#b6c6b8] dark:hover:bg-[#263329] dark:hover:text-[#c8dec7]"><Pencil size={18} /></button><button type="button" disabled={pending} onClick={() => remove(item)} title="Xóa phiên học" aria-label={`Xóa phiên ${start.toFormat("dd/MM/yyyy HH:mm")}`} className="rounded-lg p-1.5 text-[#3c4f41] transition-all duration-200 hover:scale-115 hover:bg-[#ffdad6]/60 hover:text-[#ba1a1a] active:scale-95 disabled:opacity-50 dark:text-[#b6c6b8] dark:hover:bg-[#4a2220] dark:hover:text-[#ffb4ab]"><Trash2 size={18} /></button></div></td></tr>;
          })}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-space-md bg-white px-space-lg py-space-md dark:bg-[#1b251d]"><div className="flex flex-wrap items-center gap-space-md"><span className="font-body-sm text-body-sm text-[#3c4f41] dark:text-[#b6c6b8]">Hiển thị <strong className="text-[#1b2e21] dark:text-[#e7f0e7]">{first} - {last}</strong> trên tổng số <strong className="text-[#1b2e21] dark:text-[#e7f0e7]">{total}</strong> phiên</span><div className="flex items-center gap-2"><span className="font-label-xs text-label-xs font-medium uppercase text-[#3c4f41]">Xem:</span><select aria-label="Số phiên mỗi trang" value={pageSize} onChange={(event) => navigate({ pageSize: event.target.value, page: null })} className="cursor-pointer rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-2 py-1 font-label-md text-label-md font-medium dark:border-[#3d503f] dark:bg-[#162019]">{[10, 20, 50].map((count) => <option key={count} value={count}>{count} phiên / trang</option>)}</select></div></div><nav aria-label="Phân trang lịch sử" className="flex items-center gap-1"><button type="button" disabled={page <= 1 || pending} onClick={() => navigate({ page: String(page - 1) })} className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-label-md text-label-md text-[#3c4f41] transition-all duration-200 hover:bg-[#ebf1e8] hover:text-[#1b2e21] hover:scale-102 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 dark:text-[#b6c6b8] dark:hover:bg-[#263329] dark:hover:text-[#e7f0e7]"><ChevronLeft size={16} /><span className="hidden sm:inline">Trước</span></button><div className="mx-1 flex items-center gap-1 font-label-md text-label-md">{Array.from(new Set([1, ...Array.from({ length: Math.min(3, pages) }, (_, index) => Math.max(1, Math.min(pages, page - 1 + index))), pages])).sort((a, b) => a - b).map((number, index, numbers) => <span key={number} className="flex items-center gap-1">{index > 0 && number - numbers[index - 1]! > 1 && <span className="w-6 text-center text-[#3c4f41]">...</span>}<button type="button" aria-current={number === page ? "page" : undefined} onClick={() => navigate({ page: String(number) })} className={`flex size-8 items-center justify-center rounded-lg transition-all duration-200 ${number === page ? "bg-[#2c4a32] font-medium text-white shadow-sm hover:bg-[#385a3e]" : "text-[#1b2e21] hover:bg-[#ebf1e8] hover:scale-110 active:scale-95 dark:text-[#e7f0e7] dark:hover:bg-[#263329]"}`}>{number}</button></span>)}</div><button type="button" disabled={page >= pages || pending} onClick={() => navigate({ page: String(page + 1) })} className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-label-md text-label-md transition-all duration-200 hover:bg-[#ebf1e8] hover:text-[#1b2e21] hover:scale-102 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 dark:text-[#b6c6b8] dark:hover:bg-[#263329] dark:hover:text-[#e7f0e7]"><span className="hidden sm:inline">Tiếp theo</span><ChevronRight size={16} /></button></nav></div>
      </section>

      <aside className="flex items-center justify-between gap-space-md rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-space-md dark:border-[#3d503f] dark:bg-[#1a241c]"><div className="flex items-center gap-space-sm"><Lightbulb className="size-5 shrink-0 text-[#2c4a32] dark:text-[#c8dec7]" /><p className="font-body-sm text-body-sm text-[#3c4f41] dark:text-[#b6c6b8]"><strong className="text-[#1b2e21] dark:text-[#e7f0e7]">Mẹo duy trì dòng chảy:</strong> Các phiên học kéo dài từ 45-60 phút mang lại khả năng ghi nhớ dài hạn tốt nhất. Hãy nhớ bấm nghỉ ngơi ít nhất 10 phút giữa hai phiên học liên tiếp.</p></div><a href="/dashboard" className="group inline-flex items-center gap-1 whitespace-nowrap font-label-md text-label-md font-semibold text-[#2c4a32] transition-all duration-200 hover:text-[#385a3e] hover:translate-x-1 dark:text-[#c8dec7] dark:hover:text-white">Xem biểu đồ chu kỳ →</a></aside>
    </div>

    {editing && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1b2e21]/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><form role="dialog" aria-modal="true" aria-labelledby="edit-session-title" onSubmit={saveEdit} className="flex w-full max-w-lg flex-col gap-space-md rounded-2xl border border-[#e1e8df] bg-white p-space-lg shadow-2xl dark:border-[#3d503f] dark:bg-[#1b251d]"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex size-8 items-center justify-center rounded-lg bg-[#d8e8d6] text-[#2c4a32]"><Pencil size={18} /></div><div><h3 id="edit-session-title" className="font-headline-sm text-headline-sm font-semibold">Chỉnh sửa phiên học</h3><p className="font-label-xs text-label-xs text-[#3c4f41] dark:text-[#b6c6b8]">Cập nhật lại thời lượng thực tế, danh mục và ghi chú</p></div></div><button type="button" aria-label="Đóng" onClick={() => setEditing(null)} className="flex size-8 items-center justify-center rounded-full text-[#3c4f41] transition-all duration-200 hover:scale-110 hover:bg-[#ebf1e8] active:scale-95 dark:text-[#b6c6b8] dark:hover:bg-[#263329]"><X size={18} /></button></div><div className="flex flex-col gap-space-sm"><label className="font-label-md text-label-md font-medium">Mốc ngày ghi nhận<input name="date" type="date" required defaultValue={localDate(editing.startedAt, overview.timezone).toISODate()!} className={`${input} mt-1`} /></label><div className="grid grid-cols-2 gap-space-sm"><label className="font-label-md text-label-md font-medium">Thời gian bắt đầu<input name="startTime" type="time" required defaultValue={localDate(editing.startedAt, overview.timezone).toFormat("HH:mm")} className={`${input} mt-1`} /></label><label className="font-label-md text-label-md font-medium">Thời gian kết thúc<input name="endTime" type="time" required defaultValue={localDate(editing.endedAt, overview.timezone).toFormat("HH:mm")} className={`${input} mt-1`} /></label></div><label className="font-label-md text-label-md font-medium">Danh mục môn học<select name="categoryId" defaultValue={editing.categoryId ?? ""} className={`${input} mt-1`}><option value="">Chưa phân loại</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="font-label-md text-label-md font-medium">Ghi chú &amp; Tác vụ đã thực hiện<textarea name="note" rows={3} maxLength={MAX_SESSION_NOTE_LENGTH} defaultValue={editing.note ?? ""} placeholder="Ghi lại nội dung đã học…" className={`${input} mt-1 resize-none`} /></label></div><div className="flex justify-end gap-space-sm pt-space-xs"><button type="button" onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 font-label-md text-label-md text-[#3c4f41] transition-all duration-200 hover:bg-[#ebf1e8] hover:text-[#1b2e21] active:scale-95 dark:text-[#b6c6b8] dark:hover:bg-[#263329]">Hủy bỏ</button><button disabled={pending} className="rounded-lg bg-[#2c4a32] px-5 py-2 font-label-md text-label-md font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#385a3e] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button></div></form></div>}
    {toast && <div role={toast.error ? "alert" : "status"} className={`fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-xl px-4 py-3 font-body-sm text-body-sm text-white shadow-lg ${toast.error ? "bg-[#9a4038]" : "bg-[#385a3e]"}`}>{toast.error ? <X size={18} /> : <Check size={18} />}{toast.text}</div>}
  </main>;
}

function Stat({ icon: statIcon, label, value, title }: { icon: React.ReactNode; label: string; value: string; title?: string }) {
  return <div title={title} className="flex items-center gap-space-sm rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-space-md py-space-sm dark:border-[#3d503f] dark:bg-[#162019]"><span className="text-[#2c4a32] dark:text-[#c8dec7]">{statIcon}</span><div className="flex flex-col"><span className="history-stat-label font-label-xs text-xs leading-4 font-bold tracking-[0.01em] text-[#3c4f41] dark:text-[#b6c6b8]">{label}</span><span className="font-headline-sm text-[12px] leading-[22px] font-bold tracking-[-0.02em] text-[#1b2e21] dark:text-[#e7f0e7]">{value}</span></div></div>;
}
