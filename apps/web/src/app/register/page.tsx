"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
} from "@creator-hub/ui";
import { Eye, EyeOff } from "lucide-react";
import { PrivacyModal } from "@/app/privacy/page";
import { TermsModal } from "@/app/terms/page";
import { CookiesModal } from "@/app/cookies/page";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { AuthLanguageSwitcher } from "@/components/i18n/auth-language-switcher";

export default function RegisterPage() {
  const router = useRouter();
  const { t, rich } = useI18n();
  const { register, isLoading } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCookies, setShowCookies] = useState(false);

  // One Idempotency-Key per registration attempt session: if the request is
  // retried (double submit, network retry), the API replays the original
  // response instead of creating a duplicate account.
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError(t("auth.register.mustAcceptTerms"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("errors.passwordsDoNotMatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }

    try {
      await register(
        email,
        password,
        name,
        idempotencyKeyRef.current ?? undefined,
      );
      router.push("/auth/verify");
    } catch (err) {
      setError(localizeError(err, "auth.register.failed"));
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
            {t("auth.register.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {t("auth.register.subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-error/10 border border-error/20 p-3 text-sm text-error">
                {error}
              </div>
            )}
            <Input
              label={t("auth.fields.name")}
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.fields.namePlaceholder")}
            />
            <Input
              label={t("auth.fields.email")}
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.fields.emailPlaceholder")}
              required
            />
            <div className="relative">
              <Input
                label={t("auth.fields.password")}
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-text-muted hover:text-text transition-colors"
                tabIndex={-1}
                aria-label={
                  showPassword
                    ? t("auth.fields.hidePassword")
                    : t("auth.fields.showPassword")
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="relative">
              <Input
                label={t("auth.fields.confirmPassword")}
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[38px] text-text-muted hover:text-text transition-colors"
                tabIndex={-1}
                aria-label={
                  showConfirmPassword
                    ? t("auth.fields.hidePassword")
                    : t("auth.fields.showPassword")
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-error">
                {t("errors.passwordsDoNotMatch")}
              </p>
            )}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="acceptedTerms"
                checked={acceptedTerms}
                onCheckedChange={(checked) =>
                  setAcceptedTerms(checked === true)
                }
                className="mt-1"
              />
              <label
                htmlFor="acceptedTerms"
                className="text-sm text-text-muted leading-relaxed"
              >
                {rich("auth.register.acceptTerms", {
                  terms: (chunks) => (
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      {chunks}
                    </button>
                  ),
                  privacy: (chunks) => (
                    <button
                      type="button"
                      onClick={() => setShowPrivacy(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      {chunks}
                    </button>
                  ),
                })}
              </label>
            </div>
            <Button
              type="submit"
              isLoading={isLoading}
              variant="glow"
              className="w-full"
              size="lg"
              disabled={!acceptedTerms}
            >
              {t("auth.register.submit")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-text-muted">
            {t("auth.register.haveAccount")}{" "}
            <a
              href="/login"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              {t("auth.register.signIn")}
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
