import React from 'react';
import { render, screen } from '@testing-library/react';
import { useAuth } from '@/lib/auth-context';
import DashboardPage from './page';

// Mock dependencies
jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('Dashboard Page', () => {
  const mockUser = {
    id: '1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'ACTIVE',
    twoFactorEnabled: false,
  };

  const mockUserPending = {
    ...mockUser,
    status: 'PENDING',
  };

  const mockUserWith2FA = {
    ...mockUser,
    twoFactorEnabled: true,
  };

  const mockWorkspace = {
    id: '1',
    name: 'My Company',
    plan: 'PRO',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when user is not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      workspace: mockWorkspace,
    });

    const { container } = render(<DashboardPage />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when workspace is not available', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: null,
    });

    const { container } = render(<DashboardPage />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dashboard with user and workspace information', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    // Welcome message
    expect(screen.getByText('Welcome to My Company!')).toBeInTheDocument();

    // Account information section
    expect(screen.getByText('Account Information')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    // Workspace information section
    expect(screen.getByText('Workspace Information')).toBeInTheDocument();
    expect(screen.getByText('Workspace Name')).toBeInTheDocument();
    expect(screen.getByText('My Company')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
  });

  it('shows active status with correct styling', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    const statusBadge = screen.getByText('ACTIVE');
    expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('shows pending status with correct styling', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUserPending,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    const statusBadge = screen.getByText('PENDING');
    expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('shows email verification warning for pending users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUserPending,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    expect(screen.getByText('Email verification required')).toBeInTheDocument();
    expect(screen.getByText('Please check your email and verify your account to access all features.')).toBeInTheDocument();
  });

  it('does not show email verification warning for active users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    expect(screen.queryByText('Email verification required')).not.toBeInTheDocument();
  });

  it('shows two-factor authentication as enabled', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUserWith2FA,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    const twoFactorStatus = screen.getByText('Enabled');
    expect(twoFactorStatus).toHaveClass('text-green-600');
  });

  it('shows two-factor authentication as disabled', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    const twoFactorStatus = screen.getByText('Disabled');
    expect(twoFactorStatus).toHaveClass('text-gray-500');
  });

  it('renders plan badge with correct styling', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    const planBadge = screen.getByText('PRO');
    expect(planBadge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('renders with correct layout structure', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    // Check main container exists
    const mainContainer = screen.getByText('Welcome to My Company!').closest('.max-w-7xl');
    expect(mainContainer).toBeInTheDocument();

    // Check grid layout for information sections
    const gridContainer = screen.getByText('Account Information').closest('.grid');
    expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2');
  });

  it('renders warning icon in email verification alert', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUserPending,
      workspace: mockWorkspace,
    });

    render(<DashboardPage />);

    // Check SVG warning icon exists
    const warningSection = screen.getByText('Email verification required').closest('.bg-yellow-50');
    const svgIcon = warningSection?.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon).toHaveClass('text-yellow-400');
  });
});