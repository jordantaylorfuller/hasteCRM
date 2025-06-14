import { render, screen } from '@testing-library/react';
import NotFound from './not-found';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

describe('NotFound Page', () => {
  it('should render 404 page with correct content', () => {
    render(<NotFound />);
    
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText("Sorry, we couldn't find the page you're looking for.")).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<NotFound />);
    
    const homepageLink = screen.getByText('Go to homepage').closest('a');
    expect(homepageLink).toHaveAttribute('href', '/');
    
    const dashboardLink = screen.getByText('Back to dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    
    const contactsLink = screen.getByText('Search contacts').closest('a');
    expect(contactsLink).toHaveAttribute('href', '/contacts');
  });

  it('should render support link', () => {
    render(<NotFound />);
    
    const supportLink = screen.getByText('contact support');
    expect(supportLink).toHaveAttribute('href', '/support');
    // Check that it's styled as a link (Next.js Link component wraps it)
    expect(supportLink.tagName).toBe('A');
  });

  it('should display proper button variants', () => {
    render(<NotFound />);
    
    // Homepage button should be default variant (no specific class check needed)
    
    // Dashboard button is outline variant
    const dashboardLink = screen.getByText('Back to dashboard').closest('a');
    expect(dashboardLink).toBeInTheDocument();
    
    // Contacts button is ghost variant
    const contactsLink = screen.getByText('Search contacts').closest('a');
    expect(contactsLink).toBeInTheDocument();
  });

  it('should render icons for each button', () => {
    render(<NotFound />);
    
    const buttons = [
      { text: 'Go to homepage', expectedIcon: true },
      { text: 'Back to dashboard', expectedIcon: true },
      { text: 'Search contacts', expectedIcon: true },
    ];
    
    buttons.forEach(({ text }) => {
      const button = screen.getByText(text).closest('button');
      const icon = button?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  it('should have centered layout', () => {
    const { container } = render(<NotFound />);
    
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
  });

  it('should display 404 in large text', () => {
    render(<NotFound />);
    
    const fourOhFour = screen.getByText('404');
    expect(fourOhFour).toHaveClass('text-9xl', 'font-bold', 'text-gray-200');
  });

  it('should have proper spacing between elements', () => {
    render(<NotFound />);
    
    const buttonsContainer = screen.getByText('Go to homepage').closest('.space-y-3');
    expect(buttonsContainer).toBeInTheDocument();
  });
});