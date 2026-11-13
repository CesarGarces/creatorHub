"use client";

import { useRouter } from "next/navigation";
import { Button } from "@creator-hub/ui";
import { ArrowLeft, Home } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

export default function NotFound() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-error/3 blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-6 animate-fade-in">
        <div className="mb-8">
          <span className="text-[120px] font-bold gradient-text leading-none">
            404
          </span>
        </div>

        <h1 className="text-2xl font-bold text-text mb-3">
          {t("notFound.title")}
        </h1>
        <p className="text-text-muted max-w-md mx-auto mb-10">
          {t("notFound.description")}
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("notFound.goBack")}
          </Button>
          <Button
            variant="glow"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            {t("notFound.backToDashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
}
