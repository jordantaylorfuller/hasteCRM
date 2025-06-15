import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '@/lib/auth-context';
import RegisterPage from './page';

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

describe('Register Page', () => {
  const mockRegister = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      register: mockRegister,
    });
  });

  it('renders registration form correctly', () => {
    render(<RegisterPage />);

    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByText('sign in to your existing account')).toBeInTheDocument();
    expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
  });

  it('displays validation errors for empty form submission', async () => {
    render(<RegisterPage />);

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument();
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      expect(screen.getByText('Workspace name is required')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('displays validation error for invalid email', async () => {
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText('Email address');
    
    // Mock the HTMLInputElement validity to bypass HTML5 validation
    Object.defineProperty(emailInput, 'validity', {
      get: () => ({ valid: true }),
      configurable: true
    });
    
    await user.type(emailInput, 'invalid-email');

    const form = emailInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('displays validation error for short password', async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByLabelText('Password');
    await user.type(passwordInput, 'short');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('displays validation error for password mismatch', async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm password');

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'differentpassword');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    render(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Workspace name'), 'My Company');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workspaceName: 'My Company',
        password: 'password123',
      });
    });
  });

  it('displays loading state during form submission', async () => {
    mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Workspace name'), 'My Company');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('displays error message on registration failure', async () => {
    const errorMessage = 'Email already exists';
    mockRegister.mockRejectedValue(errorMessage);

    render(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Workspace name'), 'My Company');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('clears error message on new submission', async () => {
    const errorMessage = 'Email already exists';
    mockRegister
      .mockRejectedValueOnce(errorMessage)
      .mockResolvedValueOnce(undefined);

    render(<RegisterPage />);

    // Fill form
    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Workspace name'), 'My Company');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');

    // First submission - error
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Second submission - success
    await user.clear(screen.getByLabelText('Email address'));
    await user.type(screen.getByLabelText('Email address'), 'newemail@example.com');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });
  });

  it('links to login page correctly', () => {
    render(<RegisterPage />);

    const loginLink = screen.getByText('sign in to your existing account');
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('has correct Google OAuth link', () => {
    render(<RegisterPage />);

    const googleLink = screen.getByText('Sign up with Google').closest('a');
    expect(googleLink).toHaveAttribute('href', 'http://localhost:4000/auth/google');
  });

  it('has placeholder text for workspace name', () => {
    render(<RegisterPage />);

    const workspaceInput = screen.getByLabelText('Workspace name');
    expect(workspaceInput).toHaveAttribute('placeholder', 'My Company');
  });

  it('does not include confirmPassword in register call', async () => {
    render(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Email address'), 'john@example.com');
    await user.type(screen.getByLabelText('Workspace name'), 'My Company');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workspaceName: 'My Company',
        password: 'password123',
      });
      // Ensure confirmPassword is not included
      const callArg = mockRegister.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('confirmPassword');
    });
  });
});