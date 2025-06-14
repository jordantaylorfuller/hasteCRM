import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailComposer } from "./EmailComposer";
import { Email } from "@/types/email";

const mockOnSend = jest.fn();
const mockOnClose = jest.fn();

const mockReplyToEmail: Email = {
  id: "1",
  gmailId: "gmail-1",
  threadId: "thread-1",
  fromEmail: "john@example.com",
  fromName: "John Doe",
  toEmails: ["me@example.com"],
  ccEmails: ["team@example.com"],
  bccEmails: [],
  subject: "Original Subject",
  snippet: "This is the original email content...",
  bodyText: "This is the original email content that we are replying to.",
  sentAt: "2024-01-15T10:30:00Z",
  receivedAt: "2024-01-15T10:31:00Z",
  isRead: true,
  isStarred: false,
};

describe("EmailComposer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSend.mockResolvedValue(undefined);
  });

  it("renders composer dialog when open", () => {
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    expect(screen.getByText("New Message")).toBeInTheDocument();
    expect(screen.getByLabelText("To:")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Compose your message..."),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <EmailComposer isOpen={false} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    expect(screen.queryByText("New Message")).not.toBeInTheDocument();
  });

  it("adds recipients when Enter key is pressed", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "test@example.com");
    await user.keyboard("{Enter}");

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("adds recipients when comma key is pressed", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "test@example.com,");

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("validates email format before adding", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "invalid-email");
    await user.keyboard("{Enter}");

    expect(screen.queryByText("invalid-email")).not.toBeInTheDocument();
  });

  it("removes recipients when X is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        defaultTo={["test@example.com"]}
      />,
    );

    expect(screen.getByText("test@example.com")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /x/i });
    await user.click(removeButton);

    expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
  });

  it("shows CC field when CC button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    expect(screen.queryByLabelText("Cc:")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cc" }));

    expect(screen.getByLabelText("Cc:")).toBeInTheDocument();
  });

  it("shows BCC field when BCC button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    expect(screen.queryByLabelText("Bcc:")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bcc" }));

    expect(screen.getByLabelText("Bcc:")).toBeInTheDocument();
  });

  it("handles subject input", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const subjectInput = screen.getByPlaceholderText("Add a subject");
    await user.type(subjectInput, "Test Subject");

    expect(subjectInput).toHaveValue("Test Subject");
  });

  it("handles body input", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "This is the email body");

    expect(bodyTextarea).toHaveValue("This is the email body");
  });

  it("sets up reply correctly", () => {
    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        replyTo={mockReplyToEmail}
      />,
    );

    expect(screen.getByText("Reply")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Re: Original Subject")).toBeInTheDocument();
    expect(
      screen.getByText(/On.*John Doe wrote:/),
    ).toBeInTheDocument();
  });

  it("sets up reply all correctly", () => {
    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        replyTo={mockReplyToEmail}
        replyAll={true}
      />,
    );

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("team@example.com")).toBeInTheDocument();
  });

  it("sets up forward correctly", () => {
    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        replyTo={mockReplyToEmail}
        forward={true}
      />,
    );

    expect(screen.getByText("Forward Email")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fwd: Original Subject")).toBeInTheDocument();
    expect(screen.getByText(/---------- Forwarded message ----------/)).toBeInTheDocument();
  });

  it("handles file attachments", async () => {
    const user = userEvent.setup();
    const file = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    expect(screen.getByText("(0.01 KB)")).toBeInTheDocument();
  });

  it("removes attachments when X is clicked", async () => {
    const user = userEvent.setup();
    const file = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText("test.pdf")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector(".lucide-x") !== null,
    );
    await user.click(removeButtons[removeButtons.length - 1]);

    expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
  });

  it("formats text as bold", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "test");
    
    // Select all text
    bodyTextarea.setSelectionRange(0, 4);

    const boldButton = screen.getByRole("button", { name: "Bold" });
    await user.click(boldButton);

    expect(bodyTextarea).toHaveValue("**test**");
  });

  it("formats text as italic", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "test");
    
    // Select all text
    bodyTextarea.setSelectionRange(0, 4);

    const italicButton = screen.getByRole("button", { name: "Italic" });
    await user.click(italicButton);

    expect(bodyTextarea).toHaveValue("*test*");
  });

  it("sends email with correct data", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Add recipient
    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "recipient@example.com");
    await user.keyboard("{Enter}");

    // Add subject
    const subjectInput = screen.getByPlaceholderText("Add a subject");
    await user.type(subjectInput, "Test Subject");

    // Add body
    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "Test email body");

    // Send
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(mockOnSend).toHaveBeenCalledWith({
      to: ["recipient@example.com"],
      subject: "Test Subject",
      body: "Test email body",
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("disables send button when required fields are empty", () => {
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when all required fields are filled", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Add recipient
    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "recipient@example.com");
    await user.keyboard("{Enter}");

    // Add subject
    const subjectInput = screen.getByPlaceholderText("Add a subject");
    await user.type(subjectInput, "Test Subject");

    // Add body
    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "Test email body");

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).not.toBeDisabled();
  });

  it("shows sending state", async () => {
    const user = userEvent.setup();
    let resolveSend: () => void;
    mockOnSend.mockImplementation(() => new Promise((resolve) => {
      resolveSend = resolve;
    }));

    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        defaultTo={["test@example.com"]}
        defaultSubject="Test"
        defaultBody="Test body"
      />,
    );

    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("Sending...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    resolveSend!();
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("handles send error gracefully", async () => {
    const user = userEvent.setup();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    mockOnSend.mockRejectedValue(new Error("Send failed"));

    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        defaultTo={["test@example.com"]}
        defaultSubject="Test"
        defaultBody="Test body"
      />,
    );

    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to send email:", expect.any(Error));
    });

    // Should not close on error
    expect(mockOnClose).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles discard action", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("uses default values when provided", () => {
    render(
      <EmailComposer
        isOpen={true}
        onClose={mockOnClose}
        onSend={mockOnSend}
        defaultTo={["default@example.com"]}
        defaultSubject="Default Subject"
        defaultBody="Default body text"
      />,
    );

    expect(screen.getByText("default@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Default Subject")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Default body text")).toBeInTheDocument();
  });
});