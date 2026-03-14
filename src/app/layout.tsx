import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UAE Radar Navigator",
  description: "GPS navigation with radar alerts for UAE roads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#111827" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
