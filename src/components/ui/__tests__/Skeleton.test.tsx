import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonText, SkeletonCard, SKELETON_TEST_IDS } from '../Skeleton'

it('oculta las formas decorativas a tecnologías de asistencia y conserva las clases de tamaño', () => {
  render(<Skeleton className="h-12 w-24" />)
  expect(screen.getByTestId(SKELETON_TEST_IDS.block)).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByTestId(SKELETON_TEST_IDS.block)).toHaveClass('h-12', 'w-24')
})
it('reserva exactamente las líneas solicitadas', () => {
  render(<SkeletonText lines={4} />)
  expect(screen.getByTestId(SKELETON_TEST_IDS.text)).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getAllByTestId(SKELETON_TEST_IDS.block)).toHaveLength(4)
})
it('compone una tarjeta de papel con título y texto', () => {
  render(<SkeletonCard />)
  expect(screen.getByTestId(SKELETON_TEST_IDS.card)).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByTestId(SKELETON_TEST_IDS.text)).toBeInTheDocument()
})
