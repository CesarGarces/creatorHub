"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { AuthLanguageSwitcher } from "@/components/i18n/auth-language-switcher";
import { Button, Card, CardContent, CardHeader } from "@creator-hub/ui";

const OTP_KEYS = [
  "otp-0",
  "otp-1",
  "otp-2",
  "otp-3",
  "otp-4",
  "otp-5",
] as const;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { t, rich } = useI18n();
  const { user, setUser } = useAuthStore();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = user?.email || "";

  const verifyCode = useCallback(
    async (code: string) => {
      if (!email || isVerifying) return;
      setIsVerifying(true);
      setError("");
      try {
        const res = await api.post<{
          message: string;
          user: { emailVerified: string | null };
        }>("/auth/verify-email", { email, code });
        setSuccess(true);
        if (res.user) {
          setUser({ ...user!, emailVerified: res.user.emailVerified });
        }
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch (err: unknown) {
        setError(localizeError(err, "auth.verify.invalidCode"));
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } finally {
        setIsVerifying(false);
      }
    },
    [email, user, setUser, router, isVerifying],
  );

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== "")) {
      verifyCode(newDigits.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i] ?? "";
    }
    setDigits(newDigits);

    const nextEmpty = newDigits.findIndex((d) => d === "");
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    inputRefs.current[focusIndex]?.focus();

    if (newDigits.every((d) => d !== "")) {
      verifyCode(newDigits.join(""));
    }
  };

  const handleResend = async () => {
    if (!email || countdown > 0 || isResending) return;
    setIsResending(true);
    setError("");
    try {
      await api.post("/auth/resend-verification", { email });
      setCountdown(60);
    } catch (err: unknown) {
      setError(localizeError(err, "auth.verify.resendFailed"));
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg">
        <AuthLanguageSwitcher />
        <Card className="w-full max-w-md border-border/50 bg-surface/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-text-muted">
              {t("auth.verify.noEmail")}{" "}
              <a
                href="/register"
                className="text-primary hover:text-primary-hover font-medium"
              >
                {t("auth.verify.signUp")}
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            {t("auth.verify.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {rich(
              "auth.verify.sentCode",
              {
                email: (chunks) => (
                  <span className="font-medium text-text">{chunks}</span>
                ),
              },
              { email },
            )}
          </p>
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
                {t("auth.verify.success")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t("auth.verify.redirecting")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center gap-3">
                {digits.map((digit, i) => (
                  <input
                    key={OTP_KEYS[i]}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={isVerifying}
                    className={`
                      h-14 w-12 text-center text-xl font-mono font-bold
                      rounded-xl border bg-surface-elevated text-text
                      outline-none transition-all duration-150
                      focus:border-primary focus:ring-2 focus:ring-primary/20
                      disabled:opacity-50
                      ${digit ? "border-primary/50" : "border-border"}
                      ${error ? "border-error/50" : ""}
                    `}
                    aria-label={t("auth.verify.digit", { number: i + 1 })}
                  />
                ))}
              </div>

              {error && (
                <p className="text-center text-sm text-error">{error}</p>
              )}

              {isVerifying && (
                <p className="text-center text-xs text-text-muted">
                  {t("auth.verify.verifying")}
                </p>
              )}

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-text-muted">
                    {rich(
                      "auth.verify.resendIn",
                      {
                        timer: (chunks) => (
                          <span className="font-mono font-medium text-text">
                            {chunks}
                          </span>
                        ),
                      },
                      { seconds: countdown },
                    )}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-sm font-medium text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
                  >
                    {isResending
                      ? t("auth.verify.resending")
                      : t("auth.verify.resend")}
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
