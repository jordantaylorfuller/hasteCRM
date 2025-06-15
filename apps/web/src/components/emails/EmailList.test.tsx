import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailList } from "./EmailList";
import { Email } from "@/types/email";

const mockEmails: Email[] = [
  {
    id: "1",
    gmailId: "gmail-1",
    threadId: "thread-1",
    fromEmail: "john@example.com",
    fromName: "John Doe",
    toEmails: ["me@example.com"],
    ccEmails: [],
    bccEmails: [],
    subject: "Important Meeting Tomorrow",
    snippet: "Hi, I wanted to remind you about our meeting tomorrow at 2 PM...",
    bodyText: "Full email body text",
    sentAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    isRead: false,
    isStarred: false,
    gmailLabels: ["IMPORTANT"],
    attachments: [
      {
        id: "att-1",
        gmailId: "gmail-att-1",
        filename: "document.pdf",
        mimeType: "application/pdf",
        size: 1024000,
      },
    ],
  },
  {
    id: "2",
    gmailId: "gmail-2",
    threadId: "thread-2",
    fromEmail: "jane@example.com",
    fromName: "Jane Smith",
    toEmails: ["me@example.com"],
    ccEmails: ["team@example.com"],
    bccEmails: [],
    subject: "Project Update",
    snippet: "Here's the latest update on the project status...",
    bodyText: "Full email body text for project update",
    sentAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    receivedAt: new Date(Date.now() - 86400000).toISOString(),
    isRead: true,
    isStarred: true,
    gmailLabels: [],
    attachments: [],
  },
];

const mockHandlers = {
  onSelectEmail: jest.fn(),
  onStarEmail: jest.fn(),
  onArchiveEmail: jest.fn(),
  onTrashEmail: jest.fn(),
  onMarkAsRead: jest.fn(),
  onMarkAsUnread: jest.fn(),
};

describe("EmailList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders email list with all emails", () => {
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Important Meeting Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Project Update")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    render(<EmailList emails={[]} loading={true} {...mockHandlers} />);

    // Skeleton component uses animate-pulse class
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no emails", () => {
    render(<EmailList emails={[]} loading={false} {...mockHandlers} />);

    expect(screen.getByText("No emails found")).toBeInTheDocument();
  });

  it("highlights unread emails", () => {
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const unreadEmail = screen.getByText("Important Meeting Tomorrow");
    expect(unreadEmail).toHaveClass("font-medium");

    const readEmail = screen.getByText("Project Update");
    expect(readEmail).not.toHaveClass("font-medium");
  });

  it("shows starred emails with filled star icon", () => {
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    // Find all SVG elements that are star icons
    const starIcons = screen
      .getAllByRole("button")
      .map((button) => button.querySelector("svg"))
      .filter(
        (svg) =>
          svg && svg.classList.contains("h-4") && svg.classList.contains("w-4"),
      );

    // The second email is starred, so one of the star icons should have the fill-yellow-400 class
    const starredIcon = starIcons.find((icon) =>
      icon?.classList.contains("fill-yellow-400"),
    );
    expect(starredIcon).toBeInTheDocument();
  });

  it("handles email selection", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const emailCard = screen
      .getByText("Important Meeting Tomorrow")
      .closest('[class*="card"]');
    await user.click(emailCard!);

    expect(mockHandlers.onSelectEmail).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("handles star toggle", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    // Find star buttons by looking for buttons with star SVGs
    const starButtons = screen
      .getAllByRole("button")
      .filter(
        (button) =>
          button.querySelector('svg[class*="h-4 w-4"]') &&
          button.parentElement?.className.includes("space-x-3"),
      );
    await user.click(starButtons[0]);

    expect(mockHandlers.onStarEmail).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("shows email attachments count", () => {
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    expect(screen.getByText("📎 1")).toBeInTheDocument();
  });

  it("shows important label", () => {
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    expect(screen.getByText("Important")).toBeInTheDocument();
  });

  it("handles select all checkbox", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    await user.click(selectAllCheckbox);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("handles deselect all when all emails are selected", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];

    // Select all emails
    await user.click(selectAllCheckbox);
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    // Deselect all emails
    await user.click(selectAllCheckbox);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("handles individual email selection", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // Click first email's checkbox

    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("handles individual email deselection", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const checkboxes = screen.getAllByRole("checkbox");

    // Select an email
    await user.click(checkboxes[1]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Deselect the same email
    await user.click(checkboxes[1]);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("shows bulk actions when emails are selected", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    await user.click(selectAllCheckbox);

    // Bulk action buttons appear in the header when emails are selected
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    // Find buttons that appear after selection - they have icon children
    const header = screen.getByText(/selected/).parentElement;
    const bulkActionButtons = header?.querySelectorAll("button");

    // Should have bulk action buttons visible
    expect(bulkActionButtons!.length).toBeGreaterThanOrEqual(2);
  });

  it("opens dropdown menu for individual email actions", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);

    expect(screen.getByText("Mark as read")).toBeInTheDocument();
    expect(screen.getByText("Mark as unread")).toBeInTheDocument();
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Move to trash")).toBeInTheDocument();
  });

  it("handles mark as read action", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);

    await user.click(screen.getByText("Mark as read"));

    expect(mockHandlers.onMarkAsRead).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("handles mark as unread action", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);

    await user.click(screen.getByText("Mark as unread"));

    expect(mockHandlers.onMarkAsUnread).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("handles archive action from dropdown", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);

    await user.click(screen.getByText("Archive"));

    expect(mockHandlers.onArchiveEmail).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("handles trash action from dropdown", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);

    await user.click(screen.getByText("Move to trash"));

    expect(mockHandlers.onTrashEmail).toHaveBeenCalledWith(mockEmails[0]);
  });

  it("prevents event propagation on checkbox click", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // Click first email's checkbox

    expect(mockHandlers.onSelectEmail).not.toHaveBeenCalled();
  });

  it("prevents event propagation on dropdown menu click", async () => {
    const user = userEvent.setup();
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);

    expect(mockHandlers.onSelectEmail).not.toHaveBeenCalled();
  });

  it("highlights selected email", () => {
    render(
      <EmailList
        emails={mockEmails}
        selectedEmail={mockEmails[0]}
        {...mockHandlers}
      />,
    );

    const selectedCard = screen
      .getByText("Important Meeting Tomorrow")
      .closest('[class*="p-3"]');
    expect(selectedCard).toHaveClass("border-primary");
  });

  it("formats relative time correctly", () => {
    render(<EmailList emails={mockEmails} {...mockHandlers} />);

    // Recent email should show something like "a few seconds ago"
    const timeElements = screen.getAllByText(/ago/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it("handles emails without subject", () => {
    const emailWithoutSubject: Email = {
      ...mockEmails[0],
      id: "3",
      subject: "",
    };

    render(<EmailList emails={[emailWithoutSubject]} {...mockHandlers} />);

    expect(screen.getByText("(no subject)")).toBeInTheDocument();
  });

  it("shows sender email when name is not available", () => {
    const emailWithoutName: Email = {
      ...mockEmails[0],
      id: "3",
      fromName: undefined,
    };

    render(<EmailList emails={[emailWithoutName]} {...mockHandlers} />);

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });
});
