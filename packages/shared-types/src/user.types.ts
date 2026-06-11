export type UserRole = "user" | "premium" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  credits: number;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
