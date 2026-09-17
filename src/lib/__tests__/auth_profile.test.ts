import { authService } from '../auth';
import { createInsforgeClient } from '../insforge';
import { getCurrentUserAction, updateProfileAction } from '../insforge/auth-actions';

jest.mock('../insforge', () => ({
  createInsforgeClient: jest.fn(),
}));

jest.mock('../insforge/auth-actions', () => ({
  getCurrentUserAction: jest.fn(),
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

describe('AuthService Profile Update', () => {
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

    // AuthService instancia el cliente en un property initializer; sustituimos
    // la instancia del singleton por el mock.
    (authService as unknown as { insforge: unknown }).insforge = mockClient;
  });

  test('should update profile successfully', async () => {
    (getCurrentUserAction as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });

    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { full_name: 'Old Name' }, error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    mockClient.database.from.mockReturnValue(builder);

    (updateProfileAction as jest.Mock).mockResolvedValue({ id: 'user-123' });

    await authService.updateProfile({ full_name: 'New Name' });

    expect(updateProfileAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Name', full_name: 'New Name' }),
    );
    expect(mockClient.database.from).toHaveBeenCalledWith('profiles');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-123', full_name: 'New Name' }),
    );
  });

  test('should handle timeout gracefully', async () => {
    (getCurrentUserAction as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });

    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: {}, error: null }),
      // Delay > 20s (timeout de updateProfile)
      upsert: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 21000))),
    };
    mockClient.database.from.mockReturnValue(builder);

    (updateProfileAction as jest.Mock).mockResolvedValue({});

    await expect(authService.updateProfile({ full_name: 'Timeout Name' })).rejects.toThrow(
      'Update profile timed out after 20s',
    );
  }, 25000);

  test('should fail if no user logged in', async () => {
    (getCurrentUserAction as jest.Mock).mockResolvedValue(null);

    await expect(authService.updateProfile({})).rejects.toThrow('No user logged in');
  });
});
