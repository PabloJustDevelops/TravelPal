import React, { Suspense } from 'react'
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm'
import Image from 'next/image'
import Link from 'next/link'

export default function ForgotPasswordPage(): React.JSX.Element {
  return (
    <main className="min-h-screen flex bg-white">
      {/* Sección Izquierda - Imagen (Visible en desktop) */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 h-full w-full bg-gray-900">
          <Image
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
            alt="Paisaje de montaña"
            fill
            className="object-cover opacity-80"
            priority
            sizes="50vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex flex-col justify-end p-12">
          <blockquote className="space-y-2">
            <p className="text-lg font-medium text-white">
              &ldquo;No todos los que deambulan están perdidos.&rdquo;
            </p>
            <footer className="text-sm text-gray-300">J.R.R. Tolkien</footer>
          </blockquote>
        </div>
      </div>

      {/* Sección Derecha - Formulario */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
              Recuperar contraseña
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              ¿Ya te acordaste?{' '}
              <Link href="/signin" className="font-medium text-blue-600 hover:text-blue-500">
                Inicia sesión
              </Link>
            </p>
          </div>

          <Suspense fallback={<div className="flex justify-center p-4">Cargando formulario...</div>}>
            <ForgotPasswordForm />
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
