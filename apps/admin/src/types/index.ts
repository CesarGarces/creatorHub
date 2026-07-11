export interface ProviderMode {
  id: string;
  mode: Mode;
  modeId: string;
  providerId: string;
}

export interface Provider {
  id: string;
  slug: string;
  name: string;
  model: string;
  tier: "FREE" | "PRO";
  costPerCredit: number;
  isActive: boolean;
  supportedTasks: string[];
  modes?: ProviderMode[];
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Mode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tools: number;
    providers: number;
  };
}

export interface ToolWithModes {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  status: string;
  creditsPerUse: number;
  modes: Mode[];
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
  totalFavorites: number;
}

export interface UsageByProvider {
  toolId: string;
  usageCount: number;
  credits: number;
}

export interface FavoriteStats {
  toolId: string;
  favoriteCount: number;
}

export interface TopUser {
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  usageCount: number;
  creditsUsed: number;
}

export interface RegistrationByDay {
  date: string;
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
