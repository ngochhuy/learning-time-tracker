"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ProtectedRouteError({ error, retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Protected route render error", { digest: error.digest });
  }, [error]);

  return <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-10 font-[family-name:var(--font-inter)] text-[#1b2e21]">
    <section role="alert" className="w-full max-w-lg rounded-2xl border border-[#d2ddd0] bg-white p-6 shadow-sm sm:p-8 dark:border-[#3d503f] dark:bg-[#1b251d] dark:text-[#e7f0e7]">
      <span className="grid size-11 place-items-center rounded-xl bg-[#ebd9c8] text-[#73563d] dark:bg-[#463a2d] dark:text-[#e7c59e]"><AlertTriangle size={21} /></span>
      <p className="mt-5 text-[11px] font-bold tracking-[.14em] text-[#54735c] dark:text-[#b6c6b8]">ĐÃ CÓ LỖI TẠM THỜI</p>
      <h1 className="mt-2 font-[family-name:var(--font-geist)] text-2xl font-bold tracking-[-.04em] sm:text-3xl">Không thể tải trang này.</h1>
      <p className="mt-2 text-sm leading-6 text-[#54735c] dark:text-[#b6c6b8]">Thông tin học của bạn không bị thay đổi. Hãy thử tải lại nội dung hoặc quay về Timer.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#2e5339] px-4 text-sm font-semibold text-white transition hover:bg-[#385a3e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#54735c]"><RefreshCw size={15} />Thử lại</button>
        <Link href="/" className="inline-flex min-h-10 items-center rounded-lg border border-[#d2ddd0] bg-[#f0f4ed] px-4 text-sm font-semibold text-[#2e5339] transition hover:bg-[#e6ece2] dark:border-[#3d503f] dark:bg-[#162019] dark:text-[#d7e4d6]">Về Timer</Link>
      </div>
    </section>
  </main>;
}
