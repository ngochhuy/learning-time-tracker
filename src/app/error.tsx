"use client";

import { useEffect } from "react";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error("Application render error", { digest: error.digest }); }, [error]);
  return <main className="system-page"><section className="system-card" role="alert"><p className="eyebrow eyebrow--mint">ĐÃ CÓ LỖI TẠM THỜI</p><h1>Không thể tải trang này.</h1><p>Thông tin học của bạn không bị thay đổi. Hãy thử tải lại dữ liệu.</p><button className="button button--primary transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer" onClick={retry}>Thử lại</button></section></main>;
}
