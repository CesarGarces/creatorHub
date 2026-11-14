"use client";

import { useCallback, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Shows a rendered email like a mail client would: a From/To/Subject header
 * and the full email body. The iframe grows to the email's height, so the
 * whole email is visible without an inner scrollbar or clipped edges.
 */
export function EmailPreview({
  subject,
  html,
  isLoading,
  isRefreshing,
  error,
}: {
  subject?: string;
  html?: string;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: string | null;
}) {
  const { t } = useI18n();
  const [height, setHeight] = useState(480);

  // No `allow-scripts`: the email cannot run code. `allow-same-origin` only
  // lets this page read the rendered height.
  const measure = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      const doc = event.currentTarget.contentDocument;
      if (doc) setHeight(Math.max(doc.documentElement.scrollHeight, 200));
    },
    [],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-elevated">
      <div className="space-y-1 border-b border-border px-4 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium text-text">
            <Mail size={14} className="text-primary" />
            {t("creditEmails.preview.from")}
          </span>
          {isRefreshing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-dim" />
          )}
        </div>
        <p className="text-text-muted">
          {t("creditEmails.preview.to")}{" "}
          <span className="text-text">
            {t("creditEmails.preview.sampleRecipient")}
          </span>
        </p>
        <p className="text-text-muted">
          {t("creditEmails.preview.subject")}{" "}
          <span className="font-medium text-text">
            {subject || (
              <span className="text-text-dim">
                {t("creditEmails.preview.empty")}
              </span>
            )}
          </span>
        </p>
      </div>

      {error && !html ? (
        <div className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-error">
          {error}
        </div>
      ) : isLoading || !html ? (
        <div
          role="status"
          className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-text-muted"
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          {t("creditEmails.preview.rendering")}
        </div>
      ) : (
        <iframe
          title={t("creditEmails.preview.title")}
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={measure}
          style={{ height }}
          className="block w-full border-0"
        />
      )}
    </div>
  );
}
