import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaskModal } from '../TaskModal'

it('permite localizar todos los campos por su etiqueta visible', () => {
  render(<TaskModal isOpen onClose={jest.fn()} onSave={jest.fn()} />)
  for (const label of ['Título', 'Descripción', 'Estado', 'Prioridad', 'Fecha Límite']) {
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  }
})

it('asocia el error obligatorio al título y no guarda una tarea vacía', async () => {
  const onSave = jest.fn()
  render(<TaskModal isOpen onClose={jest.fn()} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(screen.getByLabelText('Título')).toHaveAccessibleDescription('El título es obligatorio'))
  expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true')
  expect(onSave).not.toHaveBeenCalled()
})
