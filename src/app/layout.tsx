import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const themeScript = `
  (function () {
    try {
      var storedTheme = localStorage.getItem("pos-universal-theme");
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;
      document.documentElement.classList.toggle("dark", shouldUseDark);
    } catch (_) {}
  })();
`;

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
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="bg-gray-100 text-gray-950 antialiased dark:bg-neutral-950 dark:text-gray-50">
        {children}
      </body>
    </html>
  );
}
