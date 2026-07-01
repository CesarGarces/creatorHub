import { SetMetadata } from "@nestjs/common";

export const MIN_PLAN_KEY = "minPlan";
export const MinPlan = (plan: string) => SetMetadata(MIN_PLAN_KEY, plan);
