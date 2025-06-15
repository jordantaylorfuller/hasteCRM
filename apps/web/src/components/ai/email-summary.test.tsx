import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { EmailSummary } from "./email-summary";
import { SUMMARIZE_EMAIL } from "@/graphql/queries/ai";

const mockSummarizeEmailSuccess = {
  request: {
    query: SUMMARIZE_EMAIL,
    variables: {
      input: {
        emailId: "test-email-id",
        includeActionItems: true,
        includeKeyPoints: true,
        maxLength: 500,
      },
    },
  },
  result: {
    data: {
      summarizeEmail: {
        summary:
          "This email discusses the quarterly review meeting scheduled for next week. The sender is requesting feedback on the proposed agenda and asks for confirmation of attendance.",
        actionItems: [
          "Review the proposed agenda before the meeting",
          "Confirm attendance by Friday",
          "Prepare quarterly reports for presentation",
        ],
        keyPoints: [
          "Q4 Review",
          "Budget Planning",
          "Team Performance",
          "Strategic Goals",
        ],
      },
    },
  },
};

const mockSummarizeEmailNoExtras = {
  request: {
    query: SUMMARIZE_EMAIL,
    variables: {
      input: {
        emailId: "test-email-id-2",
        includeActionItems: true,
        includeKeyPoints: true,
        maxLength: 500,
      },
    },
  },
  result: {
    data: {
      summarizeEmail: {
        summary: "Simple email about lunch plans for tomorrow.",
        actionItems: [],
        keyPoints: [],
      },
    },
  },
};

const mockSummarizeEmailError = {
  request: {
    query: SUMMARIZE_EMAIL,
    variables: {
      input: {
        emailId: "error-email-id",
        includeActionItems: true,
        includeKeyPoints: true,
        maxLength: 500,
      },
    },
  },
  error: new Error("Failed to summarize email"),
};

const mockSummarizeEmailLoading = {
  request: {
    query: SUMMARIZE_EMAIL,
    variables: {
      input: {
        emailId: "loading-email-id",
        includeActionItems: true,
        includeKeyPoints: true,
        maxLength: 500,
      },
    },
  },
  delay: 1000,
  result: {
    data: {
      summarizeEmail: {
        summary: "Delayed summary",
        actionItems: [],
        keyPoints: [],
      },
    },
  },
};

