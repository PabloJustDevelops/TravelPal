// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require('node:child_process')
let sentryRelease
try { sentryRelease = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { /* No git metadata: no release. */ }
if (/^[a-f0-9]{40,64}$/.test(process.env.GITHUB_SHA || '')) sentryRelease = process.env.GITHUB_SHA

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  productionBrowserSourceMaps: process.env.CI === "true" && Boolean(process.env.SENTRY_AUTH_TOKEN),
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
    // El export estático no dispone del optimizador de imágenes del servidor.
    unoptimized: true,
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

  // Configuración de variables de entorno públicas
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease,
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

module.exports = nextConfig;
