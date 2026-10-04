import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { DashboardLayout } from '../../shared/dashboard-layout/dashboard-layout';
import { CrmService } from '../../service/crm.service';
import { Activity, ActivityType, PriorityLevel } from '../../interface/crm.model';

@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DashboardLayout],
  templateUrl: './activities.html',
  styleUrl: './activities.scss',
})
export class Activities implements OnInit {
  activities: Activity[] = [];
  filteredActivities: Activity[] = [];

  selectedType: ActivityType | 'All' = 'All';
  showCompleted = true;

  showModal = false;
  activityForm: FormGroup;

  types: ActivityType[] = ['Call', 'Meeting', 'Email', 'Task', 'Note'];

  constructor(
    private crmService: CrmService,
    private fb: FormBuilder
  ) {
    this.activityForm = this.fb.group({
      type: ['Call' as ActivityType, Validators.required],
      title: ['', [Validators.required, Validators.minLength(3)]],
      relatedType: ['Lead', Validators.required],
      relatedName: ['', Validators.required],
      dueDate: [new Date().toISOString().split('T')[0], Validators.required],
      priority: ['Medium' as PriorityLevel, Validators.required],
      assignee: ['Admin User'],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.crmService.activities$.subscribe((acts) => {
      this.activities = acts;
      this.applyFilter();
    });
  }

  applyFilter(): void {
    let list = [...this.activities];

    if (this.selectedType !== 'All') {
      list = list.filter((a) => a.type === this.selectedType);
    }

    if (!this.showCompleted) {
      list = list.filter((a) => !a.completed);
    }

    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    this.filteredActivities = list;
  }

  getTodayActivities(): Activity[] {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.filteredActivities.filter(
      (a) => a.dueDate.startsWith(todayStr) && !a.completed
    );
  }

  getUpcomingActivities(): Activity[] {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.filteredActivities.filter(
      (a) => a.dueDate > todayStr && !a.completed
    );
  }

  getOverdueActivities(): Activity[] {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.filteredActivities.filter(
      (a) => a.dueDate < todayStr && !a.completed
    );
  }

  getCompletedActivities(): Activity[] {
    return this.filteredActivities.filter((a) => a.completed);
  }

  toggleActivity(id: string | number): void {
    this.crmService.toggleActivity(id);
  }

  deleteActivity(id: string | number): void {
    if (confirm('Delete this activity?')) {
      this.crmService.deleteActivity(id);
    }
  }

  openCreateModal(): void {
    this.activityForm.reset({
      type: 'Call',
      title: '',
      relatedType: 'Deal',
      relatedName: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      assignee: 'Admin User',
      notes: '',
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveActivity(): void {
    if (this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }

    const val = this.activityForm.value;
    this.crmService.addActivity({
      ...val,
      relatedId: 'manual',
      completed: false,
    });

    this.closeModal();
  }

  getActivityIcon(type: ActivityType): string {
    switch (type) {
      case 'Call':
        return '📞';
      case 'Meeting':
        return '📅';
      case 'Email':
        return '✉️';
      case 'Task':
        return '✅';
      case 'Note':
        return '📝';
    }
  }
}
