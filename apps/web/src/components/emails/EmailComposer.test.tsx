import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailComposer } from "./EmailComposer";
import { Email } from "@/types/email";

// Mock Radix UI dialog
jest.mock("@radix-ui/react-dialog");

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
    expect(screen.getByText("To:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add recipients..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Subject:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Compose your message..."),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <EmailComposer
        isOpen={false}
        onClose={mockOnClose}
        onSend={mockOnSend}
      />,
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

    // Find the badge with the email and then find the X button within it
    const badge = screen.getByText("test@example.com").parentElement;
    const removeButton = badge?.querySelector("button");
    if (removeButton) {
      await user.click(removeButton);
    }

    expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
  });

  it("shows CC field when CC button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    expect(screen.queryByText("Cc:")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cc" }));

    expect(screen.getByText("Cc:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add Cc recipients..."),
    ).toBeInTheDocument();
  });

  it("shows BCC field when BCC button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    expect(screen.queryByText("Bcc:")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bcc" }));

    expect(screen.getByText("Bcc:")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add Bcc recipients..."),
    ).toBeInTheDocument();
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
    expect(
      screen.getByDisplayValue("Re: Original Subject"),
    ).toBeInTheDocument();
    expect(screen.getByText(/On.*John Doe wrote:/)).toBeInTheDocument();
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
    expect(
      screen.getByDisplayValue("Fwd: Original Subject"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/---------- Forwarded message ----------/),
    ).toBeInTheDocument();
  });

  it("handles file attachments", async () => {
    const user = userEvent.setup();
    const file = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    // File size formatting might vary, just check the file is displayed
  });

  it("removes attachments when X is clicked", async () => {
    const user = userEvent.setup();
    const file = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText("test.pdf")).toBeInTheDocument();

    // Click the remove button
    const removeButton = screen.getByRole("button", { name: "" });
    await user.click(removeButton);

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
    mockOnSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

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
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to send email:",
        expect.any(Error),
      );
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

  it("formats text as list", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "test");

    // Select all text
    bodyTextarea.setSelectionRange(0, 4);

    const listButton = screen.getByRole("button", { name: "Bullet List" });
    await user.click(listButton);

    expect(bodyTextarea).toHaveValue("\n- test");
  });

  it("handles CC recipient input correctly", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Show CC field
    await user.click(screen.getByRole("button", { name: "Cc" }));

    // Add CC recipient
    const ccInput = screen.getByPlaceholderText("Add Cc recipients...");
    await user.type(ccInput, "cc@example.com");
    await user.keyboard("{Enter}");

    expect(screen.getByText("cc@example.com")).toBeInTheDocument();
  });

  it("handles BCC recipient input correctly", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Show BCC field
    await user.click(screen.getByRole("button", { name: "Bcc" }));

    // Add BCC recipient
    const bccInput = screen.getByPlaceholderText("Add Bcc recipients...");
    await user.type(bccInput, "bcc@example.com");
    await user.keyboard("{Enter}");

    expect(screen.getByText("bcc@example.com")).toBeInTheDocument();
  });

  it("removes CC recipients correctly", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Show CC field
    await user.click(screen.getByRole("button", { name: "Cc" }));

    // Add CC recipient
    const ccInput = screen.getByPlaceholderText("Add Cc recipients...");
    await user.type(ccInput, "cc@example.com");
    await user.keyboard("{Enter}");

    expect(screen.getByText("cc@example.com")).toBeInTheDocument();

    // Find and click the remove button in the CC badge
    const ccBadge = screen.getByText("cc@example.com").parentElement;
    const removeButton = ccBadge?.querySelector("button");
    if (removeButton) {
      await user.click(removeButton);
    }

    expect(screen.queryByText("cc@example.com")).not.toBeInTheDocument();
  });

  it("removes BCC recipients correctly", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Show BCC field
    await user.click(screen.getByRole("button", { name: "Bcc" }));

    // Add BCC recipient
    const bccInput = screen.getByPlaceholderText("Add Bcc recipients...");
    await user.type(bccInput, "bcc@example.com");
    await user.keyboard("{Enter}");

    expect(screen.getByText("bcc@example.com")).toBeInTheDocument();

    // Find and click the remove button in the BCC badge
    const bccBadge = screen.getByText("bcc@example.com").parentElement;
    const removeButton = bccBadge?.querySelector("button");
    if (removeButton) {
      await user.click(removeButton);
    }

    expect(screen.queryByText("bcc@example.com")).not.toBeInTheDocument();
  });

  it("handles comma-separated recipients input", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const toInput = screen.getByPlaceholderText("Add recipients...");

    // Type first email and press comma
    await user.type(toInput, "first@example.com");
    await user.keyboard(",");
    expect(screen.getByText("first@example.com")).toBeInTheDocument();

    // Type second email and press comma
    await user.type(toInput, "second@example.com");
    await user.keyboard(",");
    expect(screen.getByText("second@example.com")).toBeInTheDocument();
  });

  it("sends email with CC and BCC recipients", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Add To recipient
    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "to@example.com");
    await user.keyboard("{Enter}");

    // Add CC recipient
    await user.click(screen.getByRole("button", { name: "Cc" }));
    const ccInput = screen.getByPlaceholderText("Add Cc recipients...");
    await user.type(ccInput, "cc@example.com");
    await user.keyboard("{Enter}");

    // Add BCC recipient
    await user.click(screen.getByRole("button", { name: "Bcc" }));
    const bccInput = screen.getByPlaceholderText("Add Bcc recipients...");
    await user.type(bccInput, "bcc@example.com");
    await user.keyboard("{Enter}");

    // Add subject and body
    const subjectInput = screen.getByPlaceholderText("Add a subject");
    await user.type(subjectInput, "Test Subject");

    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "Test body");

    // Send
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(mockOnSend).toHaveBeenCalledWith({
      to: ["to@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      subject: "Test Subject",
      body: "Test body",
    });
  });

  it("handles recipient input focus changes", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Show CC and BCC fields
    await user.click(screen.getByRole("button", { name: "Cc" }));
    await user.click(screen.getByRole("button", { name: "Bcc" }));

    const toInput = screen.getByPlaceholderText("Add recipients...");
    const ccInput = screen.getByPlaceholderText("Add Cc recipients...");
    const bccInput = screen.getByPlaceholderText("Add Bcc recipients...");

    // Add recipient to TO field
    await user.click(toInput);
    await user.type(toInput, "to@example.com");
    await user.keyboard("{Enter}");
    expect(screen.getByText("to@example.com")).toBeInTheDocument();

    // Add recipient to CC field
    await user.click(ccInput);
    await user.type(ccInput, "cc@example.com");
    await user.keyboard("{Enter}");
    expect(screen.getByText("cc@example.com")).toBeInTheDocument();

    // Add recipient to BCC field
    await user.click(bccInput);
    await user.type(bccInput, "bcc@example.com");
    await user.keyboard("{Enter}");
    expect(screen.getByText("bcc@example.com")).toBeInTheDocument();

    // All three recipients should be visible
    expect(screen.getByText("to@example.com")).toBeInTheDocument();
    expect(screen.getByText("cc@example.com")).toBeInTheDocument();
    expect(screen.getByText("bcc@example.com")).toBeInTheDocument();
  });

  it("handles file upload and triggers attach button click", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Click the attach file button
    const attachButton = screen.getByRole("button", { name: "Attach File" });

    // Mock the file input click
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, "click");

    await user.click(attachButton);

    expect(clickSpy).toHaveBeenCalled();
  });

  it("validates multiple email addresses separated by comma", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const toInput = screen.getByPlaceholderText("Add recipients...");

    // Type first email and press comma
    await user.type(toInput, "valid@example.com");
    await user.keyboard(",");
    expect(screen.getByText("valid@example.com")).toBeInTheDocument();

    // Type invalid email and press comma
    await user.type(toInput, "invalid");
    await user.keyboard(",");
    // Invalid email should not be added
    expect(screen.queryByText("invalid")).not.toBeInTheDocument();

    // Clear the input manually after invalid email
    await user.clear(toInput);

    // Type another valid email and press comma
    await user.type(toInput, "another@example.com");
    await user.keyboard(",");
    expect(screen.getByText("another@example.com")).toBeInTheDocument();
  });

  it("handles empty recipient removal gracefully", async () => {
    const user = userEvent.setup();

    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Show CC and BCC fields
    await user.click(screen.getByRole("button", { name: "Cc" }));
    await user.click(screen.getByRole("button", { name: "Bcc" }));

    // No recipient badges should exist yet
    const badges = screen.queryAllByRole("button").filter((button) => {
      const parent = button.parentElement;
      return parent?.tagName === "SPAN" && parent?.textContent?.includes("@");
    });
    expect(badges).toHaveLength(0);
  });

  it("handles edge case for text formatting with no selection", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");

    // Don't select any text
    bodyTextarea.setSelectionRange(0, 0);

    const boldButton = screen.getByRole("button", { name: "Bold" });
    await user.click(boldButton);

    // Should add empty bold markers
    expect(bodyTextarea).toHaveValue("****");
  });

  it("does not send email when body contains only whitespace", async () => {
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

    // Add body with only whitespace
    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "   ");

    // The button should be disabled because body.trim() is empty
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();

    // Even if we could click it, onSend would not be called
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("does not send email when there are no recipients", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Add subject
    const subjectInput = screen.getByPlaceholderText("Add a subject");
    await user.type(subjectInput, "Test Subject");

    // Add body
    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "Test body");

    // The button should be disabled because there are no recipients
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("does not send email when subject is empty", async () => {
    const user = userEvent.setup();
    render(
      <EmailComposer isOpen={true} onClose={mockOnClose} onSend={mockOnSend} />,
    );

    // Add recipient
    const toInput = screen.getByPlaceholderText("Add recipients...");
    await user.type(toInput, "recipient@example.com");
    await user.keyboard("{Enter}");

    // Don't add subject

    // Add body
    const bodyTextarea = screen.getByPlaceholderText("Compose your message...");
    await user.type(bodyTextarea, "Test body");

    // The button should be disabled because subject is empty
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it("handles send with attachments", async () => {
    const user = userEvent.setup();
    const file1 = new File(["content1"], "file1.pdf", {
      type: "application/pdf",
    });
    const file2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });

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

    // Upload files
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, [file1, file2]);

    // Send email
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(mockOnSend).toHaveBeenCalledWith({
      to: ["test@example.com"],
      subject: "Test",
      body: "Test body",
      attachments: [file1, file2],
    });
  });
});
