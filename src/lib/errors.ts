import { logger } from "@/lib/logger";

export const errorMessages = {
  ACTIVE_SESSION_EXISTS: "Bạn đang có một phiên học khác.",
  SESSION_NOT_FOUND: "Không tìm thấy phiên học.",
  INVALID_SESSION_STATE: "Trạng thái phiên học không còn phù hợp.",
  CATEGORY_NOT_FOUND: "Không tìm thấy danh mục.",
  DUPLICATE_CATEGORY: "Danh mục này đã tồn tại.",
  INVALID_CATEGORY_NAME: "Tên danh mục cần có từ 1 đến 50 ký tự.",
  INVALID_TIME_RANGE: "Khoảng thời gian không hợp lệ.",
  SESSION_TIME_CONFLICT: "Khoảng thời gian trùng với một phiên học khác.",
  INVALID_TIMEZONE: "Múi giờ không hợp lệ.",
  UNAUTHORIZED: "Bạn cần đăng nhập để tiếp tục.",
  TRANSACTION_CONFLICT: "Dữ liệu vừa thay đổi. Vui lòng thử lại.",
  UNKNOWN: "Đã có lỗi xảy ra. Vui lòng thử lại.",
} as const;

export type AppErrorCode = keyof typeof errorMessages;

export class AppError extends Error {
  constructor(public readonly code: AppErrorCode) {
    super(errorMessages[code]);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string };

export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message };
  }
  logger.error("application_action_error", { error });
  return { ok: false, code: "UNKNOWN", message: errorMessages.UNKNOWN };
}
