import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailViewer } from "./EmailViewer";
import { Email } from "@/types/email";

const mockEmail: Email = {
  id: "1",
  gmailId: "gmail-1",
  threadId: "thread-1",
  fromEmail: "john@example.com",
  fromName: "John Doe",
  toEmails: ["me@example.com", "team@example.com"],
  ccEmails: ["cc@example.com"],
  bccEmails: [],
  subject: "Important Project Update",
  snippet: "Here's the latest update on our project...",
  bodyText: "This is the plain text body of the email.\n\nBest regards,\nJohn",
  bodyHtml:
    "<p>This is the <strong>HTML body</strong> of the email.</p><p>Best regards,<br>John</p>",
  sentAt: "2024-01-15T10:30:00Z",
  receivedAt: "2024-01-15T10:31:00Z",
  isRead: true,
  isStarred: false,
  gmailLabels: ["IMPORTANT", "WORK"],
  attachments: [
    {
      id: "att-1",
      gmailId: "gmail-att-1",
      filename: "project-report.pdf",
      mimeType: "application/pdf",
      size: 2048000, // 2 MB
    },
    {
      id: "att-2",
      gmailId: "gmail-att-2",
      filename: "data.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 512000, // 500 KB
    },
  ],
};

const mockHandlers = {
  onClose: jest.fn(),
  onReply: jest.fn(),
  onReplyAll: jest.fn(),
  onForward: jest.fn(),
  onStarEmail: jest.fn(),
  onArchiveEmail: jest.fn(),
  onTrashEmail: jest.fn(),
  onMarkAsUnread: jest.fn(),
};

