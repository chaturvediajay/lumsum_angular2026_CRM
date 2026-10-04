import { Component, HostListener, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter } from "rxjs";
import { CommonHttp } from "../../service/common-http";
import { UserService } from "../../service/user-service";

interface NavItem {
  label: string;
  icon: string;
  route: string;
  section: string;
  badge?: string | number;
  badgeVariant?: "primary" | "success" | "warning" | "info";
}

interface NotificationItem {
  id: string;
  title: string;
  time: string;
  read: boolean;
  type: "deal" | "lead" | "task";
}

@Component({
  selector: "app-dashboard-layout",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./dashboard-layout.html",
  styleUrl: "./dashboard-layout.scss",
})
export class DashboardLayout implements OnInit {
  sidebarCollapsed = false;
  mobileDrawerOpen = false;
  userDropdownOpen = false;
  notificationsOpen = false;
  searchQuery = "";

  userName = "Admin User";
  userRole = "Super Admin";
  currentDate = "";
  currentRouteTitle = "Dashboard";
  currentRouteSection = "CRM Core";

  navItems: NavItem[] = [
    {
      label: "Dashboard",
      icon: "📊",
      route: "/home",
      section: "CRM Core",
    },
    {
      label: "Leads",
      icon: "🎯",
      route: "/leads",
      section: "CRM Core",
    },
    {
      label: "Deals Pipeline",
      icon: "📈",
      route: "/deals",
      section: "CRM Core",
    },
    {
      label: "Customers",
      icon: "🏢",
      route: "/customers",
      section: "CRM Core",
    },
    {
      label: "Activities",
      icon: "📅",
      route: "/activities",
      section: "CRM Core",
    },
    {
      label: "Reports",
      icon: "📈",
      route: "/reports",
      section: "Analytics",
    },
    {
      label: "AI Assistant",
      icon: "🤖",
      route: "/ai-assistant",
      section: "AI & Intelligence",
      badge: "Voice",
      badgeVariant: "info",
    },
    {
      label: "Users",
      icon: "👥",
      route: "/users",
      section: "Administration",
    },
    {
      label: "Sessions",
      icon: "🛡️",
      route: "/sessions",
      section: "Administration",
    },
  ];

  notifications: NotificationItem[] = [
    {
      id: "n1",
      title: "New enterprise lead registered: Stellar Dynamics",
      time: "10m ago",
      read: false,
      type: "lead",
    },
    {
      id: "n2",
      title: "Deal '$64,000 Acme Cloud' progressed to Negotiation",
      time: "45m ago",
      read: false,
      type: "deal",
    },
    {
      id: "n3",
      title: "Product demo scheduled with TechCorp today at 4:00 PM",
      time: "2h ago",
      read: true,
      type: "task",
    },
  ];

  constructor(
    private router: Router,
    private commonHttp: CommonHttp,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    if (sessionStorage.getItem("access_token") === null) {
      this.router.navigate(["/"]);
      return;
    }

    const savedUsername = sessionStorage.getItem("username");
    if (savedUsername) {
      this.userName = savedUsername;
    }

    // Restore desktop sidebar collapse preference
    const savedCollapse = localStorage.getItem("crm_sidebar_collapsed");
    if (savedCollapse !== null && window.innerWidth > 992) {
      this.sidebarCollapsed = savedCollapse === "true";
    }

    this.updateDate();
    this.updateRouteMetadata(this.router.url);

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateRouteMetadata(event.urlAfterRedirects || event.url);
        this.closeMobileDrawer();
        this.closeDropdowns();
      });
  }

  get unreadNotificationCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 992) {
      this.mobileDrawerOpen = !this.mobileDrawerOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem("crm_sidebar_collapsed", String(this.sidebarCollapsed));
    }
  }

  openMobileDrawer(): void {
    this.mobileDrawerOpen = true;
  }

  closeMobileDrawer(): void {
    this.mobileDrawerOpen = false;
  }

  toggleUserDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.userDropdownOpen = !this.userDropdownOpen;
    if (this.userDropdownOpen) {
      this.notificationsOpen = false;
    }
  }

  toggleNotifications(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.userDropdownOpen = false;
    }
  }

  markNotificationsRead(): void {
    this.notifications.forEach((n) => (n.read = true));
  }

  closeDropdowns(): void {
    this.userDropdownOpen = false;
    this.notificationsOpen = false;
  }

  @HostListener("document:click")
  onDocumentClick(): void {
    this.closeDropdowns();
    this.checkTokenOnClick();
  }

  checkTokenOnClick(explicit = false): boolean {
    if (!this.userService.isTokenValid()) {
      console.warn("Click detected invalid or expired JWT token. Cleaning session and redirecting to login.");
      this.userService.clearSession();
      this.router.navigate(["/"], {
        queryParams: { sessionExpired: "true" },
      });
      return false;
    }
    if (explicit) {
      alert("JWT access token is valid and active.");
    }
    return true;
  }

  @HostListener("window:resize")
  onResize(): void {
    if (window.innerWidth > 992 && this.mobileDrawerOpen) {
      this.mobileDrawerOpen = false;
    }
  }

  updateDate(): void {
    const today = new Date();
    this.currentDate = today.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  updateRouteMetadata(url: string): void {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const match = this.navItems.find((item) => cleanUrl.startsWith(item.route));

    if (match) {
      this.currentRouteTitle = match.label;
      this.currentRouteSection = match.section;
    } else if (cleanUrl.includes("users")) {
      this.currentRouteTitle = "User Directory";
      this.currentRouteSection = "Administration";
    } else {
      this.currentRouteTitle = "CRM Dashboard";
      this.currentRouteSection = "CRM Core";
    }
  }

  getNavSections(): string[] {
    return [...new Set(this.navItems.map((item) => item.section))];
  }

  getNavItemsBySection(section: string): NavItem[] {
    return this.navItems.filter((item) => item.section === section);
  }

  logout(): void {
    this.commonHttp.logout().subscribe({
      next: () => {
        this.userService.clearSession();
        this.router.navigate(["/"]);
      },
      error: () => {
        this.userService.clearSession();
        this.router.navigate(["/"]);
      },
    });
  }
}
