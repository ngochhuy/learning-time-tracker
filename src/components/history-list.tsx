"use client";

import { FormEvent, useState, useTransition } from "react";
import { CalendarClock, Check, Pencil, Trash2, X } from "lucide-react";
import { deleteSession, updateSession } from "@/app/actions/history";
import { formatDuration } from "@/lib/utils";

export type HistoryItem = { id: string; startedAt: string; endedAt: string; durationSeconds: number; categoryId: string | null; categoryName: string | null };
type Category = { id: string; name: string };

function toInputValue(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(local: string) {
  return new Date(local).toISOString();
}

function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const controlClass = "min-h-11 rounded-lg border border-[#d2ddd0] bg-[#f6f8f5] px-3 text-sm text-[#1b2e21] outline-none transition focus:border-[#54735c] focus:ring-2 focus:ring-[#54735c]/20 dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#e7f0e7]";

export function HistoryList({ initialItems, categories }: { initialItems: HistoryItem[]; categories: Category[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<HistoryItem | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function remove(id: string) {
    if (!window.confirm("Xóa phiên học này? Thao tác không thể hoàn tác.")) return;
    startTransition(async () => {
      const result = await deleteSession(id);
      if (!result.ok) return setMessage({ type: "error", text: result.message });
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage({ type: "success", text: "Đã xóa phiên học." });
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const startedAt = String(form.get("startedAt"));
    const endedAt = String(form.get("endedAt"));
    const categoryId = String(form.get("categoryId") || "") || null;
    startTransition(async () => {
      const startIso = toIso(startedAt);
      const endIso = toIso(endedAt);
      let result = await updateSession(editing.id, startIso, endIso, categoryId);
      if (!result.ok && result.code === "SESSION_DURATION_CONFIRMATION_REQUIRED") {
        if (!window.confirm(result.message)) return;
        result = await updateSession(editing.id, startIso, endIso, categoryId, undefined, true);
      }
      if (!result.ok) return setMessage({ type: "error", text: result.message });
      const category = categories.find((entry) => entry.id === categoryId) ?? null;
      setItems((current) => current.map((item) => item.id === editing.id ? {
        ...item,
        startedAt: result.data.startedAt,
        endedAt: result.data.endedAt,
        durationSeconds: result.data.durationSeconds,
        categoryId,
        categoryName: category?.name ?? null,
      } : item));
      setEditing(null);
      setMessage({ type: "success", text: "Đã cập nhật phiên học và thời lượng." });
    });
  }

  return <>
    {message && <p role="status" aria-live="polite" className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${message.type === "error" ? "border-[#f0ccc7] bg-[#fff2ef] text-[#a43e35] dark:border-[#65423d] dark:bg-[#30201e] dark:text-[#f0b9b1]" : "border-[#d2ddd0] bg-[#eaf2e8] text-[#2e5339] dark:border-[#3d503f] dark:bg-[#1b2a1e] dark:text-[#c8dec7]"}`}>
      {message.type === "success" ? <Check size={16} /> : <X size={16} />}{message.text}
    </p>}

    <div className="space-y-3">
      {items.length === 0 ? <div className="rounded-xl border border-dashed border-[#d2ddd0] bg-[#f6f8f5] px-5 py-10 text-center dark:border-[#3d503f] dark:bg-[#162019]">
        <CalendarClock className="mx-auto size-8 text-[#86a18a]" />
        <p className="mt-3 text-sm font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Chưa có phiên học nào khớp với bộ lọc.</p>
        <p className="mt-1 text-xs text-[#718575] dark:text-[#a6b9a7]">Thử đổi khoảng ngày hoặc danh mục đã chọn.</p>
      </div> : items.map((item) => <article key={item.id} className="group flex flex-col justify-between gap-4 rounded-xl border border-[#e1e8df] bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c3d3c1] hover:shadow-md sm:flex-row sm:items-center sm:px-5 dark:border-[#3d503f] dark:bg-[#1b251d] dark:hover:border-[#54735c]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1b2e21] transition-colors group-hover:text-[#2e5339] dark:text-[#e7f0e7] dark:group-hover:text-[#c8dec7]">{formatTimestamp(item.startedAt)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#54735c] dark:text-[#b6c6b8]">
            <span>{item.categoryName ?? "Chưa phân loại"}</span>
            <span aria-hidden className="text-[#c1cec0]">•</span>
            <span>Kết thúc {new Intl.DateTimeFormat("vi-VN", { timeStyle: "short" }).format(new Date(item.endedAt))}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <strong className="whitespace-nowrap font-[family-name:var(--font-geist)] text-lg font-bold tracking-[-.03em] text-[#2e5339] dark:text-[#c8dec7]">{formatDuration(item.durationSeconds)}</strong>
          <div className="flex gap-1.5">
            <button type="button" disabled={pending} className="grid size-10 place-items-center rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] text-[#3c4f41] transition-all duration-200 hover:scale-110 hover:border-[#54735c]/50 hover:bg-[#e6ece2] hover:text-[#2e5339] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#54735c] disabled:opacity-50 dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#d7e4d6] dark:hover:bg-[#263329]" aria-label={`Sửa phiên học ${formatTimestamp(item.startedAt)}`} onClick={() => { setEditing(item); setMessage(null); }}><Pencil size={16} /></button>
            <button type="button" disabled={pending} className="grid size-10 place-items-center rounded-lg border border-[#ead5d0] bg-[#fff8f6] text-[#9a4038] transition-all duration-200 hover:scale-110 hover:border-[#ba1a1a]/50 hover:bg-[#ffdad6] hover:text-[#ba1a1a] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a4038] disabled:opacity-50 dark:border-[#65423d] dark:bg-[#30201e] dark:text-[#f0b9b1] dark:hover:bg-[#4a2220]" aria-label={`Xóa phiên học ${formatTimestamp(item.startedAt)}`} onClick={() => remove(item.id)}><Trash2 size={16} /></button>
          </div>
        </div>
      </article>)}
    </div>

    {editing && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#17251a]/35 p-4 backdrop-blur-sm dark:bg-black/60" role="presentation">
      <form className="relative my-auto grid w-full max-w-lg gap-4 rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-2xl sm:p-7 dark:border-[#3d503f] dark:bg-[#1b251d]" role="dialog" aria-modal="true" aria-labelledby="history-edit-title" onSubmit={submit}>
        <button className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-[#54735c] transition-all duration-200 hover:scale-110 hover:bg-[#f0f4ed] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#54735c] dark:text-[#b6c6b8] dark:hover:bg-[#263329]" type="button" onClick={() => setEditing(null)} aria-label="Đóng"><X size={18} /></button>
        <div className="pr-10"><p className="text-[11px] font-bold tracking-[.14em] text-[#54735c] dark:text-[#b6c6b8]">CHỈNH SỬA PHIÊN</p><h2 id="history-edit-title" className="mt-1 font-[family-name:var(--font-geist)] text-xl font-bold tracking-[-.03em] text-[#1b2e21] dark:text-[#e7f0e7]">Giữ nguyên các khoảng tạm dừng</h2></div>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Bắt đầu<input autoFocus name="startedAt" type="datetime-local" defaultValue={toInputValue(editing.startedAt)} required className={controlClass} /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Kết thúc<input name="endedAt" type="datetime-local" defaultValue={toInputValue(editing.endedAt)} required className={controlClass} /></label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#3c4f41] dark:text-[#d7e4d6]">Danh mục<select name="categoryId" defaultValue={editing.categoryId ?? ""} className={controlClass}><option value="">Chưa phân loại</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <p className="rounded-lg bg-[#f0f4ed] px-3 py-2 text-xs leading-5 text-[#54735c] dark:bg-[#162019] dark:text-[#b6c6b8]">Thời gian không được ở tương lai hoặc chồng lên phiên học khác. Các khoảng tạm dừng ở giữa sẽ được bảo toàn.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="min-h-10 rounded-lg border border-[#d2ddd0] px-4 text-sm font-semibold text-[#3c4f41] transition-all duration-200 hover:bg-[#f0f4ed] hover:text-[#1b2e21] active:scale-95 dark:border-[#3d503f] dark:text-[#d7e4d6] dark:hover:bg-[#263329]">Hủy</button><button className="min-h-10 rounded-lg bg-[#2e5339] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#385a3e] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:cursor-wait disabled:opacity-60" disabled={pending}>{pending ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
      </form>
    </div>}
  </>;
}
