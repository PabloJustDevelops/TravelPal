import { authService } from '../auth';
import { createInsforgeClient } from '../insforge';

jest.mock('../insforge', () => ({
  createInsforgeClient: jest.fn(),
}));

jest.mock('../insforge/auth-actions', () => ({
  signInAction: jest.fn(),
  signUpAction: jest.fn(),
  signOutAction: jest.fn(),
  sendResetPasswordEmailAction: jest.fn(),
  resetPasswordAction: jest.fn(),
  updateProfileAction: jest.fn(),
  verifyEmailAction: jest.fn(),
  resendVerificationEmailAction: jest.fn(),
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('AuthService Resilience', () => {
  let mockClient: {
    auth: { getCurrentUser: jest.Mock };
    database: { from: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      auth: { getCurrentUser: jest.fn() },
      database: { from: jest.fn() },
    };

    (createInsforgeClient as jest.Mock).mockReturnValue(mockClient);
    (authService as unknown as { insforge: unknown }).insforge = mockClient;
  });

  it('getCurrentUser should return basic user if DB fetch fails', async () => {
    mockClient.auth.getCurrentUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          profile: { name: 'Test' },
        },
      },
      error: null,
    });

    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
    };
    mockClient.database.from.mockReturnValue(builder);

    const user = await authService.getCurrentUser();

    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-123');
    expect(user?.email).toBe('test@example.com');
    // Sin fila en profiles, cae al nombre del perfil de auth
    expect(user?.full_name).toBe('Test');
  });

  it('getCurrentUser should return null if the auth call fails', async () => {
    mockClient.auth.getCurrentUser.mockRejectedValue(new Error('network down'));

    const user = await authService.getCurrentUser();

    expect(user).toBeNull();
  });
});
