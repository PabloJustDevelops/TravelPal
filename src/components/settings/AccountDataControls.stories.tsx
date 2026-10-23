import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import AccountDataControls from './AccountDataControls';

const meta = { title: 'Cuenta/Datos', component: AccountDataControls } satisfies Meta<typeof AccountDataControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Confirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Borrar mis datos' }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog');
    await expect(within(dialog).getByRole('button', { name: 'Borrar datos y cerrar sesión' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR');
    await expect(within(dialog).getByRole('button', { name: 'Borrar datos y cerrar sesión' })).toBeEnabled();
  },
};
