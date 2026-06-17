export type EventName =
  | "marketing.credit_threshold"
  | "marketing.credit_depleted"
  | "user.plan.upgraded"
  | "tool.used"
  | "tool.enabled"
  | "tool.disabled"
  | "credits.deducted"
  | "credits.added"
  | "credits.depleted"
  | "user.registered"
  | "user.subscribed"
  | "ai.request.started"
  | "ai.request.completed"
  | "ai.request.failed"
  | "image.generated"
  | "storage.file.uploaded"
  | "storage.file.deleted"
  | "thumbnail.completed"
  | "thumbnail.failed"
  | "translation.completed"
  | "translation.failed";

export interface BaseEvent {
  id: string;
  name: EventName;
  timestamp: Date;
  correlationId?: string;
  userId?: string;
  toolId?: string;
}

export interface ToolUsedEvent extends BaseEvent {
  name: "tool.used";
  payload: {
    toolId: string;
    userId: string;
    creditsUsed: number;
    provider?: string;
    duration: number;
    success: boolean;
  };
}

export interface CreditsDeductedEvent extends BaseEvent {
  name: "credits.deducted";
  payload: {
    userId: string;
    amount: number;
    balance: number;
    toolId?: string;
  };
}

export interface AIRequestCompletedEvent extends BaseEvent {
  name: "ai.request.completed";
  payload: {
    requestId: string;
    provider: string;
    model: string;
    latency: number;
    creditsConsumed: number;
    toolId: string;
  };
}

export interface MarketingCreditThresholdEvent {
  userId: string;
  threshold: number;
  creditsRemaining: number;
  timestamp: Date;
}

export interface MarketingCreditDepletedEvent {
  userId: string;
  timestamp: Date;
}

export interface UserPlanUpgradedEvent {
  userId: string;
  fromPlan: string;
  toPlan: string;
  timestamp: Date;
}

export interface ThumbnailCompletedEvent {
  userId: string;
  key: string;
  bucket: string;
  imageId: string;
}

export interface ThumbnailFailedEvent {
  userId: string;
  error: string;
  rawError?: string;
  jobId?: string;
}

export interface ThumbnailReadyPayload {
  url: string;
  imageId: string;
}

export interface TranslationCompletedEvent {
  userId: string;
  translationId: string;
  content: string;
}

export interface TranslationFailedEvent {
  userId: string;
  error: string;
  rawError?: string;
  jobId?: string;
}

export interface TranslationReadyPayload {
  content: string;
  translationId: string;
}

export interface ToolJobUpdatePayload {
  toolId: string;
  jobId: string;
  status: "completed" | "failed";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export type PlatformEvent =
  | ToolUsedEvent
  | CreditsDeductedEvent
  | AIRequestCompletedEvent;
