import { io, Socket } from "socket.io-client";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  removeAccessToken,
  removeRefreshToken,
} from "@/lib/cookie";
import { toast } from "sonner";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) return socket;

  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!token) {
    console.error("[Socket] No access token found in cookies");
    throw new Error("No access token available for WebSocket connection");
  }

  const rawUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!rawUrl) {
    console.error("[Socket] NEXT_PUBLIC_API_URL is not set");
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const apiUrl = rawUrl.replace(/\/api\/v1\/?$/, "");
  console.log("[Socket] Creating socket connection to", apiUrl);
  socket = io(apiUrl, {
    auth: { token, refreshToken },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    autoConnect: false,
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket] Connection error:", err.message);
  });

  // Update client storage and socket auth when server refreshes the access token
  socket.on("auth:refreshed", (data: { accessToken: string }) => {
    try {
      console.log("[Socket] Received auth:refreshed, updating local token");
      setAccessToken(data.accessToken);
      if (socket) socket.auth = { ...socket.auth, token: data.accessToken };
    } catch (err) {
      console.error("[Socket] Failed to apply refreshed token", err);
    }
  });

  socket.on("auth_error", (err: { code?: string; message?: string }) => {
    console.error(
      "[Socket] Authentication error from server:",
      err?.message || err,
    );
    toast.error("Tu sesión ha expirado. Redirigiendo al login...");
    // Cleanup local credentials
    try {
      removeAccessToken();
      removeRefreshToken();
    } catch {}

    // Force disconnect and redirect to login
    disconnectSocket();
    setTimeout(() => {
      if (typeof window !== "undefined") window.location.href = "/auth/login";
    }, 1200);
  });

  return socket;
}

export function connectSocket(): Socket | null {
  try {
    const s = getSocket();
    if (!s.connected) {
      s.connect();
    }
    return s;
  } catch {
    return null;
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
