#!/bin/bash

echo "🚀 Improving Test Coverage to 100%"
echo "=================================="

cd apps/api

# Create tests for uncovered lines in gmail.service.ts
cat > src/modules/gmail/gmail.service.coverage.spec.ts << 'EOF'
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { GmailService } from "./gmail.service";
import { google } from "googleapis";

jest.mock("googleapis");

describe("GmailService Coverage - Lines 158-217, 257-269, 324-326", () => {
  let service: GmailService;
  
  const mockGmailClient = {
    users: {
      drafts: { create: jest.fn() },
      threads: { list: jest.fn(), get: jest.fn() },
      messages: { trash: jest.fn(), modify: jest.fn() },
    },
  };

  const mockOAuth2Client = {
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (google.auth.OAuth2 as jest.Mock).mockImplementation(() => mockOAuth2Client);
    (google.gmail as jest.Mock).mockReturnValue(mockGmailClient);

    const module = await Test.createTestingModule({
      providers: [
        GmailService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => "test-value") },
        },
      ],
    }).compile();

    service = module.get<GmailService>(GmailService);
  });

  describe("createDraft - lines 158-186", () => {
    it("should create draft with single recipient", async () => {
      mockGmailClient.users.drafts.create.mockResolvedValue({ 
        data: { id: "draft-1", message: { id: "msg-1" } } 
      });
      
      const result = await service.createDraft("token", "test@example.com", "Subject", "Body");
      
      expect(result.id).toBe("draft-1");
      expect(mockGmailClient.users.drafts.create).toHaveBeenCalledWith({
        userId: "me",
        requestBody: {
          message: {
            raw: expect.any(String),
          },
        },
      });
    });

    it("should create draft with array recipients", async () => {
      mockGmailClient.users.drafts.create.mockResolvedValue({ 
        data: { id: "draft-2" } 
      });
      
      const result = await service.createDraft(
        "token", 
        ["a@test.com", "b@test.com"], 
        "Subject", 
        "<p>HTML Body</p>"
      );
      
      expect(result.id).toBe("draft-2");
      
      // Verify email encoding
      const call = mockGmailClient.users.drafts.create.mock.calls[0][0];
      const raw = call.requestBody.message.raw;
      expect(raw).not.toContain("+");
      expect(raw).not.toContain("/");
      expect(raw).not.toContain("=");
    });
  });

  describe("listThreads - lines 191-205", () => {
    it("should list threads with all parameters", async () => {
      mockGmailClient.users.threads.list.mockResolvedValue({ 
        data: { 
          threads: [{ id: "t1" }, { id: "t2" }],
          nextPageToken: "next" 
        } 
      });
      
      const result = await service.listThreads("token", "query", "pageToken", 50);
      
      expect(result.threads).toHaveLength(2);
      expect(result.nextPageToken).toBe("next");
      expect(mockGmailClient.users.threads.list).toHaveBeenCalledWith({
        userId: "me",
        q: "query",
        pageToken: "pageToken",
        maxResults: 50,
      });
    });

    it("should list threads with defaults", async () => {
      mockGmailClient.users.threads.list.mockResolvedValue({ 
        data: { threads: [] } 
      });
      
      await service.listThreads("token");
      
      expect(mockGmailClient.users.threads.list).toHaveBeenCalledWith({
        userId: "me",
        q: undefined,
        pageToken: undefined,
        maxResults: 20,
      });
    });
  });

  describe("getThread - lines 210-218", () => {
    it("should get thread details", async () => {
      mockGmailClient.users.threads.get.mockResolvedValue({ 
        data: { 
          id: "thread-1",
          messages: [{ id: "msg-1" }, { id: "msg-2" }]
        } 
      });
      
      const result = await service.getThread("token", "thread-1");
      
      expect(result.id).toBe("thread-1");
      expect(result.messages).toHaveLength(2);
      expect(mockGmailClient.users.threads.get).toHaveBeenCalledWith({
        userId: "me",
        id: "thread-1",
        format: "full",
      });
    });
  });

  describe("archiveMessage - lines 257-258", () => {
    it("should archive message", async () => {
      mockGmailClient.users.messages.modify.mockResolvedValue({ 
        data: { id: "msg-1", labelIds: [] } 
      });
      
      const result = await service.archiveMessage("token", "msg-1");
      
      expect(result.id).toBe("msg-1");
      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: "msg-1",
        requestBody: {
          addLabelIds: [],
          removeLabelIds: ["INBOX"],
        },
      });
    });
  });

  describe("trashMessage - lines 263-269", () => {
    it("should trash message", async () => {
      mockGmailClient.users.messages.trash.mockResolvedValue({ 
        data: { id: "msg-1", labelIds: ["TRASH"] } 
      });
      
      const result = await service.trashMessage("token", "msg-1");
      
      expect(result.id).toBe("msg-1");
      expect(result.labelIds).toContain("TRASH");
      expect(mockGmailClient.users.messages.trash).toHaveBeenCalledWith({
        userId: "me",
        id: "msg-1",
      });
    });
  });

  describe("refreshAccessToken - lines 324-326", () => {
    it("should refresh access token", async () => {
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: { access_token: "new-token" },
      });
      
      const result = await service.refreshAccessToken("refresh-token");
      
      expect(result).toBe("new-token");
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: "refresh-token",
      });
    });

    it("should return empty string when no access token", async () => {
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {},
      });
      
      const result = await service.refreshAccessToken("refresh-token");
      
      expect(result).toBe("");
    });
  });

  describe("getGmailClient - lines 32-34", () => {
    it("should create gmail client", async () => {
      const accessToken = "test-token";
      
      const client = await service.getGmailClient(accessToken);
      
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: accessToken,
      });
      expect(google.gmail).toHaveBeenCalledWith({
        version: "v1",
        auth: mockOAuth2Client,
      });
      expect(client).toBe(mockGmailClient);
    });
  });
});
EOF

