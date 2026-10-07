import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
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
    <html lang="vi" className={`${inter.variable} ${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
