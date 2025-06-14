import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactList } from './ContactList';
import { useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@apollo/client');
jest.mock('next/navigation');

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('ContactList', () => {
  const mockPush = jest.fn();
  const mockRefetch = jest.fn();

  const mockContacts = [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      company: { name: 'Acme Corp' },
      title: 'CEO',
      tags: [{ id: 'tag1', name: 'VIP' }],
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+0987654321',
      company: { name: 'Tech Inc' },
      title: 'CTO',
      tags: [],
      createdAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any);
  });

  it('renders loading state', () => {
    mockUseQuery.mockReturnValue({
      loading: true,
      error: null,
      data: null,
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    expect(screen.getByTestId('contact-list-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: new Error('Failed to load contacts'),
      data: null,
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    expect(screen.getByText(/Failed to load contacts/i)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: [] },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    expect(screen.getByText(/No contacts found/i)).toBeInTheDocument();
  });

  it('renders contact list', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Tech Inc')).toBeInTheDocument();
  });

  it('handles contact click', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const contactCard = screen.getByText('John Doe').closest('div[role="button"]');
    fireEvent.click(contactCard!);
    
    expect(mockPush).toHaveBeenCalledWith('/contacts/1');
  });

  it('filters contacts by search term', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const searchInput = screen.getByPlaceholderText(/Search contacts/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('filters contacts by company', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const companyFilter = screen.getByRole('combobox', { name: /company/i });
    fireEvent.change(companyFilter, { target: { value: 'Acme Corp' } });
    
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledWith({
        filters: { companyId: expect.any(String) },
      });
    });
  });

  it('filters contacts by tag', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const tagFilter = screen.getByRole('combobox', { name: /tag/i });
    fireEvent.change(tagFilter, { target: { value: 'VIP' } });
    
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledWith({
        filters: { tagIds: expect.arrayContaining(['tag1']) },
      });
    });
  });

  it('handles pagination', () => {
    const mockContactsWithPagination = {
      contacts: mockContacts,
      totalCount: 50,
      pageInfo: {
        hasNextPage: true,
        hasPreviousPage: false,
      },
    };

    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: mockContactsWithPagination,
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeEnabled();
    
    fireEvent.click(nextButton);
    
    expect(mockRefetch).toHaveBeenCalledWith({
      skip: 20,
      take: 20,
    });
  });

  it('handles sort order change', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const sortSelect = screen.getByRole('combobox', { name: /sort/i });
    fireEvent.change(sortSelect, { target: { value: 'email' } });
    
    expect(mockRefetch).toHaveBeenCalledWith({
      orderBy: { email: 'asc' },
    });
  });

  it('handles bulk selection', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
    fireEvent.click(selectAllCheckbox);
    
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox, index) => {
      if (index > 0) { // Skip the select all checkbox
        expect(checkbox).toBeChecked();
      }
    });
  });

  it('handles bulk delete', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    // Select first contact
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(firstCheckbox);
    
    // Click bulk delete
    const deleteButton = screen.getByRole('button', { name: /delete selected/i });
    fireEvent.click(deleteButton);
    
    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('exports contacts', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { contacts: mockContacts },
      refetch: mockRefetch,
    } as any);

    render(<ContactList />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);
    
    const csvOption = screen.getByRole('menuitem', { name: /CSV/i });
    fireEvent.click(csvOption);
    
    // Mock file download
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});