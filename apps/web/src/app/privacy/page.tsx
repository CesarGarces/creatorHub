"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@creator-hub/ui";
import { Button } from "@creator-hub/ui";

interface PrivacyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyModal({ open, onOpenChange }: PrivacyModalProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>Last updated: October 11, 2026</DialogDescription>
        </DialogHeader>
        <div className="p-6 pb-0">
          <div className="max-h-[60vh] overflow-y-auto prose prose-sm text-text">
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
              <p>
                Welcome to Creator Hub ("we," "our," "us"). We are committed to
                protecting your personal information and your right to privacy.
                This Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you visit our platform and use
                our services.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                2. Information We Collect
              </h3>
              <h4 className="font-medium mb-1">
                Personal Information Provided by You
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Account Data:</strong> Name, email address, and hashed
                  credentials provided during registration.
                </li>
                <li>
                  <strong>Creator Style & RAG Context:</strong> User-submitted
                  brand guidelines, preferences, past scripts, or style context
                  uploaded to personalize AI outputs.
                </li>
                <li>
                  <strong>User Content:</strong> Prompts, scripts, images,
                  thumbnails, and other content created or uploaded within the
                  platform.
                </li>
                <li>
                  <strong>Payment & Transaction Data:</strong> Subscription
                  plans, credit purchase history, and credit balance. Payment
                  processing is handled directly by third-party processors
                  (e.g., Stripe, Mercado Pago); we do not store full payment
                  card details.
                </li>
              </ul>
              <h4 className="font-medium mb-1 mt-4">
                Automatically Collected Information
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  IP address, browser type, device details, and operating
                  system.
                </li>
                <li>
                  Usage analytics, feature engagement, pages visited, and
                  referral sources.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                3. How We Use Your Information
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  Provide, maintain, and personalize our AI-powered creator
                  tools and services.
                </li>
                <li>
                  Process transactions, manage credit balances, and send billing
                  receipts.
                </li>
                <li>
                  Manage community bot integrations and user workflow
                  automation.
                </li>
                <li>
                  Improve platform functionality, security, and performance
                  through analytics.
                </li>
                <li>
                  Send administrative updates, security alerts, and customer
                  support responses.
                </li>
                <li>Comply with legal and regulatory obligations.</li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                4. Sharing Your Information & Third-Party Vendors
              </h3>
              <p>
                We do not sell your personal data. We share necessary data only
                with trusted service providers:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  <strong>AI Model Providers:</strong> Prompts and input assets
                  are processed via secure API endpoints (e.g., OpenAI, Google
                  Gemini, and image synthesis services). Data processed via
                  these API services is not used to train third-party foundation
                  models.
                </li>
                <li>
                  <strong>Payment Processors:</strong> Stripe and Mercado Pago
                  for secure transaction handling.
                </li>
                <li>
                  <strong>Hosting & Infrastructure:</strong> Cloud hosting
                  (e.g., Vercel) and database providers.
                </li>
                <li>
                  <strong>Legal Authorities:</strong> When required by
                  applicable law or enforceable governmental request.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                5. Data Retention & Account Deletion
              </h3>
              <p>
                We retain your personal information, credit usage history, and
                AI outputs as long as your account remains active. You may
                request full account and data deletion at any time by contacting
                support. Upon account termination, personal data and associated
                style context will be permanently erased or anonymized, subject
                to retention required by tax or accounting laws.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                6. Your Rights (GDPR / CCPA)
              </h3>
              <p>Depending on your location, you have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  Access, download, or transfer your personal data and generated
                  content.
                </li>
                <li>Rectify inaccurate personal information.</li>
                <li>
                  Request erasure of your account and creator context ("Right to
                  be forgotten").
                </li>
                <li>
                  Restrict or object to certain data processing activities.
                </li>
                <li>Withdraw consent at any time.</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact us at{" "}
                <a
                  href="mailto:privacy@creatorhubplatform.com"
                  className="text-primary underline"
                >
                  privacy@creatorhubplatform.com
                </a>
                .
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                7. Cookies and Tracking
              </h3>
              <p>
                We use cookies and local storage to maintain user sessions,
                remember preferences, and analyze traffic. For detailed
                information, please review our Cookie Policy.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">8. Security</h3>
              <p>
                We implement industry-standard technical and organizational
                security measures, including encryption at rest and in transit,
                to protect your personal data and generated content.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                9. International Data Transfers
              </h3>
              <p>
                Your data may be transferred to and processed in servers outside
                your country of residence. We ensure all cross-border data
                transfers comply with applicable privacy regulations through
                standard contractual clauses.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                10. Children's Privacy
              </h3>
              <p>
                Creator Hub is not intended for use by individuals under the age
                of 13 (or 16 in the EU). We do not knowingly collect personal
                data from children.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                11. Changes to This Policy
              </h3>
              <p>
                We may update this Privacy Policy periodically. Material changes
                will be communicated via platform notifications or email prior
                to taking effect.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">12. Contact Us</h3>
              <p>
                If you have any questions or requests regarding this Privacy
                Policy, please contact us at:
              </p>
              <address className="not-italic mt-2">
                Creator Hub Legal Team
                <br />
                Email:{" "}
                <a
                  href="mailto:privacy@creatorhubplatform.com"
                  className="text-primary underline"
                >
                  privacy@creatorhubplatform.com
                </a>
              </address>
            </section>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="glow"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PrivacyPage() {
  return <PrivacyModal open={true} onOpenChange={() => {}} />;
}
