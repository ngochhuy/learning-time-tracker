"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type AuthControlsProps = { name: string; developmentBypass: boolean };

export function AuthControls({ name, developmentBypass }: AuthControlsProps) {
  const router = useRouter();
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="auth-controls">
      <span className="auth-controls__identity"><UserRound size={14} />{name}</span>
      {developmentBypass ? <span className="dev-badge">DEV</span> : <button className="sign-out" onClick={signOut}><LogOut size={14} />Đăng xuất</button>}
    </div>
  );
}
