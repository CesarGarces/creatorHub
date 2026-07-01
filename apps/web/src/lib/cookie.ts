const TOKEN_KEY = "ch_access_token";
const REFRESH_KEY = "ch_refresh_token";
const USER_KEY = "ch_user";

const COOKIE_OPTIONS = {
  path: "/",
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
};

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

export function setCookie(name: string, value: string, days: number): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + daysToMs(days)).toUTCString();
  const secure = COOKIE_OPTIONS.secure ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=${COOKIE_OPTIONS.path}; SameSite=${COOKIE_OPTIONS.sameSite}${secure}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function removeCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${COOKIE_OPTIONS.path}; SameSite=${COOKIE_OPTIONS.sameSite}`;
}

export function setAccessToken(token: string): void {
  setCookie(TOKEN_KEY, token, 7);
}

export function getAccessToken(): string | null {
  return getCookie(TOKEN_KEY);
}

export function removeAccessToken(): void {
  removeCookie(TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  setCookie(REFRESH_KEY, token, 30);
}

export function getRefreshToken(): string | null {
  return getCookie(REFRESH_KEY);
}

export function removeRefreshToken(): void {
  removeCookie(REFRESH_KEY);
}

export interface StoredUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

export function setStoredUser(user: StoredUser): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): StoredUser | null {
  if (typeof sessionStorage === "undefined") return null;
  const data = sessionStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as StoredUser;
  } catch {
    return null;
  }
}

export function removeStoredUser(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(USER_KEY);
}
