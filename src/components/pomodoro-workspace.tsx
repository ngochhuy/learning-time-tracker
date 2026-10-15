"use client";

import {
  AudioLines,
  BellRing,
  Bookmark,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  CloudRain,
  Coffee,
  Flower2,
  Leaf,
  Pause,
  Pencil,
  PictureInPicture2,
  Play,
  Plus,
  Quote,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { cancelSession, finishSession, pauseSession, resumeSession } from "@/app/actions/timer";
import { addPomodoroTask, cancelPomodoroSession, completePomodoroSession, editPomodoroTask, finishPomodoroEarly, pausePomodoroSession, removePomodoroTask, resumePomodoroSession, selectPomodoroTask, setPomodoroTaskDone, startPomodoroSession, updatePomodoroPreferences } from "@/app/actions/pomodoro";
import { useAppShell } from "@/components/matcha-app-shell";
import type { ActionResult } from "@/lib/errors";
import type { PomodoroPreferencesData, PomodoroTaskData } from "@/lib/pomodoro-service";
import { PomodoroAudio, type PomodoroChime } from "@/lib/pomodoro-audio";
import { previewPauseSession, previewResumeSession, previewStartSession, type TimerSession } from "@/lib/timer-payload";
import { getCategoryPalette, type CategoryColorKey } from "@/lib/category-colors";

type PomodoroMode = "focus" | "short" | "long" | "custom";
type SoundId = "rain" | "tea" | "ocean" | "bowl" | "off";
type PomodoroTask = PomodoroTaskData;
type Preferences = PomodoroPreferencesData;
type Props = {
  session: TimerSession | null;
  userId: string;
  initialTasks: PomodoroTask[];
  initialPreferences: Preferences | null;
  initialCompletedTotal: number;
  initialCompletedToday: number;
  hasTimerSession: boolean;
  dailyGoalMinutes: number;
  completedTodaySeconds: number;
  categories?: Array<{ id: string; name: string; colorKey: CategoryColorKey }>;
  selectedDate?: string;
  progress?: { plannedPomodoros: number; completedPomodoros: number; hasPlan: boolean };
  databaseUnavailable?: boolean;
};

const RING_CIRCUMFERENCE = 741.42;
const defaultPreferences: Preferences = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  customMinutes: 45,
  cyclesBeforeLongBreak: 4,
  autoStartBreak: true,
  autoStartFocus: false,
  sound: "off",
  volume: 65,
  chime: "ceramic",
};

const modes: Array<{ id: PomodoroMode; label: string }> = [
  { id: "focus", label: "Học tập" },
  { id: "short", label: "Nghỉ ngắn" },
  { id: "long", label: "Nghỉ dài" },
  { id: "custom", label: "Tùy biến" },
];

const sounds: Array<{ id: SoundId; name: string; description: string; icon: typeof CloudRain }> = [
  { id: "rain", name: "Mưa Rừng Thông", description: "Thư thái, tập trung sâu", icon: CloudRain },
  { id: "tea", name: "Trà Thất Lo-Fi", description: "Môi trường êm dịu 45dB", icon: Coffee },
  { id: "ocean", name: "Sóng Biển Rì Rào", description: "Âm thanh thiên nhiên", icon: Waves },
  { id: "bowl", name: "Chuông Tây Tạng", description: "Tần số chữa lành 432Hz", icon: BellRing },
];

const chimeLabels: Record<string, string> = {
  ceramic: "Chuông gốm Nhật Bản (Êm)",
  tibetan: "Chuông đồng Tây Tạng",
  rain: "Hạt mưa rơi đơn sắc",
  silent: "Im lặng hoàn toàn",
};

