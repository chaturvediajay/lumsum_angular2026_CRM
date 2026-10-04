import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardLayout } from '../../shared/dashboard-layout/dashboard-layout';
import { CrmService } from '../../service/crm.service';
import { CrmStats } from '../../interface/crm.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, DashboardLayout],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  stats: CrmStats | null = null;

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.crmService.getStats().subscribe((stats) => {
      this.stats = stats;
    });
  }

  resetDemo(): void {
    if (confirm('Reset CRM sample data back to factory demo state?')) {
      this.crmService.resetToDemoData();
    }
  }
}
