import type { ReactNode } from "react";
import Link from "next/link";
import { Brain, ChartNoAxesCombined, Hourglass, Leaf, PictureInPicture2, Sprout } from "lucide-react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { isGoogleAuthConfigured } from "@/lib/auth";

const studioImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuD2H_en-W8rMsTmYuUzBy1PCXQWOoCpodP0gvlGttkMgi9AkkIy8oFAr2LB3_LHtcNQFoyh6ubg091I-93MSUVep1Z4Y5T0e4-KU1_Ojz4IAvrBThjp4O-J41Z-ZBRSM8XiOIa-ZUQUHfR2Xy-lGeray8izjTkj2ltSOXF_K_T_3wtjdKSUEtUVhz7hsueBEBF1ATfsnMjCJ_yFIAnQCAOwmKiuckdITYty73bpX3Rc";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#eaffeb] font-[family-name:var(--font-inter)] text-[#02210e] selection:bg-[#c2eac5] selection:text-[#486b4d]" style={{ background: "radial-gradient(circle at 50% 15%, #fafbf9 0%, #f3f7f2 60%, #ebf2ea 100%)" }}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-40"><div className="size-[48rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(197, 224, 201, .45) 0%, rgba(220, 238, 222, .1) 70%, transparent 100%)" }} /></div>

      <header className="relative z-10 flex w-full items-center justify-between px-5 py-6 sm:px-12 md:px-16">
        <Link href="/" className="group flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[#2e5339] focus-visible:ring-offset-4">
          <span className="grid size-9 place-items-center rounded-lg bg-[#163c24] text-white shadow-[0_2px_8px_-2px_rgba(39,70,48,.08)]"><Leaf size={20} /></span>
          <span className="font-[family-name:var(--font-geist)] text-xl font-medium tracking-tight text-[#163c24]">ForcusLearn</span>
        </Link>
        <p className="hidden items-center gap-2 text-xs font-medium tracking-[.02em] text-[#424842] sm:flex"><span className="size-2 rounded-full bg-[#aad0ad]" />Không gian học tập tĩnh tại</p>
      </header>

      <section className="relative z-10 flex flex-1 items-center px-5 py-10 sm:px-6 md:px-12" aria-labelledby="login-heading">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-12">
          <section className="flex flex-col space-y-4 lg:col-span-6">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[.15em] text-[#163c24]"><Sprout size={16} /><span>Tĩnh tại trong từng khoảnh khắc</span></p>
            <h1 id="login-heading" className="max-w-xl font-[family-name:var(--font-geist)] text-[clamp(2.5rem,6vw,3.5rem)] font-semibold leading-[1.14] tracking-[-.03em] text-[#163c24]">Chào mừng bạn đến với <span className="text-[#2e5339]">ForcusLearn</span></h1>
            <p className="max-w-lg text-lg leading-7 tracking-[-.005em] text-[#424842]">Không gian theo dõi thời gian học tập sâu, tĩnh tại và bền bỉ. Thiết kế sắc màu mầm lá Matcha giúp đôi mắt thư thái trên từng chặng đường tri thức dài.</p>

            <div className="mt-2 flex max-w-md items-center justify-between rounded-xl border border-[#2e5339]/10 bg-white p-4 shadow-[0_12px_36px_-8px_rgba(22,60,36,.08),0_2px_8px_-2px_rgba(22,60,36,.04)]">
              <div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-lg bg-[#d2f7d8] text-[#163c24]"><Hourglass size={26} /></span><div><p className="font-[family-name:var(--font-geist)] text-xl font-medium tracking-tight text-[#163c24]">4.820.000+</p><p className="text-xs tracking-[.02em] text-[#424842]">Giờ học tập chánh niệm đã lưu giữ</p></div></div>
              <ProgressRing />
            </div>

            <figure className="relative mt-1 h-32 max-w-md overflow-hidden rounded-xl shadow-sm">
              {/* The supplied Stitch image is an intentionally decorative, non-data-bearing accent. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="size-full object-cover" src={studioImage} alt="Bàn học tối giản, trà matcha và ánh sáng buổi sáng" />
              <figcaption className="absolute inset-0 flex items-end bg-gradient-to-t from-[#163c24]/80 via-[#163c24]/30 to-transparent p-4 text-xs font-medium tracking-wide text-white">“Học tập là một nghệ thuật dưỡng tâm.”</figcaption>
            </figure>
          </section>

          <section className="flex flex-col items-center lg:col-span-6" aria-label="Đăng nhập Google">
            <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#2e5339]/10 bg-white p-7 shadow-[0_12px_36px_-8px_rgba(22,60,36,.08),0_2px_8px_-2px_rgba(22,60,36,.04)] sm:p-10">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#c5ecc8] via-[#163c24] to-[#2e5339]" />
              <div className="mb-10 flex flex-col items-center text-center"><span className="mb-4 grid size-16 place-items-center rounded-xl bg-[#d2f7d8] text-[#163c24] shadow-sm"><Leaf size={34} /></span><h2 className="font-[family-name:var(--font-geist)] text-2xl font-medium tracking-[-.015em] text-[#163c24]">Khởi đầu phiên học</h2><p className="mt-1 text-sm leading-5 text-[#424842]">Đồng bộ dữ liệu thời gian tức thì với tài khoản cá nhân</p></div>

              <GoogleSignInButton available={isGoogleAuthConfigured} />

              <div className="my-6 h-px bg-[#d2f7d8]" />
              <div className="space-y-2">
                <LoginBenefit icon={<Brain size={16} />} title="Không gian Zen tĩnh lặng" description="Tối ưu chống mỏi thị giác cho buổi học dài" />
                <LoginBenefit icon={<PictureInPicture2 size={16} />} title="Đồng hồ thông minh Pomodoro & PiP" description="Nổi linh hoạt trên mọi tài liệu nghiên cứu" />
                <LoginBenefit icon={<ChartNoAxesCombined size={16} />} title="Tích lũy & phân tích tiến độ" description="Thống kê chiều sâu theo môn học và dự án" />
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-xl px-5 pb-8 text-center sm:px-6" aria-label="Thông điệp ForcusLearn">
        <p className="text-base italic tracking-wide text-[#446649]">“Mỗi phút giây hiện diện là một bước tiến trên hành trình tri thức.”</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs tracking-[.02em] text-[#424842]"><span>Phiên bản học viên cá nhân</span><i className="size-1 rounded-full bg-[#c1c8c0]" /><span>Google OAuth bảo mật</span><i className="size-1 rounded-full bg-[#c1c8c0]" /><span>Không lưu mật khẩu</span></div>
      </section>

      <footer className="relative z-10 flex w-full flex-col items-center justify-between gap-4 px-5 py-6 text-xs tracking-[.02em] text-[#424842] sm:flex-row sm:px-12 md:px-16"><p>© ForcusLearn. Crafted for mindful cognitive flow.</p><div className="flex items-center gap-6"><span>Chính sách riêng tư</span><span>Điều khoản sử dụng</span><span>Hướng dẫn Zen</span></div></footer>
    </main>
  );
}

function ProgressRing() {
  return <svg className="size-10 text-[#a7d1af]" viewBox="0 0 36 36" aria-label="82% tiến trình minh họa"><path className="text-[#c7eccd]" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="currentColor" strokeWidth="3" /><path className="text-[#163c24]" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="currentColor" strokeDasharray="82, 100" strokeLinecap="round" strokeWidth="3" /></svg>;
}

function LoginBenefit({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-[#d2f7d8]/60"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#c2eac5] text-[#163c24]">{icon}</span><div className="min-w-0"><p className="truncate text-sm font-medium tracking-[.01em] text-[#163c24]">{title}</p><p className="truncate text-xs tracking-[.02em] text-[#424842]">{description}</p></div></div>;
}
