import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Tabs } from "@/components/Tabs";
import { RegisterSW } from "@/components/RegisterSW";
import { WriteStatus } from "@/components/WriteStatus";

export const metadata: Metadata = {
  title: "Magyar",
  description: "Особистий тренажер угорської",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.json`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Magyar" },
};

export const viewport: Viewport = {
  themeColor: "#b5452c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <main className="wrap">{children}</main>
        <WriteStatus />
        <Tabs />
        <RegisterSW />
      </body>
    </html>
  );
}
