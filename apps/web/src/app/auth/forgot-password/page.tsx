"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Card, CardContent, CardHeader } from "@creator-hub/ui";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { AuthLanguageSwitcher } from "@/components/i18n/auth-language-switcher";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const { t, rich } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err: unknown) {
      setError(localizeError(err, "auth.forgot.failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg relative overflow-hidden">
      <AuthLanguageSwitcher />
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
            {t("auth.forgot.title")}
          </h1>
          <p className="text-sm text-text-muted">{t("auth.forgot.subtitle")}</p>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-success"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-success">
                {t("auth.forgot.checkEmail")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {rich(
                  "auth.forgot.sentTo",
                  {
                    email: (chunks) => (
                      <span className="font-medium text-text">{chunks}</span>
                    ),
                  },
                  { email },
                )}
              </p>
              <a
                href="/login"
                className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-hover transition-colors"
              >
                {t("auth.forgot.backToSignIn")}
              </a>
            </div>
          ) : (
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
              <Button
                type="submit"
                isLoading={isLoading}
                variant="glow"
                className="w-full"
                size="lg"
              >
                {t("auth.forgot.submit")}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-text-muted">
            {t("auth.forgot.remember")}{" "}
            <a
              href="/login"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              {t("auth.forgot.signIn")}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="text-text-muted">{t("common.status.loading")}</div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