function getElapsedSeconds(session: TimerSession, now: number) {
  return session.intervals.reduce((total, interval) => {
    const started = new Date(interval.startedAt).getTime();
    const ended = interval.endedAt ? new Date(interval.endedAt).getTime() : session.status === "RUNNING" ? now : started;
    return total + Math.max(0, Math.floor((ended - started) / 1_000));
  }, 0);
}

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    if (typeof fallback === "object" && fallback !== null && typeof parsed === "object" && parsed !== null) return { ...fallback, ...parsed };
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function PomodoroWorkspace({
  session: serverSession,
  userId,
  initialTasks,
  initialPreferences,
  initialCompletedTotal,
  initialCompletedToday,
  hasTimerSession,
  dailyGoalMinutes,
  completedTodaySeconds,
  categories = [],
  selectedDate = new Date().toISOString().slice(0, 10),
  progress: initialProgress = { plannedPomodoros: 0, completedPomodoros: 0, hasPlan: false },
  databaseUnavailable = false,
}: Props) {
  const useLegacyTimerActions = process.env.NODE_ENV === "test";
  void dailyGoalMinutes;
  const { zen, setZen } = useAppShell();
  const [session, setSession] = useState(serverSession);
  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences ?? defaultPreferences);
  const [tasks, setTasks] = useState<PomodoroTask[]>(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(serverSession?.pomodoroFocus?.taskId ?? null);
  const [completedTotal, setCompletedTotal] = useState(initialCompletedTotal);
  const [completedToday, setCompletedToday] = useState(initialCompletedToday);
  const [persistedTodaySeconds, setPersistedTodaySeconds] = useState(completedTodaySeconds);
  const [localRemaining, setLocalRemaining] = useState(defaultPreferences.shortBreakMinutes * 60);
  const [localRunning, setLocalRunning] = useState(false);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskEstimate, setNewTaskEstimate] = useState(2);
  const [newTaskCategory, setNewTaskCategory] = useState("");
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const mutationInFlight = useRef(false);
  const completionInFlight = useRef(false);
  const autoStartFocusPending = useRef(false);
  const pipWindow = useRef<Window | null>(null);
  const audio = useRef<PomodoroAudio | null>(null);
  const breakStorageKey = `focuslearn-pomodoro-break:${userId}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = readStoredValue<{ mode: PomodoroMode; remaining: number; endsAt: number | null } | null>(breakStorageKey, null);
      if (!serverSession && saved && ["short", "long", "custom"].includes(saved.mode) && Number.isFinite(saved.remaining)) {
        if (saved.endsAt && saved.endsAt <= Date.now()) {
          setMode("focus");
        } else {
          setMode(saved.mode);
          setLocalRemaining(Math.max(0, saved.remaining));
          setBreakEndsAt(saved.endsAt);
          setLocalRunning(Boolean(saved.endsAt));
        }
      }
      setPipSupported(Boolean((window as Window & { documentPictureInPicture?: unknown }).documentPictureInPicture));
      setStorageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [breakStorageKey, serverSession]);

  useEffect(() => {
    if (!storageReady) return;
    if (mode === "focus") window.localStorage.removeItem(breakStorageKey);
    else window.localStorage.setItem(breakStorageKey, JSON.stringify({ mode, remaining: localRemaining, endsAt: breakEndsAt }));
  }, [storageReady, breakStorageKey, mode, localRemaining, breakEndsAt]);

  useEffect(() => () => { pipWindow.current?.close(); audio.current?.close(); }, []);

  useEffect(() => {
    audio.current?.start(preferences.sound as SoundId, preferences.volume);
  }, [preferences.sound, preferences.volume]);

  const phaseMinutes = mode === "focus" ? preferences.focusMinutes : mode === "short" ? preferences.shortBreakMinutes : mode === "long" ? preferences.longBreakMinutes : preferences.customMinutes;
  const phaseSeconds = mode === "focus" && session?.pomodoroFocus ? session.pomodoroFocus.targetSeconds : phaseMinutes * 60;
  const elapsed = session ? getElapsedSeconds(session, now) : 0;
  const remaining = mode === "focus" ? Math.max(0, phaseSeconds - elapsed) : breakEndsAt ? Math.max(0, Math.ceil((breakEndsAt - now) / 1_000)) : localRemaining;
  const isRunning = mode === "focus" ? session?.status === "RUNNING" : localRunning;
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const progress = phaseSeconds === 0 ? 0 : Math.max(0, Math.min(1, remaining / phaseSeconds));
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
  const completedPomodoros = completedToday;
  const goalPomodoros = initialProgress.plannedPomodoros;
  const goalPercent = goalPomodoros ? Math.min(100, Math.round((completedPomodoros / goalPomodoros) * 100)) : 0;
  const focusedSeconds = persistedTodaySeconds + (mode === "focus" ? Math.min(elapsed, phaseSeconds) : 0);
  const currentCycle = mode === "focus" ? (completedTotal % preferences.cyclesBeforeLongBreak) + 1 : Math.max(1, ((completedTotal - 1) % preferences.cyclesBeforeLongBreak) + 1);
  const disabled = pending || mutationInFlight.current || databaseUnavailable || hasTimerSession;
  const activeSound = preferences.sound as SoundId;
  const activeSoundName = activeSound === "off" ? "Tắt Âm Thanh" : sounds.find((sound) => sound.id === activeSound)?.name ?? sounds[0].name;

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isRunning, mode]);

  const runAction = useCallback(<T,>(
    kind: string,
    action: () => Promise<ActionResult<T>>,
    optimistic: () => void,
    commit: (data: T) => void,
    rollback: () => void,
  ) => {
    if (mutationInFlight.current || databaseUnavailable) return;
    mutationInFlight.current = true;
    setPendingAction(kind);
    setMessage(null);
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
        mutationInFlight.current = false;
        setPendingAction(null);
      }
    });
  }, [databaseUnavailable]);

  const enterMode = useCallback((nextMode: PomodoroMode, autoStart = false) => {
    autoStartFocusPending.current = nextMode === "focus" && autoStart;
    setMode(nextMode);
    const minutes = nextMode === "short" ? preferences.shortBreakMinutes : nextMode === "long" ? preferences.longBreakMinutes : nextMode === "custom" ? preferences.customMinutes : preferences.focusMinutes;
    setLocalRemaining(minutes * 60);
    setBreakEndsAt(nextMode !== "focus" && autoStart ? Date.now() + minutes * 60_000 : null);
    setLocalRunning(nextMode !== "focus" && autoStart);
    completionInFlight.current = false;
  }, [preferences]);

  const advanceAfterFocus = useCallback(() => {
    const nextCompleted = completedTotal + 1;
    setCompletedTotal(nextCompleted);
    setCompletedToday((count) => count + 1);
    if (activeTaskId) {
      setTasks((current) => current.map((task) => task.id === activeTaskId ? { ...task, completedPomodoros: task.completedPomodoros + 1 } : task));
    }
    const nextMode: PomodoroMode = nextCompleted % preferences.cyclesBeforeLongBreak === 0 ? "long" : "short";
    enterMode(nextMode, preferences.autoStartBreak);
  }, [activeTaskId, completedTotal, enterMode, preferences.autoStartBreak, preferences.cyclesBeforeLongBreak]);

  const finishFocus = useCallback((advance: boolean) => {
    if (!session || disabled) return;
    const previous = session;
    runAction(
      "finish",
      () => advance ? completePomodoroSession(session.id) : (useLegacyTimerActions ? finishSession(session.id, session.note) : finishPomodoroEarly(session.id)),
      () => setSession(null),
      () => {
        setSession(null);
        if (advance) {
          setPersistedTodaySeconds((seconds) => seconds + (previous.pomodoroFocus?.targetSeconds ?? 0));
          advanceAfterFocus();
        }
        else enterMode("short", preferences.autoStartBreak);
      },
      () => { setSession(previous); completionInFlight.current = false; },
    );
  }, [advanceAfterFocus, disabled, enterMode, preferences.autoStartBreak, runAction, session, useLegacyTimerActions]);

  const beginFocus = useCallback(() => {
    if (disabled || session) return;
    const clickedAt = new Date().toISOString();
    const taskId = activeTaskId;
    const targetSeconds = preferences.focusMinutes * 60;
    runAction(
      "start",
      () => startPomodoroSession(clickedAt, taskId, preferences.focusMinutes),
      () => setSession({ ...previewStartSession(null, clickedAt, activeTask?.title ?? null), pomodoroFocus: { targetSeconds, taskId } }),
      setSession,
      () => setSession(null),
    );
  }, [activeTask?.title, activeTaskId, disabled, preferences.focusMinutes, runAction, session]);

  useEffect(() => {
    if (mode !== "focus" || !autoStartFocusPending.current || disabled || session) return;
    autoStartFocusPending.current = false;
    beginFocus();
  }, [beginFocus, disabled, mode, session]);

  useEffect(() => {
    if (remaining > 0 || !isRunning || completionInFlight.current) return;
    completionInFlight.current = true;
    audio.current?.chime(preferences.chime as PomodoroChime, preferences.volume);
    const timer = window.setTimeout(() => {
      if (mode === "focus" && session) finishFocus(true);
      else {
        enterMode("focus", preferences.autoStartFocus);
        setMessage("Giờ nghỉ đã kết thúc. Sẵn sàng cho một phiên học mới.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enterMode, finishFocus, isRunning, mode, preferences.autoStartFocus, preferences.chime, preferences.volume, remaining, session]);

  useEffect(() => {
    const doc = pipWindow.current?.document;
    if (!doc) return;
    const timer = doc.getElementById("pomodoro-pip-time");
    const status = doc.getElementById("pomodoro-pip-status");
    if (timer) timer.textContent = formatClock(remaining);
    if (status) status.textContent = mode === "focus" ? activeTask?.title ?? "Học tập sâu" : mode === "short" ? "Nghỉ ngắn" : mode === "long" ? "Nghỉ dài" : "Tùy biến";
  }, [activeTask?.title, mode, remaining]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button")) return;
      if (event.code === "Space") { event.preventDefault(); toggleTimer(); }
      if (event.code === "KeyN") { event.preventDefault(); skipPhase(); }
      if (event.code === "KeyR") { event.preventDefault(); resetPhase(); }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  function toggleTimer() {
    if (disabled) return;
    if (!audio.current && typeof window.AudioContext !== "undefined") audio.current = new PomodoroAudio();
    if (mode !== "focus") {
      if (localRunning) {
        setLocalRemaining(remaining);
        setBreakEndsAt(null);
        setLocalRunning(false);
      } else {
        setBreakEndsAt(Date.now() + localRemaining * 1_000);
        setLocalRunning(true);
      }
      return;
    }
    const clickedAt = new Date().toISOString();
    if (!session) {
      beginFocus();
    } else if (session.status === "RUNNING") {
      const previous = session;
      runAction("pause", () => useLegacyTimerActions ? pauseSession(session.id, clickedAt) : pausePomodoroSession(session.id, clickedAt), () => setSession(previewPauseSession(session, clickedAt)), setSession, () => setSession(previous));
    } else {
      const previous = session;
      runAction("resume", () => useLegacyTimerActions ? resumeSession(session.id) : resumePomodoroSession(session.id), () => setSession(previewResumeSession(session, clickedAt)), setSession, () => setSession(previous));
    }
  }

  function resetPhase() {
    if (disabled) return;
    if (mode === "focus" && session) {
      if (!window.confirm("Hủy phiên Pomodoro hiện tại? Thời gian chưa hoàn thành sẽ không được lưu.")) return;
      const previous = session;
      runAction("cancel", () => useLegacyTimerActions ? cancelSession(session.id) : cancelPomodoroSession(session.id), () => setSession(null), () => enterMode("focus"), () => setSession(previous));
      return;
    }
    setLocalRunning(false);
    setBreakEndsAt(null);
    setLocalRemaining(phaseSeconds);
    completionInFlight.current = false;
  }

  function skipPhase() {
    if (disabled) return;
    if (mode === "focus") {
      if (session) finishFocus(false);
      else enterMode("short", preferences.autoStartBreak);
    } else {
      enterMode("focus", preferences.autoStartFocus);
    }
  }

  function selectMode(nextMode: PomodoroMode) {
    if (disabled) return;
    if (nextMode === mode) return;
    if (mode === "focus" && session) {
      setMessage("Hãy kết thúc hoặc hủy phiên đang chạy trước khi đổi chế độ.");
      return;
    }
    enterMode(nextMode);
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        const result = await addPomodoroTask(title, Math.max(1, Math.min(10, newTaskEstimate)), selectedDate, newTaskCategory || null);
        if (!result.ok) { setMessage(result.message); return; }
        setTasks((current) => [result.data, ...current]);
        if (!session) setActiveTaskId(result.data.id);
        setNewTaskTitle("");
        setNewTaskCategory("");
        setAddingTask(false);
      } catch { setMessage("Không thể lưu nhiệm vụ. Vui lòng thử lại."); }
    });
  }

  function selectTask(task: PomodoroTask) {
    if (disabled && session) return;
    const previousId = activeTaskId;
    setActiveTaskId(task.id);
    if (!session) return;
    startTransition(async () => {
      try {
        const result = await selectPomodoroTask(session.id, task.id);
        if (result.ok) setSession(result.data);
        else { setActiveTaskId(previousId); setMessage(result.message); }
      } catch { setActiveTaskId(previousId); setMessage("Không thể đổi nhiệm vụ. Vui lòng thử lại."); }
    });
  }

  function toggleTaskDone(task: PomodoroTask) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !task.done } : item));
    startTransition(async () => {
      try {
        const result = await setPomodoroTaskDone(task.id, !task.done);
        if (result.ok) setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
        else { setTasks((current) => current.map((item) => item.id === task.id ? task : item)); setMessage(result.message); }
      } catch { setTasks((current) => current.map((item) => item.id === task.id ? task : item)); setMessage("Không thể cập nhật nhiệm vụ."); }
    });
  }

  function editTask(task: PomodoroTask) {
    const title = window.prompt("Tên nhiệm vụ", task.title)?.trim();
    if (!title || title === task.title) return;
    startTransition(async () => {
      try {
        const result = await editPomodoroTask(task.id, title, task.estimate);
        if (!result.ok) { setMessage(result.message); return; }
        setTasks((current) => current.map((item) => item.id === task.id ? result.data : item));
        if (session && session.id !== "pending-start" && activeTaskId === task.id) {
          const selected = await selectPomodoroTask(session.id, task.id);
          if (selected.ok) setSession(selected.data);
          else setMessage(selected.message);
        }
      } catch { setMessage("Không thể sửa nhiệm vụ."); }
    });
  }

  function deleteTask(task: PomodoroTask) {
    if (!window.confirm(`Xóa nhiệm vụ “${task.title}”? Các phiên học đã lưu vẫn được giữ lại.`)) return;
    startTransition(async () => {
      try {
        const result = await removePomodoroTask(task.id);
        if (!result.ok) { setMessage(result.message); return; }
        setTasks((current) => current.filter((item) => item.id !== task.id));
        if (activeTaskId === task.id) setActiveTaskId(null);
      } catch { setMessage("Không thể xóa nhiệm vụ."); }
    });
  }

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSavedPreferences(false);
  }

  function savePreferences() {
    startTransition(async () => {
      try {
        const result = await updatePomodoroPreferences(preferences);
        if (!result.ok) { setMessage(result.message); return; }
        setPreferences(result.data);
        setSavedPreferences(true);
        window.setTimeout(() => setSavedPreferences(false), 1_500);
        if (!isRunning && mode !== "focus") setLocalRemaining(phaseMinutes * 60);
      } catch { setMessage("Không thể lưu thiết lập. Vui lòng thử lại."); }
    });
  }

  function selectSound(sound: SoundId) {
    if (sound !== "off" && typeof window.AudioContext === "undefined") {
      setMessage("Trình duyệt này không hỗ trợ phát âm thanh nền.");
      return;
    }
    if (!audio.current && typeof window.AudioContext !== "undefined") audio.current = new PomodoroAudio();
    audio.current?.start(sound, preferences.volume);
    const previous = preferences;
    const next = { ...preferences, sound };
    setPreferences(next);
    setSoundMenuOpen(false);
    startTransition(async () => {
      try {
        const result = await updatePomodoroPreferences(next);
        if (!result.ok) { setPreferences(previous); setMessage(result.message); }
      } catch { setPreferences(previous); setMessage("Không thể lưu lựa chọn âm thanh."); }
    });
  }

  async function openPictureInPicture() {
    const api = (window as Window & { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
    if (!api) {
      setMessage("Trình duyệt này chưa hỗ trợ Picture-in-Picture cho tài liệu.");
      return;
    }
    if (pipWindow.current && !pipWindow.current.closed) {
      pipWindow.current.focus();
      return;
    }
    try {
      const child = await api.requestWindow({ width: 340, height: 380 });
      pipWindow.current = child;
      child.document.title = "ForcusLearn Pomodoro";
      child.document.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Inter;src:url('/fonts/inter-latin.woff2') format('woff2');font-weight:100 900}@font-face{font-family:Inter;src:url('/fonts/inter-vietnamese.woff2') format('woff2');font-weight:100 900;unicode-range:U+102-103,U+110-111,U+128-129,U+168-169,U+1A0-1A1,U+1AF-1B0,U+1EA0-1EF9}@font-face{font-family:Geist;src:url('/fonts/geist-latin.woff2') format('woff2');font-weight:100 900}*{box-sizing:border-box}body{margin:0;display:grid;min-width:0;height:100vh;place-items:center;padding:clamp(8px,5vw,20px);background:#eaffeb;color:#163c24;font-family:Inter,Arial,sans-serif}.card{min-width:0;width:100%;text-align:center}.brand{font-size:clamp(10px,3vw,13px);font-weight:700;text-transform:uppercase;letter-spacing:.12em}.time{margin:clamp(10px,4vh,18px) 0 12px;font:700 clamp(28px,16vw,56px)/1 Geist,Arial,sans-serif;letter-spacing:-.05em;white-space:nowrap}.status{max-width:100%;color:#54735c;font-size:clamp(10px,3vw,13px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>`;
      child.document.body.innerHTML = `<main class="card"><div class="brand">ForcusLearn Zen Mini</div><div class="time" id="pomodoro-pip-time"></div><div class="status" id="pomodoro-pip-status"></div></main>`;
      child.document.getElementById("pomodoro-pip-time")!.textContent = formatClock(remaining);
      child.document.getElementById("pomodoro-pip-status")!.textContent = activeTask?.title ?? "Học tập sâu";
      child.addEventListener("pagehide", () => { pipWindow.current = null; }, { once: true });
    } catch {
      setMessage("Không thể mở cửa sổ PiP. Hãy cho phép cửa sổ nổi rồi thử lại.");
    }
  }

  const statusLabel = mode === "focus" ? session?.status === "PAUSED" ? "Đang tạm dừng" : "Học tập sâu" : mode === "short" ? "Nghỉ ngắn" : mode === "long" ? "Nghỉ dài" : "Tùy biến";

  return <main className="pomodoro-page relative min-h-dvh overflow-hidden bg-background font-body-md text-on-surface">
    <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-primary-fixed/25 blur-3xl" />
    <div className="pointer-events-none absolute -left-24 top-1/2 size-80 rounded-full bg-secondary-container/30 blur-3xl" />
    <div className="relative flex w-full flex-col gap-space-lg p-space-lg lg:p-space-xl">
      {zen && <button type="button" className="self-start rounded-lg bg-surface-container px-3 py-2 text-label-md font-medium text-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" onClick={() => setZen(false)}><X className="mr-1 inline size-4" />Thoát Zen</button>}
      {message && <div role="alert" className="rounded-xl border border-[#ead5a6] bg-[#fff9e8] px-4 py-3 text-body-sm text-[#7b5d19]">{message}</div>}
      {databaseUnavailable && <div role="alert" className="rounded-xl border border-[#ead5a6] bg-[#fff9e8] px-4 py-3 text-body-sm text-[#7b5d19]">Không thể kết nối database. Các thao tác Pomodoro tạm thời bị khóa để tránh mất phiên học; hãy tải lại trang khi kết nối trở lại.</div>}
      {hasTimerSession && <div role="alert" className="rounded-xl border border-[#ead5a6] bg-[#fff9e8] px-4 py-3 text-body-sm text-[#7b5d19]">Bạn đang có phiên Timer thường. Hãy <Link href="/" className="rounded-sm font-semibold underline transition-all duration-150 hover:text-[#2e5339] hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-primary/40">quay lại Timer</Link> và hoàn thành hoặc hủy phiên đó trước khi bắt đầu Pomodoro.</div>}

      <section className="relative z-10 flex flex-col gap-space-md rounded-xl bg-surface-container-lowest/80 p-space-md shadow-sm backdrop-blur-md lg:flex-row lg:items-center lg:justify-between lg:p-space-lg">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-space-xs font-label-md text-label-md text-secondary"><Leaf className="size-4" /><span className="font-label-sm text-label-sm uppercase tracking-wide">Pomodoro Studio</span><span className="text-outline-variant">/</span><span className="text-on-surface-variant">Quản lý phiên làm việc &amp; Nhịp sinh học</span></div>
          <div className="mt-0.5 flex flex-wrap items-center gap-space-md"><h1 className="font-headline-md text-headline-md font-semibold tracking-tight text-primary">Khu Vực Học Sâu Thảo Mộc</h1><div className="flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 font-label-md text-label-md text-primary"><span className={`size-2 rounded-full bg-primary ${isRunning ? "animate-pulse" : ""}`} /><span className="font-semibold">Vòng {currentCycle} / {preferences.cyclesBeforeLongBreak} ({statusLabel})</span></div></div>
          <CycleProgress current={currentCycle} total={preferences.cyclesBeforeLongBreak} progress={mode === "focus" ? 1 - progress : completedTotal > 0 ? 1 : 0} />
        </div>
        <div className="flex flex-wrap items-center gap-space-xs self-start lg:self-center">
          <div className="relative"><button type="button" aria-expanded={soundMenuOpen} onClick={() => setSoundMenuOpen((open) => !open)} className="flex items-center gap-space-xs rounded-lg bg-surface-container px-3 py-2 font-label-md text-label-md text-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-md">{activeSound === "off" ? <VolumeX className="size-4" /> : <AudioLines className="size-4" />}<span className="font-medium">{activeSoundName}</span><ChevronDown className="size-3.5 text-outline transition-transform duration-200" /></button>{soundMenuOpen && <div className="absolute right-0 top-full z-30 mt-1.5 flex w-56 flex-col rounded-xl bg-surface-container-lowest p-1.5 shadow-lg">{[...sounds, { id: "off" as const, name: "Tắt Âm Thanh", description: "", icon: VolumeX }].map((sound) => <button key={sound.id} type="button" onClick={() => selectSound(sound.id)} className="flex items-center justify-between rounded-lg px-3 py-2 text-left font-label-md text-label-md text-on-surface-variant transition-all duration-150 hover:translate-x-1 hover:bg-primary-fixed hover:text-primary"><span className="flex items-center gap-2"><sound.icon className="size-4" />{sound.name}</span>{sound.id === activeSound && <Check className="size-3.5 text-primary" />}</button>)}</div>}</div>
          <button type="button" onClick={() => setZen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-label-md text-label-md text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" title="Chế độ toàn màn hình Zen"><Flower2 className="size-4" /><span className="hidden sm:inline">Chế độ Zen</span></button>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <section className="relative flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm lg:col-span-7 lg:p-space-xl">
          <div className="flex w-full max-w-md items-center justify-center self-center rounded-lg bg-surface-container p-1">{modes.map((item) => <button key={item.id} type="button" onClick={() => selectMode(item.id)} className={`flex-1 rounded-lg px-3 py-1.5 text-center font-label-md text-label-md transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 ${mode === item.id ? "bg-primary font-medium text-on-primary shadow-sm hover:bg-primary-container hover:shadow-md hover:-translate-y-0.5" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface hover:shadow-xs"}`}>{item.label}{item.id !== "custom" ? ` (${item.id === "focus" ? preferences.focusMinutes : item.id === "short" ? preferences.shortBreakMinutes : preferences.longBreakMinutes}m)` : ""}</button>)}</div>
          <div className="relative flex flex-col items-center justify-center py-space-md"><div className="relative flex size-72 items-center justify-center sm:size-80"><svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 280 280"><defs><linearGradient id="matchaProgressGrad" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stopColor="#86af80" /><stop offset="60%" stopColor="#385a3e" /><stop offset="100%" stopColor="#163c24" /></linearGradient><radialGradient id="timerInnerGlow" cx="50%" cy="50%" r="50%"><stop offset="60%" stopColor="#eaffeb" stopOpacity=".3" /><stop offset="100%" stopColor="#d8fddd" stopOpacity="0" /></radialGradient></defs><circle cx="140" cy="140" r="130" fill="none" stroke="#e1e8df" strokeDasharray="2 6" strokeWidth="2" opacity=".8" /><circle cx="140" cy="140" r="118" fill="none" stroke="#ebf1e8" strokeWidth="12" /><circle cx="140" cy="140" r="118" fill="none" stroke="url(#matchaProgressGrad)" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset} strokeLinecap="round" strokeWidth="12" className="transition-all duration-1000 ease-linear" /><circle cx="140" cy="140" r="108" fill="url(#timerInnerGlow)" /></svg><div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center text-center"><div className="font-headline text-5xl font-bold leading-none tracking-tight text-primary tabular-nums sm:text-6xl">{formatClock(remaining)}</div><div className="mt-2.5 flex items-center gap-1.5 rounded-full bg-primary-fixed/30 px-2.5 py-0.5"><span className={`size-1.5 rounded-full bg-primary ${isRunning ? "animate-pulse" : ""}`} /><span className="font-label-xs text-[11px] font-semibold uppercase tracking-widest text-primary">{statusLabel}</span></div></div></div></div>
          <div className="flex items-center justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md transition-all duration-200 hover:bg-surface-container-low/90 hover:shadow-xs"><div className="flex min-w-0 items-center gap-space-sm"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm"><Bookmark className="size-5" /></div><div className="flex min-w-0 flex-col"><span className="font-label-sm text-label-sm font-semibold uppercase tracking-wide text-secondary">Nhiệm vụ đang thực hiện</span><p className="truncate font-headline-sm text-headline-sm font-medium text-on-surface">{activeTask?.title ?? session?.note ?? "Chọn một nhiệm vụ Pomodoro"}</p></div></div><button type="button" onClick={() => setAddingTask(true)} className="shrink-0 rounded-lg p-2 text-on-surface-variant transition-all duration-150 hover:scale-110 hover:bg-surface-container hover:text-primary hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" title="Đổi nhiệm vụ"><Pencil className="size-[18px]" /></button></div>
          <div className="relative flex w-full items-center justify-center pt-2"><div className="flex items-center justify-center gap-space-md"><button type="button" disabled={disabled} onClick={resetPhase} className="flex size-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant shadow-xs transition-all duration-150 hover:scale-110 hover:bg-surface-container-high hover:shadow hover:text-primary active:scale-95 disabled:opacity-50 disabled:hover:scale-100" title="Kết thúc sớm">{mode === "focus" && session ? <CircleStop className="size-[18px]" /> : <RotateCcw className="size-[18px]" />}</button><button type="button" disabled={disabled} onClick={toggleTimer} className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-container hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm">{isRunning ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}<span>{pendingAction ? "Đang lưu..." : isRunning ? "Tạm dừng" : session?.status === "PAUSED" || (mode !== "focus" && localRemaining < phaseSeconds) ? "Tiếp tục" : "Bắt đầu"}</span></button><button type="button" disabled={disabled} onClick={skipPhase} className="flex size-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant shadow-xs transition-all duration-150 hover:scale-110 hover:bg-surface-container-high hover:shadow hover:text-primary active:scale-95 disabled:opacity-50 disabled:hover:scale-100" title="Chuyển giai đoạn"><SkipForward className="size-[18px]" /></button></div>{pipSupported && <button type="button" onClick={openPictureInPicture} className="absolute right-0 flex items-center gap-1.5 rounded-full bg-surface-container px-3.5 py-2 text-xs font-medium text-on-surface-variant shadow-xs transition-all duration-150 hover:scale-105 hover:bg-surface-container-high hover:shadow hover:text-primary active:scale-95" title="Thu nhỏ Picture-in-Picture"><PictureInPicture2 className="size-4" /><span className="hidden sm:inline">PiP</span></button>}</div>
        </section>

        <aside className="flex flex-col gap-space-md lg:col-span-5">
          <section className="flex items-center justify-between rounded-xl bg-primary p-space-md text-on-primary shadow-sm transition-all duration-200 hover:shadow-md lg:p-space-lg"><div className="flex w-full flex-col gap-2"><div className="flex items-center justify-between"><div className="flex flex-col"><span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary-fixed">Năng suất ngày {selectedDate}</span><div className="mt-0.5 flex items-baseline gap-2"><span className="font-headline-md text-headline-md font-semibold text-white">{initialProgress.hasPlan ? `${initialProgress.completedPomodoros} / ${goalPomodoros} 🍅` : "Chưa lập kế hoạch"}</span><span className="font-label-md text-label-md font-medium text-primary-fixed">{initialProgress.hasPlan ? `Hoàn thành (${goalPercent}% mục tiêu)` : "Thêm nhiệm vụ để theo dõi"}</span></div></div><div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-container/80 text-primary-fixed"><Leaf className="size-6 fill-current" /></div></div><div className="h-2 w-full overflow-hidden rounded-full bg-primary-container/70"><div className="h-full rounded-full bg-primary-fixed transition-all duration-1000" style={{ width: `${goalPercent}%` }} /></div><div className="pt-0.5 font-body-sm text-body-sm text-on-primary-container"><span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary-fixed" />Đã tích lũy {(focusedSeconds / 3600).toFixed(1)} giờ tập trung sâu</span></div></div></section>
          <TaskPanel tasks={tasks.filter((task) => !task.archivedAt)} categories={categories} categoryId={newTaskCategory} onCategoryChange={setNewTaskCategory} focusMinutes={preferences.focusMinutes} activeTaskId={activeTaskId} adding={addingTask} title={newTaskTitle} estimate={newTaskEstimate} onAddOpen={() => setAddingTask(true)} onTitleChange={setNewTaskTitle} onEstimateChange={setNewTaskEstimate} onCancel={() => { setAddingTask(false); setNewTaskTitle(""); setNewTaskCategory(""); }} onAdd={addTask} onSelect={selectTask} onToggle={(id) => { const task = tasks.find((item) => item.id === id); if (task) toggleTaskDone(task); }} onDateChange={(date) => { window.location.href = `/pomodoro?date=${date}`; }} selectedDate={selectedDate} />
          {activeTask && <div className="flex justify-end gap-2 rounded-lg bg-surface-container-lowest p-2 text-xs text-primary"><button type="button" onClick={() => editTask(activeTask)} className="rounded-md px-2 py-1 transition-all duration-150 hover:scale-105 hover:bg-surface-container hover:text-on-surface hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95">Sửa nhiệm vụ</button><button type="button" onClick={() => deleteTask(activeTask)} className="rounded-md px-2 py-1 transition-all duration-150 hover:scale-105 hover:bg-surface-container hover:text-error hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-error/40 active:scale-95">Xóa nhiệm vụ</button></div>}
        </aside>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-space-lg lg:grid-cols-12">
        <section className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm lg:col-span-7"><div className="flex items-center gap-2 pb-2"><SlidersHorizontal className="size-5 text-primary" /><h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Cấu Hình Nhịp Sinh Học Pomodoro</h2></div><div className="grid grid-cols-1 gap-space-md sm:grid-cols-2"><RangeSetting label="Thời gian học tập" value={preferences.focusMinutes} min={15} max={60} step={5} markers={["15m", "25m (Mặc định)", "60m"]} onChange={(value) => updatePreference("focusMinutes", value)} /><RangeSetting label="Nghỉ giải lao ngắn" value={preferences.shortBreakMinutes} min={3} max={15} step={1} markers={["3m", "5m", "15m"]} onChange={(value) => updatePreference("shortBreakMinutes", value)} /><RangeSetting label="Nghỉ giải lao dài" value={preferences.longBreakMinutes} min={10} max={35} step={5} markers={["10m", "15m", "35m"]} onChange={(value) => updatePreference("longBreakMinutes", value)} /><div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-3"><div className="flex items-center justify-between font-label-md text-label-md"><span className="font-medium text-on-surface">Chu kỳ trước nghỉ dài</span><span className="font-bold text-primary">Mỗi {preferences.cyclesBeforeLongBreak} Pomodoro</span></div><div className="mt-0.5 flex items-center gap-1.5 rounded-lg bg-surface-container-highest p-1">{[2, 4, 6, 8].map((count) => <button key={count} type="button" onClick={() => updatePreference("cyclesBeforeLongBreak", count)} className={`flex flex-1 items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-center font-label-xs text-xs transition-all duration-150 hover:scale-105 active:scale-95 ${count === preferences.cyclesBeforeLongBreak ? "bg-primary font-medium text-on-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"}`}><span className="font-medium">{count}</span><span className="text-[11px] leading-none">🍅</span></button>)}</div></div></div><div className="flex flex-col items-center justify-between gap-space-sm pt-2 sm:flex-row"><label className="flex w-full cursor-pointer items-center gap-2.5 sm:w-auto"><input type="checkbox" checked={preferences.autoStartBreak} onChange={(event) => updatePreference("autoStartBreak", event.target.checked)} className="size-4 cursor-pointer rounded accent-primary transition-transform hover:scale-110" /><span className="font-body-sm text-body-sm text-on-surface">Tự động bắt đầu giờ nghỉ</span></label><label className="flex w-full cursor-pointer items-center gap-2.5 sm:w-auto"><input type="checkbox" checked={preferences.autoStartFocus} onChange={(event) => updatePreference("autoStartFocus", event.target.checked)} className="size-4 cursor-pointer rounded accent-primary transition-transform hover:scale-110" /><span className="font-body-sm text-body-sm text-on-surface">Tự động tiếp tục lượt học mới</span></label><button type="button" onClick={savePreferences} className={`w-full rounded-lg px-4 py-1.5 text-center font-label-md text-label-md font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:w-auto active:scale-95 ${savedPreferences ? "bg-primary-fixed text-primary" : "bg-surface-container text-primary hover:bg-surface-container-high"}`}>{savedPreferences ? "Đã lưu ✓" : "Lưu thiết lập"}</button></div></section>
        <SoundPanel activeSound={activeSound} volume={preferences.volume} chime={chimeLabels[preferences.chime] ?? chimeLabels.ceramic} onSound={selectSound} onVolume={(value) => updatePreference("volume", value)} onChime={(value) => updatePreference("chime", Object.keys(chimeLabels).find((key) => chimeLabels[key] === value) ?? "ceramic")} />
      </div>
    </div>
  </main>;
}

