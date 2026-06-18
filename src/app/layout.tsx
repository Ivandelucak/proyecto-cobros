import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const themeScript =
  '(function(){try{var e=document.documentElement;var t=localStorage.getItem("pos-universal-theme");var p=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=t?t==="dark":p;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";e.dataset.theme=d?"dark":"light";e.dataset.themeReady="true"}catch(_){document.documentElement.dataset.themeReady="true"}})();';

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
