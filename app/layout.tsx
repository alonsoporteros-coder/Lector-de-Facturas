import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Factura Clara | Comprobantes a Excel",
  description: "Extrae, revisa y exporta facturas y boletas a Excel en hojas de Compras y Ventas.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body>{children}</body></html>;
}
