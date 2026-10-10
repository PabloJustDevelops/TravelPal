import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import NextTrip from './NextTrip';

const meta = { title: 'Viajes/Próximo viaje', component: NextTrip, args: { today: '2026-10-10', trips: [{ id: 'lisboa-demo', user_id: 'fixture', title: 'Lisboa, a tu ritmo', destination: 'Lisboa, Portugal', origin: 'Madrid', departure_date: '2026-10-18', return_date: '2026-10-23', status: 'planned', created_at: '', updated_at: '' }] } } satisfies Meta<typeof NextTrip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Planned: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { trips: [] } };
