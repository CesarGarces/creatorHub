import { vi, describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store/auth.store";
import * as cookie from "@/lib/cookie";
import api from "@/lib/api";

vi.mock("@/lib/api");

describe("auth.store", () => {
  beforeEach(() => {
    // reset store
    const s = useAuthStore.getState();
    s.logout();
    vi.clearAllMocks();
  });

  it("stores refreshToken in cookies after login", async () => {
    const fakeRes = {
      accessToken: "access-123",
      refreshToken: "refresh-abc",
      user: { id: "u1", email: "a@b.com", role: "user" },
    };

    (api.post as any).mockResolvedValueOnce(fakeRes);

    const setRefreshSpy = vi.spyOn(cookie, "setRefreshToken");

    await useAuthStore.getState().login("a@b.com", "p");

    expect(setRefreshSpy).toHaveBeenCalledWith("refresh-abc");
  });
});
