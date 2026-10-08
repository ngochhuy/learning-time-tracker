import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["Arial", "sans-serif"],
});

const geist = Geist({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-geist",
  fallback: ["Arial", "sans-serif"],
});

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
    <html lang="vi" className={`${inter.variable} ${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try { const savedTheme = localStorage.getItem("focuslearn-theme"); const useDark = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.classList.toggle("dark", useDark); document.documentElement.style.colorScheme = useDark ? "dark" : "light"; } catch {}` }} />
      </head>
      <body className="min-h-full flex flex-col"><ThemeToggle />{children}</body>
    </html>
  );
}
