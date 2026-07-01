import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME
  }
};

const themeInitScript = `(function(){var root=document.documentElement;function apply(theme){var dark=theme==="dark";root.classList.toggle("dark",dark);root.classList.toggle("light",!dark);root.dataset.theme=dark?"dark":"light";root.dataset.themeReady="true";root.style.colorScheme=dark?"dark":"light";}try{root.classList.add("no-theme-transition");var stored=null;try{stored=localStorage.getItem("pos-universal-theme");}catch(_){}var systemDark=false;try{systemDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(_){}var theme=stored==="dark"||stored==="light"?stored:systemDark?"dark":"light";apply(theme);var remove=function(){root.classList.remove("no-theme-transition");};if(window.requestAnimationFrame){window.requestAnimationFrame(function(){window.requestAnimationFrame(remove);});}else{window.setTimeout(remove,50);}}catch(_){apply("light");root.classList.remove("no-theme-transition");}})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="app-bg antialiased">
        {children}
      </body>
    </html>
  );
}
