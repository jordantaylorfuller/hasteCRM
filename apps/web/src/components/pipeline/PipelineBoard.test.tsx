import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PipelineBoard } from './PipelineBoard';
import { useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

// Mock dependencies
jest.mock('@apollo/client');
jest.mock('next/navigation');
jest.mock('@/components/ui/use-toast');

// Mock @dnd-kit/core
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragStart, onDragEnd }: any) => {
    // Store handlers to be called by tests
    (global as any).__dndHandlers = { onDragStart, onDragEnd };
    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
  closestCorners: jest.fn(),
  PointerSensor: class PointerSensor {},
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
  DragStartEvent: class DragStartEvent {
    constructor(public active: { id: string }) {}
  },
  DragEndEvent: class DragEndEvent {
    constructor(public active: { id: string }, public over: { id: string } | null) {}
  },
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((array: any[], from: number, to: number) => {
    const result = [...array];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
}));

// Mock the child components
jest.mock('./StageColumn', () => ({
  StageColumn: ({ stage, deals, totalValue, currency }: any) => (
    <div data-testid={`stage-${stage.id}`}>
      <h3>{stage.name}</h3>
      <div>Total: {currency} {totalValue}</div>
      {deals.map((deal: any) => (
        <div key={deal.id} data-testid={`deal-${deal.id}`}>
          <span>{deal.title}</span>
          <span> - ${deal.value}</span>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./DealCard', () => ({
  DealCard: ({ deal, isDragging }: any) => (
    <div data-testid={`deal-card-${deal.id}`} className={isDragging ? 'dragging' : ''}>
      {deal.title} - ${deal.value}
    </div>
  ),
}));

const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;
const mockToast = toast as jest.MockedFunction<typeof toast>;

describe('PipelineBoard', () => {
  const mockMoveDeal = jest.fn();

  const mockPipeline = {
    id: 'pipeline-1',
    name: 'Sales Pipeline',
    stages: [
      {
        id: 'stage-1',
        name: 'Lead',
        order: 0,
        color: '#FF0000',
        probability: 10,
      },
      {
        id: 'stage-2',
        name: 'Qualified',
        order: 1,
        color: '#00FF00',
        probability: 30,
      },
      {
        id: 'stage-3',
        name: 'Proposal',
        order: 2,
        color: '#0000FF',
        probability: 60,
      },
    ],
  };

  const mockDeals = [
    {
      id: 'deal-1',
      title: 'Deal 1',
      value: 1000,
      currency: 'USD',
      probability: 10,
      stageEnteredAt: '2024-01-01T00:00:00Z',
      daysInStage: 5,
      stage: { id: 'stage-1' },
      owner: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      },
      company: {
        id: 'company-1',
        name: 'Acme Corp',
      },
      contacts: [
        {
          id: 'contact-1',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
      ],
      _count: {
        activities: 5,
        tasks: 3,
        notes: 2,
        emails: 10,
      },
    },
    {
      id: 'deal-2',
      title: 'Deal 2',
      value: 2000,
      currency: 'USD',
      probability: 30,
      stageEnteredAt: '2024-01-02T00:00:00Z',
      daysInStage: 3,
      stage: { id: 'stage-2' },
      owner: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      },
      company: {
        id: 'company-2',
        name: 'Tech Inc',
      },
      contacts: [
        {
          id: 'contact-2',
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
        },
      ],
      _count: {
        activities: 3,
        tasks: 2,
        notes: 1,
        emails: 5,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseMutation.mockReturnValue([
      mockMoveDeal,
      { loading: false, error: null, data: null },
    ] as any);
  });

  it('renders pipeline board with stages', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    expect(screen.getByTestId('stage-stage-1')).toBeInTheDocument();
    expect(screen.getByTestId('stage-stage-2')).toBeInTheDocument();
    expect(screen.getByTestId('stage-stage-3')).toBeInTheDocument();
  });

  it('renders deals in correct stages', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    const stage1 = screen.getByTestId('stage-stage-1');
    expect(stage1).toHaveTextContent('Deal 1');

    const stage2 = screen.getByTestId('stage-stage-2');
    expect(stage2).toHaveTextContent('Deal 2');
  });

  it('calculates total value by stage', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    const stage1 = screen.getByTestId('stage-stage-1');
    expect(stage1).toHaveTextContent('Total: USD 1000');

    const stage2 = screen.getByTestId('stage-stage-2');
    expect(stage2).toHaveTextContent('Total: USD 2000');

    const stage3 = screen.getByTestId('stage-stage-3');
    expect(stage3).toHaveTextContent('Total: USD 0');
  });

  it('sets up drag and drop functionality', async () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // Test that the mutation is set up for drag and drop
    expect(mockUseMutation).toHaveBeenCalled();
    
    // Test that stages are set up for drag and drop
    const stages = mockPipeline.stages;
    stages.forEach(stage => {
      expect(screen.getByTestId(`stage-${stage.id}`)).toBeInTheDocument();
    });
  });

  it('groups deals by stage correctly', () => {
    const additionalDeal = {
      ...mockDeals[0],
      id: 'deal-3',
      title: 'Deal 3',
      stage: { id: 'stage-1' },
    };

    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={[...mockDeals, additionalDeal]}
      />
    );

    const stage1 = screen.getByTestId('stage-stage-1');
    expect(stage1).toHaveTextContent('Deal 1');
    expect(stage1).toHaveTextContent('Deal 3');
  });

  it('handles empty deals array', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={[]}
      />
    );

    expect(screen.getByTestId('stage-stage-1')).toBeInTheDocument();
    expect(screen.getByTestId('stage-stage-2')).toBeInTheDocument();
    expect(screen.getByTestId('stage-stage-3')).toBeInTheDocument();
  });

  it('renders stage columns in correct order', () => {
    const unorderedStages = [
      { ...mockPipeline.stages[2], order: 2 },
      { ...mockPipeline.stages[0], order: 0 },
      { ...mockPipeline.stages[1], order: 1 },
    ];

    render(
      <PipelineBoard
        pipeline={{ ...mockPipeline, stages: unorderedStages }}
        deals={mockDeals}
      />
    );

    const stages = screen.getAllByText(/Lead|Qualified|Proposal/);
    expect(stages[0]).toHaveTextContent('Lead');
    expect(stages[1]).toHaveTextContent('Qualified');
    expect(stages[2]).toHaveTextContent('Proposal');
  });

  it('uses first deal currency as default', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // All stages should show USD currency from the first deal
    expect(screen.getByTestId('stage-stage-1')).toHaveTextContent('USD');
    expect(screen.getByTestId('stage-stage-2')).toHaveTextContent('USD');
  });

  it('handles deals with different currencies', () => {
    const dealsWithDifferentCurrencies = [
      { ...mockDeals[0], currency: 'EUR' },
      { ...mockDeals[1], currency: 'GBP' },
    ];

    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={dealsWithDifferentCurrencies}
      />
    );

    // Should use the first deal's currency
    expect(screen.getByTestId('stage-stage-1')).toHaveTextContent('EUR');
  });

  it('handles drag start event', async () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // Simulate drag start
    const handlers = (global as any).__dndHandlers;
    const dragStartEvent = {
      active: { id: 'deal-1' }
    };

    handlers.onDragStart(dragStartEvent);

    // Verify drag overlay is shown with the dragged deal
    await waitFor(() => {
      const overlay = screen.getByTestId('drag-overlay');
      expect(overlay).toHaveTextContent('Deal 1 - $1000');
    });
  });

  it('handles drag end with stage change', async () => {
    const onDealsChange = jest.fn();

    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
        onDealsChange={onDealsChange}
      />
    );

    // Simulate drag end
    const handlers = (global as any).__dndHandlers;
    const dragEndEvent = {
      active: { id: 'deal-1' },
      over: { id: 'stage-2' }
    };

    await handlers.onDragEnd(dragEndEvent);

    // Verify mutation was called
    expect(mockMoveDeal).toHaveBeenCalledWith({
      variables: {
        input: {
          dealId: 'deal-1',
          stageId: 'stage-2'
        }
      }
    });

    // Verify onDealsChange was called with updated deals
    expect(onDealsChange).toHaveBeenCalled();
    const updatedDeals = onDealsChange.mock.calls[0][0];
    const movedDeal = updatedDeals.find((d: any) => d.id === 'deal-1');
    expect(movedDeal.stage.id).toBe('stage-2');

    // Verify success toast
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Deal moved',
      description: 'Deal 1 moved to Qualified'
    });
  });

  it('handles drag end with no drop target', async () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // Simulate drag end with no over
    const handlers = (global as any).__dndHandlers;
    const dragEndEvent = {
      active: { id: 'deal-1' },
      over: null
    };

    await handlers.onDragEnd(dragEndEvent);

    // Verify mutation was not called
    expect(mockMoveDeal).not.toHaveBeenCalled();
  });

  it('handles drag end on same stage', async () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // Simulate drag end on same stage
    const handlers = (global as any).__dndHandlers;
    const dragEndEvent = {
      active: { id: 'deal-1' },
      over: { id: 'stage-1' }
    };

    await handlers.onDragEnd(dragEndEvent);

    // Verify mutation was not called (same stage)
    expect(mockMoveDeal).not.toHaveBeenCalled();
  });

  it('handles drag end with invalid deal', async () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // Simulate drag end with invalid deal
    const handlers = (global as any).__dndHandlers;
    const dragEndEvent = {
      active: { id: 'invalid-deal' },
      over: { id: 'stage-2' }
    };

    await handlers.onDragEnd(dragEndEvent);

    // Verify mutation was not called
    expect(mockMoveDeal).not.toHaveBeenCalled();
  });

  it('handles mutation error and reverts changes', async () => {
    const onDealsChange = jest.fn();
    const mutationError = new Error('Network error');
    mockMoveDeal.mockRejectedValueOnce(mutationError);

    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
        onDealsChange={onDealsChange}
      />
    );

    // Simulate drag end
    const handlers = (global as any).__dndHandlers;
    const dragEndEvent = {
      active: { id: 'deal-1' },
      over: { id: 'stage-2' }
    };

    await handlers.onDragEnd(dragEndEvent);

    // Wait for mutation to fail
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to move deal. Please try again.',
        variant: 'destructive'
      });
    });

    // Verify deals were reverted to original state
    expect(onDealsChange).toHaveBeenCalledTimes(2);
    const revertedDeals = onDealsChange.mock.calls[1][0];
    expect(revertedDeals).toEqual(mockDeals);
  });

  it('handles drag start with invalid deal', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    // Simulate drag start with invalid deal
    const handlers = (global as any).__dndHandlers;
    const dragStartEvent = {
      active: { id: 'invalid-deal' }
    };

    handlers.onDragStart(dragStartEvent);

    // Verify drag overlay is empty (no active deal)
    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay).toBeEmptyDOMElement();
  });

  it('handles empty pipeline with no deals', () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={[]}
      />
    );

    // Verify default currency is USD
    expect(screen.getByTestId('stage-stage-1')).toHaveTextContent('USD 0');
    expect(screen.getByTestId('stage-stage-2')).toHaveTextContent('USD 0');
    expect(screen.getByTestId('stage-stage-3')).toHaveTextContent('USD 0');
  });

  it('clears active deal on drag end', async () => {
    render(
      <PipelineBoard
        pipeline={mockPipeline}
        deals={mockDeals}
      />
    );

    const handlers = (global as any).__dndHandlers;

    // Start drag
    handlers.onDragStart({ active: { id: 'deal-1' } });

    // Verify drag overlay shows deal
    await waitFor(() => {
      expect(screen.getByTestId('drag-overlay')).toHaveTextContent('Deal 1');
    });

    // End drag
    handlers.onDragEnd({
      active: { id: 'deal-1' },
      over: { id: 'stage-2' }
    });

    // Verify drag overlay is cleared
    await waitFor(() => {
      const overlay = screen.getByTestId('drag-overlay');
      expect(overlay).toBeEmptyDOMElement();
    });
  });

  it('handles stage with no deals in dealsByStage map', () => {
    // Create a pipeline with an extra stage that won't have any deals
    const pipelineWithExtraStage = {
      ...mockPipeline,
      stages: [
        ...mockPipeline.stages,
        {
          id: 'stage-4',
          name: 'New Stage',
          order: 3,
          color: '#FFA500',
          probability: 80,
        }
      ]
    };

    // Mock the dealsByStage calculation to simulate a missing entry
    const originalUseMemo = React.useMemo;
    let callCount = 0;
    jest.spyOn(React, 'useMemo').mockImplementation((fn, deps) => {
      callCount++;
      // First useMemo is dealsByStage, modify it to not include stage-4
      if (callCount === 1) {
        return originalUseMemo(() => {
          const grouped = new Map();
          // Only add first 3 stages, not stage-4
          grouped.set('stage-1', []);
          grouped.set('stage-2', mockDeals.filter(d => d.stage.id === 'stage-2'));
          grouped.set('stage-3', mockDeals.filter(d => d.stage.id === 'stage-3'));
          // stage-4 is intentionally missing from the map
          return grouped;
        }, deps);
      }
      return originalUseMemo(fn, deps);
    });

    render(
      <PipelineBoard
        pipeline={pipelineWithExtraStage}
        deals={mockDeals}
      />
    );

    // Verify stage-4 is rendered with empty deals array (fallback to [])
    const stage4 = screen.getByTestId('stage-stage-4');
    expect(stage4).toBeInTheDocument();
    expect(stage4).toHaveTextContent('New Stage');
    expect(stage4).toHaveTextContent('$0'); // No deals, so value is 0

    // Restore original useMemo
    React.useMemo = originalUseMemo;
  });
});