describe("EmailViewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows empty state when no email is provided", () => {
    render(<EmailViewer email={null} {...mockHandlers} />);
    expect(screen.getByText("Select an email to view")).toBeInTheDocument();
  });

  it("renders email content correctly", () => {
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    // Subject
    expect(screen.getByText("Important Project Update")).toBeInTheDocument();

    // Sender info
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();

    // Recipients
    expect(
      screen.getByText("me@example.com, team@example.com"),
    ).toBeInTheDocument();
    expect(screen.getByText("cc@example.com")).toBeInTheDocument();

    // Labels
    expect(screen.getByText("IMPORTANT")).toBeInTheDocument();
    expect(screen.getByText("WORK")).toBeInTheDocument();
  });

  it("renders HTML body when available", () => {
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    // Check for HTML content
    expect(screen.getByText(/HTML body/)).toBeInTheDocument();
    const strongElement = screen.getByText("HTML body");
    expect(strongElement.tagName).toBe("STRONG");
  });

  it("renders plain text body when HTML is not available", () => {
    const plainTextEmail = { ...mockEmail, bodyHtml: undefined };
    render(<EmailViewer email={plainTextEmail} {...mockHandlers} />);

    expect(screen.getByText(/This is the plain text body/)).toBeInTheDocument();
  });

  it("handles email without subject", () => {
    const noSubjectEmail = { ...mockEmail, subject: "" };
    render(<EmailViewer email={noSubjectEmail} {...mockHandlers} />);

    expect(screen.getByText("(no subject)")).toBeInTheDocument();
  });

  it("shows close button when onClose is provided", () => {
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    // The close button is positioned in the header with the X icon
    // Find it by looking for a button in the header area
    const header = screen.getByText(mockEmail.subject).parentElement
      ?.parentElement;
    const closeButton = header?.querySelector("button:last-child");

    expect(closeButton).toBeInTheDocument();
    // Verify it has the X icon
    expect(closeButton?.querySelector("svg")).toBeInTheDocument();
  });

  it("hides close button when onClose is not provided", () => {
    const { onClose, ...handlersWithoutClose } = mockHandlers;
    render(<EmailViewer email={mockEmail} {...handlersWithoutClose} />);

    // When onClose is not provided, there should be no X button in the header
    const header = screen.getByText(mockEmail.subject).parentElement;
    const closeButton = header?.querySelector("button");

    // The close button should not exist
    expect(closeButton).toBeNull();
  });

  it("handles reply action", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    await user.click(screen.getByRole("button", { name: /^Reply$/ }));
    expect(mockHandlers.onReply).toHaveBeenCalledWith(mockEmail);
  });

  it("handles reply all action", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    await user.click(screen.getByRole("button", { name: /Reply All/ }));
    expect(mockHandlers.onReplyAll).toHaveBeenCalledWith(mockEmail);
  });

  it("handles forward action", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    await user.click(screen.getByRole("button", { name: /Forward/ }));
    expect(mockHandlers.onForward).toHaveBeenCalledWith(mockEmail);
  });

  it("handles star toggle", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    const starButton = screen
      .getAllByRole("button")
      .find((btn) => btn.querySelector(".lucide-star") !== null);
    await user.click(starButton!);

    expect(mockHandlers.onStarEmail).toHaveBeenCalledWith(mockEmail);
  });

  it("shows filled star for starred emails", () => {
    const starredEmail = { ...mockEmail, isStarred: true };
    render(<EmailViewer email={starredEmail} {...mockHandlers} />);

    const starButton = screen
      .getAllByRole("button")
      .find((btn) => btn.querySelector(".fill-yellow-400") !== null);
    expect(starButton).toBeInTheDocument();
  });

  it("handles archive action", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    const archiveButton = screen
      .getAllByRole("button")
      .find((btn) => btn.querySelector(".lucide-archive") !== null);
    await user.click(archiveButton!);

    expect(mockHandlers.onArchiveEmail).toHaveBeenCalledWith(mockEmail);
  });

  it("handles trash action", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    const trashButton = screen
      .getAllByRole("button")
      .find((btn) => btn.querySelector(".lucide-trash2") !== null);
    await user.click(trashButton!);

    expect(mockHandlers.onTrashEmail).toHaveBeenCalledWith(mockEmail);
  });

  it("opens more actions dropdown", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EmailViewer email={mockEmail} {...mockHandlers} />,
    );

    // Find the more actions button - it's the last icon button in the action buttons group
    const actionButtons = container.querySelector(
      ".ml-auto.flex.items-center.space-x-2",
    );
    const buttons = actionButtons?.querySelectorAll("button") || [];
    const moreButton = buttons[buttons.length - 1];

    expect(moreButton).toBeTruthy();
    await user.click(moreButton!);

    // Wait for dropdown to be visible
    await waitFor(
      () => {
        expect(screen.getByText("Mark as unread")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText("Print")).toBeInTheDocument();
    expect(screen.getByText("View original")).toBeInTheDocument();
    expect(screen.getByText("Report spam")).toBeInTheDocument();
  });

  it("handles mark as unread from dropdown", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EmailViewer email={mockEmail} {...mockHandlers} />,
    );

    // Find the more actions button - it's the last icon button in the action buttons group
    const actionButtons = container.querySelector(
      ".ml-auto.flex.items-center.space-x-2",
    );
    const buttons = actionButtons?.querySelectorAll("button") || [];
    const moreButton = buttons[buttons.length - 1];

    expect(moreButton).toBeTruthy();
    await user.click(moreButton!);

    // Wait for dropdown to be visible
    await waitFor(
      () => {
        expect(screen.getByText("Mark as unread")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    await user.click(screen.getByText("Mark as unread"));
    expect(mockHandlers.onMarkAsUnread).toHaveBeenCalledWith(mockEmail);
  });

  it("renders attachments correctly", () => {
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    expect(screen.getByText("Attachments (2)")).toBeInTheDocument();
    expect(screen.getByText("project-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.95 MB")).toBeInTheDocument();
    expect(screen.getByText("data.xlsx")).toBeInTheDocument();
    expect(screen.getByText("500 KB")).toBeInTheDocument();
  });

  it("formats file sizes correctly", () => {
    const emailWithVariousAttachments: Email = {
      ...mockEmail,
      attachments: [
        {
          id: "0",
          gmailId: "g0",
          filename: "empty.txt",
          mimeType: "text/plain",
          size: 0,
        },
        {
          id: "1",
          gmailId: "g1",
          filename: "tiny.txt",
          mimeType: "text/plain",
          size: 100,
        },
        {
          id: "2",
          gmailId: "g2",
          filename: "small.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
        {
          id: "3",
          gmailId: "g3",
          filename: "medium.doc",
          mimeType: "application/msword",
          size: 1048576,
        },
        {
          id: "4",
          gmailId: "g4",
          filename: "large.zip",
          mimeType: "application/zip",
          size: 1073741824,
        },
      ],
    };

    render(
      <EmailViewer email={emailWithVariousAttachments} {...mockHandlers} />,
    );

    expect(screen.getByText("0 Bytes")).toBeInTheDocument();
    expect(screen.getByText("100 Bytes")).toBeInTheDocument();
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.getByText("1 MB")).toBeInTheDocument();
    expect(screen.getByText("1 GB")).toBeInTheDocument();
  });

  it("does not show attachments section when there are no attachments", () => {
    const emailWithoutAttachments = { ...mockEmail, attachments: [] };
    render(<EmailViewer email={emailWithoutAttachments} {...mockHandlers} />);

    expect(screen.queryByText(/Attachments/)).not.toBeInTheDocument();
  });

  it("does not show CC section when there are no CC recipients", () => {
    const emailWithoutCc = { ...mockEmail, ccEmails: [] };
    render(<EmailViewer email={emailWithoutCc} {...mockHandlers} />);

    expect(screen.queryByText("Cc:")).not.toBeInTheDocument();
  });

  it("formats date correctly", () => {
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    // The exact format depends on the user's locale, but it should contain the date
    expect(screen.getByText(/Jan.*15.*2024/)).toBeInTheDocument();
  });

  it("generates correct initials for avatar", () => {
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("generates initials from email when name is not available", () => {
    const emailWithoutName = { ...mockEmail, fromName: undefined };
    render(<EmailViewer email={emailWithoutName} {...mockHandlers} />);

    expect(screen.getByText("JO")).toBeInTheDocument(); // First two letters of email
  });

  it("shows question mark when neither name nor email is available", () => {
    const minimalEmail = { ...mockEmail, fromName: undefined, fromEmail: "" };
    render(<EmailViewer email={minimalEmail} {...mockHandlers} />);

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("does not render action buttons when handlers are not provided", () => {
    render(<EmailViewer email={mockEmail} />);

    expect(
      screen.queryByRole("button", { name: /^Reply$/ }),
    ).toBeInTheDocument();
    // Button is rendered but clicking does nothing without handler
  });

  it("handles close button click", async () => {
    const user = userEvent.setup();
    render(<EmailViewer email={mockEmail} {...mockHandlers} />);

    const closeButton = document.querySelector("button .lucide-x")
      ?.parentElement as HTMLElement;
    await user.click(closeButton);

    expect(mockHandlers.onClose).toHaveBeenCalled();
  });
});
