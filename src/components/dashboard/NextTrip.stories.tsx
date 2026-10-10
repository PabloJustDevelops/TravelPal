import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import NextTrip from './NextTrip';

const meta = { title: 'Viajes/Próximo viaje', component: NextTrip, args: { today: '2026-10-10', trips: [{ id: 'lisboa-demo', user_id: 'fixture', title: 'Lisboa, a tu ritmo', destination: 'Lisboa, Portugal', origin: 'Madrid', departure_date: '2026-10-18', return_date: '2026-10-23', status: 'planned', created_at: '', updated_at: '' }] } } satisfies Meta<typeof NextTrip>;
export default meta;
type Story = StoryObj<typeof meta>;
const plannedData = {
  trips: [{ id: 'lisboa-demo', user_id: 'fixture', title: 'Lisboa, a tu ritmo', destination: 'Lisboa, Portugal', origin: 'Madrid', departure_date: '2026-10-18', return_date: '2026-10-23', status: 'planned' as const, created_at: '', updated_at: '' }],
  activities: [
    { id: 'activity-1', user_id: 'fixture', trip_id: 'lisboa-demo', date: '2026-10-18', title: 'Llegada a Lisboa', description: 'Llegada y traslado al alojamiento.', start_time: '14:30', location: 'Aeropuerto Humberto Delgado', completed: false, order_index: 0, created_at: '', updated_at: '' },
    { id: 'activity-2', user_id: 'fixture', trip_id: 'lisboa-demo', date: '2026-10-19', title: 'Paseo por Alfama', description: 'Recorre sus calles históricas y miradores.', start_time: '10:00', location: 'Alfama', completed: false, order_index: 1, created_at: '', updated_at: '' },
  ],
  tasks: [
    { id: 'task-1', user_id: 'fixture', title: 'Preparar documentos', status: 'pending' as const, priority: 'high' as const, due_date: '2026-10-16', created_at: '', updated_at: '' },
    { id: 'task-2', user_id: 'fixture', title: 'Revisar el transporte', status: 'in_progress' as const, priority: 'medium' as const, created_at: '', updated_at: '' },
  ],
  budgets: [
    { id: 'budget-eur', trip_id: 'lisboa-demo', name: 'Viaje', category: 'travel', total_amount: 900, spent_amount: 420, currency: 'EUR', start_date: '2026-10-18', end_date: '2026-10-23' },
    { id: 'budget-usd', trip_id: 'lisboa-demo', name: 'Alojamiento', category: 'hotel', total_amount: 300, spent_amount: 125, currency: 'USD', start_date: '2026-10-18', end_date: '2026-10-23' },
  ],
  expenses: [
    { id: 'expense-1', trip_id: 'lisboa-demo', date: '2026-10-18', amount: 74, currency: 'EUR', category: 'transport' },
    { id: 'expense-2', trip_id: 'lisboa-demo', date: '2026-10-19', amount: 82, currency: 'EUR', category: 'food' },
    { id: 'expense-3', trip_id: 'lisboa-demo', date: '2026-10-20', amount: 120, currency: 'USD', category: 'hotel' },
  ],
};

export const Planned: Story = { args: { ...plannedData } };
export const Dark: Story = { args: { ...plannedData }, globals: { theme: 'dark' } };
export const Empty: Story = { args: { trips: [], activities: [], tasks: [], budgets: [] } };
export const Mobile390: Story = {
  args: { ...plannedData },
  parameters: {
    viewport: {
      options: {
        travelPal390: {
          name: 'TravelPal 390 × 844',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'travelPal390', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(window.innerWidth).toBe(390);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    for (const link of canvas.getAllByRole('link')) {
      const bounds = link.getBoundingClientRect();
      await expect(bounds.left).toBeGreaterThanOrEqual(0);
      await expect(bounds.right).toBeLessThanOrEqual(390);
    }
  },
};
