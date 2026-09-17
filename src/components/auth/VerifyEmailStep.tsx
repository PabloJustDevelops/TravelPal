'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'

const CODE_LENGTH = 6
// El backend no manda otro correo hasta pasado este tiempo (min_interval_seconds),
// así que el botón de reenvío espera lo mismo en vez de comerse un error.
const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmailStep({ email }: { email: string }) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array<string>(CODE_LENGTH).fill(''),
  )
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const { verifyEmail, resendVerificationEmail } = useAuth()
  const router = useRouter()

  const code = digits.join('')
  const isComplete = code.length === CODE_LENGTH

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const focusInput = (index: number) => {
    const target = Math.max(0, Math.min(index, CODE_LENGTH - 1))
    inputsRef.current[target]?.focus()
  }

  // Escribe el valor a partir de `index`: una sola tecla deja un dígito y pegar
  // el código entero lo reparte por las casillas siguientes.
  const writeFrom = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev]
      if (value.length === 0) {
        next[index] = ''
        return next
      }
      for (
        let offset = 0;
        offset < value.length && index + offset < CODE_LENGTH;
        offset++
      ) {
        next[index + offset] = value[offset]
      }
      return next
    })
  }

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '')
    writeFrom(index, value.slice(0, CODE_LENGTH - index))
    if (value) focusInput(index + value.length)
  }

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      writeFrom(index - 1, '')
      focusInput(index - 1)
    }
  }

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return
    event.preventDefault()
    writeFrom(index, pasted.slice(0, CODE_LENGTH - index))
    focusInput(index + pasted.length)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isComplete) {
      setError('Introduce los 6 dígitos del código')
      return
    }

    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      // Verificar deja la sesión hecha (cookies httpOnly) y refresca el usuario.
      await verifyEmail(email, code)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el código')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setNotice('')
    setIsResending(true)
    try {
      await resendVerificationEmail(email)
      setNotice('Te hemos enviado un código nuevo.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el código')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Verifica tu email
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Hemos enviado un código de 6 dígitos a{' '}
          <span className="font-medium text-gray-900">{email}</span>. Escríbelo
          aquí para activar tu cuenta.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-danger/10 p-4">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {notice && (
          <div className="rounded-md bg-surface p-4">
            <p className="text-sm text-ink">{notice}</p>
          </div>
        )}

        <div>
          <label
            htmlFor="verify-code-1"
            className="block text-sm font-medium text-gray-700"
          >
            Código de verificación
          </label>
          <div className="mt-2 flex justify-between gap-2">
            {digits.map((digit, index) => (
              <input
                key={index}
                id={`verify-code-${index + 1}`}
                ref={(element) => {
                  inputsRef.current[index] = element
                }}
                value={digit}
                onChange={(event) => handleChange(index, event)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={(event) => handlePaste(index, event)}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                aria-label={`Dígito ${index + 1} del código`}
                className={cn(
                  fieldClassName,
                  'text-center text-lg tracking-widest',
                )}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!isComplete}
            className="w-full"
          >
            Verificar cuenta
          </Button>

          <Button
            type="button"
            variant="outline"
            loading={isResending}
            disabled={cooldown > 0}
            onClick={handleResend}
            className="w-full"
          >
            {cooldown > 0
              ? `Reenviar código en ${cooldown} s`
              : 'Reenviar código'}
          </Button>
        </div>

        <p className="text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/signin"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
