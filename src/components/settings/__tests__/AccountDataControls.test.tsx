import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountDataControls from '../AccountDataControls';
import { deleteAccountData, exportAccountData } from '@/lib/account-data';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

jest.mock('@/lib/account-data', () => ({
  deleteAccountData: jest.fn(), exportAccountData: jest.fn(), downloadAccountExport: jest.fn(),
}));
jest.mock('@/lib/insforge', () => ({ createInsforgeClient: () => ({}) }));

it('exige la palabra exacta, muestra el hueco de auth y permite reintentar un fallo', async () => {
  jest.mocked(deleteAccountData).mockRejectedValue(new Error('Borrado parcial: storage no disponible'));
  render(<AccountDataControls />);
  expect(screen.getByText(/No se elimina tu identidad de acceso/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Borrar mis datos' }));
  const button = screen.getByRole('button', { name: 'Borrar datos y cerrar sesión' });
  expect(button).toBeDisabled();
  const input = screen.getByLabelText('Escribe ELIMINAR para confirmar');
  fireEvent.change(input, { target: { value: 'eliminar' } });
  expect(button).toBeDisabled();
  fireEvent.change(input, { target: { value: 'ELIMINAR' } });
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('El borrado puede ser parcial'));
  expect(button).toBeEnabled();
});

it('informa de un fallo de exportación y conserva los enlaces legales', async () => {
  jest.mocked(exportAccountData).mockRejectedValue(new Error('No se pudo exportar. No se ha descargado un archivo parcial.'));
  render(<AccountDataControls />);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo exportar. No se ha descargado un archivo parcial.'));
  expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/es/privacidad');
  expect(screen.getByRole('link', { name: 'Aviso legal' })).toHaveAttribute('href', '/es/aviso-legal');
});


it('acepta DELETE en inglés y adapta la confirmación al contrato interno', async () => {
  jest.mocked(deleteAccountData).mockRejectedValue(new Error('retry'));
  render(
    <LocaleProvider locale="en">
      <AccountDataControls />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
  const input = screen.getByLabelText('Type DELETE to confirm');
  fireEvent.change(input, { target: { value: 'DELETE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete data and sign out' }));
  await waitFor(() => expect(deleteAccountData).toHaveBeenCalledWith({}, 'ELIMINAR'));
});
