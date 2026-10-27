import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItineraryPlanner, type PlannerActivity } from '../ItineraryPlanner'

const activity: PlannerActivity = {
  id: 'activity-1',
  title: 'Paseo por Lisboa',
  startTime: '09:15:00',
  endTime: '10:30:00',
  category: 'activity',
}

function renderPlanner(activities: PlannerActivity[]) {
  render(
    <ItineraryPlanner
      startDate="2026-10-18"
      endDate="2026-10-18"
      itinerary={[{ date: '2026-10-18', activities }]}
      onCreateActivity={jest.fn()}
      onUpdateActivity={jest.fn()}
      onDeleteActivity={jest.fn()}
    />,
  )
}

it.each([
  [0, '0 actividades'],
  [1, '1 actividad'],
  [2, '2 actividades'],
])('presenta correctamente el número de actividades: %i', (count, text) => {
  renderPlanner(Array.from({ length: count }, (_, index) => ({ ...activity, id: `activity-${index}` })))
  expect(screen.getByText(text)).toBeInTheDocument()
})

it('presenta las horas persistidas sin segundos', async () => {
  renderPlanner([activity])
  await userEvent.setup().click(screen.getByRole('button', { name: /Día 1/ }))
  expect(screen.getByText('09:15 - 10:30')).toBeInTheDocument()
  expect(screen.queryByText('09:15:00 - 10:30:00')).not.toBeInTheDocument()
})

it('permite reordenar sin arrastrar y desactiva los límites del día', async () => {
  const onMoveActivity = jest.fn().mockResolvedValue(undefined)
  render(<ItineraryPlanner startDate="2026-10-18" endDate="2026-10-18"
    itinerary={[{date:'2026-10-18', activities:[activity, {...activity,id:'second',title:'Comer'}]}]}
    onCreateActivity={jest.fn()} onUpdateActivity={jest.fn()} onDeleteActivity={jest.fn()} onMoveActivity={onMoveActivity} />)
  await userEvent.setup().click(screen.getByRole('button', {name:/Día 1/}))
  expect(screen.getByRole('button', {name:'Subir Paseo por Lisboa'})).toBeDisabled()
  await userEvent.setup().click(screen.getByRole('button', {name:'Bajar Paseo por Lisboa'}))
  expect(onMoveActivity).toHaveBeenCalledWith('activity-1', 1)
})

it('mantiene legible el itinerario de lectores y oculta sus acciones de escritura', async () => {
  render(<ItineraryPlanner startDate="2026-10-18" endDate="2026-10-18"
    itinerary={[{ date: '2026-10-18', activities: [activity] }]}
    onCreateActivity={jest.fn()} onUpdateActivity={jest.fn()} onDeleteActivity={jest.fn()} readOnly />)
  await userEvent.setup().click(screen.getByRole('button', { name: /Día 1/ }))
  expect(screen.getByRole('heading', { name: 'Paseo por Lisboa' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Editar Paseo por Lisboa' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Eliminar Paseo por Lisboa' })).not.toBeInTheDocument()
})
