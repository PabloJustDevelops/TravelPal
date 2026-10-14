import { fireEvent, render, screen, within } from '@testing-library/react'
import Home from '@/app/page'
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
