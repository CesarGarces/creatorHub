import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/cookie";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) return socket;

  const token = getAccessToken();
  if (!token) {
    throw new Error("No access token available for WebSocket connection");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  socket = io(apiUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    autoConnect: false,
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
