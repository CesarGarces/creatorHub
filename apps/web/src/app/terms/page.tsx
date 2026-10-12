"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@creator-hub/ui";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TermsModal({ open, onOpenChange }: TermsModalProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
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
              <h3 className="text-lg font-semibold mb-2">
                1. Agreement to Terms
              </h3>
              <p>
                By accessing or using Creator Hub ("the Service"), you agree to
                be bound by these Terms of Service ("Terms"). If you disagree
                with any part of these Terms, you may not access the Service.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                2. Description of Service
              </h3>
              <p>
                Creator Hub provides AI-powered tools for content creators,
                including but not limited to: video generation, script writing,
                social media content creation, trend analysis, and other
                creative assistance tools ("Tools").
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">3. Accounts</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  You must provide accurate, complete, and current registration
                  information.
                </li>
                <li>
                  You are responsible for safeguarding your password and for all
                  activities under your account.
                </li>
                <li>
                  You must notify us immediately of any unauthorized use of your
                  account.
                </li>
                <li>
                  You must be at least 13 years old (16 in the EU) to create an
                  account.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                4. Subscriptions and Billing
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  Some features require a paid subscription. Prices are subject
                  to change with notice.
                </li>
                <li>
                  Subscriptions auto-renew unless cancelled before the renewal
                  date.
                </li>
                <li>
                  Refunds are handled per our Refund Policy and applicable law.
                </li>
                <li>
                  Payments are processed by Stripe. We do not store full payment
                  details.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">5. Credits System</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  Tools consume credits. Credit amounts per tool may vary and
                  are subject to change.
                </li>
                <li>
                  Credits do not roll over month-to-month unless otherwise
                  stated.
                </li>
                <li>
                  Unused credits expire at the end of each billing period.
                </li>
                <li>
                  We reserve the right to adjust credit allocations with
                  reasonable notice.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">6. Acceptable Use</h3>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  Use the Service for illegal purposes or to violate any laws
                </li>
                <li>Infringe intellectual property rights</li>
                <li>Generate harmful, illegal, or offensive content</li>
                <li>Attempt to gain unauthorized access to systems or data</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Reverse engineer or extract source code</li>
                <li>
                  Use automated systems to access the Service (scraping, bots)
                </li>
                <li>
                  Resell or redistribute the Service without authorization
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                7. Intellectual Property
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  The Service and its original content, features, and
                  functionality are owned by Creator Hub and are protected by
                  international copyright, trademark, and other intellectual
                  property laws.
                </li>
                <li>
                  You retain ownership of content you create using the Tools
                  ("User Content").
                </li>
                <li>
                  By using the Service, you grant us a license to use, modify,
                  and display your User Content solely to provide the Service.
                </li>
                <li>
                  AI-generated content ownership follows the terms of the
                  underlying AI providers.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">8. User Content</h3>
              <ul className="list-disc list-insite space-y-1 ml-4">
                <li>You are solely responsible for your User Content.</li>
                <li>
                  We do not pre-screen User Content but reserve the right to
                  remove content that violates these Terms.
                </li>
                <li>
                  You grant us a worldwide, non-exclusive, royalty-free license
                  to use your User Content to operate and improve the Service.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                9. Third-Party Services
              </h3>
              <p>
                The Service may contain links to third-party websites or
                services. We have no control over and assume no responsibility
                for their content, privacy policies, or practices.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                10. Disclaimer of Warranties
              </h3>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
                LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                11. Limitation of Liability
              </h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CREATOR HUB SHALL NOT BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL,
                ARISING FROM YOUR USE OF THE SERVICE.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                12. Indemnification
              </h3>
              <p>
                You agree to defend, indemnify, and hold harmless Creator Hub
                and its officers, directors, employees, and agents from any
                claims, damages, or expenses arising from your use of the
                Service, violation of these Terms, or violation of any rights of
                third parties.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">13. Termination</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  We may terminate or suspend your account immediately, without
                  prior notice, for violation of these Terms.
                </li>
                <li>
                  Upon termination, your right to use the Service ceases
                  immediately.
                </li>
                <li>
                  Provisions that should survive termination will survive (IP,
                  disclaimers, limitations).
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">14. Governing Law</h3>
              <p>
                These Terms shall be governed by the laws of [Your
                Jurisdiction], without regard to conflict of law principles.
                Disputes will be resolved in the courts of [Your Jurisdiction].
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                15. Changes to Terms
              </h3>
              <p>
                We may modify these Terms at any time. Material changes will be
                communicated via email or through the Service at least 30 days
                before taking effect. Continued use constitutes acceptance.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">16. Contact Us</h3>
              <p>If you have questions about these Terms, contact us at:</p>
              <address className="not-italic mt-2">
                Creator Hub
                <br />
                Email:{" "}
                <a
                  href="mailto:legal@creatorhub.example"
                  className="text-primary underline"
                >
                  legal@creatorhub.example
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

export default function TermsPage() {
  return <TermsModal open={true} onOpenChange={() => {}} />;
}
