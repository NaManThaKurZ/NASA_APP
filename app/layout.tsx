import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Space Agents — Mission Control",
  description: "Multi-agent pipeline over NASA EONET data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0e14]">{children}</body>
    </html>
  );
}
