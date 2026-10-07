"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, ChevronRight, CirclePlus, Clock3, FolderCog, Leaf, LockKeyhole, Palette, Pencil, Plus, ShieldCheck, Tag, TimerReset, Trash2 } from "lucide-react";
import Link from "next/link";
import { addCategory, removeCategory, updateCategory } from "@/app/actions/categories";
import { MatchaAppHeader } from "@/components/matcha-app-header";
import { MatchaAppSidebar } from "@/components/matcha-app-sidebar";
import type { CategoryColorKey } from "@/lib/category-service";
import { formatDuration } from "@/lib/utils";

export type CategoryOverviewItem = {
  id: string;
  name: string;
  colorKey: CategoryColorKey;
  durationSeconds: number;
  sessionCount: number;
  lastCompletedAt: string | null;
};

type CategoryWorkspaceProps = {
  user: { name: string; image?: string | null };
  developmentBypass: boolean;
  initialCategories: CategoryOverviewItem[];
  initialUncategorized: { durationSeconds: number; sessionCount: number };
  initialTotalSeconds: number;
};

type Palette = { key: CategoryColorKey; dot: string; bg: string; text: string; bar: string };
const palettes: Palette[] = [
  { key: "matcha", dot: "#2c4a32", bg: "#d8e8d6", text: "#223a27", bar: "#2c4a32" },
  { key: "sage", dot: "#54735c", bg: "#dcedda", text: "#26442e", bar: "#54735c" },
  { key: "olive", dot: "#735639", bg: "#ebd9c8", text: "#5b4028", bar: "#735639" },
  { key: "leaf", dot: "#86af80", bg: "#eaf2e8", text: "#223a27", bar: "#86af80" },
  { key: "tea", dot: "#a9c3a6", bg: "#e3ece1", text: "#304536", bar: "#a9c3a6" },
];

function paletteFor(key: CategoryColorKey): Palette {
  if (key.startsWith("custom:#")) {
    const color = key.slice("custom:".length);
    return { key, dot: color, bg: `${color}26`, text: "#1b2e21", bar: color };
  }
  return palettes.find((palette) => palette.key === key) ?? palettes[0]!;
}

function lastUpdated(value: string | null) {
  if (!value) return "Chưa có phiên học";
  const elapsedDays = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (elapsedDays <= 0) return "Hôm nay";
  if (elapsedDays === 1) return "Hôm qua";
  return `${elapsedDays} ngày trước`;
}

function hoursAndMinutes(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return { hours: Math.floor(safe / 3600), minutes: Math.floor((safe % 3600) / 60) };
}