describe("EmailSummary", () => {
  it("renders loading state initially", () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailLoading]}>
        <EmailSummary emailId="loading-email-id" />
      </MockedProvider>,
    );

    // Check for skeleton loaders - using class names instead of data-testid
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders summary with all sections", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Summary")).toBeInTheDocument();
    });

    // Check summary section
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(
      screen.getByText(/This email discusses the quarterly review meeting/),
    ).toBeInTheDocument();

    // Check action items
    expect(screen.getByText("Action Items")).toBeInTheDocument();
    expect(
      screen.getByText("Review the proposed agenda before the meeting"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Confirm attendance by Friday"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Prepare quarterly reports for presentation"),
    ).toBeInTheDocument();

    // Check key points
    expect(screen.getByText("Key Points")).toBeInTheDocument();
    expect(screen.getByText("Q4 Review")).toBeInTheDocument();
    expect(screen.getByText("Budget Planning")).toBeInTheDocument();
    expect(screen.getByText("Team Performance")).toBeInTheDocument();
    expect(screen.getByText("Strategic Goals")).toBeInTheDocument();
  });

  it("renders thread badge when isThread is true", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" isThread={true} />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Thread")).toBeInTheDocument();
    });
  });

  it("handles empty action items and key points", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailNoExtras]}>
        <EmailSummary emailId="test-email-id-2" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Simple email about lunch plans for tomorrow."),
      ).toBeInTheDocument();
    });

    // Should not show action items or key points sections when empty
    expect(screen.queryByText("Action Items")).not.toBeInTheDocument();
    expect(screen.queryByText("Key Points")).not.toBeInTheDocument();
  });

  it("handles error state", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailError]}>
        <EmailSummary emailId="error-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to generate summary"),
      ).toBeInTheDocument();
    });
  });

  it("handles refresh button click", async () => {
    const user = userEvent.setup();
    let callCount = 0;

    const mockWithRefetch = {
      request: {
        query: SUMMARIZE_EMAIL,
        variables: {
          input: {
            emailId: "refresh-email-id",
            includeActionItems: true,
            includeKeyPoints: true,
            maxLength: 500,
          },
        },
      },
      result: () => {
        callCount++;
        return {
          data: {
            summarizeEmail: {
              summary: `Summary version ${callCount}`,
              actionItems: [],
              keyPoints: [],
            },
          },
        };
      },
    };

    render(
      <MockedProvider mocks={[mockWithRefetch, mockWithRefetch]}>
        <EmailSummary emailId="refresh-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Summary version 1")).toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByRole("button", { name: "" }); // Button with RefreshCw icon
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText("Summary version 2")).toBeInTheDocument();
    });
  });

  it("renders all UI elements correctly", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Summary")).toBeInTheDocument();
    });

    // Check for icons
    const sparklesIcon = document.querySelector(".lucide-sparkles");
    const fileTextIcon = document.querySelector(".lucide-file-text");
    const targetIcon = document.querySelector(".lucide-target");
    const refreshIcon = document.querySelector(".lucide-refresh-cw");

    expect(sparklesIcon).toBeInTheDocument();
    expect(fileTextIcon).toBeInTheDocument();
    expect(targetIcon).toBeInTheDocument();
    expect(refreshIcon).toBeInTheDocument();
  });

  it("displays action items with bullet points", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Action Items")).toBeInTheDocument();
    });

    // Check for bullet points
    const bullets = screen.getAllByText("•");
    expect(bullets).toHaveLength(3); // 3 action items
  });

  it("displays key points as badges", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Key Points")).toBeInTheDocument();
    });

    // Check that key points are rendered as badges
    const keyPointBadges = [
      "Q4 Review",
      "Budget Planning",
      "Team Performance",
      "Strategic Goals",
    ];
    keyPointBadges.forEach((badge) => {
      const element = screen.getByText(badge);
      expect(element.closest(".inline-flex")).toHaveClass("border");
    });
  });

  it("handles null summary data", async () => {
    const mockNullSummary = {
      request: {
        query: SUMMARIZE_EMAIL,
        variables: {
          input: {
            emailId: "null-email-id",
            includeActionItems: true,
            includeKeyPoints: true,
            maxLength: 500,
          },
        },
      },
      result: {
        data: {
          summarizeEmail: null,
        },
      },
    };

    render(
      <MockedProvider mocks={[mockNullSummary]}>
        <EmailSummary emailId="null-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to generate summary"),
      ).toBeInTheDocument();
    });
  });

  it("applies correct styling classes", async () => {
    render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI Summary")).toBeInTheDocument();
    });

    // Check card styling
    const card = screen.getByText("AI Summary").closest(".border");
    expect(card).toHaveClass("rounded-lg");

    // Check text styling
    const summaryText = screen.getByText(
      /This email discusses the quarterly review meeting/,
    );
    expect(summaryText).toHaveClass(
      "text-sm",
      "text-muted-foreground",
      "leading-relaxed",
    );

    // Check section headers
    // Check section headers individually
    const summaryHeader = screen.getByText("Summary");
    expect(summaryHeader.closest("div")).toHaveClass(
      "flex",
      "items-center",
      "gap-2",
      "text-sm",
      "font-medium",
    );

    const actionItemsHeader = screen.getByText("Action Items");
    expect(actionItemsHeader.closest("div")).toHaveClass(
      "flex",
      "items-center",
      "gap-2",
      "text-sm",
      "font-medium",
    );

    const keyPointsHeader = screen.getByText("Key Points");
    expect(keyPointsHeader.closest("div")).toHaveClass(
      "flex",
      "items-center",
      "gap-2",
      "text-sm",
      "font-medium",
    );
  });

  it("maintains state across re-renders", async () => {
    const { rerender } = render(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/This email discusses the quarterly review meeting/),
      ).toBeInTheDocument();
    });

    // Re-render with same props
    rerender(
      <MockedProvider mocks={[mockSummarizeEmailSuccess]}>
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    // Content should still be there (no new loading state)
    expect(
      screen.getByText(/This email discusses the quarterly review meeting/),
    ).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("updates when emailId changes", async () => {
    const { rerender } = render(
      <MockedProvider
        mocks={[mockSummarizeEmailSuccess, mockSummarizeEmailNoExtras]}
      >
        <EmailSummary emailId="test-email-id" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/This email discusses the quarterly review meeting/),
      ).toBeInTheDocument();
    });

    // Change emailId
    rerender(
      <MockedProvider
        mocks={[mockSummarizeEmailSuccess, mockSummarizeEmailNoExtras]}
      >
        <EmailSummary emailId="test-email-id-2" />
      </MockedProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Simple email about lunch plans for tomorrow."),
      ).toBeInTheDocument();
    });

    // Original summary should be gone
    expect(
      screen.queryByText(/This email discusses the quarterly review meeting/),
    ).not.toBeInTheDocument();
  });
});
