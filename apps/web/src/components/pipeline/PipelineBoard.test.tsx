import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PipelineBoard } from './PipelineBoard';
import { useQuery, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@apollo/client');
jest.mock('next/navigation');
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => (
    <div data-testid="drag-drop-context" onClick={() => onDragEnd({
      destination: { droppableId: 'stage-2', index: 0 },
      source: { droppableId: 'stage-1', index: 0 },
      draggableId: 'deal-1',
    })}>
      {children}
    </div>
  ),
  Droppable: ({ children, droppableId }: any) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children({ droppableProps: {}, innerRef: jest.fn() })}
    </div>
  ),
  Draggable: ({ children, draggableId }: any) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children({ draggableProps: {}, dragHandleProps: {}, innerRef: jest.fn() })}
    </div>
  ),
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('PipelineBoard', () => {
  const mockPush = jest.fn();
  const mockMoveDeal = jest.fn();
  const mockUpdateDeal = jest.fn();
  const mockDeleteDeal = jest.fn();

  const mockPipeline = {
    id: 'pipeline-1',
    name: 'Sales Pipeline',
    stages: [
      {
        id: 'stage-1',
        name: 'Lead',
        order: 0,
        color: '#FF0000',
        deals: [
          {
            id: 'deal-1',
            title: 'Deal 1',
            value: 10000,
            probability: 20,
            contact: { name: 'John Doe', email: 'john@example.com' },
            owner: { name: 'Sales Rep' },
            createdAt: '2024-01-01',
            expectedCloseDate: '2024-02-01',
            tags: [{ id: 'tag-1', name: 'Hot' }],
          },
        ],
      },
      {
        id: 'stage-2',
        name: 'Qualified',
        order: 1,
        color: '#00FF00',
        deals: [],
      },
      {
        id: 'stage-3',
        name: 'Proposal',
        order: 2,
        color: '#0000FF',
        deals: [
          {
            id: 'deal-2',
            title: 'Deal 2',
            value: 20000,
            probability: 60,
            contact: { name: 'Jane Smith', email: 'jane@example.com' },
            owner: { name: 'Sales Manager' },
            createdAt: '2024-01-02',
            expectedCloseDate: '2024-02-15',
            tags: [],
          },
        ],
      },
    ],
    metrics: {
      totalValue: 30000,
      dealCount: 2,
      avgDealSize: 15000,
      winRate: 0.25,
    },
  };

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

    mockUseMutation.mockImplementation((mutation: any) => {
      if (mutation.toString().includes('moveDeal')) {
        return [mockMoveDeal, { loading: false, error: null }] as any;
      }
      if (mutation.toString().includes('updateDeal')) {
        return [mockUpdateDeal, { loading: false, error: null }] as any;
      }
      if (mutation.toString().includes('deleteDeal')) {
        return [mockDeleteDeal, { loading: false, error: null }] as any;
      }
      return [jest.fn(), { loading: false, error: null }] as any;
    });
  });

  it('renders loading state', () => {
    mockUseQuery.mockReturnValue({
      loading: true,
      error: null,
      data: null,
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    expect(screen.getByTestId('pipeline-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: new Error('Failed to load pipeline'),
      data: null,
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    expect(screen.getByText(/Failed to load pipeline/i)).toBeInTheDocument();
  });

  it('renders pipeline board with stages', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    expect(screen.getByText('Sales Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(screen.getByText('Proposal')).toBeInTheDocument();
  });

  it('renders deals in stages', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    expect(screen.getByText('Deal 1')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Hot')).toBeInTheDocument();
    
    expect(screen.getByText('Deal 2')).toBeInTheDocument();
    expect(screen.getByText('$20,000')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders pipeline metrics', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    expect(screen.getByText(/Total Value/i)).toBeInTheDocument();
    expect(screen.getByText('$30,000')).toBeInTheDocument();
    expect(screen.getByText(/Deals/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Win Rate/i)).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('handles deal drag and drop', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    // Simulate drag and drop (mocked in the DragDropContext)
    const dragDropContext = screen.getByTestId('drag-drop-context');
    fireEvent.click(dragDropContext);
    
    await waitFor(() => {
      expect(mockMoveDeal).toHaveBeenCalledWith({
        variables: {
          input: {
            dealId: 'deal-1',
            stageId: 'stage-2',
          },
        },
      });
    });
  });

  it('opens deal details on click', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const dealCard = screen.getByText('Deal 1').closest('div[role="button"]');
    fireEvent.click(dealCard!);
    
    expect(mockPush).toHaveBeenCalledWith('/pipelines/pipeline-1/deals/deal-1');
  });

  it('filters deals by search', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const searchInput = screen.getByPlaceholderText(/Search deals/i);
    fireEvent.change(searchInput, { target: { value: 'Deal 1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Deal 1')).toBeInTheDocument();
      expect(screen.queryByText('Deal 2')).not.toBeInTheDocument();
    });
  });

  it('filters deals by value range', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const minValueInput = screen.getByLabelText(/Min value/i);
    fireEvent.change(minValueInput, { target: { value: '15000' } });
    
    await waitFor(() => {
      expect(screen.queryByText('Deal 1')).not.toBeInTheDocument();
      expect(screen.getByText('Deal 2')).toBeInTheDocument();
    });
  });

  it('filters deals by owner', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const ownerFilter = screen.getByRole('combobox', { name: /owner/i });
    fireEvent.change(ownerFilter, { target: { value: 'Sales Manager' } });
    
    await waitFor(() => {
      expect(screen.queryByText('Deal 1')).not.toBeInTheDocument();
      expect(screen.getByText('Deal 2')).toBeInTheDocument();
    });
  });

  it('adds new deal to stage', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const addButton = screen.getAllByRole('button', { name: /add deal/i })[0];
    fireEvent.click(addButton);
    
    // Fill in deal form
    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: 'New Deal' } });
    
    const valueInput = screen.getByLabelText(/Value/i);
    fireEvent.change(valueInput, { target: { value: '5000' } });
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateDeal).toHaveBeenCalledWith({
        variables: {
          input: {
            title: 'New Deal',
            value: 5000,
            stageId: 'stage-1',
            pipelineId: 'pipeline-1',
          },
        },
      });
    });
  });

  it('edits deal inline', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
    fireEvent.click(editButton);
    
    const valueInput = screen.getByDisplayValue('10000');
    fireEvent.change(valueInput, { target: { value: '12000' } });
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateDeal).toHaveBeenCalledWith({
        variables: {
          id: 'deal-1',
          input: {
            value: 12000,
          },
        },
      });
    });
  });

  it('deletes deal', async () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    fireEvent.click(deleteButton);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockDeleteDeal).toHaveBeenCalledWith({
        variables: {
          id: 'deal-1',
        },
      });
    });
  });

  it('shows stage statistics', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    // Check Lead stage stats
    const leadStage = screen.getByText('Lead').closest('div');
    expect(leadStage).toHaveTextContent('1 deal');
    expect(leadStage).toHaveTextContent('$10,000');
    
    // Check Qualified stage stats
    const qualifiedStage = screen.getByText('Qualified').closest('div');
    expect(qualifiedStage).toHaveTextContent('0 deals');
    expect(qualifiedStage).toHaveTextContent('$0');
  });

  it('changes view mode', () => {
    mockUseQuery.mockReturnValue({
      loading: false,
      error: null,
      data: { pipeline: mockPipeline },
    } as any);

    render(<PipelineBoard pipelineId="pipeline-1" />);
    
    const viewToggle = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewToggle);
    
    const listView = screen.getByRole('menuitem', { name: /list/i });
    fireEvent.click(listView);
    
    // Should now show list view instead of kanban
    expect(screen.getByTestId('pipeline-list-view')).toBeInTheDocument();
  });
});