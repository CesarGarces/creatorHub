"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Button, Input, Card, CardContent, CardHeader } from "@creator-hub/ui";
import Link from "next/link";
import { PrivacyModal } from "@/app/privacy/page";
import { TermsModal } from "@/app/terms/page";
import { CookiesModal } from "@/app/cookies/page";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { AuthLanguageSwitcher } from "@/components/i18n/auth-language-switcher";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { login, isLoading, user, isHydrated, hydrate } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCookies, setShowCookies] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && user) {
      router.push("/dashboard");
    }
  }, [isHydrated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(localizeError(err, "auth.login.invalidCredentials"));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg relative overflow-hidden">
      <AuthLanguageSwitcher />
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-surface/90 backdrop-blur-sm">
        <CardHeader className="text-center">
          <img
            src="/isologo_white.png"
            alt={t("common.appName")}
            className="mx-auto mb-4 h-14 w-auto"
          />
          <h1 className="text-2xl font-bold text-text">
            {t("auth.login.title")}
          </h1>
          <p className="text-sm text-text-muted">{t("auth.login.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-error/10 border border-error/20 p-3 text-sm text-error">
                {error}
              </div>
            )}
            <Input
              label={t("auth.fields.email")}
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.fields.emailPlaceholder")}
              required
            />
            <Input
              label={t("auth.fields.password")}
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="flex justify-end">
              <a
                href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                {t("auth.login.forgotPassword")}
              </a>
            </div>
            <Button
              type="submit"
              isLoading={isLoading}
              variant="glow"
              className="w-full"
              size="lg"
            >
              {t("auth.login.submit")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-text-muted">
            {t("auth.login.noAccount")}{" "}
            <a
              href="/register"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              {t("auth.login.register")}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 whitespace-nowrap text-xs text-text-muted">
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="hover:underline text-primary hover:text-primary-hover transition-colors"
            >
              {t("auth.legal.privacy")}
            </button>
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="hover:underline text-primary hover:text-primary-hover transition-colors"
            >
              {t("auth.legal.terms")}
            </button>
            <button
              type="button"
              onClick={() => setShowCookies(true)}
              className="hover:underline text-primary hover:text-primary-hover transition-colors"
            >
              {t("auth.legal.cookies")}
            </button>
          </div>

          {/* Modals */}
          <PrivacyModal open={showPrivacy} onOpenChange={setShowPrivacy} />
          <TermsModal open={showTerms} onOpenChange={setShowTerms} />
          <CookiesModal open={showCookies} onOpenChange={setShowCookies} />
        </CardContent>
      </Card>
    </div>
  );
}
