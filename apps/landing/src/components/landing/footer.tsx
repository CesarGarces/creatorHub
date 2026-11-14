"use client";

import { useI18n } from "@/i18n/i18n-provider";

// Texts: footer.groups.<group> and footer.links.<id>
const footerLinks = {
  product: [
    { id: "thumbnail", href: "#tools" },
    { id: "video", href: "#tools" },
    { id: "translator", href: "#tools" },
    { id: "agents", href: "#agents" },
    { id: "pricing", href: "#pricing" },
  ],
  resources: [
    { id: "docs", href: "#" },
    { id: "blog", href: "#" },
    { id: "changelog", href: "#" },
    { id: "status", href: "#" },
  ],
  company: [
    { id: "about", href: "#" },
    { id: "contact", href: "#" },
    { id: "privacy", href: "#" },
    { id: "terms", href: "#" },
  ],
} as const;

export function Footer() {
  const { t, rich } = useI18n();
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center mb-4">
              <img
                src="/isologo_white.png"
                alt={t("common.logoAlt")}
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-text-muted leading-relaxed max-w-xs">
              {t("footer.tagline")}
            </p>
          </div>

          {(
            Object.entries(footerLinks) as [
              keyof typeof footerLinks,
              (typeof footerLinks)[keyof typeof footerLinks],
            ][]
          ).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-sm font-semibold text-text mb-4">
                {t(`footer.groups.${group}`)}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className="text-sm text-text-muted hover:text-text transition-colors"
                    >
                      {t(`footer.links.${link.id}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border-subtle flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-dim">
            {/* String year: numbers would be digit-grouped ("2,026"). */}
            {t("footer.rights", { year: "2026" })}
          </p>
          <p className="text-xs text-text-dim">
            {rich("footer.developedBy", {
              link: (chunks) => (
                <a
                  href="https://www.cesargarces.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-hover transition-colors"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              aria-label={t("footer.social.x")}
              className="text-text-dim hover:text-text-muted transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label={t("footer.social.github")}
              className="text-text-dim hover:text-text-muted transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label={t("footer.social.discord")}
              className="text-text-dim hover:text-text-muted transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
