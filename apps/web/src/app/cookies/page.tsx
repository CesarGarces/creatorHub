"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@creator-hub/ui";

interface CookiesModalProps {
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
                1. What Are Cookies
              </h3>
              <p>
                Cookies are small text files stored on your device (computer,
                tablet, mobile) when you visit websites. They help websites
                function properly, remember your preferences, and provide
                analytics.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                2. How We Use Cookies
              </h3>
              <p>We use cookies for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  <strong>Essential:</strong> Required for the Service to
                  function (authentication, security, session management)
                </li>
                <li>
                  <strong>Preferences:</strong> Remember your settings (theme,
                  language, region)
                </li>
                <li>
                  <strong>Analytics:</strong> Understand how visitors use our
                  Service (Google Analytics, Vercel Analytics)
                </li>
                <li>
                  <strong>Marketing:</strong> Deliver relevant advertisements
                  (if applicable)
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                3. Types of Cookies We Use
              </h3>
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 font-semibold">Category</th>
                    <th className="text-left p-2 font-semibold">Purpose</th>
                    <th className="text-left p-2 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="p-2 font-medium">Session/Auth</td>
                    <td className="p-2">
                      Keep you logged in, secure authentication
                    </td>
                    <td className="p-2">Session / 30 days</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-2 font-medium">CSRF Token</td>
                    <td className="p-2">
                      Prevent cross-site request forgery attacks
                    </td>
                    <td className="p-2">Session</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-2 font-medium">Preferences</td>
                    <td className="p-2">Theme, language, UI settings</td>
                    <td className="p-2">1 year</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-2 font-medium">Analytics (GA)</td>
                    <td className="p-2">Track page views, user behavior</td>
                    <td className="p-2">2 years</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-2 font-medium">Analytics (Vercel)</td>
                    <td className="p-2">Performance and usage metrics</td>
                    <td className="p-2">1 year</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                4. Third-Party Cookies
              </h3>
              <p>
                We use the following third-party services that may set cookies:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>
                  <strong>Google Analytics:</strong> Website analytics (
                  <a
                    href="https://policies.google.com/technologies/cookies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google's cookie policy
                  </a>
                  )
                </li>
                <li>
                  <strong>Vercel Analytics:</strong> Performance monitoring (
                  <a
                    href="https://vercel.com/legal/cookie-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Vercel's cookie policy
                  </a>
                  )
                </li>
                <li>
                  <strong>Stripe:</strong> Payment processing (
                  <a
                    href="https://stripe.com/cookies-policy/legal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Stripe's cookie policy
                  </a>
                  )
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                5. Your Cookie Choices
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>Browser Settings:</strong> Most browsers allow you to
                  refuse or delete cookies. See your browser's help section.
                </li>
                <li>
                  <strong>Essential Cookies:</strong> Cannot be disabled as they
                  are required for the Service to function.
                </li>
                <li>
                  <strong>Opt-Out:</strong> You can opt out of Google Analytics
                  at{" "}
                  <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    tools.google.com/dlpage/gaoptout
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">6. Cookie Consent</h3>
              <p>
                By continuing to use our Service after being notified of our use
                of cookies (via our cookie banner), you consent to our use of
                cookies as described in this policy. You can withdraw consent at
                any time by deleting cookies from your browser.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">7. Do Not Track</h3>
              <p>
                Some browsers have a "Do Not Track" feature. We do not currently
                respond to Do Not Track signals as there is no industry standard
                for compliance.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">
                8. Changes to This Policy
              </h3>
              <p>
                We may update this Cookie Policy from time to time. We will
                notify you of any material changes by posting the new policy on
                this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2">9. Contact Us</h3>
              <p>
                If you have questions about this Cookie Policy, contact us at:
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

export default function CookiesPage() {
  return <CookiesModal open={true} onOpenChange={() => {}} />;
}
