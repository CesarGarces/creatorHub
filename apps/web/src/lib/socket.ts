import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/cookie";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) return socket;

  const token = getAccessToken();
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
    auth: { token },
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
