import { BookOpenCheck, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { TimerConsole, type TimerSnapshot } from "@/components/timer-console";
import { getCurrentUser } from "@/lib/current-user";
import { getActiveSession } from "@/lib/timer-service";
import { getCategories } from "@/lib/category-service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

function serializeSession(session: Awaited<ReturnType<typeof getActiveSession>>): TimerSnapshot | null {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    intervals: session.intervals.map((interval) => ({
      startedAt: interval.startedAt.toISOString(),
      endedAt: interval.endedAt?.toISOString() ?? null,
    })),
    category: session.category,
  };
}

export default async function Home() {
  let session: TimerSnapshot | null = null;
  let categories: Array<{ id: string; name: string }> = [];
  let databaseUnavailable = false;
  let user;

  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login");
    throw error;
  }
  try {
    [session, categories] = await Promise.all([
      getActiveSession(user.id).then(serializeSession),
      getCategories(user.id).then((items) => items.map(({ id, name }) => ({ id, name }))),
    ]);
  } catch {
    databaseUnavailable = true;
  }
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";

  return (
    <main className="focus-page">
      <div className="focus-shell">
        <header className="app-header">
          <Link className="wordmark" href="/" aria-label="Nhịp Học, trang chủ"><span className="wordmark__mark"><BookOpenCheck size={20} /></span><span>NHỊP HỌC</span></Link>
          <div className="header-actions"><Link className="header-link" href="/dashboard">Tổng quan</Link><Link className="header-link" href="/history">Lịch sử</Link><Link className="header-link" href="/categories">Danh mục</Link><AuthControls name={user.name} developmentBypass={developmentBypass} /></div>
        </header>
        <div className="focus-grid">
          <div className="intro-column">
            <p className="eyebrow eyebrow--mint">THEO DÕI THỜI GIAN THỰC</p>
            <h1>Ít chuẩn bị.<br /><em>Nhiều học hơn.</em></h1>
            <p className="intro-copy">Một phiên học bắt đầu chỉ bằng một lần chạm. Tạm dừng khi cần, quay lại khi sẵn sàng — thời gian thực của bạn luôn được giữ đúng.</p>
            <div className="trust-list" aria-label="Điểm mạnh của timer">
              <div><Clock3 size={18} /><span>Ghi nhận theo từng khoảng tập trung</span></div>
              <div><ShieldCheck size={18} /><span>Không mất phiên khi tải lại trang</span></div>
              <div><Sparkles size={18} /><span>Không cần chọn danh mục trước</span></div>
            </div>
          </div>
          <TimerConsole session={session} categories={categories} databaseUnavailable={databaseUnavailable} />
        </div>
      </div>
    </main>
  );
}
