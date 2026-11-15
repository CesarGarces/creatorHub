"use client";

import {
  LegalDocumentModal,
  type LegalModalProps,
} from "@/components/legal/legal-document-modal";

// Kept out of the app/*/page.tsx files: Next.js only allows page exports
// (default, metadata, ...) there, and extra exports fail the build's type check.

export type CookiesModalProps = LegalModalProps;

export function PrivacyModal(props: LegalModalProps) {
  return <LegalDocumentModal documentId="privacy" {...props} />;
}

export function TermsModal(props: LegalModalProps) {
  return <LegalDocumentModal documentId="terms" {...props} />;
}

export function CookiesModal(props: CookiesModalProps) {
  return <LegalDocumentModal documentId="cookies" {...props} />;
}
