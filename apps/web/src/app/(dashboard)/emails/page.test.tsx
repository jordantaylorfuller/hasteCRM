import React from 'react';
import { render, screen } from '@testing-library/react';
import EmailsPage from './page';

describe('Emails Page', () => {
  it('renders page title', () => {
    render(<EmailsPage />);

    expect(screen.getByText('Emails')).toBeInTheDocument();
  });

  it('renders coming soon message', () => {
    render(<EmailsPage />);

    expect(screen.getByText('Emails feature coming soon...')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    render(<EmailsPage />);

    const container = screen.getByText('Emails').parentElement;
    expect(container).toHaveClass('p-6');

    const title = screen.getByText('Emails');
    expect(title).toHaveClass('text-2xl', 'font-bold', 'mb-4');

    const message = screen.getByText('Emails feature coming soon...');
    expect(message).toHaveClass('text-gray-500');
  });

  it('renders within the expected structure', () => {
    const { container } = render(<EmailsPage />);

    const mainDiv = container.firstChild;
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv?.childNodes).toHaveLength(2); // title and message
  });
});