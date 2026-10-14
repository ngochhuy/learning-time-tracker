import { AppError } from "@/lib/errors";

export const MAX_SESSION_NOTE_LENGTH = 1000;

export function normalizeSessionNote(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new AppError("INVALID_SESSION_NOTE");
  const note = value.trim();
  if (note.length > MAX_SESSION_NOTE_LENGTH) throw new AppError("INVALID_SESSION_NOTE");
  return note || null;
}
