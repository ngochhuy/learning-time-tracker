import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { parseHistoryFilters } from "@/lib/history-filters";
import { getHistoryExport } from "@/lib/history-service";

export const dynamic = "force-dynamic";

function csvField(value: string | number | null) {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  let user;
  try { user = await getCurrentUser(); }
  catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "csv" && format !== "json") return new Response("Invalid format", { status: 400 });
  const settings = await db.userSettings.findUnique({ where: { userId: user.id }, select: { timezone: true } });
  const filters = parseHistoryFilters({
    category: url.searchParams.get("category") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  }, settings?.timezone ?? "Asia/Bangkok");
  const sessions = await getHistoryExport(user.id, filters);
  if (sessions.length > 20_000) return new Response("Too many sessions to export at once. Narrow the date range.", { status: 413 });
  const rows = sessions.map((session) => ({
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? "",
    durationSeconds: session.durationSeconds ?? 0,
    category: session.category?.name ?? "Chưa phân loại",
    note: session.note ?? "",
  }));
  const headers = { "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="focuslearn-history.${format}"` };
  if (format === "json") return Response.json(rows, { headers });
  const lines = ["startedAt,endedAt,durationSeconds,category,note", ...rows.map((row) => [row.startedAt, row.endedAt, row.durationSeconds, row.category, row.note].map(csvField).join(","))];
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
}
