"use client";

import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@creator-hub/ui";
import { renderRich, useI18n } from "@/i18n/i18n-provider";
import {
  getLegalDocuments,
  LEGAL_EMAIL,
  LEGAL_LAST_UPDATED,
  type LegalBlock,
  type LegalDocumentId,
} from "@/i18n/legal";

function inline(text: string, href?: string): ReactNode {
  return renderRich(text, {
    b: (chunks) => <strong>{chunks}</strong>,
    code: (chunks) => <code>{chunks}</code>,
    email: (chunks) => (
      <a href={`mailto:${chunks}`} className="text-primary underline">
        {chunks}
      </a>
    ),
    link: (chunks) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline"
      >
        {chunks}
      </a>
    ),
  });
}

function Block({ block, isFirst }: { block: LegalBlock; isFirst: boolean }) {
  switch (block.type) {
    case "p":
      return (
        <p className={isFirst ? "" : "mt-2"}>
          {inline(block.text, block.href)}
        </p>
      );
    case "h4":
      return (
        <h4 className={`font-medium mb-1 ${isFirst ? "" : "mt-4"}`}>
          {block.text}
        </h4>
      );
    case "ul":
      return (
        <ul
          className={`list-disc list-inside space-y-1 ml-4 ${isFirst ? "" : "mt-2"}`}
        >
          {block.items.map((item) => (
            <li key={item}>{inline(item, block.href)}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="border-b border-border">
                {block.headers.map((header) => (
                  <th key={header} className="text-left p-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-b border-border">
                  {row.map((cell, i) => (
                    <td key={i} className="p-2">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "contact":
      return (
        <address className="not-italic mt-2">
          {block.team}
          <br />
          {block.emailLabel}{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">
            {LEGAL_EMAIL}
          </a>
        </address>
      );
  }
}

export interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Privacy policy / terms / cookie policy, rendered in the interface language. */
export function LegalDocumentModal({
  documentId,
  open,
  onOpenChange,
}: LegalModalProps & { documentId: LegalDocumentId }) {
  const { t, locale, formatDate } = useI18n();
  if (!open) return null;

  const doc = getLegalDocuments(locale)[documentId];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{doc.title}</DialogTitle>
          <DialogDescription>
            {t("legal.lastUpdated", {
              // Noon UTC avoids the date shifting in western time zones.
              date: formatDate(`${LEGAL_LAST_UPDATED}T12:00:00Z`, {
                dateStyle: "long",
              }),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 pb-0">
          <div
            lang={locale}
            className="max-h-[60vh] overflow-y-auto prose prose-sm text-text"
          >
            {doc.sections.map((section) => (
              <section key={section.title} className="mb-6">
                <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} isFirst={i === 0} />
                ))}
              </section>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="glow"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {t("legal.agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
