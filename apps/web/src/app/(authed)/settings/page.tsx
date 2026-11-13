"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { XAccountCard } from "@/components/settings/x-account-card";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import api from "@/lib/api";
import { Pencil, Eye, EyeOff, Globe } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { LanguageOptions } from "@/components/i18n/language-selector";

const planVariants: Record<string, "free" | "primary" | "premium"> = {
  FREE: "free",
  PAY_AS_YOU_GO: "primary",
  PREMIUM: "premium",
  STARTER: "primary",
  PRO: "premium",
};

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={
          show
            ? t("settings.password.hidePassword")
            : t("settings.password.showPassword")
        }
        className="absolute right-3 top-[38px] text-text-dim hover:text-text-muted transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { t, tOptional, rich } = useI18n();
  const { user, setUser, logout } = useAuthStore();
  const { balance, plan, fetchBalance } = useCreditsStore();

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Profile
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(
    user?.name || user?.email?.split("@")[0] || "",
  );
  const [profileLoading, setProfileLoading] = useState(false);

  // Delete Account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleProfileSave = async () => {
    setProfileLoading(true);
    try {
      await api.patch("/auth/profile", { name: profileName });
      setUser({ ...user!, name: profileName });
      toast.success(t("settings.toasts.nameUpdated"));
      setProfileOpen(false);
    } catch (err: unknown) {
      toast.error(localizeError(err, "settings.toasts.nameUpdateFailed"));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.toasts.passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("settings.toasts.passwordTooShort"));
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success(t("settings.toasts.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setConfirmOpen(false);
    } catch (err: unknown) {
      toast.error(localizeError(err, "settings.toasts.passwordUpdateFailed"));
    } finally {
      setPwLoading(false);
    }
  };

  // The confirmation word follows the interface language (DELETE / ELIMINAR / EXCLUIR).
  const confirmWord = t("settings.danger.confirmWord");

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== confirmWord) {
      toast.error(t("settings.toasts.typeToConfirm", { word: confirmWord }));
      return;
    }
    setDeleteLoading(true);
    try {
      await api.delete("/auth/account");
      toast.success(t("settings.toasts.accountDeleted"));
      logout();
      router.push("/login");
    } catch (err: unknown) {
      toast.error(localizeError(err, "settings.toasts.accountDeleteFailed"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "U";

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.settings") },
        ]}
      />
      <div className="p-6 space-y-8 max-w-3xl mx-auto animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {t("settings.title")}
          </h1>
          <p className="mt-1 text-text-muted">{t("settings.subtitle")}</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-text">
              {t("settings.profile.title")}
            </h2>
            <p className="text-sm text-text-muted">
              {t("settings.profile.description")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
                  {displayName[0]?.toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileName(
                      user?.name || user?.email?.split("@")[0] || "",
                    );
                    setProfileOpen(true);
                  }}
                  aria-label={t("settings.profile.editAvatar")}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated border border-border text-text-muted hover:text-primary hover:border-primary transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-3 text-base font-medium text-text">
                {displayName}
              </p>
              <p className="text-sm text-text-dim">{user?.email}</p>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    planVariants[plan] === "free"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                      : planVariants[plan] === "premium"
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                        : "bg-primary-light text-primary"
                  }`}
                >
                  {tOptional(`common.plans.${plan}`, plan)}
                </span>
                <span className="text-sm text-text-muted">
                  {t("settings.profile.credits", { count: balance })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interface language */}
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
              <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
              {t("language.settingsTitle")}
            </h2>
            <p className="text-sm text-text-muted">
              {t("language.settingsDescription")}
            </p>
          </CardHeader>
          <CardContent>
            <LanguageOptions savedToAccount={!!user} />
          </CardContent>
        </Card>

        {/* Integrations */}
        <XAccountCard />

        {/* Change Password */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-text">
              {t("settings.password.title")}
            </h2>
            <p className="text-sm text-text-muted">
              {t("settings.password.description")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput
              label={t("settings.password.current")}
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <PasswordInput
              label={t("settings.password.new")}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordInput
              label={t("settings.password.confirm")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <Button
              variant="primary"
              disabled={
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                pwLoading
              }
              onClick={() => setConfirmOpen(true)}
            >
              {t("settings.password.submit")}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-error/30">
          <CardHeader>
            <h2 className="text-lg font-semibold text-error">
              {t("settings.danger.title")}
            </h2>
            <p className="text-sm text-text-muted">
              {t("settings.danger.description")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-error/20 bg-error/5 p-4">
              <div>
                <p className="text-sm font-medium text-text">
                  {t("settings.danger.deleteTitle")}
                </p>
                <p className="text-xs text-text-muted">
                  {t("settings.danger.deleteDescription")}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteConfirmation("");
                  setDeleteOpen(true);
                }}
              >
                {t("settings.danger.deleteButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Edit Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClose={() => setProfileOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>{t("settings.editProfile.title")}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <Input
              label={t("settings.editProfile.name")}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setProfileOpen(false)}
                disabled={profileLoading}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleProfileSave}
                isLoading={profileLoading}
                disabled={!profileName.trim()}
              >
                {t("common.actions.saveChanges")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Password Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClose={() => setConfirmOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>{t("settings.password.confirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-text-muted">
              {t("settings.password.confirmDescription")}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={pwLoading}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handlePasswordChange}
                isLoading={pwLoading}
              >
                {t("settings.password.confirmButton")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClose={() => setDeleteOpen(false)}
        >
          <DialogHeader>
            <DialogTitle className="text-error">
              {t("settings.danger.deleteTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-text-muted">
              {t("settings.danger.modalDescription")}
            </p>
            <p className="text-sm text-text-muted">
              {rich(
                "settings.danger.typeToConfirm",
                {
                  word: (chunks) => (
                    <span className="font-bold text-error">{chunks}</span>
                  ),
                },
                { word: confirmWord },
              )}
            </p>
            <Input
              label={t("settings.danger.confirmationLabel")}
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={confirmWord}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteLoading}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
                isLoading={deleteLoading}
                disabled={deleteConfirmation !== confirmWord}
              >
                {t("settings.danger.deleteButton")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
