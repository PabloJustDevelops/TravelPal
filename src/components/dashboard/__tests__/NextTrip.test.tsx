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
    expect(screen.getByRole('link', { name: /Continuar planificación/ })).toHaveAttribute('href', '/trips/viaje-1');
    rerender(<NextTrip trips={[]} today="2026-10-10" />);
    expect(screen.getByRole('link', { name: /Organizar un viaje/ })).toHaveAttribute('href', '/trips');
  });
});
