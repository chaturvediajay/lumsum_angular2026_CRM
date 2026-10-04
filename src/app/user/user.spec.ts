import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { of } from "rxjs";
import { vi } from "vitest";
import { User, UserData } from "./user";
import { CommonHttp } from "../service/common-http";
import { SessionService } from "../service/session.service";
import { UserService } from "../service/user-service";
import { UserSession, SessionStats } from "../interface/session.model";

describe("User", () => {
  let component: User;
  let fixture: ComponentFixture<User>;
  let mockSessionService: any;
  let mockCommonHttp: any;
  let mockUserService: any;

  const mockUsers: UserData[] = [
    { id: 1, username: "admin", email: "admin@example.com", isActive: true },
    { id: 2, username: "john_doe", email: "john@example.com", isActive: true },
  ];

  const mockSessions: UserSession[] = [
    {
      id: 10,
      userId: 1,
      username: "admin",
      email: "admin@example.com",
      roles: ["ROLE_ADMIN"],
      ipAddress: "127.0.0.1",
      userAgent: "Chrome on macOS",
      deviceType: "Desktop",
      browser: "Chrome",
      operatingSystem: "macOS",
      expiryDate: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      active: true,
      currentSession: true,
    },
    {
      id: 20,
      userId: 2,
      username: "john_doe",
      email: "john@example.com",
      roles: ["ROLE_USER"],
      ipAddress: "192.168.1.50",
      userAgent: "Safari on iOS",
      deviceType: "Mobile",
      browser: "Safari",
      operatingSystem: "iOS",
      expiryDate: new Date(Date.now() + 7200000).toISOString(),
      createdAt: new Date().toISOString(),
      active: true,
      currentSession: false,
    },
  ];

  const mockStats: SessionStats = {
    totalActiveSessions: 2,
    uniqueActiveUsers: 2,
    activeToday: 2,
    deviceBreakdown: { Desktop: 1, Mobile: 1 },
    browserBreakdown: { Chrome: 1, Safari: 1 },
  };

  beforeEach(async () => {
    sessionStorage.clear();
    mockSessionService = {
      getAllSessions: vi.fn(() => of(mockSessions)),
      getSessionStats: vi.fn(() => of(mockStats)),
      getUserSessions: vi.fn(() => of([mockSessions[1]])),
      revokeSession: vi.fn((id: number) => of({ status: "success", message: "Revoked", sessionId: id })),
      revokeAllUserSessions: vi.fn((userId: number) => of({ status: "success", message: "Revoked all", userId: userId, revokedCount: 1 })),
      revokeAllOtherSessions: vi.fn((userId: number) => of({ status: "success", message: "Revoked others", userId: userId, revokedCount: 2 })),
      updateDeviceName: vi.fn((id: number, name: string) => of({ status: "success", message: "Updated", sessionId: id, deviceName: name })),
    };

    mockCommonHttp = {
      getAll: vi.fn(() => of(mockUsers)),
    };

    mockUserService = {
      clearSession: vi.fn(),
      getDeviceId: vi.fn().mockReturnValue("mock-device-id"),
      getDeviceName: vi.fn().mockReturnValue("Mock Device"),
      setDeviceName: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [User],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: mockSessionService },
        { provide: CommonHttp, useValue: mockCommonHttp },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(User);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should load user and session data on initialization", () => {
    component.ngOnInit();
    expect(mockCommonHttp.getAll).toHaveBeenCalled();
    expect(mockSessionService.getAllSessions).toHaveBeenCalled();
    expect(mockSessionService.getSessionStats).toHaveBeenCalled();
    expect(component.userList.length).toBe(2);
    expect(component.sessionsList.length).toBe(2);
    expect(component.filteredSessions.length).toBe(2);
    expect(component.sessionStats?.totalActiveSessions).toBe(2);
  });

  it("should switch tabs accurately", () => {
    component.switchTab("sessions");
    expect(component.activeTab).toBe("sessions");

    component.switchTab("list");
    expect(component.activeTab).toBe("list");
  });

  it("should filter sessions by search keyword", () => {
    component.sessionsList = [...mockSessions];
    component.sessionSearchTerm = "admin";
    component.applySessionFilter();

    expect(component.filteredSessions.length).toBe(1);
    expect(component.filteredSessions[0].username).toBe("admin");

    component.sessionSearchTerm = "192.168.1.50";
    component.applySessionFilter();
    expect(component.filteredSessions.length).toBe(1);
    expect(component.filteredSessions[0].username).toBe("john_doe");
  });

  it("should filter sessions by device type", () => {
    component.sessionsList = [...mockSessions];
    component.selectedDeviceFilter = "Mobile";
    component.applySessionFilter();

    expect(component.filteredSessions.length).toBe(1);
    expect(component.filteredSessions[0].deviceType).toBe("Mobile");

    component.selectedDeviceFilter = "Desktop";
    component.applySessionFilter();
    expect(component.filteredSessions.length).toBe(1);
    expect(component.filteredSessions[0].deviceType).toBe("Desktop");
  });

  it("should calculate active session count per user correctly", () => {
    component.sessionsList = [...mockSessions];
    expect(component.getUserSessionCount(1)).toBe(1);
    expect(component.getUserSessionCount(2)).toBe(1);
    expect(component.getUserSessionCount(999)).toBe(0);
  });

  it("should return appropriate icons for devices, browsers, and OS", () => {
    expect(component.getDeviceIcon("Mobile")).toBe("📱");
    expect(component.getDeviceIcon("Desktop")).toBe("💻");
    expect(component.getBrowserIcon("Chrome")).toBe("🌐");
    expect(component.getBrowserIcon("Safari")).toBe("🧭");
    expect(component.getOSIcon("macOS")).toBe("🍎");
    expect(component.getOSIcon("Windows")).toBe("🪟");
    expect(component.getOSIcon("Linux")).toBe("🐧");
    expect(component.getOSIcon("Android")).toBe("🤖");
  });

  it("should revoke other user session when confirmed and remove it from active list", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    component.sessionsList = [...mockSessions];
    component.filteredSessions = [...mockSessions];

    component.revokeSession(mockSessions[1]);
    expect(mockSessionService.revokeSession).toHaveBeenCalledWith(20);
    expect(component.sessionsList.find((s) => s.id === 20)).toBeUndefined();
    expect(component.actionSuccessMessage).toContain("terminated successfully");
  });

  it("should clear session and redirect to login when current session is revoked", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, "navigate");

    component.sessionsList = [...mockSessions];
    component.revokeSession(mockSessions[0]); // mockSessions[0].currentSession === true

    expect(mockSessionService.revokeSession).toHaveBeenCalledWith(10);
    expect(mockUserService.clearSession).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(["/"], {
      queryParams: { sessionTerminated: "true" },
    });
  });

  it("should not revoke session when user cancels confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    component.sessionsList = [...mockSessions];

    component.revokeSession(mockSessions[0]);
    expect(mockSessionService.revokeSession).not.toHaveBeenCalled();
    expect(component.sessionsList.length).toBe(2);
  });

  it("should revoke all user sessions when confirmed and refresh lists", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    component.sessionsList = [...mockSessions];
    component.selectedUser = mockUsers[1];

    component.revokeAllSessionsForUser(2);
    expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(2);
    expect(component.sessionsList.find((s) => s.userId === 2)).toBeUndefined();
    expect(component.actionSuccessMessage).toContain("terminated for john_doe");
  });

  it("should clear session and redirect to login when terminating all sessions for current user", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    sessionStorage.setItem("user_id", "1");
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, "navigate");

    component.revokeAllSessionsForUser(1);
    expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(1);
    expect(mockUserService.clearSession).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(["/"], {
      queryParams: { sessionTerminated: "true" },
    });
  });

  it("should accurately detect and count multiple devices sharing same IP and browser", () => {
    const sessionDev1: UserSession = {
      ...mockSessions[0],
      id: 101,
      ipAddress: "127.0.0.1",
      browser: "Chrome",
      deviceId: "dev_laptop",
      deviceName: "Chrome on macOS (Device 1)",
    };
    const sessionDev2: UserSession = {
      ...mockSessions[0],
      id: 102,
      ipAddress: "127.0.0.1",
      browser: "Chrome",
      deviceId: "dev_phone",
      deviceName: "Chrome on macOS (Device 2)",
      currentSession: false,
    };
    const sessionDifferent: UserSession = {
      ...mockSessions[1],
      id: 103,
      ipAddress: "10.0.0.5",
      browser: "Firefox",
      deviceId: "dev_tablet",
    };

    component.sessionsList = [sessionDev1, sessionDev2, sessionDifferent];

    expect(component.isSameIpAndBrowser(sessionDev1)).toBe(true);
    expect(component.isSameIpAndBrowser(sessionDev2)).toBe(true);
    expect(component.isSameIpAndBrowser(sessionDifferent)).toBe(false);

    expect(component.getSameIpBrowserCount(sessionDev1)).toBe(2);
    expect(component.getSameIpBrowserCount(sessionDifferent)).toBe(1);

    expect(component.getDeviceDisplayLabel(sessionDev1)).toBe("Chrome on macOS (Device 1)");
    expect(component.getDeviceShortId(sessionDev1)).toBe("laptop");
  });

  it("should revoke all other sessions when confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    sessionStorage.setItem("user_id", "1");

    component.revokeOtherSessions();

    expect(mockSessionService.revokeAllOtherSessions).toHaveBeenCalledWith(1);
    expect(component.actionSuccessMessage).toContain("signed out 2 other device session(s)");
  });

  it("should update device name when edited by user", () => {
    vi.spyOn(window, "prompt").mockReturnValue("My Work Laptop");
    const sessionToRename = { ...mockSessions[0], id: 10, deviceName: "Old Name" };

    component.editDeviceName(sessionToRename);

    expect(mockSessionService.updateDeviceName).toHaveBeenCalledWith(10, "My Work Laptop");
    expect(sessionToRename.deviceName).toBe("My Work Laptop");
    expect(component.actionSuccessMessage).toContain('Device renamed to "My Work Laptop"');
  });

  it("should open and close system details modal correctly", () => {
    const session: UserSession = {
      ...mockSessions[0],
      clientPort: 54321,
      networkType: "Private LAN (WIFI)",
      timezone: "America/New_York",
      locale: "en-US",
      screenResolution: "2560x1440",
      clientSystemInfo: "macOS • Chrome • 2560x1440 (8 cores)",
    };

    component.openSystemDetailsModal(session);
    expect(component.selectedSystemSession).toBe(session);

    component.closeSystemDetailsModal();
    expect(component.selectedSystemSession).toBeNull();
  });

  it("should return appropriate network icons based on network classification", () => {
    expect(component.getNetworkIcon("Localhost (Loopback)")).toBe("🏠");
    expect(component.getNetworkIcon("Private LAN (WIFI)")).toBe("🏢");
    expect(component.getNetworkIcon("wifi")).toBe("📶");
    expect(component.getNetworkIcon("4G")).toBe("📱");
    expect(component.getNetworkIcon("ethernet")).toBe("🔌");
    expect(component.getNetworkIcon("Public WAN")).toBe("🌐");
  });

  it("should filter sessions by network type, timezone, and system info", () => {
    const session1: UserSession = {
      ...mockSessions[0],
      networkType: "Private LAN",
      timezone: "Asia/Kolkata",
      clientSystemInfo: "macOS • Chrome (8 cores)",
    };
    const session2: UserSession = {
      ...mockSessions[1],
      networkType: "Public WAN",
      timezone: "America/New_York",
      clientSystemInfo: "Windows • Firefox (16 cores)",
    };

    component.sessionsList = [session1, session2];

    // Filter by network
    component.sessionSearchTerm = "Private LAN";
    component.applySessionFilter();
    expect(component.filteredSessions.length).toBe(1);
    expect(component.filteredSessions[0].networkType).toBe("Private LAN");

    // Filter by timezone
    component.sessionSearchTerm = "Kolkata";
    component.applySessionFilter();
    expect(component.filteredSessions.length).toBe(1);

    // Filter by system info
    component.sessionSearchTerm = "Firefox";
    component.applySessionFilter();
    expect(component.filteredSessions.length).toBe(1);
    expect(component.filteredSessions[0].clientSystemInfo).toContain("Firefox");
  });
});
