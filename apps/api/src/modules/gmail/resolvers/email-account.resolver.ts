import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Context,
} from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { EmailAccountService } from "../email-account.service";
import { GmailSyncService } from "../gmail-sync.service";
import { CustomGqlAuthGuard } from "../../../common/guards/custom-gql-auth.guard";
import { EmailAccount } from "../../prisma/prisma-client";

@Resolver("EmailAccount")
@UseGuards(CustomGqlAuthGuard)
export class EmailAccountResolver {
  constructor(
    private emailAccountService: EmailAccountService,
    private gmailSyncService: GmailSyncService,
  ) {}

  @Query("emailAccounts")
  async emailAccounts(@Context() _ctx: any): Promise<EmailAccount[]> {
    const { workspaceId } = ctx.req.user;
    return this.emailAccountService.findByWorkspace(workspaceId);
  }

  @Query("emailAccount")
  async emailAccount(
    @Args("id", { type: () => ID }) id: string,
    @Context() _ctx: any,
  ): Promise<EmailAccount | null> {
    // TODO: Add workspace validation
    return this.emailAccountService.findOne(id);
  }

  @Query("emailSyncStatus")
  async emailSyncStatus(@Context() _ctx: any): Promise<any[]> {
    const { workspaceId } = ctx.req.user;
    return this.gmailSyncService.getSyncStatus(workspaceId);
  }

  @Mutation("connectEmailAccount")
  async connectEmailAccount(
    @Args("input") input: { email: string; provider: string },
    @Context() _ctx: any,
  ): Promise<{ authUrl: string }> {
    // TODO: Implement OAuth flow initiation
    const authUrl = `${process.env.API_URL}/auth/google/connect?email=${input.email}&workspace=${ctx.req.user.workspaceId}`;
    return { authUrl };
  }

  @Mutation("disconnectEmailAccount")
  async disconnectEmailAccount(
    @Args("id", { type: () => ID }) id: string,
    @Context() _ctx: any,
  ): Promise<boolean> {
    // TODO: Add workspace validation
    await this.emailAccountService.delete(id);
    return true;
  }

  @Mutation("enableEmailSync")
  async enableEmailSync(
    @Args("id", { type: () => ID }) id: string,
    @Context() _ctx: any,
  ): Promise<EmailAccount> {
    // TODO: Add workspace validation
    return this.emailAccountService.enableSync(id);
  }

  @Mutation("disableEmailSync")
  async disableEmailSync(
    @Args("id", { type: () => ID }) id: string,
    @Context() _ctx: any,
  ): Promise<EmailAccount> {
    // TODO: Add workspace validation
    return this.emailAccountService.disableSync(id);
  }

  @Mutation("syncEmailAccount")
  async syncEmailAccount(
    @Args("id", { type: () => ID }) id: string,
    @Args("fullSync", { type: () => Boolean, nullable: true })
    fullSync?: boolean,
    @Context() ctx?: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // TODO: Add workspace validation
      await this.gmailSyncService.syncAccount(id, {
        fullSync,
        source: "manual",
      });
      return {
        success: true,
        message: "Sync started successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Sync failed",
      };
    }
  }
}
