import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { DashboardLayout } from "../shared/dashboard-layout/dashboard-layout";
import { CrmService } from "../service/crm.service";
import { Activity, CrmStats, Deal } from "../interface/crm.model";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardLayout],
  templateUrl: "./home.html",
  styleUrl: "./home.scss",
})
export class Home implements OnInit {
  crmStats: CrmStats | null = null;
  priorityTasks: Activity[] = [];
  recentDeals: Deal[] = [];
  userName = "Admin";
  userRoles: string[] = [];
  userProfile: any = null;
  tokenStatus: any = null;

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    const savedName = sessionStorage.getItem("username");
    if (savedName) {
      this.userName = savedName;
    }

    const savedRoles = sessionStorage.getItem("roles");
    if (savedRoles) {
      try {
        this.userRoles = JSON.parse(savedRoles);
      } catch {
        this.userRoles = [savedRoles];
      }
    }

    this.crmService.getStats().subscribe((stats) => {
      this.crmStats = stats;
    });

    this.crmService.getUserCrmProfile().subscribe((profile) => {
      this.userProfile = profile;
    });

    this.crmService.checkTokenStatus().subscribe((status) => {
      this.tokenStatus = status;
    });

    this.crmService.activities$.subscribe((acts) => {
      this.priorityTasks = acts.filter((a) => !a.completed).slice(0, 5);
    });

    this.crmService.deals$.subscribe((deals) => {
      this.recentDeals = deals.slice(0, 5);
    });
  }

  toggleTask(id: string | number): void {
    this.crmService.toggleActivity(id);
  }

  getStageBadgeClass(stage: string): string {
    switch (stage) {
      case "Prospecting":
        return "stage-prospecting";
      case "Qualification":
        return "stage-qualification";
      case "Proposal":
        return "stage-proposal";
      case "Negotiation":
        return "stage-negotiation";
      case "Closed Won":
        return "stage-won";
      case "Closed Lost":
        return "stage-lost";
      default:
        return "";
    }
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case "Call":
        return "📞";
      case "Meeting":
        return "🤝";
      case "Email":
        return "✉️";
      case "Task":
        return "📋";
      default:
        return "📝";
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case "High":
        return "priority-high";
      case "Medium":
        return "priority-medium";
      case "Low":
        return "priority-low";
      default:
        return "";
    }
  }
}