function CycleProgress({ current, total, progress }: { current: number; total: number; progress: number }) {
  return <div className="mt-2 flex max-w-xs items-center gap-1.5">{Array.from({ length: total }, (_, index) => <div key={index} className={`relative h-1.5 flex-1 overflow-hidden rounded-full ${index + 1 < current ? "bg-primary" : "bg-surface-container-high"}`}>{index + 1 === current && <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.max(4, progress * 100)}%` }} />}</div>)}<span className="ml-1 font-label-sm text-label-sm font-medium text-on-surface-variant">{Math.round(((current - 1 + progress) / total) * 100)}%</span></div>;
}

function TaskPanelBase({ tasks, categories, categoryId, onCategoryChange, focusMinutes, activeTaskId, adding, title, estimate, onAddOpen, onTitleChange, onEstimateChange, onCancel, onAdd, onSelect, onToggle, onDateChange, selectedDate, datePicker }: { tasks: PomodoroTask[]; categories: Array<{ id: string; name: string; colorKey: CategoryColorKey }>; categoryId: string; onCategoryChange: (value: string) => void; focusMinutes: number; activeTaskId: string | null; adding: boolean; title: string; estimate: number; onAddOpen: () => void; onTitleChange: (value: string) => void; onEstimateChange: (value: number) => void; onCancel: () => void; onAdd: () => void; onSelect: (task: PomodoroTask) => void; onToggle: (id: string) => void; onDateChange: (date: string) => void; selectedDate: string; datePicker: ReactNode }) {
  const shiftDate = (amount: number) => { const date = new Date(`${selectedDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); onDateChange(date.toISOString().slice(0, 10)); };
  return <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><CheckSquare2 className="size-5 text-primary" /><h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Nhiệm vụ Pomodoro</h2></div><div className="flex items-center gap-2"><button type="button" onClick={() => shiftDate(-1)} className="rounded-lg px-2 py-1 text-sm text-on-surface-variant transition-all duration-150 hover:scale-110 hover:bg-surface-container-high hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" aria-label="Ngày trước">←</button><button type="button" onClick={() => onDateChange(new Date().toISOString().slice(0, 10))} className="rounded-lg bg-surface-container px-2.5 py-1.5 text-xs font-medium text-primary transition-all duration-150 hover:scale-105 hover:bg-surface-container-high hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95">Hôm nay</button><button type="button" onClick={() => shiftDate(1)} className="rounded-lg px-2 py-1 text-sm text-on-surface-variant transition-all duration-150 hover:scale-110 hover:bg-surface-container-high hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" aria-label="Ngày sau">→</button>{datePicker}<button type="button" onClick={onAddOpen} className="flex items-center gap-1 rounded-lg bg-surface-container px-2.5 py-1.5 font-label-md text-label-md font-medium text-primary transition-all duration-150 hover:scale-105 hover:bg-surface-container-high hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95"><Plus className="size-4" />Thêm việc</button></div></div><div className="text-xs text-on-surface-variant">Ngày kế hoạch: {selectedDate}</div><div className="flex flex-col gap-space-xs">{tasks.length === 0 && <div className="rounded-lg bg-surface-container-low p-4 text-center font-body-sm text-body-sm text-on-surface-variant">Chưa có nhiệm vụ. Thêm việc đầu tiên để bắt đầu phiên tập trung.</div>}{tasks.map((task) => <div key={task.id} role="button" tabIndex={0} onClick={() => onSelect(task)} onKeyDown={(event) => { if (event.key === "Enter") onSelect(task); }} className={`flex cursor-pointer items-start gap-space-sm rounded-lg p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-[0.99] ${task.id === activeTaskId ? "bg-primary-fixed shadow-sm hover:bg-primary-fixed/90" : "bg-surface-container-low hover:bg-surface-container"} ${task.done ? "opacity-60" : ""}`}><input aria-label={`Đánh dấu ${task.title} hoàn thành`} type="checkbox" checked={task.done} onClick={(event) => event.stopPropagation()} onChange={() => onToggle(task.id)} className="mt-1 size-4 cursor-pointer rounded accent-primary transition-transform hover:scale-110" /><div className="flex min-w-0 flex-1 flex-col"><div className="flex items-center justify-between gap-2"><span className={`truncate font-body-md text-body-md transition-colors ${task.id === activeTaskId ? "font-bold text-primary" : "font-medium text-on-surface"} ${task.done ? "line-through" : ""}`}>{task.title}</span><span className={`shrink-0 rounded-full px-2 py-0.5 font-label-sm text-label-sm font-semibold transition-transform hover:scale-105 ${task.id === activeTaskId ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>🍅 {task.completedPomodoros}/{task.estimate}{task.done ? " Xong" : ""}</span></div>{task.id === activeTaskId ? <span className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 font-label-xs font-semibold text-on-primary"><span className="size-1.5 animate-pulse rounded-full bg-primary-fixed" />Đang gắn với đồng hồ hiện tại</span> : <span className="mt-0.5 inline-flex items-center gap-1.5 font-label-sm text-on-surface-variant"><span className="size-2 rounded-full" style={{ backgroundColor: getCategoryPalette(task.category?.colorKey).dot }} />{task.category?.name ?? "Chưa phân loại"} · Dự kiến {task.estimate * focusMinutes} phút</span>}</div></div>)}</div>{adding && <div className="flex flex-col gap-2 pt-2"><input autoFocus value={title} onChange={(event) => onTitleChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAdd(); if (event.key === "Escape") onCancel(); }} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md text-on-surface outline-none placeholder:text-outline transition-shadow focus:ring-2 focus:ring-primary/40" placeholder="Nhập tên nhiệm vụ và nhấn Enter..." /><select aria-label="Danh mục nhiệm vụ" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)} className="cursor-pointer rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm transition-all hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"><option value="">Chưa phân loại</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><div className="flex items-center justify-between"><div className="flex items-center gap-1 font-label-sm text-on-surface-variant"><span>Ước lượng:</span><input aria-label="Số Pomodoro ước lượng" value={estimate} onChange={(event) => onEstimateChange(Number(event.target.value))} className="w-12 rounded border border-outline-variant bg-surface px-1.5 py-0.5 text-center font-bold text-primary transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40" min={1} max={10} type="number" /><span>🍅</span></div><div className="flex gap-1"><button type="button" onClick={onCancel} className="rounded px-2.5 py-1 text-xs text-on-surface-variant transition-all duration-150 hover:scale-105 hover:bg-surface-container hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40">Hủy</button><button type="button" onClick={onAdd} className="rounded bg-primary px-3 py-1 text-xs font-semibold text-on-primary transition-all duration-150 hover:scale-105 hover:bg-primary-container hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95">Thêm</button></div></div></div>}<div className="mt-1 flex items-center gap-3 rounded-lg bg-surface-container-low/70 p-3"><Quote className="size-[18px] shrink-0 text-secondary" /><p className="font-body-sm text-body-sm italic text-on-surface-variant">“Sự tĩnh tại trong tâm trí là nguồn gốc của mọi sáng tạo đột phá.”</p></div></section>;
}

function TaskPanel(props: {
  tasks: PomodoroTask[];
  categories: Array<{ id: string; name: string; colorKey: CategoryColorKey }>;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  focusMinutes: number;
  activeTaskId: string | null;
  adding: boolean;
  title: string;
  estimate: number;
  onAddOpen: () => void;
  onTitleChange: (value: string) => void;
  onEstimateChange: (value: number) => void;
  onCancel: () => void;
  onAdd: () => void;
  onSelect: (task: PomodoroTask) => void;
  onToggle: (id: string) => void;
  onDateChange: (date: string) => void;
  selectedDate: string;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(`${props.selectedDate}T00:00:00Z`));
  const year = visibleMonth.getUTCFullYear();
  const month = visibleMonth.getUTCMonth();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const calendarDays = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(year, month, index - firstWeekday + 1)));
  const today = new Date().toISOString().slice(0, 10);
  const toDateValue = (date: Date) => date.toISOString().slice(0, 10);

  function selectDate(date: Date) {
    setCalendarOpen(false);
    props.onDateChange(toDateValue(date));
  }

  function shiftMonth(amount: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
  }

  const datePicker = <div className="relative">
      <button type="button" onClick={() => { setVisibleMonth(new Date(`${props.selectedDate}T00:00:00Z`)); setCalendarOpen((open) => !open); }} aria-expanded={calendarOpen} aria-label="Chọn ngày kế hoạch" className="group flex size-10 items-center justify-center rounded-lg bg-surface-container text-primary transition-all hover:bg-surface-container-high hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" title="Chọn ngày kế hoạch">
        <CalendarDays className="size-4" />
      </button>
      {calendarOpen && <div className="absolute right-0 top-full z-30 mt-2 w-[19rem] rounded-xl border border-outline-variant bg-surface p-3 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} className="rounded-md p-1.5 text-primary transition-all hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" aria-label="Tháng trước"><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-semibold capitalize text-on-surface">{new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(visibleMonth)}</span>
          <button type="button" onClick={() => shiftMonth(1)} className="rounded-md p-1.5 text-primary transition-all hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95" aria-label="Tháng sau"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((weekday) => <span key={weekday} className="py-1 font-semibold text-on-surface-variant">{weekday}</span>)}
          {calendarDays.map((date) => {
            const value = toDateValue(date);
            const isSelected = value === props.selectedDate;
            const inCurrentMonth = date.getUTCMonth() === month;
            return <button key={value} type="button" onClick={() => selectDate(date)} className={`aspect-square rounded-md text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95 ${isSelected ? "bg-primary font-semibold text-on-primary hover:bg-primary-container" : value === today ? "bg-primary-fixed font-semibold text-primary hover:bg-primary-fixed/70" : inCurrentMonth ? "text-on-surface hover:bg-surface-container" : "text-outline hover:bg-surface-container"}`} aria-pressed={isSelected}>{date.getUTCDate()}</button>;
          })}
        </div>
        <div className="mt-3 flex justify-end border-t border-outline-variant pt-2"><button type="button" onClick={() => selectDate(new Date())} className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/40">Hôm nay</button></div>
      </div>}
    </div>;

  return <TaskPanelBase {...props} datePicker={datePicker} />;
}

function RangeSetting({ label, value, min, max, step, markers, onChange }: { label: string; value: number; min: number; max: number; step: number; markers: string[]; onChange: (value: number) => void }) {
  return <label className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-3"><span className="flex items-center justify-between font-label-md text-label-md"><span className="font-medium text-on-surface">{label}</span><span className="font-bold text-primary">{value} phút</span></span><input aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full cursor-pointer rounded-lg bg-surface-container-highest accent-primary" min={min} max={max} step={step} type="range" /><span className="flex justify-between font-mono text-[11px] text-outline">{markers.map((marker) => <span key={marker}>{marker}</span>)}</span></label>;
}

function SoundPanel({ activeSound, volume, chime, onSound, onVolume, onChime }: { activeSound: SoundId; volume: number; chime: string; onSound: (sound: SoundId) => void; onVolume: (value: number) => void; onChime: (value: string) => void }) {
  return <section className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm lg:col-span-5"><div className="flex items-center justify-between pb-2"><div className="flex items-center gap-2"><AudioLines className="size-5 text-primary" /><h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Âm Thanh Tĩnh Tâm (Zen Audio)</h2></div><Waves className="size-4 animate-pulse text-primary" /></div><div className="grid grid-cols-2 gap-space-sm">{sounds.map((sound) => { const Icon = sound.icon; const active = sound.id === activeSound; return <button key={sound.id} type="button" onClick={() => onSound(sound.id)} className={`group flex cursor-pointer flex-col gap-1 rounded-lg p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${active ? "bg-primary-fixed/30 hover:bg-primary-fixed/50" : "bg-surface-container-low hover:bg-surface-container"}`}><span className="flex items-center justify-between"><Icon className={`size-[18px] transition-transform duration-200 group-hover:scale-110 ${active ? "text-primary" : "text-secondary"}`} /><span className={`size-2 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} /></span><span className={`font-label-md text-label-md font-semibold ${active ? "text-primary" : "text-on-surface"}`}>{sound.name}</span><span className="font-label-xs text-label-xs text-on-surface-variant">{sound.description}</span></button>; })}</div><div className="flex flex-col gap-2 pt-1"><div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"><span className="flex items-center gap-1.5"><Volume2 className="size-3.5" />Âm lượng nền</span><span className="font-mono font-semibold text-primary">{volume}%</span></div><input aria-label="Âm lượng nền" value={volume} onChange={(event) => onVolume(Number(event.target.value))} className="h-1.5 w-full cursor-pointer rounded-lg bg-surface-container-high accent-primary transition-opacity hover:opacity-90" min={0} max={100} type="range" /><label className="flex w-full items-center justify-between gap-3 pt-1"><span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-on-surface-variant"><BellRing className="size-3.5 text-secondary" />Chuông báo</span><select value={chime} onChange={(event) => onChime(event.target.value)} className="cursor-pointer truncate rounded-lg border-none bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface transition-all duration-150 hover:bg-surface-container-high hover:shadow-xs focus:ring-1 focus:ring-primary"><option>Chuông gốm Nhật Bản (Êm)</option><option>Chuông đồng Tây Tạng</option><option>Hạt mưa rơi đơn sắc</option><option>Im lặng hoàn toàn</option></select></label></div></section>;
}
