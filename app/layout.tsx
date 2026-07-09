import type { Metadata } from "next";
import { Cardo, Arimo } from "next/font/google";
import "./globals.css";

// Tipografías del sitio de la marca (jafcarniceria.com): Cardo para títulos, Arimo para texto.
const cardo = Cardo({
  variable: "--font-cardo",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JAF Central",
  description:
    "Plataforma de inteligencia de negocio para JAF Carnicería — Hermosillo, Sonora",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: el script de abajo marca data-theme antes de
    // hidratar y React no debe quejarse de ese atributo.
    <html
      lang="es"
      className={`${cardo.variable} ${arimo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Aplica el tema guardado antes del primer pintado para evitar parpadeo. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('jaf-tema')==='light')document.documentElement.dataset.theme='light'}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
