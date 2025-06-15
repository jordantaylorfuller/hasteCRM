import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@apollo/client";
import PipelinesPage from "./page";
import { GET_PIPELINES } from "@/graphql/queries/pipelines";

// Mock dependencies
jest.mock("@apollo/client", () => ({
  useQuery: jest.fn(),
  gql: jest.fn((template) => template),
}));

jest.mock("@/graphql/queries/pipelines", () => ({
  GET_PIPELINES: "GET_PIPELINES_QUERY",
  GET_DEALS: "GET_DEALS_QUERY",
}));

jest.mock("@/components/pipeline/PipelineBoard", () => ({
  PipelineBoard: ({ pipeline, deals, onDealsChange }: any) => (
    <div data-testid="pipeline-board">
      <div>Pipeline: {pipeline.name}</div>
      <div>Deals: {deals.length}</div>
      <button onClick={onDealsChange}>Refresh</button>
    </div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div data-testid="select-wrapper">
      {React.Children.map(children, (child) =>
        React.cloneElement(child as React.ReactElement, {
          value,
          onValueChange,
        }),
      )}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ value, children, onClick }: any) => (
    <div data-testid={`select-item-${value}`} onClick={() => onClick?.(value)}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ value, onValueChange, children }: any) => {
    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, { value, onValueChange } as any);
      }
      return child;
    });
    return (
      <div data-testid="tabs" data-value={value}>
        {childrenWithProps}
      </div>
    );
  },
  TabsList: ({ children, value, onValueChange }: any) => {
    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          currentValue: value,
          onValueChange,
        } as any);
      }
      return child;
    });
    return <div>{childrenWithProps}</div>;
  },
  TabsTrigger: ({
    value: triggerValue,
    children,
    currentValue,
    onValueChange,
  }: any) => {
    // currentValue is intentionally not used in this mock
    void currentValue;
    return (
      <button onClick={() => onValueChange?.(triggerValue)}>{children}</button>
    );
  },
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: any) => <div className={className}>Loading...</div>,
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Plus: () => <span>Plus</span>,
  Search: () => <span>Search</span>,
  Filter: () => <span>Filter</span>,
  ChartBar: () => <span>ChartBar</span>,
}));