# Create tests for contacts.resolver.ts uncovered lines
cat > src/modules/contacts/contacts.resolver.coverage.spec.ts << 'EOF'
import { Test } from "@nestjs/testing";
import { ContactsResolver } from "./contacts.resolver";
import { ContactsService } from "./contacts.service";

describe("ContactsResolver Coverage", () => {
  let resolver: ContactsResolver;
  let service: ContactsService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    updateScore: jest.fn(),
    getContactsByCompany: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        workspaceId: "workspace-123",
        userId: "user-123",
      },
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContactsResolver,
        {
          provide: ContactsService,
          useValue: mockService,
        },
      ],
    }).compile();

    resolver = module.get<ContactsResolver>(ContactsResolver);
    service = module.get<ContactsService>(ContactsService);
    jest.clearAllMocks();
  });

  // Cover all methods
  it("should create contact", async () => {
    const input = { email: "test@example.com", firstName: "Test" };
    mockService.create.mockResolvedValue({ id: "1", ...input });
    
    const result = await resolver.createContact(input, mockContext);
    
    expect(result.id).toBe("1");
    expect(service.create).toHaveBeenCalledWith("workspace-123", "user-123", input);
  });

  it("should find all contacts", async () => {
    const response = { contacts: [], total: 0, hasMore: false };
    mockService.findAll.mockResolvedValue(response);
    
    const result = await resolver.findAll(undefined, 0, 20, mockContext);
    
    expect(result).toEqual(response);
    expect(service.findAll).toHaveBeenCalledWith("workspace-123", undefined, 0, 20);
  });

  it("should find one contact", async () => {
    mockService.findOne.mockResolvedValue({ id: "1" });
    
    const result = await resolver.findOne("1", mockContext);
    
    expect(result.id).toBe("1");
    expect(service.findOne).toHaveBeenCalledWith("1", "workspace-123");
  });

  it("should search contacts", async () => {
    const response = { contacts: [], total: 0, hasMore: false };
    mockService.search.mockResolvedValue(response);
    
    const result = await resolver.search("query", undefined, 0, 20, mockContext);
    
    expect(result).toEqual(response);
    expect(service.search).toHaveBeenCalledWith("workspace-123", "query", undefined, 0, 20);
  });

  it("should update contact", async () => {
    const input = { id: "1", firstName: "Updated" };
    mockService.update.mockResolvedValue({ id: "1", firstName: "Updated" });
    
    const result = await resolver.updateContact(input, mockContext);
    
    expect(result.firstName).toBe("Updated");
    expect(service.update).toHaveBeenCalledWith("1", "workspace-123", { firstName: "Updated" });
  });

  it("should remove contact", async () => {
    mockService.remove.mockResolvedValue({ id: "1", deletedAt: new Date() });
    
    const result = await resolver.removeContact("1", mockContext);
    
    expect(result.deletedAt).toBeDefined();
    expect(service.remove).toHaveBeenCalledWith("1", "workspace-123");
  });

  it("should restore contact", async () => {
    mockService.restore.mockResolvedValue({ id: "1", deletedAt: null });
    
    const result = await resolver.restoreContact("1", mockContext);
    
    expect(result.deletedAt).toBeNull();
    expect(service.restore).toHaveBeenCalledWith("1", "workspace-123");
  });

  it("should update contact score", async () => {
    mockService.updateScore.mockResolvedValue({ id: "1", score: 100 });
    
    const result = await resolver.updateContactScore("1", 100, mockContext);
    
    expect(result.score).toBe(100);
    expect(service.updateScore).toHaveBeenCalledWith("1", "workspace-123", 100);
  });

  it("should get contacts by company", async () => {
    mockService.getContactsByCompany.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    
    const result = await resolver.contactsByCompany("company-1", mockContext);
    
    expect(result).toHaveLength(2);
    expect(service.getContactsByCompany).toHaveBeenCalledWith("company-1", "workspace-123");
  });
});
EOF

