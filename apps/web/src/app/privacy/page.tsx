"use client";

import {
  LegalDocumentModal,
  type LegalModalProps,
} from "@/components/legal/legal-document-modal";

export function PrivacyModal(props: LegalModalProps) {
  return <LegalDocumentModal documentId="privacy" {...props} />;
}

export default function PrivacyPage() {
  return <PrivacyModal open={true} onOpenChange={() => {}} />;
}
