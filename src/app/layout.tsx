import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-main",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OYES Attendance Local MVP",
  description: "오예스 아침 운동 체크인/체크아웃 웹 시스템 로컬 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body>{children}</body>
    </html>
  );
}
