"use client";

import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton({ available }: { available: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function signIn() {
    if (!available || pending) return;
    setPending(true);
    setError(null);
    setNotice("Đang kết nối bảo mật tới Google…");
    const messageTimer = window.setTimeout(() => setNotice("Đang chuyển tiếp an toàn tới cổng đăng nhập Google…"), 850);
    const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    window.clearTimeout(messageTimer);
    if (result.error) {
      setError("Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.");
      setNotice(null);
      setPending(false);
    }
  }

  return <div className="flex w-full flex-col items-center gap-4">
    <button type="button" onClick={signIn} disabled={!available || pending} className="group relative flex w-full items-center justify-center gap-4 rounded-lg border border-[#2e5339]/15 bg-white px-6 py-3.5 text-[#163c24] shadow-[0_2px_6px_rgba(22,60,36,.04)] transition-all duration-200 hover:bg-[#d2f7d8] hover:shadow-md active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e5339] focus-visible:ring-offset-2">
      <GoogleMark /><span className="font-[family-name:var(--font-geist)] text-base font-medium tracking-tight">{pending ? "Đang chuyển hướng…" : "Tiếp tục bằng tài khoản Google"}</span><ArrowRight size={18} className="text-[#446649] transition-transform duration-200 group-hover:translate-x-0.5" />
    </button>
    {notice && <p className="w-full rounded-lg bg-[#d2f7d8] px-3 py-2 text-center text-sm text-[#163c24]" role="status">{notice}</p>}
    {!available && <p className="w-full rounded-lg border border-[#d7b56d]/40 bg-[#fff8df] px-3 py-2 text-center text-xs leading-5 text-[#725719]">Google OAuth chưa được cấu hình. Thêm <code>GOOGLE_CLIENT_ID</code> và <code>GOOGLE_CLIENT_SECRET</code> vào môi trường.</p>}
    {error && <p className="w-full rounded-lg border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-center text-sm text-[#93000a]" role="alert">{error}</p>}
    <div className="flex w-full items-start gap-2 rounded-lg border border-[#2e5339]/10 bg-[#f1f6f0] p-4 text-[#424842]"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#163c24]" /><p className="text-sm leading-6"><strong className="font-medium text-[#163c24]">Đăng nhập một chạm an toàn.</strong> Lịch sử học tập, phiên tập trung và tiến độ được đồng bộ riêng cho tài khoản của bạn.</p></div>
  </div>;
}

function GoogleMark() {
  return <svg className="size-5 shrink-0 transition-transform duration-200 group-hover:scale-105" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09A6.94 6.94 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" /></svg>;
}
