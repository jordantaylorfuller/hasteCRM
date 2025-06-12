import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SessionService, SessionData } from "./session.service";

@Controller("auth/sessions")
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getActiveSessions(@Request() req): Promise<SessionData[]> {
    return this.sessionService.getUserActiveSessions(req.user.userId);
  }

  @Get("count")
  @HttpCode(HttpStatus.OK)
  async getSessionCount(@Request() req): Promise<{ count: number }> {
    const count = await this.sessionService.getActiveSessionCount(
      req.user.userId,
    );
    return { count };
  }

  @Delete(":sessionId")
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Request() req,
    @Param("sessionId") sessionId: string,
  ): Promise<{ message: string }> {
    // Users can only revoke their own sessions
    const session = await this.sessionService.getSession(sessionId);
    if (!session || session.userId !== req.user.userId) {
      return { message: "Session not found" };
    }

    await this.sessionService.invalidateSession(sessionId);
    return { message: "Session revoked successfully" };
  }

  @Post("revoke-all")
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @Request() req,
  ): Promise<{ message: string; count: number }> {
    const sessions = await this.sessionService.getUserActiveSessions(
      req.user.userId,
    );
    const count = sessions.length;

    await this.sessionService.invalidateAllUserSessions(req.user.userId);

    return {
      message: "All sessions revoked successfully",
      count,
    };
  }

  @Post("revoke-others")
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @Request() req,
  ): Promise<{ message: string; count: number }> {
    // Get current session ID from JWT
    const currentSessionId = req.user.sessionId;

    const sessions = await this.sessionService.getUserActiveSessions(
      req.user.userId,
    );
    let count = 0;

    for (const session of sessions) {
      if (session.sessionId !== currentSessionId) {
        await this.sessionService.invalidateSession(session.sessionId);
        count++;
      }
    }

    return {
      message: "Other sessions revoked successfully",
      count,
    };
  }
}
