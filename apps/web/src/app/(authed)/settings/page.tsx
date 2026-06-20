"use client";

import { useState, useEffect } from "react";
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
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import api from "@/lib/api";
import { Pencil, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const planLabels: Record<
  string,
  { label: string; variant: "free" | "primary" | "premium" }
> = {
  FREE: { label: "FREE PLAN", variant: "free" },
  PAY_AS_YOU_GO: { label: "PAY AS YOU GO", variant: "primary" },
  PREMIUM: { label: "PREMIUM", variant: "premium" },
  STARTER: { label: "STARTER", variant: "primary" },
  PRO: { label: "PRO", variant: "premium" },
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
        className="absolute right-3 top-[38px] text-text-dim hover:text-text-muted transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
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

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleProfileSave = async () => {
    setProfileLoading(true);
    try {
      await api.patch("/auth/profile", { name: profileName });
      setUser({ ...user!, name: profileName });
      toast.success("Name updated successfully");
      setProfileOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update name");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setConfirmOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "U";

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />
      <div className="p-6 space-y-8 max-w-3xl mx-auto animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">Settings</h1>
          <p className="mt-1 text-text-muted">
            Manage your account preferences
          </p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-text">Profile</h2>
            <p className="text-sm text-text-muted">
              Update your personal information
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
                  {displayName[0]?.toUpperCase()}
                </div>
                <button
                  onClick={() => {
                    setProfileName(
                      user?.name || user?.email?.split("@")[0] || "",
                    );
                    setProfileOpen(true);
                  }}
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
                    planLabels[plan]?.variant === "free"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                      : planLabels[plan]?.variant === "premium"
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                        : "bg-primary-light text-primary"
                  }`}
                >
                  {planLabels[plan]?.label || plan}
                </span>
                <span className="text-sm text-text-muted">
                  {balance} credits
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-text">Change Password</h2>
            <p className="text-sm text-text-muted">
              Update your password to keep your account secure
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordInput
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirm New Password"
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
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-error/30">
          <CardHeader>
            <h2 className="text-lg font-semibold text-error">Danger Zone</h2>
            <p className="text-sm text-text-muted">Irreversible actions</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-error/20 bg-error/5 p-4">
              <div>
                <p className="text-sm font-medium text-text">Delete Account</p>
                <p className="text-xs text-text-muted">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="danger" size="sm">
                Delete Account
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
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <Input
              label="Name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setProfileOpen(false)}
                disabled={profileLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleProfileSave}
                isLoading={profileLoading}
                disabled={!profileName.trim()}
              >
                Save Changes
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
            <DialogTitle>Confirm Password Change</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-text-muted">
              Are you sure you want to change your password? You will need to
              use the new password for future logins.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={pwLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePasswordChange}
                isLoading={pwLoading}
              >
                Yes, Change Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
