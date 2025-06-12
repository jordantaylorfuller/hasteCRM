import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Request,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Controller('auth/sessions')
@UseGuards(RateLimitGuard, JwtAuthGuard)
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserSessions(@Request() req) {
    return this.sessionService.getUserActiveSessions(req.user.sub);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Request() req,
    @Param('sessionId') sessionId: string,
  ) {
    await this.sessionService.invalidateSession(sessionId);
    return { message: 'Session revoked successfully' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@Request() req) {
    await this.sessionService.invalidateAllUserSessions(req.user.sub);
    return { message: 'All sessions revoked successfully' };
  }
}