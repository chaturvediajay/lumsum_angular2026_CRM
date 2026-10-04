import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";
import { SessionService } from "./session.service";
import { environment } from "@environments/environment";
import { UserSession, SessionStats } from "../interface/session.model";

describe("SessionService", () => {
  let service: SessionService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/v1/sessions`;

  const mockSession: UserSession = {
    id: 1,
    userId: 101,
    username: "john_doe",
    email: "john@example.com",
    roles: ["ROLE_USER", "ROLE_ADMIN"],
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 Chrome/120.0",
    deviceType: "Desktop",
    browser: "Chrome",
    operatingSystem: "macOS",
    expiryDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    active: true,
    currentSession: true,
  };

  const mockStats: SessionStats = {
    totalActiveSessions: 5,
    uniqueActiveUsers: 3,
    activeToday: 4,
    deviceBreakdown: { Desktop: 3, Mobile: 2 },
    browserBreakdown: { Chrome: 4, Safari: 1 },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("getAllSessions should perform GET /v1/sessions and return session list", () => {
    service.getAllSessions().subscribe((sessions) => {
      expect(sessions.length).toBe(1);
      expect(sessions[0].username).toBe("john_doe");
      expect(sessions[0].deviceType).toBe("Desktop");
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe("GET");
    req.flush([mockSession]);
  });

  it("getSessionStats should perform GET /v1/sessions/stats and return aggregated metrics", () => {
    service.getSessionStats().subscribe((stats) => {
      expect(stats.totalActiveSessions).toBe(5);
      expect(stats.uniqueActiveUsers).toBe(3);
      expect(stats.deviceBreakdown?.["Desktop"]).toBe(3);
    });

    const req = httpMock.expectOne(`${baseUrl}/stats`);
    expect(req.request.method).toBe("GET");
    req.flush(mockStats);
  });

  it("getUserSessions should perform GET /v1/sessions/user/:id", () => {
    service.getUserSessions(101).subscribe((sessions) => {
      expect(sessions.length).toBe(1);
      expect(sessions[0].userId).toBe(101);
    });

    const req = httpMock.expectOne(`${baseUrl}/user/101`);
    expect(req.request.method).toBe("GET");
    req.flush([mockSession]);
  });

  it("getMySessions should perform GET /v1/sessions/my", () => {
    service.getMySessions().subscribe((sessions) => {
      expect(sessions.length).toBe(1);
      expect(sessions[0].currentSession).toBe(true);
    });

    const req = httpMock.expectOne(`${baseUrl}/my`);
    expect(req.request.method).toBe("GET");
    req.flush([mockSession]);
  });

  it("revokeSession should perform DELETE /v1/sessions/:id", () => {
    const mockResponse = { status: "success", message: "Session revoked", sessionId: 1 };

    service.revokeSession(1).subscribe((res) => {
      expect(res.status).toBe("success");
      expect(res.sessionId).toBe(1);
    });

    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe("DELETE");
    req.flush(mockResponse);
  });

  it("revokeAllUserSessions should perform DELETE /v1/sessions/user/:userId", () => {
    const mockResponse = { status: "success", message: "All sessions revoked", userId: 101, revokedCount: 2 };

    service.revokeAllUserSessions(101).subscribe((res) => {
      expect(res.status).toBe("success");
      expect(res.revokedCount).toBe(2);
    });

    const req = httpMock.expectOne(`${baseUrl}/user/101`);
    expect(req.request.method).toBe("DELETE");
    req.flush(mockResponse);
  });

  it("revokeAllOtherSessions should perform DELETE /v1/sessions/user/:userId/others", () => {
    const mockResponse = { status: "success", message: "All other device sessions revoked", userId: 101, revokedCount: 3 };

    service.revokeAllOtherSessions(101).subscribe((res) => {
      expect(res.status).toBe("success");
      expect(res.revokedCount).toBe(3);
    });

    const req = httpMock.expectOne(`${baseUrl}/user/101/others`);
    expect(req.request.method).toBe("DELETE");
    req.flush(mockResponse);
  });

  it("revokeDeviceSession should perform DELETE /v1/sessions/device/:deviceId", () => {
    const mockResponse = { status: "success", message: "Device session revoked", deviceId: "dev_xyz123" };

    service.revokeDeviceSession("dev_xyz123").subscribe((res) => {
      expect(res.status).toBe("success");
      expect(res.deviceId).toBe("dev_xyz123");
    });

    const req = httpMock.expectOne(`${baseUrl}/device/dev_xyz123`);
    expect(req.request.method).toBe("DELETE");
    req.flush(mockResponse);
  });

  it("updateDeviceName should perform PUT /v1/sessions/:id/device-name", () => {
    const mockResponse = { status: "success", message: "Device name updated", sessionId: 1, deviceName: "Work Laptop" };

    service.updateDeviceName(1, "Work Laptop").subscribe((res) => {
      expect(res.status).toBe("success");
      expect(res.deviceName).toBe("Work Laptop");
    });

    const req = httpMock.expectOne(`${baseUrl}/1/device-name`);
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toEqual({ deviceName: "Work Laptop" });
    req.flush(mockResponse);
  });
});
