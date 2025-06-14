export interface JwtPayload {
  sub: string; // user id
  email: string;
  workspaceId: string;
  role: string;
  type?: 'access' | 'refresh';
  firstName?: string;
  lastName?: string;
  status?: string;
  twoFactorEnabled?: boolean;
  workspaceName?: string;
  workspaceSlug?: string;
  plan?: string;
  iat?: number;
  exp?: number;
}
