"use client";

import { useState } from "react";
import { Globe2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton({ available }: { available: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    if (!available) return;
    setPending(true);
    setError(null);
    const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (result.error) {
      setError("Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.");
      setPending(false);
    }
  }

  return <>
    <button className="google-button" onClick={signIn} disabled={!available || pending}>
      <Globe2 size={18} />{pending ? "Đang chuyển hướng..." : "Tiếp tục với Google"}
    </button>
    {!available && <p className="login-note">Google OAuth chưa được cấu hình. Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET vào môi trường.</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
  </>;
}
