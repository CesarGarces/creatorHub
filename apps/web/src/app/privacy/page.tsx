"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@creator-hub/ui";

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
          <DialogDescription>
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 pb-0">
          <div className="max-h-[60vh] overflow-y-auto prose prose-sm text-text">
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
              <p>
                Welcome to Creator Hub ("we," "our," "us"). We are committed to
                protecting your personal information and your right to privacy.
                This Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you visit our website and use
                our services.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                2. Information We Collect
              </h3>
              <h4 className="font-medium mb-1">Personal Information</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Name and email address (provided during registration)</li>
                <li>Account credentials (hashed passwords)</li>
                <li>
                  Payment information (processed by Stripe, we don't store full
                  card details)
                </li>
                <li>Usage data and analytics</li>
              </ul>
              <h4 className="font-medium mb-1 mt-4">
                Automatically Collected Information
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>IP address and browser type</li>
                <li>Device information and operating system</li>
                <li>Pages visited and time spent</li>
                <li>Referral source</li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                3. How We Use Your Information
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide and maintain our services</li>
                <li>Process transactions and send related communications</li>
                <li>
                  Send administrative information (security updates, policy
                  changes)
                </li>
                <li>Improve our website and services through analytics</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                4. Sharing Your Information
              </h3>
              <p>
                We do not sell your personal information. We may share
                information with:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  Service providers (Stripe for payments, Vercel for hosting,
                  etc.)
                </li>
                <li>Legal authorities when required by law</li>
                <li>
                  Business transfers (merger, acquisition, sale of assets)
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">5. Data Retention</h3>
              <p>
                We retain your personal information only as long as necessary
                for the purposes described in this policy, or as required by
                law. Account data is retained while your account is active. You
                may request deletion of your account at any time.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                6. Your Rights (GDPR/CCPA)
              </h3>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>Access your personal data</li>
                <li>Rectify inaccurate data</li>
                <li>Erase your data ("right to be forgotten")</li>
                <li>Restrict or object to processing</li>
                <li>Data portability</li>
                <li>Withdraw consent (where processing is based on consent)</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, contact us at{" "}
                <a
                  href="mailto:privacy@creatorhub.example"
                  className="text-primary underline"
                >
                  privacy@creatorhub.example
                </a>
                .
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                7. Cookies and Tracking
              </h3>
              <p>
                We use cookies and similar technologies to improve your
                experience. See our
                <a href="/cookies" className="text-primary underline">
                  Cookie Policy
                </a>{" "}
                for details.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">8. Security</h3>
              <p>
                We implement appropriate technical and organizational measures
                to protect your personal information. However, no method of
                transmission over the Internet or electronic storage is 100%
                secure.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                9. International Transfers
              </h3>
              <p>
                Your information may be transferred to and processed in
                countries other than your own. We ensure appropriate safeguards
                are in place (Standard Contractual Clauses, adequacy decisions).
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                10. Children's Privacy
              </h3>
              <p>
                Our services are not directed to children under 13 (or 16 in the
                EU). We do not knowingly collect personal information from
                children. If you believe we have collected such information,
                please contact us.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                11. Changes to This Policy
              </h3>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify you of any material changes by posting the new policy on
                this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">12. Contact Us</h3>
              <p>
                If you have questions about this Privacy Policy, contact us at:
              </p>
              <address className="not-italic mt-2">
                Creator Hub
                <br />
                Email:{" "}
                <a
                  href="mailto:privacy@creatorhub.example"
                  className="text-primary underline"
                >
                  privacy@creatorhub.example
                </a>
              </address>
            </section>

            <hr className="my-6 border-border" />
            <p className="text-sm text-text-muted">
              <em>
                This is a template for informational purposes. Consult with a
                qualified attorney for legal advice specific to your situation.
              </em>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PrivacyPage() {
  return <PrivacyModal open={true} onOpenChange={() => {}} />;
}