export function MatchaCategoryWorkspace({ user, developmentBypass, initialCategories, initialUncategorized, initialTotalSeconds }: CategoryWorkspaceProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [uncategorized, setUncategorized] = useState(initialUncategorized);
  const totalSeconds = initialTotalSeconds;
  const [name, setName] = useState("");
  const [colorKey, setColorKey] = useState<CategoryColorKey>("matcha");
  const [editing, setEditing] = useState<CategoryOverviewItem | null>(null);
  const [deleting, setDeleting] = useState<CategoryOverviewItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleCategories = [...categories].sort((a, b) => b.durationSeconds - a.durationSeconds || a.name.localeCompare(b.name, "vi"));
  const distributionTotal = Math.max(1, totalSeconds);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") { setEditing(null); setDeleting(null); }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addCategory(name, colorKey);
      if (!result.ok) return setMessage(result.message);
      const newItem: CategoryOverviewItem = { id: result.data.id, name: name.trim().replace(/\s+/g, " "), colorKey: result.data.colorKey, durationSeconds: 0, sessionCount: 0, lastCompletedAt: null };
      setCategories((current) => [newItem, ...current]);
      setName("");
      setColorKey("matcha");
      setMessage(`Đã tạo danh mục “${newItem.name}”.`);
    });
  }

  function rename() {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateCategory(editing.id, editing.name);
      if (!result.ok) return setMessage(result.message);
      const updatedName = editing.name.trim().replace(/\s+/g, " ");
      setCategories((current) => current.map((item) => item.id === editing.id ? { ...item, name: updatedName } : item));
      setEditing(null);
      setMessage("Đã cập nhật tên danh mục.");
    });
  }

  function destroy() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await removeCategory(deleting.id);
      if (!result.ok) return setMessage(result.message);
      setCategories((current) => current.filter((item) => item.id !== deleting.id));
      setUncategorized((current) => ({ durationSeconds: current.durationSeconds + result.data.transferredDurationSeconds, sessionCount: current.sessionCount + result.data.transferredSessionCount }));
      setDeleting(null);
      setMessage(`Đã xóa “${deleting.name}”; các phiên học được chuyển sang Chưa phân loại.`);
    });
  }

  function chooseCustomColor(value: string) {
    setColorKey(`custom:${value}` as CategoryColorKey);
  }

  return <main className="min-h-screen bg-[#f6f8f5] font-[family-name:var(--font-inter)] text-[#1b2e21] lg:pl-72">
    <MatchaAppSidebar active="categories" user={user} developmentBypass={developmentBypass} />
    <div>
      <MatchaAppHeader left={<><Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-geist)] font-bold text-[#2e5339] lg:hidden"><Leaf size={20} /> ForcusLearn</Link><div className="hidden items-center gap-2 text-xs font-medium text-[#3c4f41] lg:flex"><Leaf size={16} className="text-[#2e5339]" /><span>Không gian học tập cá nhân</span><span className="text-[#a5b0a4]">•</span><span className="font-semibold text-[#1b2e21]">Chế độ học sâu thảo mộc</span></div></>} right={<span className="rounded-full bg-[#e2eee1] px-3 py-1 text-xs font-semibold text-[#2e5339]">Danh mục học tập</span>} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
        {message && <div role="status" className="fixed bottom-8 right-6 z-50 flex max-w-md items-center gap-2 rounded-lg border border-[#d2ddd0] bg-[#2e5339] px-4 py-3 text-sm font-semibold text-white shadow-xl"><Check size={18} className="text-[#d8e8d6]" />{message}</div>}

        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-[#d8e8d6] px-2.5 py-0.5 text-[11px] font-bold text-[#2e5339]">CẤU HÌNH HỆ THỐNG</span><span className="text-[#d2ddd0]">•</span><span className="text-[11px] font-semibold text-[#54735c]">Phiên bản MVP</span></div><h1 className="font-[family-name:var(--font-geist)] text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Quản lý danh mục học tập</h1><p className="mt-2 text-sm leading-6 text-[#3c4f41]">Tổ chức và phân loại thời gian để tối ưu hiệu suất học tập cá nhân, duy trì trạng thái tập trung sâu và cân bằng các môn học.</p></div>
          <div className="flex flex-wrap gap-4"><SummaryCard icon={<FolderCog size={22} />} label="Tổng danh mục" value={`${categories.length} môn học`} /><SummaryCard icon={<Clock3 size={22} />} label="Thời lượng đã ghi" value={formatDuration(totalSeconds)} sage /></div>
        </section>

        <section className="rounded-xl border border-[#e1e8df] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#3c4f41]"><span className="flex items-center gap-2 font-semibold text-[#1b2e21]"><Palette size={17} className="text-[#2e5339]" />Tỷ trọng phân bổ thời gian học tập</span><span className="text-xs">Dữ liệu toàn thời gian</span></div><div className="mt-3 flex h-3 overflow-hidden rounded-full border border-[#e1e8df] bg-[#ebf1e8]">{visibleCategories.map((category) => { const palette = paletteFor(category.colorKey); return <span key={category.id} title={`${category.name}: ${Math.round((category.durationSeconds / distributionTotal) * 100)}%`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ backgroundColor: palette.bar, width: `${(category.durationSeconds / distributionTotal) * 100}%` }} />; })}{uncategorized.durationSeconds > 0 && <span title="Chưa phân loại" className="h-full bg-[#d2ddd0]" style={{ width: `${(uncategorized.durationSeconds / distributionTotal) * 100}%` }} />}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{visibleCategories.map((category) => { const palette = paletteFor(category.colorKey); return <span key={category.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3c4f41]"><i className="size-2.5 rounded-full" style={{ backgroundColor: palette.dot }} />{category.name}: {Math.round((category.durationSeconds / distributionTotal) * 100)}%</span>; })}{uncategorized.durationSeconds > 0 && <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3c4f41]"><i className="size-2.5 rounded-full bg-[#d2ddd0]" />Khác: {Math.round((uncategorized.durationSeconds / distributionTotal) * 100)}%</span>}</div></section>

        <section className="relative overflow-hidden rounded-xl border border-[#e1e8df] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg border border-[#d2ddd0] bg-[#d8e8d6] text-[#2e5339]"><CirclePlus size={18} /></span><div><h2 className="font-[family-name:var(--font-geist)] text-lg font-semibold">Tạo danh mục mới</h2><p className="text-[11px] font-medium text-[#54735c]">Chọn nhãn màu và đặt tên để kích hoạt việc phân loại phiên học</p></div></div><kbd className="rounded border border-[#e1e8df] bg-[#ebf1e8] px-2.5 py-1 text-[11px] font-semibold text-[#54735c]">Ctrl / ⌘ + N</kbd></div>
          <form onSubmit={create} className="mt-5 grid grid-cols-1 items-end gap-4 lg:grid-cols-12"><label className="flex flex-col gap-1.5 lg:col-span-6"><span className="flex justify-between text-xs font-semibold"><span>Tên danh mục mới</span><span className="font-normal text-[#54735c]">Tối đa 50 ký tự</span></span><span className="relative"><Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2e5339]" /><input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={50} required className="w-full rounded-lg border border-[#e1e8df] bg-[#f0f4ed] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2e5339] focus:bg-white focus:ring-2 focus:ring-[#2e5339]/15" placeholder="Ví dụ: Lập trình Python, Ôn thi JLPT N2, Data Science..." /></span></label>
            <fieldset className="flex flex-col gap-1.5 lg:col-span-4"><legend className="text-xs font-semibold">Bảng màu nhận diện (Botanical)</legend><div className="flex items-center gap-2 py-1">{palettes.map((palette) => <button key={palette.key} type="button" title={palette.key} onClick={() => setColorKey(palette.key)} className={`grid size-9 place-items-center rounded-full shadow-sm transition hover:scale-105 ${colorKey === palette.key ? "ring-2 ring-[#2e5339] ring-offset-2" : ""}`} style={{ backgroundColor: palette.dot }}>{colorKey === palette.key && <Check size={16} className="text-white" />}</button>)}<label title="Tùy chọn màu" className="relative grid size-9 cursor-pointer place-items-center rounded-full border border-dashed border-[#718575] bg-[#ebf1e8] text-[#54735c] transition hover:scale-105 hover:border-[#2e5339]"><Palette size={16} /><input type="color" className="absolute inset-0 size-full cursor-pointer opacity-0" value={colorKey.startsWith("custom:#") ? colorKey.slice("custom:".length) : "#41674b"} onChange={(event) => chooseCustomColor(event.target.value)} /></label></div></fieldset>
            <button disabled={isPending || !name.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#2e5339] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#385a3e] disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-2"><Plus size={18} />{isPending ? "Đang thêm..." : "Thêm mới"}</button>
          </form>
        </section>

        <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h2 className="font-[family-name:var(--font-geist)] text-lg font-semibold">Danh sách các môn học</h2><span className="rounded-full bg-[#d8e8d6] px-2.5 py-0.5 text-[11px] font-bold text-[#2e5339]">{categories.length} danh mục hoạt động</span></div><span className="flex items-center gap-1 text-[11px] font-semibold text-[#54735c]"><ChevronRight size={15} className="rotate-90 text-[#2e5339]" />Sắp xếp theo thời lượng học cao nhất</span></div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{visibleCategories.map((category, index) => <CategoryCard key={category.id} item={category} index={index} totalSeconds={distributionTotal} disabled={isPending} onRename={() => setEditing({ ...category })} onDelete={() => setDeleting(category)} />)}<UncategorizedCard item={uncategorized} totalSeconds={distributionTotal} />{visibleCategories.length === 0 && <div className="rounded-xl border border-dashed border-[#d2ddd0] bg-white p-8 text-center text-sm text-[#54735c] md:col-span-2 lg:col-span-3">Chưa có danh mục tự tạo. Bạn vẫn có thể học ngay với “Chưa phân loại”.</div>}</div>
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-6 shadow-sm md:flex-row md:items-center"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#d2ddd0] bg-[#d8e8d6] text-[#2e5339]"><ShieldCheck size={22} /></span><div><h3 className="text-sm font-semibold">Lưu ý an toàn về dữ liệu</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-[#3c4f41]">Khi xóa một danh mục, tất cả phiên học cũ thuộc danh mục này sẽ tự động chuyển về <strong className="text-[#1b2e21]">“Chưa phân loại”</strong>. Thời gian học tập và lịch sử rèn luyện luôn được bảo toàn.</p></div></div><span className="shrink-0 rounded-full border border-[#d2ddd0] bg-[#d8e8d6] px-3 py-1.5 text-[11px] font-bold text-[#2e5339]">Bảo vệ dữ liệu 100%</span></section>
      </div>
    </div>

    {editing && <Modal><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg border border-[#d2ddd0] bg-[#d8e8d6] text-[#2e5339]"><Pencil size={19} /></span><div><h3 className="font-[family-name:var(--font-geist)] text-lg font-semibold">Đổi tên danh mục</h3><p className="text-[11px] text-[#54735c]">Cập nhật ngay lập tức vào tất cả các phiên học</p></div></div><label className="mt-5 flex flex-col gap-1.5 text-sm font-semibold">Tên hiển thị mới<input autoFocus value={editing.name} maxLength={50} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="rounded-lg border border-[#e1e8df] bg-[#f0f4ed] px-3.5 py-2.5 font-normal outline-none focus:border-[#2e5339] focus:ring-2 focus:ring-[#2e5339]/15" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#54735c] hover:bg-[#f0f4ed]">Hủy bỏ</button><button type="button" disabled={isPending || !editing.name.trim()} onClick={rename} className="inline-flex items-center gap-1 rounded-lg bg-[#2e5339] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} />Lưu thay đổi</button></div></Modal>}
    {deleting && <Modal><span className="grid size-12 place-items-center rounded-full bg-[#ffdad6] text-[#ba1a1a]"><AlertTriangle size={23} /></span><h3 className="mt-4 font-[family-name:var(--font-geist)] text-lg font-semibold">Xác nhận xóa danh mục?</h3><p className="mt-1 text-sm leading-6 text-[#3c4f41]">Bạn sắp xóa danh mục <strong className="text-[#1b2e21]">{deleting.name}</strong>.</p><div className="mt-3 rounded-lg border border-[#e1e8df] bg-[#f0f4ed] p-3 text-sm text-[#3c4f41]"><strong className="text-[#1b2e21]">{deleting.sessionCount} phiên học</strong> sẽ được bảo toàn và chuyển sang <strong className="text-[#1b2e21]">“Chưa phân loại”</strong>.</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleting(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#54735c] hover:bg-[#f0f4ed]">Hủy bỏ</button><button type="button" disabled={isPending} onClick={destroy} className="inline-flex items-center gap-1 rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={16} />Xóa danh mục</button></div></Modal>}
  </main>;
}

function SummaryCard({ icon, label, value, sage = false }: { icon: React.ReactNode; label: string; value: string; sage?: boolean }) {
  return <div className="flex min-w-[180px] items-center gap-4 rounded-xl border border-[#e1e8df] bg-white p-4 shadow-sm transition hover:shadow-md"><span className={`grid size-11 place-items-center rounded-xl border border-[#d2ddd0] ${sage ? "bg-[#dcedda] text-[#26442e]" : "bg-[#d8e8d6] text-[#2e5339]"}`}>{icon}</span><div><p className="text-[11px] font-bold uppercase tracking-[.06em] text-[#54735c]">{label}</p><p className="mt-0.5 font-[family-name:var(--font-geist)] text-lg font-bold text-[#2e5339]">{value}</p></div></div>;
}

function CategoryCard({ item, index, totalSeconds, disabled, onRename, onDelete }: { item: CategoryOverviewItem; index: number; totalSeconds: number; disabled: boolean; onRename: () => void; onDelete: () => void }) {
  const palette = paletteFor(item.colorKey); const time = hoursAndMinutes(item.durationSeconds); const percent = Math.round((item.durationSeconds / totalSeconds) * 100);
  return <article className="flex min-h-72 flex-col justify-between gap-5 overflow-hidden rounded-xl border border-[#e1e8df] bg-white p-6 shadow-sm transition hover:shadow-md"><div className="space-y-4"><div className="flex items-start justify-between gap-3"><span className="inline-flex max-w-[75%] items-center gap-1.5 truncate rounded-md px-3 py-1 text-xs font-bold" style={{ backgroundColor: palette.bg, color: palette.text }}><i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: palette.dot }} /><span className="truncate">{item.name}</span></span><span className="rounded border border-[#e1e8df] bg-[#e6ece2] px-2 py-0.5 text-[11px] font-semibold text-[#54735c]">#{String(index + 1).padStart(2, "0")}</span></div><div><p className="text-[11px] font-bold uppercase tracking-[.08em] text-[#54735c]">Tổng thời lượng tích lũy</p><div className="mt-1 flex items-baseline gap-1"><strong className="font-[family-name:var(--font-geist)] text-3xl tracking-[-.05em]">{time.hours}</strong><span className="text-sm text-[#54735c]">giờ</span><strong className="ml-1 font-[family-name:var(--font-geist)] text-3xl tracking-[-.05em]">{String(time.minutes).padStart(2, "0")}</strong><span className="text-sm text-[#54735c]">phút</span></div></div><p className="flex items-center gap-2 text-sm text-[#54735c]"><TimerReset size={16} style={{ color: palette.dot }} />Đã hoàn thành <strong className="text-[#1b2e21]">{item.sessionCount} phiên học</strong></p><div className="h-1.5 overflow-hidden rounded-full bg-[#ebf1e8]"><div className="h-full rounded-full transition-all" style={{ backgroundColor: palette.bar, width: `${percent}%` }} /></div></div><footer className="-mx-6 -mb-6 flex items-center justify-between border-t border-[#e1e8df] bg-[#f0f4ed] px-6 py-2.5"><span className="text-[11px] font-medium text-[#54735c]">{lastUpdated(item.lastCompletedAt)}</span><span className="flex gap-1"><button disabled={disabled} type="button" onClick={onRename} className="rounded-md p-1.5 text-[#54735c] transition hover:bg-[#e1e8df] hover:text-[#1b2e21] disabled:opacity-50" aria-label={`Đổi tên ${item.name}`}><Pencil size={17} /></button><button disabled={disabled} type="button" onClick={onDelete} className="rounded-md p-1.5 text-[#54735c] transition hover:bg-[#ffdad6] hover:text-[#ba1a1a] disabled:opacity-50" aria-label={`Xóa ${item.name}`}><Trash2 size={17} /></button></span></footer></article>;
}

function UncategorizedCard({ item, totalSeconds }: { item: { durationSeconds: number; sessionCount: number }; totalSeconds: number }) {
  const time = hoursAndMinutes(item.durationSeconds); const percent = Math.round((item.durationSeconds / totalSeconds) * 100);
  return <article className="flex min-h-72 flex-col justify-between gap-5 overflow-hidden rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-6 opacity-95"><div className="space-y-4"><div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-md border border-[#e1e8df] bg-[#ebf1e8] px-3 py-1 text-xs font-bold text-[#3c4f41]"><i className="size-2 rounded-full bg-[#718575]" />Chưa phân loại</span><span className="inline-flex items-center gap-1 rounded border border-[#e1e8df] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#54735c]"><LockKeyhole size={11} className="text-[#2e5339]" />Mặc định</span></div><div><p className="text-[11px] font-bold uppercase tracking-[.08em] text-[#54735c]">Tổng thời lượng tích lũy</p><div className="mt-1 flex items-baseline gap-1"><strong className="font-[family-name:var(--font-geist)] text-3xl tracking-[-.05em]">{time.hours}</strong><span className="text-sm text-[#54735c]">giờ</span><strong className="ml-1 font-[family-name:var(--font-geist)] text-3xl tracking-[-.05em]">{String(time.minutes).padStart(2, "0")}</strong><span className="text-sm text-[#54735c]">phút</span></div></div><p className="flex items-center gap-2 text-sm text-[#54735c]"><TimerReset size={16} className="text-[#718575]" />Bao gồm <strong className="text-[#1b2e21]">{item.sessionCount} phiên học</strong> tự do</p><div className="h-1.5 overflow-hidden rounded-full bg-[#e1e8df]"><div className="h-full rounded-full bg-[#718575]" style={{ width: `${percent}%` }} /></div></div><footer className="-mx-6 -mb-6 flex items-center justify-between border-t border-[#e1e8df] bg-[#e1e8df]/60 px-6 py-2.5"><span className="text-[11px] italic text-[#54735c]">Không thể đổi tên hoặc xóa</span><ShieldCheck size={17} className="text-[#718575]" /></footer></article>;
}

function Modal({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#e1e8df] bg-white p-6 shadow-2xl">{children}</div></div>;
}
