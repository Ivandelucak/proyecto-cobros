import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS Universal",
  description: "MVP local para comercios minoristas"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="app-bg antialiased">
        <Script id="theme-init" src="/theme.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
