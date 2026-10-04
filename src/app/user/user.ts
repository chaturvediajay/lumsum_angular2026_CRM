import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { CommonHttp } from "../service/common-http";
import { SessionService } from "../service/session.service";
import { UserService } from "../service/user-service";
import { UserSession, SessionStats } from "../interface/session.model";
import { DashboardLayout } from "../shared/dashboard-layout/dashboard-layout";

export interface UserData {
  id?: number;
  username: string;
  email: string;
  roles?: { id?: number; name: string }[];
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

@Component({
  selector: "app-user",
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardLayout],
  templateUrl: "./user.html",
  styleUrl: "./user.scss",
})
export class User implements OnInit {
  userList: UserData[] = [];
  sessionsList: UserSession[] = [];
  filteredSessions: UserSession[] = [];
  sessionStats: SessionStats | null = null;

  isLoading = false;
  isSessionsLoading = false;
  errorMessage = "";
  sessionErrorMessage = "";
  actionSuccessMessage = "";

  selectedUser: UserData | null = null;
  selectedUserSessions: UserSession[] = [];
  activeTab: "list" | "sessions" | "profile" = "list";

  sessionSearchTerm = "";
  selectedDeviceFilter = "All";
  selectedStatusFilter = "All";
  revokingSessionId: number | null = null;
  selectedSystemSession: UserSession | null = null;

  constructor(
    private commonHttp: CommonHttp,
    private sessionService: SessionService,
    private userService: UserService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.router.url.includes("/sessions")) {
      this.activeTab = "sessions";
    }

    this.route.queryParams.subscribe((params) => {
      if (params["tab"] === "sessions") {
        this.activeTab = "sessions";
      }
    });

