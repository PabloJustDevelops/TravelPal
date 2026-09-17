import { authService } from '../auth';
import { signInAction } from '../insforge/auth-actions';

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

describe('AuthService signIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve el usuario cuando el login va bien', async () => {
    (signInAction as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'user-123', email: 'ana@example.com' },
    });

    await expect(authService.signIn('ana@example.com', 'Password1')).resolves.toEqual({
      ok: true,
      user: { id: 'user-123', email: 'ana@example.com' },
    });
  });

  it('devuelve el codigo y el statusCode en vez de lanzar mensaje crudo', async () => {
    (signInAction as jest.Mock).mockResolvedValue({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    });

    await expect(authService.signIn('ana@example.com', 'Password1')).resolves.toEqual({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    });
  });
});
