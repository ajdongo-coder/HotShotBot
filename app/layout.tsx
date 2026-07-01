import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOT Camera Simulator",
  description: "PS5 DualSense PTZ controller for Panasonic AW-UE70",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
