"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RotateCcw, Square, TimerReset } from "lucide-react";
import { cancelSession, changeSessionCategory, finishSession, pauseSession, resumeSession, startSession } from "@/app/actions/timer";
import { initializeTimezone } from "@/app/actions/settings";
import { cn, formatDuration } from "@/lib/utils";
import type { LearningStatus } from "@/generated/prisma/client";

export type TimerSnapshot = {
  id: string;
  status: LearningStatus;
  startedAt: string;
  intervals: Array<{ startedAt: string; endedAt: string | null }>;
  category: { id: string; name: string } | null;
};

export type CategoryOption = { id: string; name: string };
type TimerConsoleProps = { session: TimerSnapshot | null; categories: CategoryOption[]; databaseUnavailable?: boolean };

function getElapsedSeconds(session: TimerSnapshot, currentTime: number) {
  return session.intervals.reduce((total, interval) => {
    const startedAt = new Date(interval.startedAt).getTime();
    const endedAt = interval.endedAt
      ? new Date(interval.endedAt).getTime()
      : session.status === "RUNNING" ? currentTime : startedAt;
    return total + Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  }, 0);
}

export function TimerConsole({ session, categories, databaseUnavailable = false }: TimerConsoleProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(session?.category?.id ?? "");

  useEffect(() => {
    if (session?.status !== "RUNNING") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [session?.status]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) void initializeTimezone(timezone);
  }, []);

  const elapsed = useMemo(() => session ? getElapsedSeconds(session, now) : 0, [now, session]);
  const longRunning = elapsed >= 8 * 60 * 60;

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.message ?? "Đã có lỗi xảy ra. Vui lòng thử lại.");
        return;
      }
      router.refresh();
    });
  }

  const disabled = isPending || databaseUnavailable;

  return (
    <section className="timer-card" aria-labelledby="timer-heading">
      <div className="timer-orbit" aria-hidden="true" />
      <div className="timer-card__topline">
        <span className={cn("status-pill", session?.status === "RUNNING" && "status-pill--live")}>
          <span className="status-pill__dot" />
          {session?.status === "RUNNING" ? "Đang học" : session?.status === "PAUSED" ? "Đang tạm dừng" : "Sẵn sàng"}
        </span>
        <span className="timer-card__hint">{session ? "Nhịp của bạn đang được ghi nhận" : "Bắt đầu khi bạn sẵn sàng"}</span>
      </div>
      <div className="timer-display">
        <p id="timer-heading" className="eyebrow">PHIÊN HỌC HIỆN TẠI</p>
        <time className="timer-value" dateTime={`PT${elapsed}S`} aria-live="polite">{formatDuration(elapsed)}</time>
        <p className="timer-copy">{session?.status === "RUNNING" ? "Tập trung vào việc đang làm. Đồng hồ sẽ lo phần còn lại." : session?.status === "PAUSED" ? "Đồng hồ đã dừng. Quay lại bất cứ khi nào bạn muốn." : "Không cần lập kế hoạch trước. Chỉ việc bắt đầu."}</p>
      </div>
      {longRunning && <p className="timer-warning" role="status">Phiên học đã quá 8 giờ. Hãy kiểm tra lại trước khi hoàn tất.</p>}
      {databaseUnavailable && <p className="timer-warning" role="status">Chưa kết nối database. Thêm Neon connection string vào `.env` để bắt đầu ghi nhận.</p>}
      {message && <p className="timer-error" role="alert">{message}</p>}
      <label className="category-picker">
        <span>Danh mục</span>
        <select
          value={selectedCategoryId}
          disabled={disabled}
          onChange={(event) => {
            const categoryId = event.target.value;
            setSelectedCategoryId(categoryId);
            if (session) run(() => changeSessionCategory(session.id, categoryId || null));
          }}
        >
          <option value="">Chưa phân loại</option>
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
      </label>
      <div className="timer-actions">
        {!session ? <button className="button button--primary button--large" disabled={disabled} onClick={() => run(() => startSession(selectedCategoryId || null))}><Play size={18} fill="currentColor" />{isPending ? "Đang bắt đầu..." : "Học ngay"}</button> : <>
          {session.status === "RUNNING" ? <button className="button button--primary" disabled={disabled} onClick={() => run(() => pauseSession(session.id))}><Pause size={18} fill="currentColor" />{isPending ? "Đang lưu..." : "Tạm dừng"}</button> : <button className="button button--primary" disabled={disabled} onClick={() => run(() => resumeSession(session.id))}><Play size={18} fill="currentColor" />{isPending ? "Đang tiếp tục..." : "Tiếp tục"}</button>}
          <button className="button button--secondary" disabled={disabled} onClick={() => run(() => finishSession(session.id))}><Square size={16} fill="currentColor" />Kết thúc</button>
          <button className="icon-button" disabled={disabled} onClick={() => { if (window.confirm("Hủy phiên học hiện tại? Thời gian chưa hoàn thành sẽ không được lưu.")) run(() => cancelSession(session.id)); }} aria-label="Hủy phiên học"><RotateCcw size={18} /></button>
        </>}
      </div>
      <div className="timer-footer"><TimerReset size={15} /><span>{session ? "Khôi phục được sau khi tải lại trang" : "Không chọn danh mục vẫn có thể bắt đầu"}</span></div>
    </section>
  );
}
