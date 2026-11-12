import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GLASS: menilai kerusakan bencana dari satelit dan drone",
  description:
    "Prototipe GLASS (Geo-Actuarial Autonomous Loss Assessment System): skor kerusakan SDSI dari satelit dan drone (RGB, LiDAR, termal), cadangan klaim, dan pembayaran hibrida. Studi kasus Palu 2018 dengan data contoh.",
  icons: {
    icon: [{ url: "/brand/icon-64.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/brand/icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#13283f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
