"use client";

import {
  LegalDocumentModal,
  type LegalModalProps,
} from "@/components/legal/legal-document-modal";

export type CookiesModalProps = LegalModalProps;

export function CookiesModal(props: CookiesModalProps) {
  return <LegalDocumentModal documentId="cookies" {...props} />;
}

export default function CookiesPage() {
  return <CookiesModal open={true} onOpenChange={() => {}} />;
}
