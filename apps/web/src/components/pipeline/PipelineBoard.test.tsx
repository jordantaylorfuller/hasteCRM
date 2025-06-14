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
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCorners: jest.fn(),
  PointerSensor: class PointerSensor {},
  useSensor: jest.fn(),
  useSensors: jest.fn(),
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
});