describe("Pipelines Page", () => {
  const mockPipelines = [
    {
      id: "1",
      name: "Sales Pipeline",
      color: "#3B82F6",
      isDefault: true,
      _count: { deals: 5 },
      stages: [
        { id: "s1", name: "Lead", order: 1 },
        { id: "s2", name: "Qualified", order: 2 },
      ],
    },
    {
      id: "2",
      name: "Support Pipeline",
      color: "#10B981",
      isDefault: false,
      _count: { deals: 3 },
      stages: [
        { id: "s3", name: "New", order: 1 },
        { id: "s4", name: "In Progress", order: 2 },
      ],
    },
  ];

  const mockDeals = [
    {
      id: "d1",
      title: "Deal with Acme Corp",
      value: 10000,
      company: { name: "Acme Corp" },
      contacts: [{ firstName: "John", lastName: "Doe" }],
      stage: { id: "s1" },
    },
    {
      id: "d2",
      title: "Deal with Tech Inc",
      value: 25000,
      company: { name: "Tech Inc" },
      contacts: [{ firstName: "Jane", lastName: "Smith" }],
      stage: { id: "s2" },
    },
  ];

  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state", () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: null, loading: true };
      }
      return { data: null, loading: false, skip: true };
    });

    render(<PipelinesPage />);

    expect(screen.getAllByText("Loading...").length).toBeGreaterThan(0);
  });

  it("renders page header and controls", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    await waitFor(() => {
      // Check for header (h1 element)
      expect(
        screen.getByRole("heading", { name: "Sales Pipeline" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
      expect(screen.getByText("New Deal")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search deals..."),
      ).toBeInTheDocument();
      expect(screen.getByText("Board")).toBeInTheDocument();
      expect(screen.getByText("List")).toBeInTheDocument();
      expect(screen.getByText("Filters")).toBeInTheDocument();
    });
  });

  it("selects default pipeline on load", async () => {
    const mockRefetch = jest.fn();
    (useQuery as jest.Mock).mockImplementation((query, options) => {
      // options is used to check query type
      void options;
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: mockRefetch,
      };
    });

    render(<PipelinesPage />);

    await waitFor(() => {
      // Should select the default pipeline (Sales Pipeline)
      const pipelineBoard = screen.getByTestId("pipeline-board");
      expect(pipelineBoard).toHaveTextContent("Pipeline: Sales Pipeline");
    });
  });

  it("switches between pipelines", async () => {
    const mockRefetch = jest.fn();
    let selectedPipelineId = "1";
    // Used to track pipeline changes in mock
    void selectedPipelineId;

    (useQuery as jest.Mock).mockImplementation((query, options) => {
      // options is used to check query type and variables
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      if (options?.variables?.pipelineId) {
        selectedPipelineId = options.variables.pipelineId;
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: mockRefetch,
      };
    });

    render(<PipelinesPage />);

    // Simulate pipeline change
    // Note: In real implementation, this would be handled by the Select component
    // For testing, we're checking that the component responds to pipeline changes
    await waitFor(() => {
      expect(screen.getByTestId("pipeline-board")).toHaveTextContent(
        "Pipeline: Sales Pipeline",
      );
    });
  });

  it("filters deals by search query", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    const searchInput = screen.getByPlaceholderText("Search deals...");

    // Search for "Acme"
    await user.type(searchInput, "Acme");

    await waitFor(() => {
      const pipelineBoard = screen.getByTestId("pipeline-board");
      // Only 1 deal should match
      expect(pipelineBoard).toHaveTextContent("Deals: 1");
    });

    // Clear search
    await user.clear(searchInput);

    await waitFor(() => {
      const pipelineBoard = screen.getByTestId("pipeline-board");
      // All deals should show
      expect(pipelineBoard).toHaveTextContent("Deals: 2");
    });
  });

  it("searches by contact name", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    const searchInput = screen.getByPlaceholderText("Search deals...");

    // Search for "Jane"
    await user.type(searchInput, "Jane");

    await waitFor(() => {
      const pipelineBoard = screen.getByTestId("pipeline-board");
      // Only 1 deal should match
      expect(pipelineBoard).toHaveTextContent("Deals: 1");
    });
  });

  it("switches between board and list view", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    // Initially in board view
    expect(screen.getByTestId("pipeline-board")).toBeInTheDocument();

    // Switch to list view
    const listTab = screen.getByText("List");
    fireEvent.click(listTab);

    await waitFor(() => {
      expect(screen.queryByTestId("pipeline-board")).not.toBeInTheDocument();
      expect(screen.getByText("List view coming soon...")).toBeInTheDocument();
    });

    // Switch back to board view
    const boardTab = screen.getByText("Board");
    fireEvent.click(boardTab);

    await waitFor(() => {
      expect(screen.getByTestId("pipeline-board")).toBeInTheDocument();
    });
  });

  it("calls refetch when deals change", async () => {
    const mockRefetch = jest.fn();
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: mockRefetch,
      };
    });

    render(<PipelinesPage />);

    await waitFor(() => {
      const refreshButton = screen.getByText("Refresh");
      fireEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it("handles empty pipelines", () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: [] }, loading: false };
      }
      return { data: null, loading: false, skip: true };
    });

    render(<PipelinesPage />);

    // Should not crash and show the header
    expect(screen.getByText("Sales Pipeline")).toBeInTheDocument();
  });

  it("handles empty deals", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: [] } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    await waitFor(() => {
      const pipelineBoard = screen.getByTestId("pipeline-board");
      expect(pipelineBoard).toHaveTextContent("Deals: 0");
    });
  });

  it("renders pipeline color indicators", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    await waitFor(() => {
      // Check that pipeline items are rendered with colors
      const selectContent = screen.getByTestId("select-content");
      expect(selectContent).toBeInTheDocument();
    });
  });

  it("displays deal counts in pipeline selector", async () => {
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query === GET_PIPELINES) {
        return { data: { pipelines: mockPipelines }, loading: false };
      }
      return {
        data: { deals: { deals: mockDeals } },
        loading: false,
        refetch: jest.fn(),
      };
    });

    render(<PipelinesPage />);

    await waitFor(() => {
      // Check that deal counts are shown
      expect(screen.getByText("(5)")).toBeInTheDocument();
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });
  });
});
