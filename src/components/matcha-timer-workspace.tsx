"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CirclePause, Coffee, Edit3, PictureInPicture2, Play, TimerReset, Trash2, X } from "lucide-react";
import { useAppShell } from "@/components/matcha-app-shell";
import { cancelSession, changeSessionCategory, finishSession, pauseSession, resumeSession, saveSessionNote, startSession } from "@/app/actions/timer";
import { formatDuration } from "@/lib/utils";
import type { ActionResult } from "@/lib/errors";
import { previewPauseSession, previewResumeSession, previewStartSession, type TimerSession } from "@/lib/timer-payload";
import { MAX_SESSION_NOTE_LENGTH } from "@/lib/session-note";
import { getCategoryPalette, type CategoryColorKey } from "@/lib/category-colors";

type Category = { id: string; name: string; colorKey: CategoryColorKey };
type TimerActionKind = "start" | "pause" | "resume" | "finish" | "cancel" | "category";
type Props = {
  session: TimerSession | null;
  categories: Category[];
  timezone: string;
  dailyGoalMinutes: number;
  completedTodaySeconds: number;
  hasPomodoroSession?: boolean;
  databaseUnavailable?: boolean;
};

type DocumentPictureInPictureApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi;
  }
}

const subscribeToPictureInPictureAvailability = () => () => undefined;
const noteDraftKey = (sessionId: string) => `focuslearn-session-note:${sessionId}`;

function getElapsedSeconds(session: TimerSession, now: number) {
  return session.intervals.reduce((total, interval) => {
    const started = new Date(interval.startedAt).getTime();
    const end = interval.endedAt ? new Date(interval.endedAt).getTime() : session.status === "RUNNING" ? now : started;
    return total + Math.max(0, Math.floor((end - started) / 1000));
  }, 0);
}

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60].map((part) => String(part).padStart(2, "0"));
}

