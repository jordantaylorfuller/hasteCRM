import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Context,
  Int,
} from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { EmailService } from "../email.service";
import { GmailService } from "../gmail.service";
import { EmailAccountService } from "../email-account.service";
import { CustomGqlAuthGuard } from "../../../common/guards/custom-gql-auth.guard";
import { Email } from "../../prisma/prisma-client";

@Resolver("Email")
@UseGuards(CustomGqlAuthGuard)
export class EmailResolver {
  constructor(
    private emailService: EmailService,
    private gmailService: GmailService,
    private emailAccountService: EmailAccountService,
  ) {}

  @Query("emails")
  async emails(
    @Args("skip", { type: () => Int, nullable: true }) skip?: number,
    @Args("take", { type: () => Int, nullable: true }) take?: number,
    @Args("filters", { nullable: true }) filters?: any,
    @Context() ctx?: any,
  ): Promise<{ emails: Email[]; total: number; hasMore: boolean }> {
    const { workspaceId } = _ctx.req.user;
    const { emails, total } = await this.emailService.findByWorkspace(
      workspaceId,
      {
        skip: skip || 0,
        take: take || 20,
        where: filters,
      },
    );

    return {
      emails,
      total,
      hasMore: (skip || 0) + emails.length < total,
    };
  }

  @Query("email")
  async email(
    @Args("id", { type: () => ID }) id: string,
    @Context() _ctx: any,
  ): Promise<Email | null> {
    // TODO: Add workspace validation
    const email = await this.emailService.findByMessageId(id);
    if (email) {
      // Mark as read
      await this.emailService.markAsRead(id);
    }
    return email;
  }

  @Query("emailThread")
  async emailThread(
    @Args("threadId") threadId: string,
    @Context() _ctx: any,
  ): Promise<Email[]> {
    // TODO: Add workspace validation
    return this.emailService.findByThread(threadId);
  }

  @Query("searchEmails")
  async searchEmails(
    @Args("query") query: string,
    @Args("skip", { type: () => Int, nullable: true }) skip?: number,
    @Args("take", { type: () => Int, nullable: true }) take?: number,
    @Context() ctx?: any,
  ): Promise<{ emails: Email[]; total: number; hasMore: boolean }> {
    const { workspaceId } = _ctx.req.user;
    const { emails, total } = await this.emailService.search(
      workspaceId,
      query,
      {
        skip: skip || 0,
        take: take || 20,
      },
    );

    return {
      emails,
      total,
      hasMore: (skip || 0) + emails.length < total,
    };
  }

  @Query("emailStats")
  async emailStats(@Context() _ctx: any): Promise<any> {
    const { workspaceId } = _ctx.req.user;
    return this.emailService.getStats(workspaceId);
  }

  @Mutation("sendEmail")
  async sendEmail(
    @Args("input") input: any,
    @Context() _ctx: any,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { userId } = _ctx.req.user;

      // Get email account
      const accounts = await this.emailAccountService.findByUser(userId);
      const account = accounts.find((a) => a.email === input.from);

      if (!account) {
        return {
          success: false,
          error: "Email account not found",
        };
      }

      // Get fresh token
      const accessToken = await this.emailAccountService.getFreshAccessToken(
        account.id,
      );

      // Send email via Gmail
      const result = await this.gmailService.sendEmail(
        accessToken,
        input.to,
        input.subject,
        input.body,
        {
          cc: input.cc,
          bcc: input.bcc,
          replyTo: input.replyTo,
        },
      );

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }
  }

  @Mutation("createDraft")
  async createDraft(
    @Args("input") input: any,
    @Context() _ctx: any,
  ): Promise<{ success: boolean; draftId?: string; error?: string }> {
    try {
      const { userId } = _ctx.req.user;

      // Get email account
      const accounts = await this.emailAccountService.findByUser(userId);
      const account = accounts.find((a) => a.email === input.from);

      if (!account) {
        return {
          success: false,
          error: "Email account not found",
        };
      }

      // Get fresh token
      const accessToken = await this.emailAccountService.getFreshAccessToken(
        account.id,
      );

      // Create draft via Gmail
      const result = await this.gmailService.createDraft(
        accessToken,
        input.to,
        input.subject,
        input.body,
      );

      return {
        success: true,
        draftId: result.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create draft",
      };
    }
  }

  @Mutation("markEmailAsRead")
  async markEmailAsRead(
    @Args("messageId") messageId: string,
    @Context() _ctx: any,
  ): Promise<Email> {
    // TODO: Add workspace validation
    return this.emailService.markAsRead(messageId);
  }

  @Mutation("markEmailAsUnread")
  async markEmailAsUnread(
    @Args("messageId") messageId: string,
    @Context() _ctx: any,
  ): Promise<Email> {
    // TODO: Add workspace validation
    return this.emailService.markAsUnread(messageId);
  }

  @Mutation("toggleEmailStar")
  async toggleEmailStar(
    @Args("messageId") messageId: string,
    @Context() _ctx: any,
  ): Promise<Email> {
    // TODO: Add workspace validation
    return this.emailService.toggleStar(messageId);
  }

  @Mutation("archiveEmail")
  async archiveEmail(
    @Args("messageId") messageId: string,
    @Context() _ctx: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const email = await this.emailService.findByMessageId(messageId);
      if (!email) {
        return {
          success: false,
          error: "Email not found",
        };
      }

      // Get account
      const account = await this.emailAccountService.findOne(email.accountId);
      if (!account) {
        return {
          success: false,
          error: "Email account not found",
        };
      }

      // Get fresh token
      const accessToken = await this.emailAccountService.getFreshAccessToken(
        account.id,
      );

      // Archive via Gmail
      await this.gmailService.archiveMessage(accessToken, messageId);

      // Update local labels
      await this.emailService.removeLabels(email.workspaceId, messageId, [
        "INBOX",
      ]);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to archive email",
      };
    }
  }

  @Mutation("trashEmail")
  async trashEmail(
    @Args("messageId") messageId: string,
    @Context() _ctx: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const email = await this.emailService.findByMessageId(messageId);
      if (!email) {
        return {
          success: false,
          error: "Email not found",
        };
      }

      // Get account
      const account = await this.emailAccountService.findOne(email.accountId);
      if (!account) {
        return {
          success: false,
          error: "Email account not found",
        };
      }

      // Get fresh token
      const accessToken = await this.emailAccountService.getFreshAccessToken(
        account.id,
      );

      // Trash via Gmail
      await this.gmailService.trashMessage(accessToken, messageId);

      // Update local labels
      await this.emailService.addLabels(email.workspaceId, messageId, [
        "TRASH",
      ]);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to trash email",
      };
    }
  }
}
