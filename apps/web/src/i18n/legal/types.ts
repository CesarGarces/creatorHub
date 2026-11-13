/**
 * Legal documents (privacy, terms, cookies) are long-form content, so they
 * live outside the UI dictionary as structured documents per language.
 *
 * Inline markup in any text (rendered by LegalDocumentModal):
 *   <b>bold</b> · <code>code</code> · <email>address</email>
 *   <link>text</link> (uses the block's `href`)
 */
export type LegalBlock =
  | { type: "p"; text: string; href?: string }
  | { type: "h4"; text: string }
  | { type: "ul"; items: string[]; href?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "contact"; team: string; emailLabel: string };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  sections: LegalSection[];
}

export type LegalDocumentId = "privacy" | "terms" | "cookies";

export type LegalDocuments = Record<LegalDocumentId, LegalDocument>;

/** Contact address used across all documents. */
export const LEGAL_EMAIL = "privacy@creatorhubplatform.com";

/** ISO date of the last revision (formatted per locale when displayed). */
export const LEGAL_LAST_UPDATED = "2026-10-11";
