"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { AppError, toActionError, type ActionResult } from "@/lib/errors";

function isValidTimezone(timezone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export async function initializeTimezone(timezone: string): Promise<ActionResult> {
  try {
    const parsed = z.string().min(1).max(100).parse(timezone);
    if (!isValidTimezone(parsed)) throw new AppError("INVALID_TIMEZONE");
    const user = await getCurrentUser();
    const existing = await db.userSettings.findUnique({
      where: { userId: user.id },
      select: { timezoneInitialized: true },
    });
    if (existing?.timezoneInitialized) return { ok: true, data: undefined };
    await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, timezone: parsed, timezoneInitialized: true },
      update: { timezone: parsed, timezoneInitialized: true },
    });
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateSettings(timezone: string, dailyGoalMinutes: number): Promise<ActionResult> {
  try {
    const parsedTimezone = z.string().min(1).max(100).parse(timezone);
    const goal = z.number().int().min(1).max(1440).parse(dailyGoalMinutes);
    if (!isValidTimezone(parsedTimezone)) throw new AppError("INVALID_TIMEZONE");
    const user = await getCurrentUser();
    await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, timezone: parsedTimezone, timezoneInitialized: true, dailyGoalMinutes: goal },
      update: { timezone: parsedTimezone, timezoneInitialized: true, dailyGoalMinutes: goal },
    });
    revalidatePath("/");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
