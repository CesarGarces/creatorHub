"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { config } from "@/lib/config";

const navLinks = [
  { label: "Tools", href: "#tools" },
  { label: "Agents", href: "#agents" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border-subtle">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
            C
          </div>
          <span className="text-lg font-semibold text-text">Creator Hub</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a
            href={`${config.appUrl}/login`}
            className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
          >
            Login
          </a>
          <a
            href={`${config.appUrl}/register`}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
          >
            Sign Up
          </a>
        </div>

        <button
          className="md:hidden text-text-muted hover:text-text"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
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
                {link.label}
              </a>
            ))}
            <div className="flex gap-3 mt-2 pt-2 border-t border-border-subtle">
              <a
                href={`${config.appUrl}/login`}
                className="flex-1 text-center px-4 py-2 text-sm text-text-muted hover:text-text"
              >
                Login
              </a>
              <a
                href={`${config.appUrl}/register`}
                className="flex-1 text-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg"
              >
                Sign Up
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
