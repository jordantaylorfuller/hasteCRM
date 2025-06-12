export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    status: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  };
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}