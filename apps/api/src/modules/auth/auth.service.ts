import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { User, Workspace, WorkspaceUser } from '@ai-crm/database';
import { AuthResponse, TokenResponse } from '../../common/types/auth.types';

type UserWithWorkspace = User & {
  workspaces: (WorkspaceUser & {
    workspace: Workspace;
  })[];
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName, workspaceName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create workspace and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: this.generateSlug(workspaceName),
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          status: 'ACTIVE',
        },
      });
      
      // Create workspace user relation
      const workspaceUser = await tx.workspaceUser.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'ADMIN', // First user is workspace admin
          isDefault: true,
        },
        include: {
          workspace: true,
          user: true,
        },
      });

      return { user, workspace, workspaceUser };
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      result.user,
      result.workspace.id,
      result.workspaceUser.role,
    );

    return {
      user: this.sanitizeUser(result.user),
      workspace: result.workspace,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.workspaces.length) {
      throw new UnauthorizedException('User has no workspace');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );

    return {
      user: this.sanitizeUser(user),
      workspace: defaultWorkspace.workspace,
      ...tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  async refreshTokens(userId: string): Promise<TokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
      },
    });

    if (!user || !user.workspaces.length) {
      throw new UnauthorizedException('User not found or has no workspace');
    }

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );
    
    return tokens;
  }

  private async generateTokens(user: User, workspaceId: string, role: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      workspaceId,
      role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async validateOAuthUser(oauthUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }): Promise<AuthResponse> {
    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: oauthUser.email },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
      },
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId && oauthUser.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { 
            googleId: oauthUser.googleId,
            avatarUrl: user.avatarUrl || oauthUser.avatar,
            lastLoginAt: new Date(),
          },
          include: {
            workspaces: {
              where: { isDefault: true },
              include: { workspace: true },
            },
          },
        });
      }
    } else {
      // Create new user with workspace
      const workspaceName = `${oauthUser.firstName} ${oauthUser.lastName}'s Workspace`;
      
      const result = await this.prisma.$transaction(async (tx) => {
        // Create workspace
        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            slug: this.generateSlug(workspaceName),
          },
        });

        // Create user
        const newUser = await tx.user.create({
          data: {
            email: oauthUser.email,
            googleId: oauthUser.googleId,
            firstName: oauthUser.firstName,
            lastName: oauthUser.lastName,
            avatarUrl: oauthUser.avatar,
            status: 'ACTIVE',
          },
        });
        
        // Create workspace user relation
        const workspaceUser = await tx.workspaceUser.create({
          data: {
            workspaceId: workspace.id,
            userId: newUser.id,
            role: 'ADMIN',
            isDefault: true,
          },
          include: {
            workspace: true,
            user: true,
          },
        });

        return { user: newUser, workspace, workspaceUser };
      });

      user = await this.prisma.user.findUnique({
        where: { id: result.user.id },
        include: {
          workspaces: {
            where: { isDefault: true },
            include: { workspace: true },
          },
        },
      });
    }

    if (!user || !user.workspaces.length) {
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );

    return {
      user: this.sanitizeUser(user),
      workspace: defaultWorkspace.workspace,
      ...tokens,
    };
  }
}