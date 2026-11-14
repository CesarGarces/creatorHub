"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { config } from "@/lib/config";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";
import { LanguageSwitcher } from "@/components/language-switcher";

const navLinks: { labelKey: TranslationKey; href: string }[] = [
  { labelKey: "nav.tools", href: "#tools" },
  { labelKey: "nav.agents", href: "#agents" },
  { labelKey: "nav.pricing", href: "#pricing" },
  { labelKey: "nav.faq", href: "#faq" },
];

export function Navbar() {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border-subtle">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <img
            src="/isologo_white.png"
            alt={t("common.logoAlt")}
            className="h-8 w-auto object-contain"
          />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              {t(link.labelKey)}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <a
            href={`${config.appUrl}/login`}
            className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
          >
            {t("nav.login")}
          </a>
          <a
            href={`${config.appUrl}/register`}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
          >
            {t("nav.signUp")}
          </a>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <LanguageSwitcher compact />
          <button
            type="button"
            className="text-text-muted hover:text-text"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-border-subtle bg-surface">
          <div className="flex flex-col px-6 py-4 gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-text-muted hover:text-text py-2"
                onClick={() => setMobileOpen(false)}
              >
                {t(link.labelKey)}
              </a>
            ))}
            <div className="flex gap-3 mt-2 pt-2 border-t border-border-subtle">
              <a
                href={`${config.appUrl}/login`}
                className="flex-1 text-center px-4 py-2 text-sm text-text-muted hover:text-text"
              >
                {t("nav.login")}
              </a>
              <a
                href={`${config.appUrl}/register`}
                className="flex-1 text-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg"
              >
                {t("nav.signUp")}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
