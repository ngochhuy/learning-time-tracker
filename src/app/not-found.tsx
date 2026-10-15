import Link from "next/link";

export default function NotFound() {
  return <main className="system-page"><section className="system-card"><p className="eyebrow eyebrow--mint">404</p><h1>Không tìm thấy trang.</h1><p>Đường dẫn này không tồn tại hoặc đã được thay đổi.</p><Link className="button button--primary transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95" href="/">Về trang học</Link></section></main>;
}