    this.fetchUserData();
    this.fetchSessionsData();
  }

  fetchUserData(): void {
    this.isLoading = true;
    this.errorMessage = "";
    this.cdr.markForCheck();

    this.commonHttp.getAll(null, `/v1/all`).subscribe({
      next: (data) => {
        this.userList = data || [];
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to fetch users:", err);
        this.errorMessage = "Failed to load users. Please try again.";
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  fetchSessionsData(): void {
    this.isSessionsLoading = true;
    this.sessionErrorMessage = "";
    this.cdr.markForCheck();

    this.sessionService.getAllSessions().subscribe({
      next: (sessions) => {
        this.sessionsList = sessions || [];
        this.applySessionFilter();
        this.isSessionsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to fetch sessions:", err);
        this.sessionErrorMessage = "Failed to load active sessions.";
        this.isSessionsLoading = false;
        this.cdr.markForCheck();
      },
    });

    this.sessionService.getSessionStats().subscribe({
      next: (stats) => {
        this.sessionStats = stats;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to fetch session stats:", err);
      },
    });
  }

  applySessionFilter(): void {
    let result = [...this.sessionsList];

    if (this.selectedDeviceFilter !== "All") {
      result = result.filter((s) => s.deviceType === this.selectedDeviceFilter);
    }

    if (this.selectedStatusFilter === "Active") {
      result = result.filter((s) => s.active);
    } else if (this.selectedStatusFilter === "Expiring") {
      const oneDayAhead = Date.now() + 24 * 60 * 60 * 1000;
      result = result.filter((s) => new Date(s.expiryDate).getTime() < oneDayAhead);
    }

    if (this.sessionSearchTerm.trim()) {
      const term = this.sessionSearchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          (s.username && s.username.toLowerCase().includes(term)) ||
          (s.email && s.email.toLowerCase().includes(term)) ||
          (s.ipAddress && s.ipAddress.toLowerCase().includes(term)) ||
          (s.browser && s.browser.toLowerCase().includes(term)) ||
          (s.operatingSystem && s.operatingSystem.toLowerCase().includes(term)) ||
          (s.deviceName && s.deviceName.toLowerCase().includes(term)) ||
          (s.deviceId && s.deviceId.toLowerCase().includes(term)) ||
          (s.networkType && s.networkType.toLowerCase().includes(term)) ||
          (s.timezone && s.timezone.toLowerCase().includes(term)) ||
          (s.locale && s.locale.toLowerCase().includes(term)) ||
          (s.screenResolution && s.screenResolution.toLowerCase().includes(term)) ||
          (s.clientSystemInfo && s.clientSystemInfo.toLowerCase().includes(term))
      );
    }

    this.filteredSessions = result;
  }

  selectUser(user: UserData): void {
    this.selectedUser = user;
    this.activeTab = "profile";
    if (user.id) {
      this.selectedUserSessions = this.sessionsList.filter((s) => s.userId === user.id);
    } else {
      this.selectedUserSessions = [];
    }
  }

  viewUserSessions(user: UserData, event?: Event): void {
    if (event) event.stopPropagation();
    this.sessionSearchTerm = user.username;
    this.switchTab("sessions");
  }

  switchTab(tab: "list" | "sessions" | "profile"): void {
    this.activeTab = tab;
    if (tab === "sessions") {
      this.fetchSessionsData();
    }
  }

  isCurrentSession(session: UserSession): boolean {
    if (session.currentSession) {
      return true;
    }
    const currentDeviceId = this.userService?.getDeviceId ? this.userService.getDeviceId() : null;
    if (session.deviceId && currentDeviceId && session.deviceId === currentDeviceId) {
      return true;
    }
    const currentRefreshToken = sessionStorage.getItem("refresh_token");
    if (currentRefreshToken && session.token) {
      const cleanToken = session.token.replace(/\./g, "").trim();
      if (cleanToken && currentRefreshToken.startsWith(cleanToken.substring(0, 8))) {
        return true;
      }
    }
    return false;
  }

  isSameIpAndBrowser(session: UserSession): boolean {
    if (!session.ipAddress || !session.browser) return false;
    return this.sessionsList.some(
      (s) => s.id !== session.id && s.ipAddress === session.ipAddress && s.browser === session.browser
    );
  }

  getSameIpBrowserCount(session: UserSession): number {
    if (!session.ipAddress || !session.browser) return 1;
    return this.sessionsList.filter(
      (s) => s.ipAddress === session.ipAddress && s.browser === session.browser
    ).length;
  }

  getDeviceDisplayLabel(session: UserSession): string {
    if (session.deviceName && session.deviceName.trim()) {
      return session.deviceName.trim();
    }
    return `${session.browser} on ${session.operatingSystem}`;
  }

  getDeviceShortId(session: UserSession): string {
    if (!session.deviceId) return "";
    const id = session.deviceId.replace(/^dev_/, "");
    return id.length > 8 ? id.substring(0, 8) + "..." : id;
  }

  isCurrentUser(userId?: number): boolean {
    if (!userId) return false;
    const currentUserId = sessionStorage.getItem("user_id");
    return currentUserId ? Number(currentUserId) === userId : false;
  }

  revokeSession(session: UserSession): void {
    if (!confirm(`Are you sure you want to terminate session #${session.id} for user ${session.username}?`)) {
      return;
    }

    this.revokingSessionId = session.id;
    this.sessionService.revokeSession(session.id).subscribe({
      next: () => {
        if (this.isCurrentSession(session)) {
          this.userService.clearSession();
          this.router.navigate(["/"], {
            queryParams: { sessionTerminated: "true" },
          });
          return;
        }

        this.actionSuccessMessage = `Session #${session.id} (${session.username} on ${session.browser}) terminated successfully.`;
        this.sessionsList = this.sessionsList.filter((s) => s.id !== session.id);
        if (this.selectedUser) {
          this.selectedUserSessions = this.selectedUserSessions.filter((s) => s.id !== session.id);
        }
        this.applySessionFilter();
        this.revokingSessionId = null;
        this.clearSuccessNoticeAfterDelay();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to revoke session:", err);
        alert("Failed to terminate session. Please try again.");
        this.revokingSessionId = null;
        this.cdr.markForCheck();
      },
    });
  }

  revokeAllSessionsForUser(userId?: number): void {
    if (!userId) return;
    const targetUser = this.userList.find((u) => u.id === userId) || this.selectedUser;
    const name = targetUser ? targetUser.username : `User #${userId}`;

    if (!confirm(`Terminate all active sessions for ${name}? The user will be logged out on all devices.`)) {
      return;
    }

    this.sessionService.revokeAllUserSessions(userId).subscribe({
      next: (resp) => {
        if (this.isCurrentUser(userId)) {
          this.userService.clearSession();
          this.router.navigate(["/"], {
            queryParams: { sessionTerminated: "true" },
          });
          return;
        }

        this.actionSuccessMessage = `All sessions (${resp.revokedCount}) terminated for ${name}.`;
        this.sessionsList = this.sessionsList.filter((s) => s.userId !== userId);
        this.selectedUserSessions = [];
        this.applySessionFilter();
        this.clearSuccessNoticeAfterDelay();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to revoke all user sessions:", err);
        alert("Failed to terminate all user sessions.");
        this.cdr.markForCheck();
      },
    });
  }

  revokeOtherSessions(userId?: number): void {
    const targetUserId = userId || (sessionStorage.getItem("user_id") ? Number(sessionStorage.getItem("user_id")) : undefined);
    if (!targetUserId) {
      alert("Unable to identify target user for revoking other sessions.");
      return;
    }

    if (!confirm("Are you sure you want to sign out all other devices? This device will remain logged in.")) {
      return;
    }

    this.sessionService.revokeAllOtherSessions(targetUserId).subscribe({
      next: (resp) => {
        this.actionSuccessMessage = `Successfully signed out ${resp.revokedCount} other device session(s).`;
        this.fetchSessionsData();
        this.clearSuccessNoticeAfterDelay();
      },
      error: (err) => {
        console.error("Failed to revoke other sessions:", err);
        alert("Failed to terminate other sessions.");
      },
    });
  }

  editDeviceName(session: UserSession): void {
    const currentName = session.deviceName || this.getDeviceDisplayLabel(session);
    const newName = prompt("Enter a custom name for this device:", currentName);
    if (newName === null || newName.trim() === "" || newName.trim() === currentName) {
      return;
    }

    this.sessionService.updateDeviceName(session.id, newName.trim()).subscribe({
      next: () => {
        session.deviceName = newName.trim();
        if (this.isCurrentSession(session)) {
          this.userService.setDeviceName(newName.trim());
        }
        this.actionSuccessMessage = `Device renamed to "${newName.trim()}".`;
        this.clearSuccessNoticeAfterDelay();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to rename device:", err);
        alert("Failed to rename device. Please try again.");
      },
    });
  }

  getUserSessionCount(userId?: number): number {
    if (!userId) return 0;
    return this.sessionsList.filter((s) => s.userId === userId).length;
  }

  getDeviceIcon(deviceType?: string): string {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return "📱";
      case "tablet":
        return "📟";
      default:
        return "💻";
    }
  }

  getBrowserIcon(browser?: string): string {
    const b = (browser || "").toLowerCase();
    if (b.includes("chrome")) return "🌐";
    if (b.includes("safari")) return "🧭";
    if (b.includes("firefox")) return "🦊";
    if (b.includes("edge")) return "🌊";
    return "🌐";
  }

  getOSIcon(os?: string): string {
    const o = (os || "").toLowerCase();
    if (o.includes("mac") || o.includes("ios")) return "🍎";
    if (o.includes("win")) return "🪟";
    if (o.includes("android")) return "🤖";
    if (o.includes("linux")) return "🐧";
    return "🖥️";
  }

  getNetworkIcon(networkType?: string): string {
    const net = (networkType || "").toLowerCase();
    if (net.includes("localhost") || net.includes("loopback")) return "🏠";
    if (net.includes("lan") || net.includes("private")) return "🏢";
    if (net.includes("wifi")) return "📶";
    if (net.includes("4g") || net.includes("5g") || net.includes("cellular")) return "📱";
    if (net.includes("ethernet")) return "🔌";
    return "🌐";
  }

  openSystemDetailsModal(session: UserSession): void {
    this.selectedSystemSession = session;
  }

  closeSystemDetailsModal(): void {
    this.selectedSystemSession = null;
  }

  private clearSuccessNoticeAfterDelay(): void {
    setTimeout(() => {
      this.actionSuccessMessage = "";
      this.cdr.markForCheck();
    }, 4000);
  }

  retry(): void {
    this.fetchUserData();
    this.fetchSessionsData();
  }
}
