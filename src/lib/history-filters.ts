import { DateTime } from "luxon";
import type { HistoryFilters } from "@/lib/history-service";

export type HistoryQuery = { category?: string; from?: string; to?: string; page?: string; pageSize?: string; q?: string };

export function parseHistoryFilters(params: HistoryQuery, timezone: string): HistoryFilters {
  const from = params.from ? DateTime.fromISO(params.from, { zone: timezone }).startOf("day") : null;
  const to = params.to ? DateTime.fromISO(params.to, { zone: timezone }).endOf("day") : null;
  const page = Number(params.page);
  const pageSize = Number(params.pageSize);
  return {
    categoryId: params.category && params.category !== "uncategorized" ? params.category : undefined,
    uncategorized: params.category === "uncategorized",
    from: from?.isValid ? from.toUTC().toJSDate() : undefined,
    to: to?.isValid ? to.toUTC().toJSDate() : undefined,
    query: params.q?.trim().slice(0, 80) || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
  };
}
