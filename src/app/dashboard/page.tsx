import { BookOpenCheck, ChartNoAxesCombined, Target } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { DashboardSettings } from "@/components/dashboard-settings";
import { getCurrentUser } from "@/lib/current-user";
import { AppError } from "@/lib/errors";
import { getDashboardData } from "@/lib/dashboard-service";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  let user; try { user = await getCurrentUser(); } catch (error) { if (error instanceof AppError && error.code === "UNAUTHORIZED") redirect("/login"); throw error; }
  const data = await getDashboardData(user.id);
  const goalSeconds = data.dailyGoalMinutes * 60; const percent = Math.min(100, Math.round((data.todaySeconds / goalSeconds) * 100)); const remaining = Math.max(0, goalSeconds - data.todaySeconds);
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS !== "false";
  return <main className="app-page"><div className="app-shell"><header className="app-header"><Link className="wordmark" href="/"><span className="wordmark__mark"><BookOpenCheck size={20} /></span><span>NHỊP HỌC</span></Link><div className="header-actions"><Link className="header-link" href="/history">Lịch sử</Link><Link className="header-link" href="/categories">Danh mục</Link><AuthControls name={user.name} developmentBypass={developmentBypass} /></div></header><section className="dashboard-heading"><p className="eyebrow eyebrow--mint">TỔNG QUAN</p><h1>Tiến độ của <em>hôm nay.</em></h1><p>Múi giờ đang dùng: {data.timezone}</p></section><section className="metric-grid"><article className="metric-card metric-card--goal"><Target size={20} /><span>Hôm nay</span><strong>{formatDuration(data.todaySeconds)}</strong><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><small>{percent}% mục tiêu · {remaining ? `còn ${formatDuration(remaining)}` : "đã hoàn thành mục tiêu"}</small></article><article className="metric-card"><ChartNoAxesCombined size={20} /><span>Tuần này</span><strong>{formatDuration(data.weekSeconds)}</strong><small>Từ thứ Hai đến hiện tại</small></article><article className="metric-card"><Target size={20} /><span>Mục tiêu ngày</span><strong>{data.dailyGoalMinutes} phút</strong><small>Có thể thay đổi bên dưới</small></article></section><section className="dashboard-grid"><article className="dashboard-panel"><h2>Theo danh mục</h2>{data.categories.length === 0 ? <p className="muted">Hoàn thành phiên đầu tiên để xem phân bổ.</p> : <div className="breakdown">{data.categories.map((category) => <div key={category.id ?? "none"}><span>{category.name}</span><strong>{formatDuration(category.seconds)}</strong></div>)}</div>}</article><article className="dashboard-panel"><h2>5 phiên gần nhất</h2>{data.recent.length === 0 ? <p className="muted">Chưa có phiên hoàn thành.</p> : <div className="recent-list">{data.recent.map((item) => <div key={item.id}><span>{item.category?.name ?? "Chưa phân loại"}<small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(item.startedAt)}</small></span><strong>{formatDuration(item.durationSeconds ?? 0)}</strong></div>)}</div>}<Link className="text-link" href="/history">Xem toàn bộ lịch sử →</Link></article></section><section className="dashboard-panel settings-panel"><h2>Cài đặt mục tiêu</h2><DashboardSettings timezone={data.timezone} dailyGoalMinutes={data.dailyGoalMinutes} /></section></div></main>;
}
