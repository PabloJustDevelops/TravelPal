import { render, screen } from '@testing-library/react';
import NextTrip, { selectNextTrip } from '../NextTrip';
import type { Trip } from '@/lib/insforge';

const trip = (id: string, departure: string, status: Trip['status'] = 'planned', end?: string): Trip => ({ id, title: id, destination: 'Lisboa', departure_date: departure, return_date: end, status, user_id: 'fixture', origin: 'Madrid', created_at: '', updated_at: '' });

describe('proximo viaje', () => {
  it('prioriza el viaje en curso, excluye cancelados/completados y no reordena la entrada', () => {
    const trips = [trip('futuro', '2026-10-18'), trip('cancelado', '2026-10-10', 'cancelled'), trip('en curso', '2026-10-09', 'confirmed', '2026-10-12'), trip('completado', '2026-10-10', 'completed')];
    expect(selectNextTrip(trips, '2026-10-10')?.id).toBe('en curso');
    expect(trips[0].id).toBe('futuro');
  });
  it('elige la salida mas cercana y no devuelve viajes terminados', () => {
    expect(selectNextTrip([trip('tarde', '2026-10-20'), trip('antes', '2026-10-18'), trip('pasado', '2026-10-08')], '2026-10-10')?.id).toBe('antes');
  });
  it('interpreta timestamps ISO en el día local al seleccionar y mostrar fechas', () => {
    const departure = new Date(2026, 9, 10, 1, 30).toISOString();
    const trips = [trip('salida-hoy', departure)];
    const { getByText } = render(<NextTrip trips={trips} today="2026-10-10" />);

    expect(selectNextTrip(trips, '2026-10-10')?.id).toBe('salida-hoy');
    expect(getByText(/10 de octubre de 2026 a las 1:30/)).toBeInTheDocument();
  });
  it('prioriza el viaje en curso y conserva el día de fechas sin hora', () => {
    const trips = [
      trip('futuro', '2026-10-10T22:00:00.000Z'),
      trip('en curso', '2026-10-09T21:30:00.000Z', 'confirmed', '2026-10-11T00:30:00.000Z'),
    ];
    const { getByText, rerender } = render(<NextTrip trips={[trip('date-only', '2026-10-10')]} today="2026-10-10" />);

    expect(selectNextTrip(trips, '2026-10-10')?.id).toBe('en curso');
    expect(getByText('10 de octubre de 2026')).toBeInTheDocument();
    rerender(<NextTrip trips={trips} today="2026-10-10" />);
    expect(getByText('Tu viaje en curso')).toBeInTheDocument();
  });
  it('enlaza al detalle real y ofrece crear cuando no hay viaje', () => {
    const { rerender } = render(<NextTrip trips={[trip('viaje-1', '2026-10-18')]} today="2026-10-10" />);
    expect(screen.getByRole('link', { name: /Continuar planificación/ })).toHaveAttribute('href', '/trip?id=viaje-1');
    rerender(<NextTrip trips={[]} today="2026-10-10" />);
    expect(screen.getByRole('link', { name: /Organizar un viaje/ })).toHaveAttribute('href', '/trips');
  });

  it('muestra el itinerario y las tareas reales sin atribuirlas al viaje, y solo su presupuesto vinculado', () => {
    const currentTrip = trip('viaje-1', '2026-10-18');
    render(
      <NextTrip
        trips={[currentTrip]}
        today="2026-10-10"
        activities={[
          {
            id: 'activity-1', trip_id: 'viaje-1',
            title: 'Paseo por Alfama', date: '2026-10-19', start_time: '10:00',
            completed: false,
          },
          {
            id: 'activity-other', trip_id: 'otro-viaje',
            title: 'Actividad de otro viaje', date: '2026-10-19',
            completed: false,
          },
        ]}
        tasks={[
          {
            id: 'task-1', title: 'Preparar documentos',
            status: 'pending', due_date: '2026-10-16',
          },
        ]}
        budgets={[
          {
            id: 'budget-eur', trip_id: 'viaje-1', name: 'Alojamiento', category: 'hotel',
            total_amount: 900, spent_amount: 420, currency: 'EUR',
            start_date: '2026-10-18', end_date: '2026-10-20',
          },
          {
            id: 'budget-usd', trip_id: 'viaje-1', name: 'Transporte', category: 'transport',
            total_amount: 250, spent_amount: 80, currency: 'USD',
            start_date: '2026-10-18', end_date: '2026-10-20',
          },
          {
            id: 'budget-other', trip_id: 'otro-viaje', name: 'Presupuesto de otro viaje', category: 'travel',
            total_amount: 100, spent_amount: 10, currency: 'USD',
            start_date: '2026-10-18', end_date: '2026-10-20',
          },
        ]}
        expenses={[
          { id: 'expense-1', trip_id: 'viaje-1', date: '2026-10-19', amount: 100, currency: 'EUR', category: 'hotel' },
          { id: 'expense-2', trip_id: 'viaje-1', date: '2026-10-20', amount: 10, currency: 'EUR', category: 'hotel' },
          { id: 'expense-out-of-period', trip_id: 'viaje-1', date: '2026-10-21', amount: 700, currency: 'EUR', category: 'hotel' },
          { id: 'expense-wrong-category', trip_id: 'viaje-1', date: '2026-10-19', amount: 800, currency: 'EUR', category: 'food' },
          { id: 'expense-wrong-currency', trip_id: 'viaje-1', date: '2026-10-19', amount: 600, currency: 'USD', category: 'hotel' },
          { id: 'expense-wrong-trip', trip_id: 'otro-viaje', date: '2026-10-19', amount: 500, currency: 'EUR', category: 'hotel' },
          { id: 'expense-usd', trip_id: 'viaje-1', date: '2026-10-19', amount: 35, currency: 'USD', category: 'transport' },
        ]}
      />,
    );

    expect(screen.getByText('Paseo por Alfama')).toBeInTheDocument();
    expect(screen.queryByText('Actividad de otro viaje')).not.toBeInTheDocument();
    expect(screen.getByText('Preparar documentos')).toBeInTheDocument();
    expect(screen.getByText(/Pendiente · Vence/)).toBeInTheDocument();
    expect(screen.getByText('Alojamiento')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
    expect(screen.queryByText('Presupuesto de otro viaje')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Uso del presupuesto Alojamiento' })).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByRole('progressbar', { name: 'Uso del presupuesto Transporte' })).toHaveAttribute('aria-valuenow', '14');
    expect(screen.getByRole('link', { name: 'Ver tareas' })).toHaveAttribute('href', '/tasks');
  });

  it('no atribuye actividades ni presupuestos si no hay un viaje próximo', () => {
    render(<NextTrip trips={[]} today="2026-10-10" tasks={[]} budgets={[]} activities={[]} />);

    expect(screen.getByText('Tu itinerario aparecerá cuando tengas un viaje próximo.')).toBeInTheDocument();
    expect(screen.getByText('Vincula un presupuesto a un viaje próximo para verlo aquí.')).toBeInTheDocument();
    expect(screen.getByText('No tienes tareas pendientes.')).toBeInTheDocument();
  });
});
