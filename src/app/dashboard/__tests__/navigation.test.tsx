import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { useAuth } from '@/contexts/AuthContext';
import { createInsforgeClient } from '@/lib/insforge';

// Mocks
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/components/notifications/NotificationSystem', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));
// jsPDF es ESM puro y no se puede cargar bajo Jest; el menu de exportacion no se
// ejercita en este test, asi que basta con aislar el modulo.
jest.mock('jspdf', () => ({ __esModule: true, default: jest.fn() }));

type QueryResult = { data?: unknown; error?: unknown };

interface DbChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  gte: jest.Mock;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// Cadena encadenable y "awaitable": cualquier terminal (order, gte) resuelve el
// resultado de su tabla. El panel lee las tres tablas del SDK, no del BFF.
function makeChain(result: QueryResult): DbChain {
  const chain = {} as DbChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}

const trip = {
  id: 'trip-1',
  user_id: 'user-123',
  title: 'Escapada a Roma',
  origin: 'Madrid',
  destination: 'Roma',
  departure_date: '2026-05-01',
  return_date: '2026-05-07',
  status: 'confirmed',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const expense = {
  id: 'expense-1',
  user_id: 'user-123',
  trip_id: 'trip-1',
  title: 'Cena',
  amount: 42,
  currency: 'USD',
  category: 'food',
  date: '2026-05-02',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const budget = {
  id: 'budget-1',
  name: 'Presupuesto Roma',
  total_amount: 1500,
  spent_amount: 420,
  currency: 'USD',
  category: 'travel',
};

const mockedClient = createInsforgeClient as jest.Mock;

describe('DashboardPage Navigation', () => {
  const mockUser = { id: 'user-123', full_name: 'Test User' };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    const tripsChain = makeChain({ data: [trip], error: null });
    const expensesChain = makeChain({ data: [expense], error: null });
    const budgetsChain = makeChain({ data: [budget], error: null });
    const from = jest.fn((table: string) => {
      if (table === 'trips') return tripsChain;
      if (table === 'expenses') return expensesChain;
      return budgetsChain;
    });
    mockedClient.mockReturnValue({ database: { from } });
  });

  it('renders dashboard content after loading', async () => {
    render(<DashboardPage />);

    // Should show welcome message eventually
    await screen.findByText(/Bienvenido, Test/);
  });

  it('enlaza al listado y al detalle del viaje desde el resumen', async () => {
    render(<DashboardPage />);

    await screen.findByText(/Bienvenido, Test/);

    expect(screen.getByRole('link', { name: 'Ver todos' })).toHaveAttribute(
      'href',
      '/trips',
    );
    expect(
      screen.getByRole('link', { name: /Escapada a Roma/ }),
    ).toHaveAttribute('href', '/trips/trip-1');
  });
});
