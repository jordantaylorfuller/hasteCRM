import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '@/lib/auth-context';
import LoginPage from './page';

// Mock dependencies
jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Login Page', () => {
  const mockLogin = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
    });
  });

  it('renders login form correctly', () => {
    render(<LoginPage />);

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('create a new account')).toBeInTheDocument();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('displays validation errors for empty form submission', async () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('displays validation error for invalid email', async () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    
    // Mock the HTMLInputElement validity to bypass HTML5 validation
    Object.defineProperty(emailInput, 'validity', {
      get: () => ({ valid: true }),
      configurable: true
    });
    
    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'validpassword123');

    const form = emailInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('displays validation error for short password', async () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'short');

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('displays loading state during form submission', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('displays error message on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValue(errorMessage);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('clears error message on new submission', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin
      .mockRejectedValueOnce(errorMessage)
      .mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    // First submission - error
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Second submission - success
    await user.clear(passwordInput);
    await user.type(passwordInput, 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });
  });

  it('links to register page correctly', () => {
    render(<LoginPage />);

    const registerLink = screen.getByText('create a new account');
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('links to forgot password page correctly', () => {
    render(<LoginPage />);

    const forgotPasswordLink = screen.getByText('Forgot your password?');
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('has correct Google OAuth link', () => {
    render(<LoginPage />);

    const googleLink = screen.getByText('Sign in with Google').closest('a');
    expect(googleLink).toHaveAttribute('href', 'http://localhost:4000/auth/google');
  });

  it('renders Google icon correctly', () => {
    render(<LoginPage />);

    // Check that the Google sign-in link contains an SVG
    const googleLink = screen.getByText('Sign in with Google').closest('a');
    const svgElement = googleLink?.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement?.tagName).toBe('svg');
  });
});