"use client";

import { FormEvent, useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteSession, updateSession } from "@/app/actions/history";
import { formatDuration } from "@/lib/utils";

export type HistoryItem = { id: string; startedAt: string; endedAt: string; durationSeconds: number; categoryId: string | null; categoryName: string | null };
type Category = { id: string; name: string };

function toInputValue(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function toIso(local: string) { return new Date(local).toISOString(); }

export function HistoryList({ initialItems, categories }: { initialItems: HistoryItem[]; categories: Category[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<HistoryItem | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  async function remove(id: string) {
    if (!window.confirm("Xóa phiên học này? Thao tác không thể hoàn tác.")) return;
    startTransition(async () => {
      const result = await deleteSession(id);
      if (!result.ok) return setMessage(result.message);
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Đã xóa phiên học.");
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const start = String(form.get("startedAt")); const end = String(form.get("endedAt")); const categoryId = String(form.get("categoryId") || "") || null;
    startTransition(async () => {
      const result = await updateSession(editing.id, toIso(start), toIso(end), categoryId);
      if (!result.ok) return setMessage(result.message);
      const category = categories.find((entry) => entry.id === categoryId) ?? null;
      setItems((current) => current.map((item) => item.id === editing.id ? { ...item, startedAt: toIso(start), endedAt: toIso(end), categoryId, categoryName: category?.name ?? null } : item));
      setEditing(null); setMessage("Đã cập nhật phiên học.");
    });
  }
  return <>
    {message && <p className="feedback" role="status">{message}</p>}
    <div className="history-list">
      {items.length === 0 ? <p className="history-empty">Chưa có phiên học nào khớp với bộ lọc.</p> : items.map((item) => <article className="history-item" key={item.id}>
        <div><p className="history-item__date">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.startedAt))}</p><strong>{formatDuration(item.durationSeconds)}</strong><span>{item.categoryName ?? "Chưa phân loại"}</span></div>
        <div className="history-item__actions"><button className="small-icon" aria-label="Sửa phiên" onClick={() => { setEditing(item); setMessage(""); }}><Pencil size={16} /></button><button className="small-icon small-icon--danger" aria-label="Xóa phiên" disabled={pending} onClick={() => remove(item.id)}><Trash2 size={16} /></button></div>
      </article>)}
    </div>
    {editing && <div className="modal-backdrop" role="presentation"><form className="edit-dialog" onSubmit={submit}><button className="dialog-close" type="button" onClick={() => setEditing(null)} aria-label="Đóng"><X size={18} /></button><p className="eyebrow eyebrow--mint">CHỈNH SỬA PHIÊN</p><h2>Giữ nguyên các khoảng tạm dừng</h2><label>Bắt đầu<input name="startedAt" type="datetime-local" defaultValue={toInputValue(editing.startedAt)} required /></label><label>Kết thúc<input name="endedAt" type="datetime-local" defaultValue={toInputValue(editing.endedAt)} required /></label><label>Danh mục<select name="categoryId" defaultValue={editing.categoryId ?? ""}><option value="">Chưa phân loại</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><p className="dialog-note">Thời gian không được ở tương lai hoặc chồng với phiên học khác.</p><button className="button button--primary" disabled={pending}>{pending ? "Đang lưu…" : "Lưu thay đổi"}</button></form></div>}
  </>;
}
