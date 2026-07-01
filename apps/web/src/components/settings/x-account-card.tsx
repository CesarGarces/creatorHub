"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, Button } from "@creator-hub/ui";
import api from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface SocialAccount {
  id: string;
  provider: string;
  providerUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "ERROR";
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export function XAccountCard() {
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    try {
      const response = await api.get<{ data: SocialAccount[] }>(
        "/social/accounts",
      );
      const accounts = response.data || [];
      const xAccount = accounts.find((a) => a.provider === "X_TWITTER");
      setAccount(xAccount || null);
    } catch (error) {
      console.error("Failed to fetch accounts", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await api.post<{ data: { authorizationUrl: string } }>(
        "/social/x/connect",
      );
      const { authorizationUrl } = response.data;
      window.location.href = authorizationUrl;
    } catch (error) {
      toast.error("Failed to initiate X connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account) return;
    setDisconnecting(true);
    try {
      await api.delete(`/social/accounts/${account.id}`);
      setAccount(null);
      toast.success("X account disconnected");
    } catch (error) {
      toast.error("Failed to disconnect account");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    if (!account) return;
    try {
      await api.post(`/social/accounts/${account.id}/refresh`);
      await fetchAccount();
      toast.success("Tokens refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh tokens");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-text">Integrations</h2>
        <p className="text-sm text-text-muted">Connect your social accounts</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-white"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text">X (Twitter)</p>
                {account && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      account.status === "ACTIVE"
                        ? "bg-success/10 text-success"
                        : account.status === "EXPIRED"
                          ? "bg-warning/10 text-warning"
                          : "bg-error/10 text-error"
                    }`}
                  >
                    {account.status === "ACTIVE" ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {account.status}
                  </span>
                )}
              </div>
              {account ? (
                <p className="text-xs text-text-muted">
                  @{account.providerUsername} • {account.displayName}
                </p>
              ) : (
                <p className="text-xs text-text-muted">Not connected</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {account ? (
              <>
                {account.status === "EXPIRED" && (
                  <Button variant="secondary" size="sm" onClick={handleRefresh}>
                    Reconnect
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? "Connecting..." : "Connect"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
