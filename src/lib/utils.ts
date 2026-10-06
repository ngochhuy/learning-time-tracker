import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) return `${hours}g ${minutes.toString().padStart(2, "0")}p`;
  if (minutes > 0) return `${minutes}p ${seconds.toString().padStart(2, "0")}s`;
  return `${seconds}s`;
}
