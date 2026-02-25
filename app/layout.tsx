import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SettingsModal } from "@/components/settings/settings-modal";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-kr"
});

export const metadata: Metadata = {
  title: "성과/역량평가 AI 작성 도우미",
  description: "연말 평가 초안 작성을 도와주는 사내 AI 서비스"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} font-sans antialiased`}>
        <ThemeToggle />
        <SettingsModal />
        {children}
      </body>
    </html>
  );
}
