import { fireEvent, render, screen } from '@testing-library/react';
import Navbar from '../Navbar';
import { HomeIcon, MapPinIcon } from '@heroicons/react/24/outline';
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { full_name: 'Test' }, signOut: jest.fn() }) }));
jest.mock('next/navigation', () => ({ usePathname: () => '/trips/fixture' }));
jest.mock('@/components/notifications/NotificationSystem', () => ({ __esModule: true, default: () => null }));
const navigation = [{ name: 'Dashboard', href: '/dashboard', icon: HomeIcon }, { name: 'Viajes', href: '/trips', icon: MapPinIcon }];
it('marca el destino actual tambien en movil y devuelve el foco al cerrar con Escape', () => {
  render(<Navbar navigation={navigation} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
  expect(screen.getAllByRole('link', { name: 'Viajes' })).toHaveLength(2);
  screen.getAllByRole('link', { name: 'Viajes' }).forEach(link => expect(link).toHaveAttribute('aria-current', 'page'));
  fireEvent.keyDown(screen.getAllByRole('link', { name: 'Viajes' })[1], { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  expect(screen.getAllByRole('link', { name: 'Viajes' })).toHaveLength(1);
});
