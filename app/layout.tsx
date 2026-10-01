import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { DESCRIPCION_SITIO, esProduccion, NOMBRE_SITIO, urlSitio } from "@/lib/sitio";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: urlSitio(),
  title: {
    default: `${NOMBRE_SITIO}: trámites de construcción en Perú, de SUNARP a la conformidad`,
    template: `%s · ${NOMBRE_SITIO}`,
  },
  description: DESCRIPCION_SITIO,
  applicationName: NOMBRE_SITIO,
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: NOMBRE_SITIO,
    title: "Todos tus expedientes de obra, de SUNARP a la conformidad, en un solo lugar",
    description: DESCRIPCION_SITIO,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  // Las vistas previas de Vercel no se indexan.
  robots: esProduccion() ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-PE"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#contenido"
          className="bg-background sr-only z-50 rounded-md border px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <div id="contenido" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
