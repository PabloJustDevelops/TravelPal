import { act, renderHook } from '@testing-library/react'
import { useDelayedLoading } from '../useDelayedLoading'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
it('no muestra formas si la consulta termina antes de 120 ms', () => {
  const { result, rerender } = renderHook(({ pending }) => useDelayedLoading(pending), { initialProps: { pending: true } })
  act(() => jest.advanceTimersByTime(119))
  expect(result.current).toBe(false)
  rerender({ pending: false })
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current).toBe(false)
})
it('muestra a los 120 ms, desaparece al resolver y reinicia el umbral al recargar', () => {
  const { result, rerender } = renderHook(({ pending }) => useDelayedLoading(pending), { initialProps: { pending: true } })
  act(() => jest.advanceTimersByTime(120))
  expect(result.current).toBe(true)
  rerender({ pending: false })
  expect(result.current).toBe(false)
  rerender({ pending: true })
  expect(result.current).toBe(false)
  act(() => jest.advanceTimersByTime(120))
  expect(result.current).toBe(true)
})
it('cancela el temporizador al desmontar', () => {
  const { unmount } = renderHook(() => useDelayedLoading(true))
  unmount()
  expect(jest.getTimerCount()).toBe(0)
})
