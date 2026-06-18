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
        <Script
          id="theme-init"
          src="/theme.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-gray-100 text-gray-950 antialiased dark:bg-neutral-950 dark:text-gray-50">
        {children}
      </body>
    </html>
  );
}
