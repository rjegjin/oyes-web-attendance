import type { Metadata } from "next";
import { Black_Han_Sans, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-main",
  subsets: ["latin"],
});

const blackHanSans = Black_Han_Sans({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OYES Attendance",
  description: "오예스 아침 운동 체크인/체크아웃 운영 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${blackHanSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
