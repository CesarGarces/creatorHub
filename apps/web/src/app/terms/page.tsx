"use client";

import {
  LegalDocumentModal,
  type LegalModalProps,
} from "@/components/legal/legal-document-modal";

export function TermsModal(props: LegalModalProps) {
  return <LegalDocumentModal documentId="terms" {...props} />;
}

export default function TermsPage() {
  return <TermsModal open={true} onOpenChange={() => {}} />;
}
