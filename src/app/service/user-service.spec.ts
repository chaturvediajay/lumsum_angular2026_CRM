import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";
import { UserService } from "./user-service";
import { environment } from "@environments/environment";
import { SessionSyncService } from "./session-sync.service";

const mockSessionSync = {
  broadcastRefresh: () => {},
  broadcastLogout: () => {},
  clearSnapshot: () => {},
  broadcastLogin: () => {},
  writeSnapshot: () => {},
  init: () => {},
  tryRestoreFromSnapshot: () => {},
};

if (typeof (globalThis as any).localStorage === 'undefined') {
  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe("UserService", () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        UserService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionSyncService, useValue: mockSessionSync },
      ],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("clearSession should remove all auth keys from sessionStorage", () => {
    sessionStorage.setItem("access_token", "abc");
    sessionStorage.setItem("refresh_token", "ref-xyz");
    sessionStorage.setItem("token_type", "Bearer");
    sessionStorage.setItem("user_id", "123");
    sessionStorage.setItem("username", "testuser");
    sessionStorage.setItem("email", "test@test.com");
    sessionStorage.setItem("roles", JSON.stringify(["ROLE_USER"]));

    service.clearSession();

    expect(sessionStorage.getItem("access_token")).toBeNull();
    expect(sessionStorage.getItem("refresh_token")).toBeNull();
    expect(sessionStorage.getItem("token_type")).toBeNull();
    expect(sessionStorage.getItem("user_id")).toBeNull();
    expect(sessionStorage.getItem("username")).toBeNull();
    expect(sessionStorage.getItem("email")).toBeNull();
    expect(sessionStorage.getItem("roles")).toBeNull();
  });

  it("isTokenValid should return false when no token is present", () => {
    expect(service.isTokenValid()).toBe(false);
  });

  it("refreshToken should throw error if no refresh_token in sessionStorage", () => {
    service.refreshToken().subscribe({
      error: (err) => {
        expect(err.message).toBe("No refresh token available");
      },
    });
  });

  it("refreshToken should call /auth/refreshtoken and update tokens in sessionStorage", () => {
    sessionStorage.setItem("refresh_token", "old-refresh-token");

    service.refreshToken().subscribe((res) => {
      expect(res.accessToken).toBe("new-jwt-token");
      expect(res.refreshToken).toBe("new-refresh-token");
      expect(sessionStorage.getItem("access_token")).toBe("new-jwt-token");
      expect(sessionStorage.getItem("refresh_token")).toBe("new-refresh-token");
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refreshtoken`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ refreshToken: "old-refresh-token" });

    req.flush({
      accessToken: "new-jwt-token",
      refreshToken: "new-refresh-token",
      tokenType: "Bearer",
    });
  });

  it("refreshToken should clear session on HTTP failure", () => {
    sessionStorage.setItem("access_token", "expired-token");
    sessionStorage.setItem("refresh_token", "expired-refresh-token");

    service.refreshToken().subscribe({
      error: (err) => {
        expect(sessionStorage.getItem("access_token")).toBeNull();
        expect(sessionStorage.getItem("refresh_token")).toBeNull();
      },
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refreshtoken`);
    req.flush("Expired", { status: 403, statusText: "Forbidden" });
  });

  // ---------------------------------------------------------------------------
  // Client-side IP detection
  // ---------------------------------------------------------------------------

  it("getClientPublicIp should return 'unknown' when localStorage is empty", () => {
    localStorage.removeItem("lumsum_public_ip");
    expect(service.getClientPublicIp()).toBe("unknown");
  });

  it("getClientPublicIp should return cached value from localStorage", () => {
    localStorage.setItem("lumsum_public_ip", "203.0.113.10");
    expect(service.getClientPublicIp()).toBe("203.0.113.10");
  });

  it("getClientPrivateIp should return 'unknown' when localStorage is empty", () => {
    localStorage.removeItem("lumsum_private_ip");
    expect(service.getClientPrivateIp()).toBe("unknown");
  });

  it("getClientPrivateIp should return cached value from localStorage", () => {
    localStorage.setItem("lumsum_private_ip", "192.168.1.42");
    expect(service.getClientPrivateIp()).toBe("192.168.1.42");
  });

  it("initClientIp should not throw even when fetch and RTCPeerConnection are unavailable", () => {
    // Stub fetch to fail
    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = () => Promise.reject(new Error("offline"));
    // Remove RTCPeerConnection to simulate unsupported environment
    const origRTC = (window as any).RTCPeerConnection;
    delete (window as any).RTCPeerConnection;

    expect(() => service.initClientIp()).not.toThrow();

    // Restore
    (globalThis as any).fetch = origFetch;
    (window as any).RTCPeerConnection = origRTC;
  });

  it("initClientIp should skip public IP fetch when cache is fresh", () => {
    // Pre-populate a fresh cache entry
    localStorage.setItem("lumsum_public_ip", "1.2.3.4");
    localStorage.setItem("lumsum_public_ip_ts", String(Date.now())); // fresh

    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);
    service.initClientIp();

    // fetch should NOT be called because cache is fresh
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
