import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hay un pnpm-lock.yaml suelto en el home del usuario y Turbopack infería esa
  // carpeta como raíz del workspace, lo que hacía flaky el watcher de CSS
  // (hojas viejas tras editar globals.css o clases nuevas). Raíz explícita:
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
