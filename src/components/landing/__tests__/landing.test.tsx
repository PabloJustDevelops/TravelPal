import { act, fireEvent, render, screen, within } from '@testing-library/react'
import Home from '@/app/page'
import CurrentYear from '../CurrentYear'
import LandingMotion from '../LandingMotion'
import type { ImgHTMLAttributes } from 'react'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ preload, ...props }: ImgHTMLAttributes<HTMLImageElement> & { preload?: boolean }) => {
    void preload
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />
  },
}))

it('reproduce la portada seleccionada y conecta la acción con el registro', () => {
  render(<Home />)
  const brand = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
    name: 'TravelPal',
  })
  expect(brand).toHaveAttribute('href', '/')
  expect(brand.querySelector('[aria-hidden="true"]')).toHaveStyle({
    maskImage: 'url("/brand/travelpal-mark.svg")',
  })
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu viaje, de principio a fin.')
  expect(screen.getByRole('link', { name: 'Crear mi viaje' })).toHaveAttribute('href', '/signup')
  expect(screen.getByRole('link', { name: 'Ver un ejemplo' })).toHaveAttribute('href', '#example')
  for (const image of screen.getAllByRole('img')) expect(image.getAttribute('src')).not.toMatch(/^https?:/)
})

it('permite explorar las paradas de un viaje explícitamente de ejemplo', () => {
  render(<Home />)
  const example = screen.getByRole('region', { name: 'Viaje de ejemplo: Costa mediterránea' })
  fireEvent.click(within(example).getByRole('tab', { name: /Alojamiento/ }))
  expect(within(example).getByRole('tab', { name: /Alojamiento/ })).toHaveAttribute('aria-selected', 'true')
  expect(within(example).getByRole('tabpanel')).toHaveTextContent('La reserva, localizada')
})

it('abre y cierra el menú móvil al elegir una sección', () => {
  render(<Home />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Menú móvil' })).getByRole('link', { name: 'Cómo funciona' }))
  expect(screen.queryByRole('button', { name: 'Cerrar menú' })).not.toBeInTheDocument()
})

it('ofrece un footer global con navegación de producto y proyecto', () => {
  render(<Home />)
  const footer = screen.getByRole('contentinfo')
  expect(footer.closest('main')).toBeNull()
  expect(within(footer).getByRole('navigation', { name: 'Producto' })).toBeInTheDocument()
  expect(within(footer).getByRole('navigation', { name: 'Proyecto' })).toBeInTheDocument()
  expect(within(footer).getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/PabloJustDevelops/TravelPal')
  expect(within(footer).getByRole('link', { name: /Repositorio en GitHub/ })).toBeInTheDocument()
  expect(within(footer).getByRole('link', { name: /Licencia MIT/ })).toBeInTheDocument()
})

it('retira el placeholder al cargar o fallar una imagen sin cambiar sus dimensiones', () => {
  render(<Home />)
  const image = screen.getAllByRole('img')[1]
  const frame = image.parentElement!
  const ratio = frame.style.aspectRatio
  expect(ratio).not.toBe('')
  expect(image).toHaveAttribute('data-loading', 'true')
  fireEvent.load(image)
  expect(image).toHaveAttribute('data-loading', 'false')
  expect(frame.style.aspectRatio).toBe(ratio)
  fireEvent.error(image)
  expect(image).toHaveAttribute('data-loading', 'false')
  expect(image).toHaveAttribute('alt')
})


it('actualiza el año a medianoche sin reconstruir el export', () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date(2030, 11, 31, 23, 59, 58))
  const { unmount } = render(<CurrentYear />)
  expect(screen.getByText('2030')).toBeInTheDocument()
  act(() => { jest.advanceTimersByTime(2000) })
  expect(screen.getByText('2031')).toBeInTheDocument()
  unmount()
  jest.useRealTimers()
})

it('revela una sección al entrar y cancela el efecto al reducir movimiento', () => {
  const originalObserver = global.IntersectionObserver
  let callback: IntersectionObserverCallback
  let change: () => void = () => {}
  const preference = { matches: false, addEventListener: (_: string, handler: () => void) => { change = handler }, removeEventListener: () => {} }
  const originalMedia = window.matchMedia
  window.matchMedia = jest.fn(() => preference as unknown as MediaQueryList)
  const rect = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 1100 } as DOMRect)
  global.IntersectionObserver = class {
    constructor(handler: IntersectionObserverCallback) { callback = handler }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
  const { unmount } = render(<LandingMotion><section>Contenido inmediato</section></LandingMotion>)
  const section = screen.getByText('Contenido inmediato')
  expect(section).not.toHaveClass('reveal')
  act(() => callback([{ target: section, isIntersecting: true, time: 0, rootBounds: null, boundingClientRect: section.getBoundingClientRect(), intersectionRect: section.getBoundingClientRect(), intersectionRatio: 1 }], {} as IntersectionObserver))
  expect(section).toHaveClass('reveal')
  preference.matches = true
  act(() => change())
  expect(section).not.toHaveClass('reveal')
  expect(section).toBeVisible()
  unmount()
  window.matchMedia = originalMedia
  rect.mockRestore()
  global.IntersectionObserver = originalObserver
})

it('mantiene contenido visible cuando IntersectionObserver no está disponible', () => {
  const originalObserver = global.IntersectionObserver
  Reflect.deleteProperty(global, 'IntersectionObserver')
  const { unmount } = render(<LandingMotion><section>Sin observer</section></LandingMotion>)
  expect(screen.getByText('Sin observer')).toBeVisible()
  unmount()
  global.IntersectionObserver = originalObserver
})
