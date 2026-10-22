import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import SentryInit from '@/components/common/SentryInit'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import MotionProvider from '@/components/common/MotionProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Una sola importacion de next/font para todo el contrato de tipografia: el texto va en Inter y
// los titulares en la serif del rumbo. La familia de titulares se expone como variable para que
// `font-serif` la resuelva desde globals.css, sin declarar un segundo import.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })

// El tema se aplica antes del primer pintado. Sin esto, quien tiene el modo oscuro guardado ve
// un parpadeo claro hasta que monta el proveedor de tema. Usa la misma clave y la misma
// semantica que ThemeContext.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

export const metadata: Metadata = {
  title: 'TravelPal | Tu compañero de viaje',
  description: 'Planifica itinerarios, tareas y gastos de viaje en un solo lugar.',
  keywords: 'viajes, gastos, planificación, presupuesto, itinerario',
  authors: [{ name: 'TravelPal' }],
  robots: 'index, follow',
}

// En Next.js App Router, `viewport` debe exportarse por separado y como objeto
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} ${fraunces.variable}`} suppressHydrationWarning>
        <SentryInit />
        <ErrorBoundary>
          <MotionProvider>
            <ToastProvider>
              <ThemeProvider>
                <AuthProvider>
                  {children}
                </AuthProvider>
              </ThemeProvider>
            </ToastProvider>
          </MotionProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
