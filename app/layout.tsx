import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QueenB 101 — האתר של הקבוצה שלנו",
  description: "המסע, המטרות, החידון והדמויות של קבוצת QueenB שלנו.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
