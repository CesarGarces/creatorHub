/**
 * Rules checked by `tests/story-coverage.spec.ts`.
 *
 * Every React component file (`*.tsx`) under the roots below needs a story at
 * the mirrored path in `stories/`, e.g.
 *   packages/ui/src/components/button.tsx → stories/ui/button.stories.tsx
 *   apps/web/src/components/layout/top-bar.tsx → stories/web/layout/top-bar.stories.tsx
 */
export const STORY_ROOTS = [
  { source: "packages/ui/src/components", stories: "ui" },
  { source: "packages/i18n/src", stories: "i18n" },
  { source: "apps/web/src/components", stories: "web" },
  { source: "apps/admin/src/components", stories: "admin" },
] as const;

/**
 * `.tsx` modules that are not visual components. Each needs a reason; the
 * components using them have stories.
 */
export const EXEMPT: Record<string, string> = {
  "packages/i18n/src/react.tsx":
    "i18n provider factory and hooks (createI18n) — no UI of its own",
  "apps/web/src/components/content-planner/event-type-meta.tsx":
    "color/icon tables for session types — rendered by the calendar views",
  "apps/web/src/components/content-planner/event-tooltip.tsx":
    "tooltip hook used by WeekView/MonthView/AgendaView — shown in their stories",
  "apps/web/src/components/voice-button/voice-button-icons.tsx":
    "icon set of VoiceButton — shown in its story",
  "apps/web/src/components/error-boundary.tsx":
    "React error boundary — renders its caller's fallback",
  "apps/admin/src/components/auth-guard.tsx":
    "route guard (redirects to /login) — no UI beyond a spinner",
  "apps/web/src/components/legal/lazy-cookies-modal.tsx":
    "next/dynamic wrapper of CookiesModal (legal-modals.tsx) — no UI of its own",
  "apps/web/src/components/dashboard-widgets/widget-loader.tsx":
    "next/dynamic map of the dashboard widgets (one lazy chunk each) — no UI of its own; every widget has a story",
  "apps/web/src/components/web-vitals-reporter.tsx":
    "field Web Vitals telemetry (useReportWebVitals) — renders nothing",
  "apps/admin/src/components/web-vitals-reporter.tsx":
    "field Web Vitals telemetry (useReportWebVitals) — renders nothing",
};

/**
 * Components that existed before Storybook was introduced and still have no
 * story. This list may only shrink: new components must ship with a story,
 * and an entry must be removed here as soon as its story exists.
 */
export const PENDING_STORIES: string[] = [
  "apps/admin/src/components/credit-emails/credit-email-editor.tsx",
  "apps/admin/src/components/credit-emails/email-preview.tsx",
  "apps/admin/src/components/dashboard/favorite-tools-chart.tsx",
  "apps/admin/src/components/dashboard/registrations-chart.tsx",
  "apps/admin/src/components/dashboard/usage-chart.tsx",
  "apps/admin/src/components/models/create-model-modal.tsx",
  "apps/admin/src/components/models/model-detail-modal.tsx",
  "apps/admin/src/components/users/user-form.tsx",
  "apps/web/src/components/BorderGlow.tsx",
  "apps/web/src/components/animations/liquid-ether-wrapper.tsx",
  "apps/web/src/components/asset-like-button.tsx",
  "apps/web/src/components/billing/CheckoutModal.tsx",
  "apps/web/src/components/chat/chat-widget.tsx",
  "apps/web/src/components/chat/model-settings-panel.tsx",
  "apps/web/src/components/chat/tweet-action-card.tsx",
  "apps/web/src/components/community-bot/behavior-tab.tsx",
  "apps/web/src/components/community-bot/channels-tab.tsx",
  "apps/web/src/components/community-bot/conversations-tab.tsx",
  "apps/web/src/components/community-bot/playground-tab.tsx",
  "apps/web/src/components/content-planner/ai-planner-dialog.tsx",
  "apps/web/src/components/content-planner/appearance-picker.tsx",
  "apps/web/src/components/content-planner/event-dialog.tsx",
  "apps/web/src/components/content-planner/icon-button.tsx",
  "apps/web/src/components/content-planner/plan-video-dialog.tsx",
  "apps/web/src/components/content-planner/platform-field.tsx",
  "apps/web/src/components/content-planner/reminder-select.tsx",
  "apps/web/src/components/content-planner/select-field.tsx",
  "apps/web/src/components/content-planner/steps-editor.tsx",
  "apps/web/src/components/content-planner/tool-action-card.tsx",
  "apps/web/src/components/content-planner/type-field.tsx",
  "apps/web/src/components/credit-purchase/CreditPurchaseForm.tsx",
  "apps/web/src/components/legal/legal-document-modal.tsx",
  "apps/web/src/components/legal/legal-modals.tsx",
  "apps/web/src/components/provider-select.tsx",
  "apps/web/src/components/settings/x-account-card.tsx",
];
