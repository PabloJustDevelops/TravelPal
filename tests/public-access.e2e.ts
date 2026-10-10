import { test } from '@e2e-dev/web'
import { expect } from 'e2e'

test('una ruta privada sin sesion lleva al acceso con un formulario utilizable', async ({ app, browser, screen }) => {
  await app.open('/dashboard')
  await expect(browser).toHaveURL(/\/signin/)
  await expect(screen.getByRole('heading', 'Inicia sesión en tu cuenta')).toBeVisible()
  await expect(screen.getByLabel('Email')).toBeVisible()
  await expect(screen.getByRole('button', 'Iniciar sesión')).toBeVisible()
})

test('el acceso ofrece registro y recuperacion de contraseña', async ({ app, screen }) => {
  await app.open('/signin')
  await expect(screen.getByRole('link', 'crea una nueva cuenta')).toBeVisible()
  await expect(screen.getByRole('link', '¿Olvidaste tu contraseña?')).toBeVisible()
  await expect(screen.getByRole('button', 'Continuar con Google')).toBeVisible()
})

test('la recuperacion pide email y permite volver al acceso', async ({ app, screen }) => {
  await app.open('/forgot-password')
  await expect(screen.getByLabel('Correo electrónico')).toBeVisible()
  await expect(screen.getByRole('button', /enviar/i)).toBeVisible()
  await expect(screen.getByRole('link', /sesión/i)).toBeVisible()
})
