/** @type {import('next').NextConfig} */
const nextConfig = {
  // La burbuja de desarrollo no debe tapar controles durante los E2E.
  devIndicators: process.env.E2E_DISABLE_DEV_INDICATORS === "1" ? false : undefined,
  // Configuración para Turbopack (silencia advertencia de conflicto con webpack)
  turbopack: {},

  // Configuración experimental para mejorar rendimiento
  experimental: {
    // Mejorar el tree shaking
    optimizePackageImports: ["@heroicons/react", "date-fns", "recharts"],
  },

  // Configuración de compilación
  compiler: {
    // Remover console.log en producción
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Configuración de imágenes
  images: {
    // Formatos optimizados
    formats: ["image/webp", "image/avif"],
    // Tamaños de imagen responsivos
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Dominios permitidos para imágenes externas
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "via.placeholder.com" },
    ],
  },

  // Configuración de headers para optimización
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      {
        source: "/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Configuración de webpack para optimizaciones adicionales
  webpack: (config, { dev, isServer }) => {
    // Optimizaciones para producción
    if (!dev && !isServer) {
      // Configurar code splitting más agresivo
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: -10,
            chunks: "all",
          },
          heroicons: {
            test: /[\\/]node_modules[\\/]@heroicons[\\/]/,
            name: "heroicons",
            priority: 10,
            chunks: "all",
          },
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: "recharts",
            priority: 10,
            chunks: "all",
          },
        },
      };
    }

    return config;
  },

  // Configuración de compresión
  compress: true,

  // Configuración de PWA (opcional)
  // Descomenta si quieres habilitar PWA
  /*
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/_next/static/sw.js',
      },
    ]
  },
  */

  // Configuración de redirects para SEO
  async redirects() {
    return [
      // Redirect principal eliminado para permitir Landing Page
      // Redirects de rutas legacy de autenticación
      {
        source: "/auth/login",
        destination: "/signin",
        permanent: true,
      },
      {
        source: "/auth/register",
        destination: "/signup",
        permanent: true,
      },
      {
        source: "/auth/reset-password",
        destination: "/reset-password",
        permanent: true,
      },
      {
        source: "/auth/forgot-password",
        destination: "/forgot-password",
        permanent: true,
      },
      {
        source: "/login",
        destination: "/signin",
        permanent: true,
      },
    ];
  },

  // Configuración de variables de entorno públicas
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Configuración de análisis de bundle (desarrollo)
  ...(process.env.ANALYZE === "true" && {
    webpack: (config) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "server",
          analyzerPort: 8888,
          openAnalyzer: true,
        }),
      );
      return config;
    },
  }),
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");

initOpenNextCloudflareForDev();

module.exports = nextConfig;
