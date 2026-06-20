export interface Provider {
  id: string;
  slug: string;
  name: string;
  model: string;
  tier: "FREE" | "PRO";
  costPerCredit: number;
  isActive: boolean;
  supportedTasks: string[];
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  plan: "FREE" | "PAY_AS_YOU_GO" | "PREMIUM" | "STARTER" | "PRO";
  currentCredits: number;
  purchasedCredits: number;
  totalCredits: number;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalProviders: number;
  activeProviders: number;
  totalCreditsUsed: number;
  totalCreditsRemaining: number;
}

export interface UsageByProvider {
  toolId: string;
  usageCount: number;
  credits: number;
}

export interface TopUser {
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  usageCount: number;
  creditsUsed: number;
}

export interface RegistrationByMonth {
  month: string;
  count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
