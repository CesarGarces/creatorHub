import {
  plannerUrlFor,
  type SessionReminderData,
} from "@/lib/content-planner/reminders";
import { useContentPlannerStore } from "@/store/content-planner.store";

export const PLANNER_PATH = "/tools/content-planner";

/**
 * Shows the reminded session's week: jumps there directly when the planner
 * is already open, otherwise navigates with `?date=`.
 */
export function openSessionInPlanner(
  data: SessionReminderData,
  navigate: (url: string) => void,
): void {
  if (
    typeof window !== "undefined" &&
    window.location.pathname === PLANNER_PATH
  ) {
    const store = useContentPlannerStore.getState();
    store.setCursor(new Date(data.startAt));
    store.setView("week");
    return;
  }
  navigate(plannerUrlFor(data));
}