# Create tests for gmail-sync.service.ts uncovered lines
cat > src/modules/gmail/gmail-sync.service.coverage.spec.ts << 'EOF'
import { Test } from "@nestjs/testing";
import { GmailSyncService } from "./gmail-sync.service";
import { GmailService } from "./gmail.service";
import { EmailService } from "./email.service";
import { EmailAccountService } from "./email-account.service";
import { GmailHistoryService } from "./gmail-history.service";
import { PrismaService } from "../prisma/prisma.service";
import { getQueueToken } from "@nestjs/bullmq";

describe("GmailSyncService Coverage", () => {
  let service: GmailSyncService;

  const mockQueue = {
    add: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };

  const mockGmailService = {
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    getAttachment: jest.fn(),
  };

  const mockEmailService = {
    createFromGmail: jest.fn(),
    updateFromGmail: jest.fn(),
    findByMessageId: jest.fn(),
  };

  const mockEmailAccountService = {
    findOne: jest.fn(),
    findByWorkspace: jest.fn(),
    getFreshAccessToken: jest.fn(),
    updateSyncState: jest.fn(),
  };

  const mockGmailHistoryService = {
    processHistory: jest.fn(),
  };

  const mockPrismaService = {
    email: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    emailAttachment: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module = await Test.createTestingModule({
      providers: [
        GmailSyncService,
        { provide: GmailService, useValue: mockGmailService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EmailAccountService, useValue: mockEmailAccountService },
        { provide: GmailHistoryService, useValue: mockGmailHistoryService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken("message-fetch"), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<GmailSyncService>(GmailSyncService);
  });

  describe("downloadAttachment", () => {
    it("should handle account not found", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);
      
      await expect(
        service.downloadAttachment("acc-1", "msg-1", "att-1", "file.pdf")
      ).rejects.toThrow("Account not found");
    });

    it("should handle email not found", async () => {
      mockEmailAccountService.findOne.mockResolvedValue({ id: "acc-1" });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue("token");
      mockEmailService.findByMessageId.mockResolvedValue(null);
      
      const spy = jest.spyOn(service["logger"], "warn");
      
      await service.downloadAttachment("acc-1", "msg-1", "att-1", "file.pdf");
      
      expect(spy).toHaveBeenCalledWith("Email msg-1 not found for attachment");
    });

    it("should handle attachment with no data", async () => {
      mockEmailAccountService.findOne.mockResolvedValue({ id: "acc-1" });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue("token");
      mockEmailService.findByMessageId.mockResolvedValue({ id: "email-1" });
      mockGmailService.getAttachment.mockResolvedValue({ data: null });
      
      const spy = jest.spyOn(service["logger"], "warn");
      
      await service.downloadAttachment("acc-1", "msg-1", "att-1", "file.pdf");
      
      expect(spy).toHaveBeenCalledWith("No data for attachment att-1");
    });

    it("should handle attachment download error", async () => {
      mockEmailAccountService.findOne.mockResolvedValue({ id: "acc-1" });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue("token");
      mockEmailService.findByMessageId.mockResolvedValue({ id: "email-1" });
      mockGmailService.getAttachment.mockRejectedValue(new Error("Download failed"));
      
      const spy = jest.spyOn(service["logger"], "error");
      
      await service.downloadAttachment("acc-1", "msg-1", "att-1", "file.pdf");
      
      expect(spy).toHaveBeenCalledWith("Failed to download attachment att-1:", expect.any(Error));
    });

    it("should successfully download attachment", async () => {
      mockEmailAccountService.findOne.mockResolvedValue({ id: "acc-1" });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue("token");
      mockEmailService.findByMessageId.mockResolvedValue({ id: "email-1" });
      mockGmailService.getAttachment.mockResolvedValue({ data: "base64data" });
      
      await service.downloadAttachment("acc-1", "msg-1", "att-1", "file.pdf");
      
      expect(mockPrismaService.emailAttachment.updateMany).toHaveBeenCalledWith({
        where: { emailId: "email-1", gmailId: "att-1" },
        data: { url: "attachment://msg-1/att-1/file.pdf" },
      });
    });
  });

  describe("getSyncStatus", () => {
    it("should get sync status for all accounts", async () => {
      mockEmailAccountService.findByWorkspace.mockResolvedValue([
        { id: "acc-1", email: "test1@example.com", lastHistoryId: "123", syncCursor: "cursor-1" },
        { id: "acc-2", email: "test2@example.com", lastHistoryId: "456", syncCursor: null },
      ]);
      mockPrismaService.email.count.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
      
      const result = await service.getSyncStatus("workspace-1");
      
      expect(result).toEqual([
        { id: "acc-1", email: "test1@example.com", emailCount: 100, lastHistoryId: "123", syncCursor: "cursor-1" },
        { id: "acc-2", email: "test2@example.com", emailCount: 50, lastHistoryId: "456", syncCursor: null },
      ]);
    });
  });
});
EOF

# Run the new tests
echo "Running coverage tests..."
npx jest --testPathPattern="coverage.spec" --coverage --silent 2>&1 | tail -20

echo ""
echo "📊 Final coverage report:"
pnpm test:cov --silent 2>&1 | grep -A5 "All files"