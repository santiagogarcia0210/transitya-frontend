import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_URL || 'https://transitya-backend-production.up.railway.app';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Rutas Next.js (escanear, duplicado, etc.) tienen prioridad.
      // Todo /api/* que no matchee un route handler se proxea a Railway.
      fallback: [
        {
          source: '/api/:path*',
          destination: `${BACKEND}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
