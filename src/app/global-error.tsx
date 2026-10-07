"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="vi"><body style={{ margin: 0, background: "#06101d", color: "#edf8f5", fontFamily: "system-ui, sans-serif" }}><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}><section style={{ maxWidth: "32rem", padding: "2rem", border: "1px solid #31504f", borderRadius: "1rem" }}><h1>Không thể mở ứng dụng</h1><p>Vui lòng thử lại. Dữ liệu của bạn không bị thay đổi.</p><button onClick={retry}>Thử lại</button></section></main></body></html>;
}
