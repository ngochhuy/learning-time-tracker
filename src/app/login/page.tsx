import { BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { isGoogleAuthConfigured } from "@/lib/auth";

export default function LoginPage() {
  return <main className="login-page"><div className="login-card"><Link className="wordmark" href="/"><span className="wordmark__mark"><BookOpenCheck size={20} /></span><span>NHỊP HỌC</span></Link><div className="login-copy"><p className="eyebrow eyebrow--mint">CHÀO MỪNG TRỞ LẠI</p><h1>Giữ nhịp học<br /><em>theo cách của bạn.</em></h1><p>Đăng nhập để lưu phiên học, danh mục và tiến độ của riêng bạn.</p></div><GoogleSignInButton available={isGoogleAuthConfigured} /></div></main>;
}
