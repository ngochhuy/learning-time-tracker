import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["Arial", "sans-serif"],
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Nhịp Học",
    template: "%s · Nhịp Học",
  },
  description: "Theo dõi thời gian học thực tế, rõ ràng và không gián đoạn.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} ${playfairDisplay.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
