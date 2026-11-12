import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { BOOT_SCRIPT } from "@/lib/boot";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "GLASS: menilai kerusakan bencana dari satelit dan drone",
  description:
    "Prototipe GLASS (Geo-Actuarial Autonomous Loss Assessment System): skor kerusakan SDSI dari satelit dan drone (RGB, LiDAR, termal), cadangan klaim, dan pembayaran hibrida. Studi kasus Palu 2018 dengan data contoh. Tersedia dalam bahasa Indonesia dan Inggris.",
  icons: {
    icon: [{ url: "/brand/icon-64.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/brand/icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1826" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* tema & bahasa dipasang sebelum halaman tergambar, supaya tidak berkedip */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
