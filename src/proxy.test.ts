import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { updateSession } from '@insforge/sdk/ssr/middleware'

jest.mock('@insforge/sdk/ssr/middleware', () => ({
  updateSession: jest.fn(),
}))

const updateSessionMock = updateSession as jest.Mock

const protectedPaths = [
  '/dashboard',
  '/trips',
  '/trips/abc',
  '/tasks',
  '/tasks/abc',
  '/planning',
  '/expenses',
  '/expenses/new',
  '/alerts',
  '/notes',
  '/notes/abc',
  '/settings',
  '/profile',
]

async function runProxy(
  path: string,
  accessToken: string | null,
  search = '',
) {
  updateSessionMock.mockResolvedValue({ accessToken })
  const request = new NextRequest(
    new URL(`${path}${search}`, 'https://travelpal.test'),
  )
  return proxy(request)
}

function passesThrough(res: Response) {
  return res.headers.get('x-middleware-next') === '1'
}

function redirectTarget(res: Response) {
  const location = res.headers.get('location')
  return location ? new URL(location) : null
}

describe('proxy - protección de rutas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(protectedPaths)(
    'sin sesión redirige %s a /signin con redirectTo',
    async (path) => {
      const res = await runProxy(path, null)

      expect(res.status).toBe(307)
      const target = redirectTarget(res)
      expect(target?.pathname).toBe('/signin')
      expect(target?.searchParams.get('redirectTo')).toBe(path)
    },
  )

  it.each(protectedPaths)('con sesión deja pasar %s', async (path) => {
    const res = await runProxy(path, 'access-token')

    expect(passesThrough(res)).toBe(true)
  })

  it.each(['/', '/signin', '/signup', '/forgot-password', '/reset-password'])(
    'sin sesión deja pasar la ruta pública %s',
    async (path) => {
      const res = await runProxy(path, null)

      expect(passesThrough(res)).toBe(true)
    },
  )

  it('sin sesión deja pasar el callback del OAuth (llega con el código)', async () => {
    const res = await runProxy('/api/auth/callback', null, '?insforge_code=abc')

    expect(passesThrough(res)).toBe(true)
  })

  it('con sesión también deja pasar el callback del OAuth', async () => {
    const res = await runProxy('/api/auth/callback', 'access-token', '?insforge_code=abc')

    expect(passesThrough(res)).toBe(true)
  })

  it('con sesión redirige /signin a /dashboard', async () => {
    const res = await runProxy('/signin', 'access-token')

    expect(res.status).toBe(307)
    expect(redirectTarget(res)?.pathname).toBe('/dashboard')
  })

  it('con sesión respeta el redirectTo al volver de una ruta protegida', async () => {
    const res = await runProxy(
      '/signin',
      'access-token',
      '?redirectTo=%2Ftasks',
    )

    expect(res.status).toBe(307)
    expect(redirectTarget(res)?.pathname).toBe('/tasks')
  })

  it('con sesión ignora un redirectTo externo', async () => {
    const res = await runProxy(
      '/signin',
      'access-token',
      '?redirectTo=https%3A%2F%2Fevil.test',
    )

    expect(res.status).toBe(307)
    expect(redirectTarget(res)?.pathname).toBe('/dashboard')
  })
})
