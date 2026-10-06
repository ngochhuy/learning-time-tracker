"use client";

import { FormEvent, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { addCategory, removeCategory, updateCategory } from "@/app/actions/categories";

export type CategoryItem = { id: string; name: string };

export function CategoryManager({ initialCategories }: { initialCategories: CategoryItem[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addCategory(name);
      if (!result.ok) return setMessage(result.message);
      setCategories((current) => [...current, { id: result.data.id, name: name.trim().replace(/\s+/g, " ") }].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      setName("");
      setMessage(null);
    });
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateCategory(editing.id, editing.name);
      if (!result.ok) return setMessage(result.message);
      setCategories((current) => current.map((category) => category.id === editing.id ? { ...category, name: editing.name.trim().replace(/\s+/g, " ") } : category).sort((a, b) => a.name.localeCompare(b.name, "vi")));
      setEditing(null);
      setMessage(null);
    });
  }

  function remove(category: CategoryItem) {
    if (!window.confirm(`Xóa danh mục “${category.name}”? Các phiên cũ sẽ thành Chưa phân loại.`)) return;
    startTransition(async () => {
      const result = await removeCategory(category.id);
      if (!result.ok) return setMessage(result.message);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setMessage(null);
    });
  }

  return <section className="category-panel" aria-labelledby="category-title">
    <div className="category-panel__heading"><div><p className="eyebrow eyebrow--mint">PHÂN LOẠI SAU, KHI CẦN</p><h1 id="category-title">Danh mục học</h1><p>Tạo một vài nhóm quen thuộc. Bạn luôn có thể bắt đầu mà chưa cần chọn nhóm nào.</p></div><span>{categories.length} danh mục</span></div>
    <form className="category-add" onSubmit={create}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Tiếng Anh" maxLength={50} aria-label="Tên danh mục mới" /><button className="button button--primary" disabled={isPending || !name.trim()}><Plus size={17} />Thêm danh mục</button></form>
    {message && <p className="timer-error" role="alert">{message}</p>}
    <ul className="category-list">
      {categories.map((category) => <li key={category.id}>
        {editing?.id === category.id ? <><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={50} aria-label={`Đổi tên ${category.name}`} /><div className="category-actions"><button className="small-icon" onClick={save} disabled={isPending} aria-label="Lưu"><Check size={17} /></button><button className="small-icon" onClick={() => setEditing(null)} disabled={isPending} aria-label="Hủy"><X size={17} /></button></div></> : <><span>{category.name}</span><div className="category-actions"><button className="small-icon" onClick={() => setEditing({ id: category.id, name: category.name })} disabled={isPending} aria-label={`Đổi tên ${category.name}`}><Pencil size={16} /></button><button className="small-icon small-icon--danger" onClick={() => remove(category)} disabled={isPending} aria-label={`Xóa ${category.name}`}><Trash2 size={16} /></button></div></>}
      </li>)}
      {categories.length === 0 && <li className="category-empty">Chưa có danh mục nào. Bạn vẫn có thể học ngay với “Chưa phân loại”.</li>}
    </ul>
  </section>;
}
