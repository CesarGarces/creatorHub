"use client";

import { Card, CardContent, CardHeader, Input, Button } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { useAuthStore } from "@/store/auth.store";

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />
      <div className="p-6 space-y-8 max-w-3xl animate-fade-in">
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
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white text-xl font-bold">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <Button variant="secondary" size="sm">
                Change Avatar
              </Button>
            </div>
            <Input label="Name" defaultValue={user?.email?.split("@")[0]} />
            <Input label="Email" type="email" defaultValue={user?.email} />
            <Button variant="primary">Save Changes</Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-text">Preferences</h2>
            <p className="text-sm text-text-muted">Customize your experience</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-muted">
                Default AI Provider
              </label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary">
                <option>OpenAI (DALL-E 3)</option>
                <option>Flux</option>
                <option>Stability AI</option>
                <option>Gemini</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-muted">
                Default Style
              </label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary">
                <option>Bold & Colorful</option>
                <option>Minimalist</option>
                <option>Gaming</option>
                <option>Cinematic</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-text">
                  Email Notifications
                </p>
                <p className="text-xs text-text-muted">
                  Receive updates about your generations
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors">
                <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition-transform" />
              </button>
            </div>
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
    </>
  );
}
