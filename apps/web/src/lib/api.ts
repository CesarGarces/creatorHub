const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams}`;
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: "DELETE" }),
};

export default api;
