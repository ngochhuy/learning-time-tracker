import { logger } from "@/lib/logger";

export const errorMessages = {
  POMODORO_TASK_NOT_FOUND: "Không tìm thấy nhiệm vụ Pomodoro của bạn.",
  POMODORO_NOT_READY: "Phiên Pomodoro chưa đủ thời lượng để tính hoàn thành.",
  ACTIVE_SESSION_EXISTS: "Bạn đang có một phiên học khác.",
  INVALID_SESSION_KIND: "Phiên học thuộc chế độ khác. Hãy thao tác tại đúng trang.",
  SESSION_NOT_FOUND: "Không tìm thấy phiên học.",
  INVALID_SESSION_STATE: "Trạng thái phiên học không còn phù hợp.",
  CATEGORY_NOT_FOUND: "Không tìm thấy danh mục.",
  DUPLICATE_CATEGORY: "Danh mục này đã tồn tại.",
  INVALID_CATEGORY_NAME: "Tên danh mục cần có từ 1 đến 50 ký tự.",
  INVALID_TIME_RANGE: "Khoảng thời gian không hợp lệ.",
  SESSION_DURATION_CONFIRMATION_REQUIRED: "Phiên học vượt quá 24 giờ. Bạn có muốn vẫn lưu phiên này không?",
  INVALID_SESSION_NOTE: "Ghi chú không được vượt quá 1.000 ký tự.",
  SESSION_TIME_CONFLICT: "Khoảng thời gian trùng với một phiên học khác.",
  INVALID_TIMEZONE: "Múi giờ không hợp lệ.",
  UNAUTHORIZED: "Bạn cần đăng nhập để tiếp tục.",
  TRANSACTION_CONFLICT: "Dữ liệu vừa thay đổi. Vui lòng thử lại.",
  PRISMA_CLIENT_OUTDATED: "Ứng dụng cần cập nhật database và khởi động lại server trước khi tạo danh mục.",
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
  | { ok: false; code: AppErrorCode; message: string; diagnosticId?: string };

export function toActionError(error: unknown, diagnosticId?: string): ActionResult<never> {
  const diagnostic = diagnosticId ? { diagnosticId } : {};
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message, ...diagnostic };
  }
  logger.error("application_action_error", {
    error,
    ...diagnostic,
    ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { detail: error.message } : {}),
  });
  if (error instanceof Error && error.name === "PrismaClientValidationError") {
    return { ok: false, code: "PRISMA_CLIENT_OUTDATED", message: errorMessages.PRISMA_CLIENT_OUTDATED, ...diagnostic };
  }
  return { ok: false, code: "UNKNOWN", message: errorMessages.UNKNOWN, ...diagnostic };
}
