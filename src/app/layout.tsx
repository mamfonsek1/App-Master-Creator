import type { Metadata, Viewport } from "next";
import { EB_Garamond, Inter } from "next/font/google";

import "./globals.css";

const serif = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aula · Refuerzo Master Creador Lans",
  description:
    "Entorno local de curso y reproducción: temario completo, progreso y vídeos en 1080p.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${serif.variable} ${sans.variable}`}
      data-scroll-behavior="smooth"
      // El script de tema modifica `data-theme` antes de hidratar.
      suppressHydrationWarning
    >
      <body>
        <script
          // Aplica el tema guardado antes de pintar para evitar el destello.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aula-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
