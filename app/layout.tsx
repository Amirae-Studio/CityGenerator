import type { Metadata } from "next";
import { Cormorant_Garamond, Instrument_Sans, Space_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "City Generator — any place on Earth, ready to 3D print",
  description:
    "Pick any place on the map, choose filament colours and download a print-ready 3MF or STL city model.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${instrument.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          // Resolve theme before paint to avoid a flash of the wrong mode.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('fc-theme');if(!m){m=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',m);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
