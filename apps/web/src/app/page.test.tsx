import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Home from './page';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('Home Page', () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('renders loading state correctly', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    render(<Home />);

    expect(screen.getByText('hasteCRM')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to dashboard when user is authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      loading: false,
    });

    render(<Home />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects to login when user is not authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    render(<Home />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('does not redirect while loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    render(<Home />);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('updates redirect when auth state changes', async () => {
    const { rerender } = render(<Home />);

    // Initial loading state
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });
    rerender(<Home />);
    expect(mockPush).not.toHaveBeenCalled();

    // User authenticated
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      loading: false,
    });
    rerender(<Home />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});