import { fireEvent, render, screen } from '@testing-library/react';
import Navbar from '../Navbar';
import { HomeIcon, MapPinIcon } from '@heroicons/react/24/outline';
const mockUser = { full_name: 'Test', avatar_url: '' };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, signOut: jest.fn() }) }));
jest.mock('next/navigation', () => ({ usePathname: () => '/trips/fixture' }));
jest.mock('@/components/notifications/NotificationSystem', () => ({ __esModule: true, default: () => null }));
const navigation = [{ name: 'Dashboard', href: '/dashboard', icon: HomeIcon }, { name: 'Viajes', href: '/trips', icon: MapPinIcon }];
beforeEach(() => { mockUser.avatar_url = ''; });
it('no solicita avatares externos heredados y muestra los de storage', () => {
  mockUser.avatar_url = 'https://tracker.example/pixel.png';
  const { rerender } = render(<Navbar navigation={navigation} />);
  expect(screen.queryByRole('img', { name: 'Test' })).not.toBeInTheDocument();
  mockUser.avatar_url = 'https://insforge-storage.s3.us-east-2.amazonaws.com/avatar.png';
  rerender(<Navbar navigation={navigation} />);
  expect(screen.getByRole('img', { name: 'Test' })).toHaveAttribute('src', mockUser.avatar_url);
});
it('marca el destino actual tambien en movil y devuelve el foco al cerrar con Escape', () => {
  render(<Navbar navigation={navigation} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
  expect(screen.getAllByRole('link', { name: 'Viajes' })).toHaveLength(2);
  screen.getAllByRole('link', { name: 'Viajes' }).forEach(link => expect(link).toHaveAttribute('aria-current', 'page'));
  fireEvent.keyDown(screen.getAllByRole('link', { name: 'Viajes' })[1], { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  expect(screen.getAllByRole('link', { name: 'Viajes' })).toHaveLength(1);
});
