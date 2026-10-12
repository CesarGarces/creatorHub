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

export interface CookiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CookiesModal({ open, onOpenChange }: CookiesModalProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Cookie Policy</DialogTitle>
          <DialogDescription>Last updated: October 11, 2026</DialogDescription>
        </DialogHeader>
        <div className="p-6 pb-0">
          <div className="max-h-[60vh] overflow-y-auto prose prose-sm text-text">
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                1. What Are Cookies and Local Storage?
              </h3>
              <p>
                Cookies are small text files placed on your device (computer,
                tablet, or mobile) when you visit websites. In addition to
                cookies, Creator Hub ("we," "our," or "us") utilizes standard
                browser storage technologies, such as{" "}
                <strong>Local Storage</strong>
                and <strong>Session Storage</strong> (collectively, "Storage
                Technologies"), to ensure seamless service functionality,
                authentication, and user preferences.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                2. How We Use Storage Technologies
              </h3>
              <p>
                We use cookies and browser storage for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  <strong>Essential & Security:</strong> Required for core
                  service operations, user authentication, session persistence,
                  and Cross-Site Request Forgery (CSRF) protection.
                </li>
                <li>
                  <strong>Preferences & State:</strong> Remember your UI
                  settings, theme (light/dark mode), credit balance display
                  preferences, and temporary script/editor drafts.
                </li>
                <li>
                  <strong>Analytics & Performance:</strong> Help us understand
                  user traffic, application latency, and platform performance to
                  improve features (e.g., Vercel Analytics, Google Analytics).
                </li>
                <li>
                  <strong>Payment & Fraud Prevention:</strong> Placed by payment
                  processors during checkout to ensure secure transaction
                  processing and prevent fraudulent chargebacks.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                3. Storage Technologies Used by Creator Hub
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse mb-4">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Category</th>
                      <th className="text-left p-2 font-semibold">
                        Storage Method / Name
                      </th>
                      <th className="text-left p-2 font-semibold">Purpose</th>
                      <th className="text-left p-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="p-2 font-medium">Authentication</td>
                      <td className="p-2">Session / Auth Token</td>
                      <td className="p-2">
                        Keeps you securely logged in and manages active API
                        requests
                      </td>
                      <td className="p-2">Session / 30 Days</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-2 font-medium">Security</td>
                      <td className="p-2">CSRF Token</td>
                      <td className="p-2">
                        Protects against unauthorized cross-site request forgery
                      </td>
                      <td className="p-2">Session</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-2 font-medium">Preferences</td>
                      <td className="p-2">
                        <code>theme</code>, <code>creator_settings</code>
                      </td>
                      <td className="p-2">
                        Remembers your UI preferences and workspace layout
                      </td>
                      <td className="p-2">1 Year (Local Storage)</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-2 font-medium">Analytics</td>
                      <td className="p-2">Vercel Analytics</td>
                      <td className="p-2">
                        Measures page responsiveness, bundle performance, and
                        error logs
                      </td>
                      <td className="p-2">1 Year</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-2 font-medium">Analytics</td>
                      <td className="p-2">
                        Google Analytics (<code>_ga</code>, <code>_gid</code>)
                      </td>
                      <td className="p-2">
                        Tracks usage metrics, page views, and feature adoption
                      </td>
                      <td className="p-2">Up to 2 Years</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-2 font-medium">Payments</td>
                      <td className="p-2">Stripe / Payment Gateway Cookies</td>
                      <td className="p-2">
                        Facilitates secure credit purchases and fraud detection
                      </td>
                      <td className="p-2">Session / 1 Year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                4. Third-Party Services
              </h3>
              <p>
                We rely on trusted third-party service providers that may place
                cookies or access browser storage when you interact with Creator
                Hub:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  <strong>Vercel Analytics:</strong> Performance and reliability
                  monitoring.
                </li>
                <li>
                  <strong>Google Analytics:</strong> Traffic analysis and
                  aggregated user flow insights.
                </li>
                <li>
                  <strong>Payment Gateways (Stripe / Mercado Pago):</strong>
                  Fraud prevention and secure checkout processing.
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                5. Your Cookie Choices & Controls
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Browser Settings:</strong> Most web browsers allow you
                  to manage, block, or delete cookies and cleared Local Storage
                  via your browser preferences/settings.
                </li>
                <li>
                  <strong>Essential Storage:</strong> Please note that disabling
                  essential cookies or local storage may prevent you from
                  logging in or using Creator Hub features.
                </li>
                <li>
                  <strong>Analytics Opt-Out:</strong> You can opt out of Google
                  Analytics tracking across all websites by visiting{" "}
                  <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google Analytics Opt-out Browser Add-on
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                6. Cookie Consent & Banner
              </h3>
              <p>
                When you first access Creator Hub, a cookie banner will notify
                you about our use of Storage Technologies. Essential cookies are
                loaded automatically to enable core platform operation. By
                continuing to use our platform or accepting non-essential
                cookies through the banner, you consent to our use of these
                technologies as outlined in this policy.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                7. Do Not Track (DNT) Signals
              </h3>
              <p>
                Some browsers include a "Do Not Track" setting. Because uniform
                standards for DNT compliance have not been broadly established
                across the industry, Creator Hub does not currently respond to
                DNT signals.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                8. Changes to This Cookie Policy
              </h3>
              <p>
                We may update this Cookie Policy to reflect technical,
                operational, or legal changes. We will notify users of any
                material updates by posting the revised version with an updated
                "Last updated" date.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">9. Contact Us</h3>
              <p>
                If you have any questions or concerns regarding our use of
                cookies and local storage, please contact us at:
              </p>
              <address className="not-italic mt-2">
                Creator Hub Legal & Privacy Team
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

export default function CookiesPage() {
  return <CookiesModal open={true} onOpenChange={() => {}} />;
}
