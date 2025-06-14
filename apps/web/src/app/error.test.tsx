import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorPage from './error';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

describe('Error Page', () => {
  const mockReset = jest.fn();
  const mockError = Object.assign(new Error('Test error message'), {
    digest: undefined as string | undefined,
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid polluting test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('should render error page with correct content', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.getByText('We encountered an unexpected error. Our team has been notified.')).toBeInTheDocument();
  });

  it('should display error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should display error digest if provided', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const errorWithDigest = Object.assign(new Error('Test error'), {
      digest: 'error-123',
    });
    
    render(<ErrorPage error={errorWithDigest} reset={mockReset} />);
    
    expect(screen.getByText('Error ID: error-123')).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should not display error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should call reset function when Try again button is clicked', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    const tryAgainButton = screen.getByText('Try again');
    fireEvent.click(tryAgainButton);
    
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('should render homepage link', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    const homepageLink = screen.getByText('Go to homepage').closest('a');
    expect(homepageLink).toHaveAttribute('href', '/');
  });

  it('should log error to console', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    expect(console.error).toHaveBeenCalledWith('Application error:', mockError);
  });

  it('should render AlertCircle icon', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    const iconContainer = screen.getByText('Something went wrong!')
      .previousElementSibling?.querySelector('svg');
    expect(iconContainer).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    
    const tryAgainButton = screen.getByText('Try again').closest('button');
    expect(tryAgainButton).toBeInTheDocument();
    
    const homepageButton = screen.getByText('Go to homepage').closest('button');
    expect(homepageButton).toBeInTheDocument();
  });
});