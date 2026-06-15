export type UserRole = "user" | "premium" | "admin";

export type UserPlan = "free" | "pay_as_you_go" | "premium";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  plan: UserPlan;
  freeCredits: number;
  purchasedCredits: number;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