export function MatchaTimerWorkspace({ session: serverSession, hasPomodoroSession = false, categories, timezone, dailyGoalMinutes, completedTodaySeconds, databaseUnavailable = false }: Props) {
  const { zen, setZen, setTimezone } = useAppShell();
  const [session, setSession] = useState(serverSession);
  const [frozenPauseSeconds, setFrozenPauseSeconds] = useState<number | null>(null);
  const [previousServerSession, setPreviousServerSession] = useState(serverSession);
  const [now, setNow] = useState(() => Date.now());
  const [selectedCategoryId, setSelectedCategoryId] = useState(serverSession?.category?.id ?? "");
  if (serverSession !== previousServerSession) {
    setPreviousServerSession(serverSession);
    setSession(serverSession);
    if (serverSession) setSelectedCategoryId(serverSession.category?.id ?? "");
  }
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(true);
  const [noteDraft, setNoteDraft] = useState(serverSession?.note ?? "");
  const noteRef = useRef(serverSession?.note ?? "");
  const savedNoteRef = useRef(serverSession?.note ?? "");
  const [noteSessionId, setNoteSessionId] = useState(serverSession?.id ?? null);
  const [noteSaveState, setNoteSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteSaveRevision, setNoteSaveRevision] = useState(0);
  if ((serverSession?.id ?? null) !== noteSessionId) {
    setNoteSessionId(serverSession?.id ?? null);
    if (serverSession) {
      noteRef.current = serverSession.note ?? "";
      savedNoteRef.current = serverSession.note ?? "";
      setNoteDraft(serverSession.note ?? "");
      setNoteSaveState("saved");
    }
  }
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TimerActionKind | null>(null);
  const pipSupported = useSyncExternalStore(
    subscribeToPictureInPictureAvailability,
    () => Boolean(window.documentPictureInPicture),
    () => false,
  );
  const [pipOpen, setPipOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const mutationInFlightRef = useRef(false);
  const queuedPauseRef = useRef<{ clickedAt: string; displayedSeconds: number } | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const toggleRunRef = useRef<() => void>(() => undefined);
  const finishSessionRef = useRef<() => void>(() => undefined);

  // The shell mirrors this server-provided setting when the Timer segment mounts or refreshes.
  useEffect(() => setTimezone(timezone), [setTimezone, timezone]);

  const persistedSessionId = serverSession?.id;
  const persistedNote = serverSession?.note;
  useEffect(() => {
    if (!persistedSessionId) return;
    const draft = window.sessionStorage.getItem(noteDraftKey(persistedSessionId));
    if (draft === null || draft === (persistedNote ?? "")) return;
    noteRef.current = draft.slice(0, MAX_SESSION_NOTE_LENGTH);
    setNoteDraft(noteRef.current);
  }, [persistedSessionId, persistedNote]);

  const activeNoteSessionId = session?.id;
  const activeNoteSessionIdRef = useRef(activeNoteSessionId);
  activeNoteSessionIdRef.current = activeNoteSessionId;
  useEffect(() => {
    if (!activeNoteSessionId || activeNoteSessionId === "pending-start" || noteDraft.trim() === savedNoteRef.current) return;
    const sessionId = activeNoteSessionId;
    const nextNote = noteDraft;
    const timeout = window.setTimeout(async () => {
      setNoteSaveState("saving");
      try {
        const result = await saveSessionNote(sessionId, nextNote);
        if (activeNoteSessionIdRef.current !== sessionId) return;
        if (!result.ok) {
          if (noteRef.current === nextNote) setNoteSaveState("error");
          return;
        }
        savedNoteRef.current = result.data.note ?? "";
        if (noteRef.current.trim() === savedNoteRef.current) {
          window.sessionStorage.removeItem(noteDraftKey(sessionId));
          setNoteSaveState("saved");
        } else {
          window.sessionStorage.setItem(noteDraftKey(sessionId), noteRef.current);
          setNoteSaveState("idle");
          setNoteSaveRevision((revision) => revision + 1);
        }
      } catch {
        if (activeNoteSessionIdRef.current === sessionId && noteRef.current === nextNote) setNoteSaveState("error");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [activeNoteSessionId, noteDraft, noteSaveRevision]);

  useEffect(() => {
    if (session?.status !== "RUNNING") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [session?.status]);

  useEffect(() => () => pipWindowRef.current?.close(), []);

  useEffect(() => {
    function syncPictureInPictureTheme() {
      pipWindowRef.current?.document.documentElement.classList.toggle("dark", document.documentElement.classList.contains("dark"));
    }
    window.addEventListener("focuslearn-theme-change", syncPictureInPictureTheme);
    return () => window.removeEventListener("focuslearn-theme-change", syncPictureInPictureTheme);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button")) return;
      if (event.code === "Space") { event.preventDefault(); toggleRun(); }
      if (event.ctrlKey && event.key === "Enter" && session) { event.preventDefault(); finishCurrentSession(); }
      if (event.key === "Escape" && session) { event.preventDefault(); cancelCurrentSession(); }
      if (event.key.toLowerCase() === "z") setZen((value) => !value);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const elapsed = frozenPauseSeconds ?? (session ? getElapsedSeconds(session, now) : 0);
  const [hours, minutes, seconds] = clock(elapsed);
  const isRunning = session?.status === "RUNNING";
  const isPaused = session?.status === "PAUSED";
  const longRunning = elapsed >= 8 * 60 * 60;
  const goalSeconds = dailyGoalMinutes * 60;
  const goalProgress = Math.min(1, (completedTodaySeconds + elapsed) / goalSeconds);
  const goalPercent = Math.round(goalProgress * 100);
  const circumference = 791.68;
  const strokeOffset = circumference * (1 - goalProgress);
  const disabled = pending || mutationInFlightRef.current || databaseUnavailable || hasPomodoroSession;
  const canQueuePause = pendingAction === "start" && session?.id === "pending-start" && session.status === "RUNNING" && !queuedPauseRef.current;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const categoryName = selectedCategory?.name ?? "Chưa phân loại";
  const categoryPalette = getCategoryPalette(selectedCategory?.colorKey);
  const statusText = hasPomodoroSession ? "Pomodoro đang hoạt động · quay lại Pomodoro" : pendingAction === "finish" ? "Đang lưu phiên học…" : pendingAction === "cancel" ? "Đang hủy phiên học…" : isRunning ? "Đang trong phiên học sâu" : isPaused ? "Phiên học đang tạm dừng" : "Sẵn sàng kích hoạt chu kỳ mới";

  function runAction<T>(
    kind: TimerActionKind,
    action: () => Promise<ActionResult<T>>,
    optimistic: () => void,
    commit: (data: T) => void,
    rollback: () => void,
  ) {
    if (mutationInFlightRef.current || databaseUnavailable) return;
    mutationInFlightRef.current = true;
    setMessage(null);
    setPendingAction(kind);
    optimistic();
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) commit(result.data);
        else {
          rollback();
          setMessage(result.message);
        }
      } catch {
        rollback();
        setMessage("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
      } finally {
        mutationInFlightRef.current = false;
        setPendingAction(null);
      }
    });
  }

  function runSessionAction(kind: TimerActionKind, action: () => Promise<ActionResult<TimerSession>>, optimisticSession: TimerSession) {
    const previous = session;
    runAction(kind, action, () => setSession(optimisticSession), setSession, () => setSession(previous));
  }

  function toggleRun() {
    if (canQueuePause && session) {
      const clickedAt = new Date().toISOString();
      queuedPauseRef.current = { clickedAt, displayedSeconds: elapsed };
      setFrozenPauseSeconds(elapsed);
      setSession(previewPauseSession(session, clickedAt));
      return;
    }
    if (disabled) return;
    const clickedAt = new Date().toISOString();
    if (!session) {
      setNow(Date.now());
      const category = categories.find((item) => item.id === selectedCategoryId) ?? null;
      const startingNote = noteRef.current;
      runAction(
        "start",
        () => startSession(selectedCategoryId || null, clickedAt, startingNote),
        () => setSession(previewStartSession(category, clickedAt, startingNote)),
        (saved) => {
          savedNoteRef.current = saved.note ?? "";
          if (noteRef.current.trim() !== savedNoteRef.current) {
            window.sessionStorage.setItem(noteDraftKey(saved.id), noteRef.current);
          }
          setNoteSaveState(noteRef.current.trim() === savedNoteRef.current ? "saved" : "idle");
          const queuedPause = queuedPauseRef.current;
          if (!queuedPause) { setSession(saved); return; }
          queuedPauseRef.current = null;
          const pausedPreview = previewPauseSession(saved, queuedPause.clickedAt);
          setSession(pausedPreview);
          queueMicrotask(() => runAction(
            "pause",
            () => pauseSession(saved.id, queuedPause.clickedAt),
            () => { setFrozenPauseSeconds(queuedPause.displayedSeconds); setSession(pausedPreview); },
            (confirmed) => { setSession(confirmed); setFrozenPauseSeconds(null); },
            () => { setSession(saved); setFrozenPauseSeconds(null); },
          ));
        },
        () => { queuedPauseRef.current = null; setFrozenPauseSeconds(null); setSession(null); },
      );
    } else if (session.status === "RUNNING") {
      const previous = session;
      const displayedSeconds = elapsed;
      runAction(
        "pause",
        () => pauseSession(session.id, clickedAt),
        () => { setFrozenPauseSeconds(displayedSeconds); setSession(previewPauseSession(session, clickedAt)); },
        (saved) => { setSession(saved); setFrozenPauseSeconds(null); },
        () => { setSession(previous); setFrozenPauseSeconds(null); },
      );
    } else {
      setNow(Date.now());
      runSessionAction("resume", () => resumeSession(session.id), previewResumeSession(session, clickedAt));
    }
  }
  function selectCategory(categoryId: string) {
    if (disabled) return;
    setCategoryOpen(false);
    if (categoryId === selectedCategoryId) return;
    if (!session) {
      setSelectedCategoryId(categoryId);
      return;
    }
    const previousCategoryId = selectedCategoryId;
    const previousSession = session;
    const category = categories.find((item) => item.id === categoryId) ?? null;
    runAction(
      "category",
      () => changeSessionCategory(session.id, categoryId || null),
      () => { setSelectedCategoryId(categoryId); setSession({ ...session, category }); },
      (saved) => { setSelectedCategoryId(saved.category?.id ?? ""); setSession(saved); },
      () => { setSelectedCategoryId(previousCategoryId); setSession(previousSession); },
    );
  }
  function finishCurrentSession() {
    if (!session || disabled) return;
    const previous = session;
    const finishingNote = noteRef.current;
    runAction("finish", () => finishSession(session.id, finishingNote), () => setSession(null), () => {
      setSession(null); noteRef.current = ""; savedNoteRef.current = ""; setNoteDraft(""); setNoteSaveState("idle");
      window.sessionStorage.removeItem(noteDraftKey(previous.id));
    }, () => setSession(previous));
  }
  function cancelCurrentSession() {
    if (!session || disabled || !window.confirm("Hủy phiên học hiện tại? Thời gian chưa hoàn thành sẽ không được lưu.")) return;
    const previous = session;
    runAction("cancel", () => cancelSession(session.id), () => setSession(null), () => {
      setSession(null); noteRef.current = ""; savedNoteRef.current = ""; setNoteDraft(""); setNoteSaveState("idle");
      window.sessionStorage.removeItem(noteDraftKey(previous.id));
    }, () => setSession(previous));
  }

  toggleRunRef.current = toggleRun;
  finishSessionRef.current = finishCurrentSession;

  const updatePictureInPicture = useCallback(() => {
    const pipDocument = pipWindowRef.current?.document;
    if (!pipDocument) return;
    const timer = pipDocument.getElementById("focuslearn-pip-timer");
    const category = pipDocument.getElementById("focuslearn-pip-category");
    const status = pipDocument.getElementById("focuslearn-pip-status");
    const primary = pipDocument.getElementById("focuslearn-pip-primary") as HTMLButtonElement | null;
    const finish = pipDocument.getElementById("focuslearn-pip-finish") as HTMLButtonElement | null;
    if (timer) timer.textContent = `${hours}:${minutes}:${seconds}`;
    if (category) category.textContent = categoryName;
    if (status) status.textContent = statusText;
    if (primary) { primary.textContent = !session ? "Bắt đầu học" : isRunning ? "Tạm dừng" : "Tiếp tục học"; primary.disabled = disabled && !canQueuePause; }
    if (finish) { finish.disabled = !session || disabled; }
  }, [canQueuePause, categoryName, disabled, hours, isRunning, minutes, seconds, session, statusText]);

  useEffect(() => {
    updatePictureInPicture();
  }, [updatePictureInPicture]);

  async function openPictureInPicture() {
    const pictureInPicture = window.documentPictureInPicture;
    if (!pictureInPicture) {
      setMessage("Trình duyệt này chưa hỗ trợ Cửa sổ nổi. Hãy dùng Chrome hoặc Edge trên máy tính.");
      return;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.focus();
      return;
    }
    try {
      const pipWindow = await pictureInPicture.requestWindow({ width: 390, height: 270 });
      pipWindowRef.current = pipWindow;
      pipWindow.document.title = "ForcusLearn Timer";
      pipWindow.document.documentElement.classList.toggle("dark", document.documentElement.classList.contains("dark"));
      pipWindow.document.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><style>:root{color-scheme:light}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#f6f8f5;color:#1b2e21;font-family:Inter,Arial,sans-serif}*{box-sizing:border-box}body{padding:clamp(8px,4vw,16px)}.card{width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;border:1px solid #d2ddd0;border-radius:clamp(14px,6vw,20px);background:#fff;padding:clamp(10px,5vw,18px);box-shadow:0 12px 30px rgba(27,46,33,.12);display:flex;flex-direction:column;justify-content:space-between;gap:clamp(10px,4vh,18px)}.top{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:8px;color:#54735c;font-size:clamp(10px,3.2vw,12px);font-weight:700}.category{min-width:0;max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:#f0f4ed;padding:clamp(5px,2.4vw,7px) clamp(7px,3vw,10px)}.live{display:flex;min-width:0;flex:1;justify-content:flex-end;gap:clamp(4px,2vw,6px);align-items:center;white-space:nowrap}.dot{width:clamp(7px,2.4vw,8px);height:clamp(7px,2.4vw,8px);flex:0 0 auto;border-radius:50%;background:#2e5339}.timer{max-width:100%;overflow:hidden;text-align:center;font-family:Geist,Arial,sans-serif;font-size:clamp(32px,16vw,54px);font-weight:700;line-height:.92;letter-spacing:-.06em;color:#2e5339;font-variant-numeric:tabular-nums}.status{margin:clamp(10px,4vh,16px) 0 0;text-align:center;color:#54735c;font-size:clamp(10px,3.2vw,12px);font-weight:600;line-height:1.25}.actions{display:flex;min-width:0;gap:clamp(6px,3vw,8px)}.primary,.secondary{min-width:0;flex:1;border-radius:10px;padding:clamp(9px,3.2vw,11px) clamp(6px,2.4vw,11px);border:1px solid #d2ddd0;font-size:clamp(11px,3.8vw,14px);font-weight:700;line-height:1.15;white-space:nowrap;cursor:pointer}.primary{background:#2e5339;color:#fff;border-color:#2e5339}.secondary{background:#f0f4ed;color:#1b2e21}.primary:disabled,.secondary:disabled{opacity:.45;cursor:not-allowed}@media (max-width:220px){.top{font-size:9px}.live{letter-spacing:-.04em}.actions{gap:5px}.primary,.secondary{font-size:10px;padding:8px 4px}}</style>`;
      pipWindow.document.head.insertAdjacentHTML("beforeend", `<style>html.dark{color-scheme:dark}html.dark,html.dark body{background:#101712;color:#e7f0e7}html.dark .card{background:#1b251d;border-color:#3d503f;box-shadow:0 12px 30px rgba(0,0,0,.32)}html.dark .top,html.dark .status{color:#b6c6b8}html.dark .category,html.dark .secondary{background:#1a241c;border-color:#3d503f;color:#e7f0e7}html.dark .timer{color:#bee1c3}html.dark .dot,html.dark .primary{background:#3f714a;border-color:#3f714a}</style>`);
      pipWindow.document.body.innerHTML = `<main class="card"><div class="top"><span class="category" id="focuslearn-pip-category"></span><span class="live"><i class="dot"></i>FORCUSLEARN</span></div><div><div class="timer" id="focuslearn-pip-timer"></div><p class="status" id="focuslearn-pip-status"></p></div><div class="actions"><button class="primary" id="focuslearn-pip-primary"></button><button class="secondary" id="focuslearn-pip-finish">Kết thúc</button></div></main>`;
      pipWindow.document.getElementById("focuslearn-pip-primary")?.addEventListener("click", () => toggleRunRef.current());
      pipWindow.document.getElementById("focuslearn-pip-finish")?.addEventListener("click", () => finishSessionRef.current());
      pipWindow.addEventListener("pagehide", () => { pipWindowRef.current = null; setPipOpen(false); }, { once: true });
      setPipOpen(true);
      updatePictureInPicture();
    } catch {
      setMessage("Không thể mở Cửa sổ nổi. Hãy cho phép cửa sổ này trong trình duyệt rồi thử lại.");
    }
  }

  return <main className="min-h-dvh bg-[#f6f8f5] font-[family-name:var(--font-inter)] text-[#1b2e21]">
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {zen && <button type="button" className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#e1e8df] bg-white px-3 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#f0f4ed] hover:text-[#2e5339] hover:shadow-sm active:scale-95" onClick={() => setZen(false)}><X size={15} />Thoát Zen</button>}

      {longRunning && showAlert && <section className="relative mb-6 overflow-hidden rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:p-5"><div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-[#d8e8d6]/70 blur-2xl" /><div className="relative flex items-start gap-3.5"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[#ebd9c8] text-[#704214]"><Coffee size={18} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-[family-name:var(--font-geist)] text-lg font-semibold tracking-[-.01em]">Nhắc nhở hồi phục năng lượng</h2><span className="rounded-full bg-[#ebd9c8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#704214]">{formatDuration(elapsed)} liên tục</span></div><p className="mt-1 max-w-3xl text-sm leading-6 text-[#3c4f41]">Bạn đã duy trì sự tập trung sâu qua 8 giờ liên tục. Hãy dành thời gian uống nước và thư giãn mắt để bảo toàn hiệu suất.</p></div></div><div className="relative mt-3 flex justify-end gap-2 sm:mt-0"><button className="rounded-lg border border-[#e1e8df] bg-white px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:border-[#d2ddd0] hover:bg-[#f0f4ed] hover:shadow-xs active:scale-95" onClick={() => setShowAlert(false)}>Đã hiểu</button>{isRunning && <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e5339] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#385a3e] hover:shadow-md active:scale-95" disabled={disabled} onClick={toggleRun}><Coffee size={15} />Nghỉ giải lao</button>}</div></section>}
      {message && <p className="mb-5 rounded-xl border border-[#f2c9c5] bg-[#fff1ef] px-4 py-3 text-sm text-[#9a3028]" role="alert">{message}</p>}
      {databaseUnavailable && <p className="mb-5 rounded-xl border border-[#ead5a6] bg-[#fff9e8] px-4 py-3 text-sm text-[#7b5d19]">Không thể kết nối database. Hãy kiểm tra cấu hình `.env` rồi thử lại.</p>}
      {hasPomodoroSession && <p className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d5dfd2] bg-[#eaf2e8] px-4 py-3 text-sm text-[#2e5339]">Bạn đang có một phiên Pomodoro hoạt động. Timer thường đã khóa để tránh ghi đè phiên.<Link href="/pomodoro" className="rounded-lg bg-[#2e5339] px-3 py-1.5 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#385a3e] hover:shadow-md active:scale-95">Quay lại Pomodoro</Link></p>}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <section className="flex flex-col gap-6 lg:col-span-8">
          <div className="relative flex min-h-[460px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#e1e8df] bg-[#ffffff] p-6 shadow-sm sm:p-10"><div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-[#d8e8d6]/55 blur-3xl" />
            <div className="relative z-10 mb-6 flex w-full items-center justify-between gap-3"><div className="relative"><button type="button" aria-expanded={categoryOpen} className="inline-flex items-center gap-2 rounded-full border border-[#e1e8df] bg-[#f0f4ed] px-3 py-1.5 text-sm font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#e6ece2] hover:shadow active:scale-95" onClick={() => setCategoryOpen((open) => !open)}><span className="size-2.5 rounded-full" style={{ backgroundColor: categoryPalette.dot }} />{categoryName}<ChevronDown size={16} className="text-[#3c4f41]" /></button>{categoryOpen && <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-[#e1e8df] bg-[#ffffff] p-1.5 shadow-xl"><CategoryOption active={!selectedCategoryId} colorKey="matcha" name="Chưa phân loại" onClick={() => selectCategory("")} />{categories.map((category) => <CategoryOption active={category.id === selectedCategoryId} colorKey={category.colorKey} key={category.id} name={category.name} onClick={() => selectCategory(category.id)} />)}</div>}</div><div className="flex items-center gap-2">{pipSupported && <button type="button" aria-pressed={pipOpen} title="Mở timer trong cửa sổ nổi" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 ${pipOpen ? "bg-[#d8e8d6] text-[#2e5339] hover:bg-[#cde2cb]" : "bg-[#f0f4ed] text-[#3c4f41] hover:bg-[#e6ece2] hover:text-[#1b2e21]"}`} onClick={openPictureInPicture}><PictureInPicture2 size={15} /><span className="hidden sm:inline">Cửa sổ nổi</span></button>}<button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f4ed] px-3 py-1.5 text-xs font-medium text-[#3c4f41] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#e6ece2] hover:text-[#2e5339] hover:shadow-xs active:scale-95" onClick={() => setZen(true)}><TimerReset size={15} className="text-[#2e5339]" /><span className="hidden sm:inline">Chế độ Zen</span></button></div></div>
            <div className="relative z-10 my-6 flex items-center justify-center"><div className="relative grid size-72 place-items-center sm:size-80"><svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="126" fill="transparent" stroke="#d8e8d6" strokeWidth="4" /><circle cx="140" cy="140" r="126" fill="transparent" stroke="#2e5339" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeOffset} className="transition-[stroke-dashoffset] duration-700" /></svg><div className="relative flex max-w-[78%] flex-col items-center text-center"><div className="whitespace-nowrap font-[family-name:var(--font-geist)] text-[48px] font-semibold leading-none tracking-[-.055em] text-[#2e5339] tabular-nums sm:text-[64px]"><span>{hours}</span><span className="mx-0.5 font-normal text-[#d2ddd0]">:</span><span>{minutes}</span><span className="mx-0.5 font-normal text-[#d2ddd0]">:</span><span>{seconds}</span></div><div className="mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#d2ddd0] bg-[#e2eee1] px-3 py-1 text-xs font-medium text-[#2e5339]"><span className={`size-2 rounded-full ${isRunning ? "animate-ping bg-[#2e5339]" : "bg-[#9eaa9d]"}`} />{statusText}</div></div></div></div>
            <div className="relative z-10 mt-2 flex w-full flex-wrap justify-center gap-4">{!session ? <button className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#2e5339] px-10 py-3.5 font-[family-name:var(--font-geist)] text-lg font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#385a3e] hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" disabled={disabled} onClick={toggleRun}><Play size={22} fill="currentColor" />{pendingAction === "finish" ? "Đang kết thúc…" : pendingAction === "cancel" ? "Đang hủy…" : pendingAction === "start" ? "Đang bắt đầu…" : "Bắt đầu học"}</button> : <><button className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#2e5339] px-8 py-3 font-[family-name:var(--font-geist)] text-lg font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#385a3e] hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" disabled={disabled && !canQueuePause} onClick={toggleRun}>{isRunning ? <CirclePause size={22} /> : <Play size={22} fill="currentColor" />}{isRunning ? "Tạm dừng" : "Tiếp tục học"}</button><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e1e8df] bg-[#f0f4ed] px-7 py-3 font-[family-name:var(--font-geist)] text-lg font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#e6ece2] hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm" disabled={disabled} onClick={finishCurrentSession}><CheckCircle2 size={21} className="text-[#2e5339]" />Kết thúc phiên</button></>}</div>
          </div>

          <section className="rounded-2xl border border-[#e1e8df] bg-[#f0f4ed] p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#54735c]" /><h2 className="font-[family-name:var(--font-geist)] text-lg font-semibold">Bảng điều khiển khi Tạm Dừng</h2></div><span className="rounded-full border border-[#d5dfd2] bg-[#f6f8f5] px-2.5 py-0.5 text-[10px] font-semibold text-[#3c4f41]">Trạng thái rẽ nhánh</span></div><p className="mt-2 text-sm leading-6 text-[#3c4f41]">Khi tạm dừng, bạn có thể quay lại nhịp học, lưu phần đã làm hoặc hủy nếu bị gián đoạn ngoài ý muốn.</p><div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><button disabled={!isPaused || disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2e5339] px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#385a3e] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm" onClick={toggleRun}><Play size={17} />Tiếp tục học</button><button disabled={!session || disabled} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e1e8df] bg-[#ffffff] px-4 py-3 text-sm font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#f0f4ed] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm" onClick={finishCurrentSession}><CheckCircle2 size={17} className="text-[#2e5339]" />Lưu phiên</button><button disabled={!isPaused || disabled} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0ccc7] bg-[#fff2ef] px-4 py-3 text-sm font-medium text-[#a43e35] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#eaaba3] hover:bg-[#ffe6e2] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm" onClick={cancelCurrentSession}><Trash2 size={17} />Hủy session</button></div></section>
        </section>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <section className="flex flex-col gap-3 rounded-2xl border border-[#e1e8df] bg-[#ffffff] p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[.12em] text-[#3c4f41]">Ghi chú phiên học</h2><Edit3 size={18} className="text-[#2e5339]" /></div><textarea aria-label="Ghi chú phiên học" value={noteDraft} onChange={(event) => {
            const next = event.target.value.slice(0, MAX_SESSION_NOTE_LENGTH);
            noteRef.current = next;
            setNoteDraft(next);
            setNoteSaveState(next.trim() === savedNoteRef.current ? "saved" : "idle");
            if (session && session.id !== "pending-start") {
              if (next.trim() === savedNoteRef.current) window.sessionStorage.removeItem(noteDraftKey(session.id));
              else window.sessionStorage.setItem(noteDraftKey(session.id), next);
            }
          }} rows={3} maxLength={MAX_SESSION_NOTE_LENGTH} className="w-full resize-none rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-3.5 text-sm leading-6 outline-none transition focus:border-[#2e5339] focus:bg-white" placeholder="Bạn muốn học gì, hoặc đã hoàn thành những gì?" /><div className="flex justify-between gap-3 text-[11px] text-[#3c4f41]"><span aria-live="polite" className={`rounded px-1.5 py-0.5 ${noteSaveState === "error" ? "bg-[#fff1ef] text-[#9a3028]" : "bg-[#eaf0df]"}`}>{!session || session.id === "pending-start" ? "Bản nháp · lưu khi bắt đầu" : noteSaveState === "saving" ? "Đang lưu ghi chú…" : noteSaveState === "error" ? "Chưa lưu được · chỉnh sửa để thử lại" : noteSaveState === "saved" ? "Đã lưu ghi chú" : "Sẽ tự lưu sau khi ngừng gõ"}</span><span className="font-mono">{noteDraft.length}/{MAX_SESSION_NOTE_LENGTH}</span></div></section>
          <section className="flex flex-col gap-4 rounded-2xl border border-[#e1e8df] bg-[#ffffff] p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[.12em] text-[#3c4f41]">Nhịp Pomodoro</h2><span className="rounded-full bg-[#e2eee1] px-2 py-0.5 text-[10px] font-semibold text-[#2e5339]">Chu kỳ 4/4 · mock</span></div><div className="grid grid-cols-2 gap-2.5"><button type="button" className="cursor-pointer rounded-xl border border-[#e1e8df] bg-[#e6ece2] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#dbe4d6] hover:shadow-sm active:scale-[0.98]"><span className="block text-[11px] text-[#3c4f41]">Học tập</span><strong className="font-[family-name:var(--font-geist)] text-lg text-[#2e5339]">25 phút</strong></button><button type="button" className="cursor-pointer rounded-xl border border-[#e1e8df] bg-[#f0f4ed] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d2ddd0] hover:bg-[#e6ece2] hover:shadow-sm active:scale-[0.98]"><span className="block text-[11px] text-[#3c4f41]">Giải lao ngắn</span><strong className="font-[family-name:var(--font-geist)] text-lg">5 phút</strong></button></div><div><div className="mb-1.5 flex justify-between text-[11px] text-[#3c4f41]"><span>Tiến trình hoàn thành mục tiêu ngày</span><strong className="text-[#2e5339]">{goalPercent}%</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e6ece2]"><div className="h-full rounded-full bg-[#2e5339] transition-all" style={{ width: `${goalPercent}%` }} /></div></div></section>
          <section className="rounded-2xl border border-[#e1e8df] bg-[#ffffff] p-6 shadow-sm"><h2 className="text-xs font-semibold uppercase tracking-[.12em] text-[#3c4f41]">Phím tắt nhanh</h2><div className="mt-3 flex flex-col gap-2"><Shortcut label="Tạm dừng / Bắt đầu" keys={["Space"]} /><Shortcut label="Kết thúc và lưu" keys={["Ctrl", "Enter"]} /><Shortcut label="Hủy phiên học" keys={["Esc"]} /><Shortcut label="Bật / tắt Zen" keys={["Z"]} /></div></section>
        </aside>
      </div>
    </div>
  </main>;
}

function CategoryOption({ name, colorKey, active, onClick }: { name: string; colorKey: CategoryColorKey; active: boolean; onClick: () => void }) {
  const palette = getCategoryPalette(colorKey);
  return <button className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 active:scale-[0.99] ${active ? "bg-[#f0f4ed] font-medium text-[#2e5339]" : "hover:bg-[#f0f4ed] hover:text-[#1b2e21] hover:translate-x-1"}`} onClick={onClick}><span className="size-2.5 rounded-full" style={{ backgroundColor: palette.dot }} /><span className="flex-1 font-medium">{name}</span>{active && <CheckCircle2 size={15} className="text-[#2e5339]" />}</button>;
}

function Shortcut({ label, keys }: { label: string; keys: string[] }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-sm"><span className="text-[#3c4f41]">{label}</span><span className="flex gap-1">{keys.map((key) => <kbd className="rounded border border-[#e1e8df] bg-[#f0f4ed] px-2 py-1 font-mono text-[10px] font-semibold" key={key}>{key}</kbd>)}</span></div>;
}
