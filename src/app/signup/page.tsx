import { Suspense } from 'react'
import RegisterForm from '@/components/auth/RegisterForm'
import Image from 'next/image'

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex bg-white">
      {/* Sección Izquierda - Imagen (Visible en desktop) */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 h-full w-full bg-gray-900">
          <Image
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
            alt="Fondo de viajes y aventura"
            fill
            className="object-cover opacity-80"
            priority
            sizes="50vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex flex-col justify-end p-12">
          <blockquote className="space-y-2">
            <p className="text-lg font-medium text-white">
              &ldquo;No he estado en todas partes, pero están en mi lista.&rdquo;
            </p>
            <footer className="text-sm text-gray-300">Susan Sontag</footer>
          </blockquote>
        </div>
      </div>

      {/* Sección Derecha - Formulario */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Comienza tu aventura
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Únete hoy y empieza a planificar tu próximo viaje soñado.
            </p>
          </div>

          <Suspense fallback={<div className="flex justify-center p-4">Cargando formulario...</div>}>
            <RegisterForm />
          </Suspense>
          
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
             <p className="text-xs text-gray-500">
               © {new Date().getFullYear()} TravelPal. Todos los derechos reservados.
             </p>
          </div>
        </div>
      </div>
    </main>
  )
}
