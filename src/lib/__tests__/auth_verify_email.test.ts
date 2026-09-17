import { authService } from '../auth';
import {
  resendVerificationEmailAction,
  signUpAction,
  verifyEmailAction,
} from '../insforge/auth-actions';

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

describe('AuthService verificacion por codigo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('propaga requireEmailVerification del alta en vez de descartarlo', async () => {
    (signUpAction as jest.Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'ana@example.com' },
      requireEmailVerification: true,
    });

    const result = await authService.signUp(
      'ana@example.com',
      'Password1',
      'Ana',
    );

    expect(signUpAction).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'Password1',
      name: 'Ana',
    });
    expect(result.requireEmailVerification).toBe(true);
  });

  it('mantiene el flag en false cuando el backend no pide verificacion', async () => {
    (signUpAction as jest.Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'ana@example.com' },
      requireEmailVerification: false,
    });

    const result = await authService.signUp(
      'ana@example.com',
      'Password1',
      'Ana',
    );

    expect(result.requireEmailVerification).toBe(false);
  });

  it('verifyEmail delega en la server action con email y otp', async () => {
    const user = { id: 'user-123', email: 'ana@example.com' };
    (verifyEmailAction as jest.Mock).mockResolvedValue({ user });

    const result = await authService.verifyEmail('ana@example.com', '123456');

    expect(verifyEmailAction).toHaveBeenCalledWith({
      email: 'ana@example.com',
      otp: '123456',
    });
    expect(result).toEqual({ user });
  });

  it('no se traga el error del codigo invalido', async () => {
    const error = Object.assign(new Error('Invalid or expired verification code'), {
      statusCode: 400,
    });
    (verifyEmailAction as jest.Mock).mockRejectedValue(error);

    await expect(
      authService.verifyEmail('ana@example.com', '000000'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('resendVerificationEmail delega en la server action con el email', async () => {
    (resendVerificationEmailAction as jest.Mock).mockResolvedValue(undefined);

    await authService.resendVerificationEmail('ana@example.com');

    expect(resendVerificationEmailAction).toHaveBeenCalledWith({
      email: 'ana@example.com',
    });
  });
});
