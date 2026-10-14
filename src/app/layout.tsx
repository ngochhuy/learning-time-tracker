import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ForcusLearn",
    template: "%s · ForcusLearn",
  },
  description: "Theo dõi thời gian học thực tế, rõ ràng và không gián đoạn.",
  icons: {
    icon: [{ url: "/favicon.svg?v=matcha-leaf", type: "image/svg+xml", sizes: "any" }],
    shortcut: ["/favicon.svg?v=matcha-leaf"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try { const savedTheme = localStorage.getItem("focuslearn-theme"); const useDark = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.classList.toggle("dark", useDark); document.documentElement.style.colorScheme = useDark ? "dark" : "light"; } catch {}` }} />
      </head>
      <body className="min-h-full flex flex-col"><ThemeToggle />{children}</body>
    </html>
  );
}
