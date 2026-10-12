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
          <DialogDescription>Last updated: October 11, 2026</DialogDescription>
        </DialogHeader>
        <div className="p-6 pb-0">
          <div className="max-h-[60vh] overflow-y-auto prose prose-sm text-text">
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                1. Agreement to Terms
              </h3>
              <p>
                By accessing or using Creator Hub ("the Service," "we," "our,"
                or "us"), you agree to be bound by these Terms of Service
                ("Terms"). If you do not agree to these Terms, you may not
                access or use the Service.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                2. Description of Service
              </h3>
              <p>
                Creator Hub provides AI-powered software, workflows, and tools
                for content creators, including but not limited to script
                generation, thumbnail design, image synthesis, user style/RAG
                context management, credit billing systems, and community bot
                integrations ("Tools").
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                3. Accounts & Registration
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Eligibility:</strong> You must be at least 13 years
                  old (or 16 in the European Union) to create an account.
                </li>
                <li>
                  <strong>Accuracy:</strong> You agree to provide accurate and
                  complete registration information.
                </li>
                <li>
                  <strong>Security:</strong> You are responsible for maintaining
                  the confidentiality of your account credentials and for all
                  activities conducted under your account.
                </li>
                <li>
                  <strong>Unauthorized Use:</strong> You must notify us
                  immediately at{" "}
                  <a
                    href="mailto:privacy@creatorhubplatform.com"
                    className="text-primary underline"
                  >
                    privacy@creatorhubplatform.com
                  </a>{" "}
                  if you suspect unauthorized access to your account.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                4. Subscriptions, Payments & Refunds
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Billing:</strong> Access to certain features and
                  credit allocations requires a paid subscription or
                  pay-as-you-go purchase.
                </li>
                <li>
                  <strong>Payment Processors:</strong> Payments are securely
                  handled through third-party payment gateways (e.g., Stripe,
                  Mercado Pago). We do not store or process complete credit card
                  details.
                </li>
                <li>
                  <strong>Auto-Renewal:</strong> Subscription plans
                  automatically renew at the end of each billing cycle unless
                  cancelled prior to the renewal date.
                </li>
                <li>
                  <strong>Refund Policy:</strong> Purchases and credit top-ups
                  are non-refundable once credits have been partially or fully
                  consumed, except where required by applicable law.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                5. Credit System & Fair Usage
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Credit Consumption:</strong> Platform tools consume
                  credits based on compute complexity (e.g., text generation vs.
                  image rendering). Credit costs per action are displayed within
                  the platform and may be adjusted with prior notice.
                </li>
                <li>
                  <strong>Expiration & Exclusions:</strong> Unless explicitly
                  stated in your subscription plan, monthly credits do not roll
                  over to subsequent billing periods and expire at the end of
                  each cycle.
                </li>
                <li>
                  <strong>Adjustments:</strong> Creator Hub reserves the right
                  to adjust credit pricing or allocations to account for
                  underlying API operational costs.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                6. User Content & Intellectual Property
              </h3>
              <h4 className="font-medium mb-1">
                Your Ownership & License Grant
              </h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>User Inputs:</strong> You retain all ownership rights
                  over the text, style guides, brand assets, and prompts you
                  upload to the Service ("User Content").
                </li>
                <li>
                  <strong>License to Creator Hub:</strong> You grant Creator Hub
                  a non-exclusive, worldwide, royalty-free license to host,
                  store, run, and display your User Content{" "}
                  <strong>solely</strong>
                  for the purpose of operating, rendering, and providing the
                  Service to you. We do not sell your content or use your
                  private inputs to train public third-party AI models.
                </li>
              </ul>
              <h4 className="font-medium mb-1 mt-4">AI-Generated Outputs</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Ownership of Generated Content:</strong> Subject to
                  compliance with these Terms and applicable copyright laws,
                  Creator Hub assigns to you all its rights, title, and interest
                  in the outputs generated for you by the Tools ("Generated
                  Content").
                </li>
                <li>
                  <strong>Third-Party AI Constraints:</strong> Generated Content
                  is subject to the terms of underlying AI infrastructure
                  providers. You acknowledge that AI-generated outputs may not
                  be unique across different users and that copyright protection
                  for AI output varies by jurisdiction.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                7. Acceptable Use Policy
              </h3>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>Violate any local, national, or international law.</li>
                <li>
                  Generate, upload, or distribute content that is defamatory,
                  hateful, abusive, illegal, or infringes on third-party
                  intellectual property or privacy rights.
                </li>
                <li>
                  Reverse engineer, decompile, or attempt to extract source code
                  from Creator Hub.
                </li>
                <li>
                  Scrap, harvest, or utilize unauthorized automated bots to
                  bypass API limits or credit systems (excluding official
                  community bots provided by Creator Hub).
                </li>
                <li>
                  Abuse, overload, or disrupt the integrity or performance of
                  the platform or its infrastructure.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                8. Third-Party Services & Integrations
              </h3>
              <p>
                The Service integrates with third-party tools, APIs, and
                community platforms (e.g., external LLM providers, social
                channels, webhooks). Creator Hub is not responsible for the
                availability, uptime, or privacy practices of these third-party
                services.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                9. Disclaimer of Warranties
              </h3>
              <p>
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS.
                CREATOR HUB DISCLAIMS ALL WARRANTIES OF ANY KIND, EXPRESS OR
                IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
                GUARANTEE THAT AI GENERATED CONTENT WILL BE ACCURATE,
                UNINTERRUPTED, OR ERROR-FREE.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                10. Limitation of Liability
              </h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CREATOR HUB AND ITS
                AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF
                PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR
                INABILITY TO USE THE SERVICE.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                11. Indemnification
              </h3>
              <p>
                You agree to indemnify and hold harmless Creator Hub, its team,
                and affiliates against any claims, liabilities, damages, or
                legal expenses arising from your User Content, your misuse of
                Generated Content, or your violation of these Terms.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                12. Account Suspension & Termination
              </h3>
              <p>
                We reserve the right to suspend or terminate your access to the
                Service immediately, without prior notice, if you breach these
                Terms or engage in fraudulent, abusive, or unauthorized credit
                activity. Upon termination, unused credits are forfeited.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">13. Governing Law</h3>
              <p>
                These Terms shall be governed by and construed in accordance
                with applicable laws, without regard to conflict of law
                principles. Any legal suit or proceeding shall be instituted in
                the competent courts of your operational jurisdiction.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                14. Changes to Terms
              </h3>
              <p>
                We may revise these Terms from time to time. Material
                modifications will be notified via in-app banners or email at
                least 30 days prior to enforcement. Your continued use of
                Creator Hub constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                15. Contact Information
              </h3>
              <p>
                For questions or legal inquiries regarding these Terms, please
                contact us at:
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

export default function TermsPage() {
  return <TermsModal open={true} onOpenChange={() => {}} />;
}
