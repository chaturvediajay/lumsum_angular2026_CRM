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
import { Lead, LeadSource, LeadStatus } from '../../interface/crm.model';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DashboardLayout],
  templateUrl: './leads.html',
  styleUrl: './leads.scss',
})
export class Leads implements OnInit {
  leads: Lead[] = [];
  filteredLeads: Lead[] = [];

  // Filter & Search state
  searchTerm = '';
  selectedStatus: LeadStatus | 'All' = 'All';
  selectedSource: LeadSource | 'All' = 'All';
  sortBy: 'score' | 'value' | 'date' = 'score';

  // Modal & Form state
  showModal = false;
  isEditing = false;
  editingLeadId: string | number | null = null;
  leadForm: FormGroup;

  // Conversion Toast / Success Message
  conversionMessage: string | null = null;

  // Detail Modal / Drawer
  selectedLead: Lead | null = null;

  statusOptions: LeadStatus[] = ['New', 'Contacted', 'In Discussion', 'Qualified', 'Lost'];
  sourceOptions: LeadSource[] = ['Website', 'Referral', 'LinkedIn', 'Campaign', 'Cold Call', 'Event'];

  constructor(
    private crmService: CrmService,
    private fb: FormBuilder
  ) {
    this.leadForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      company: ['', Validators.required],
      title: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      status: ['New', Validators.required],
      score: [70, [Validators.required, Validators.min(0), Validators.max(100)]],
      source: ['Website', Validators.required],
      estimatedValue: [25000, [Validators.required, Validators.min(0)]],
      assignedTo: ['Admin User'],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.crmService.leads$.subscribe((leads) => {
      this.leads = leads;
      this.applyFilter();
    });
  }

  applyFilter(): void {
    let result = [...this.leads];

    // Status Filter
    if (this.selectedStatus !== 'All') {
      result = result.filter((l) => l.status === this.selectedStatus);
    }

    // Source Filter
    if (this.selectedSource !== 'All') {
      result = result.filter((l) => l.source === this.selectedSource);
    }

    // Search Term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          l.company.toLowerCase().includes(term) ||
          l.email.toLowerCase().includes(term) ||
          l.title.toLowerCase().includes(term)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (this.sortBy === 'score') return b.score - a.score;
      if (this.sortBy === 'value') return b.estimatedValue - a.estimatedValue;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    this.filteredLeads = result;
  }

  getTotalPipelinePotential(): number {
    return this.filteredLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  }

  getQualifiedCount(): number {
    return this.filteredLeads.filter((l) => l.status === 'Qualified').length;
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  setStatusFilter(status: LeadStatus | 'All'): void {
    this.selectedStatus = status;
    this.applyFilter();
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingLeadId = null;
    this.leadForm.reset({
      name: '',
      company: '',
      title: '',
      email: '',
      phone: '',
      status: 'New',
      score: 70,
      source: 'Website',
      estimatedValue: 25000,
      assignedTo: 'Admin User',
      notes: '',
    });
    this.showModal = true;
  }

  openEditModal(lead: Lead, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    this.editingLeadId = lead.id;
    this.leadForm.patchValue({
      name: lead.name,
      company: lead.company,
      title: lead.title,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      score: lead.score,
      source: lead.source,
      estimatedValue: lead.estimatedValue,
      assignedTo: lead.assignedTo,
      notes: lead.notes || '',
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingLeadId = null;
  }

  saveLead(): void {
    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }

    const formVal = this.leadForm.value;

    if (this.isEditing && this.editingLeadId) {
      const existing = this.leads.find((l) => l.id === this.editingLeadId);
      if (existing) {
        this.crmService.updateLead({
          ...existing,
          ...formVal,
        });
      }
    } else {
      this.crmService.addLead(formVal);
    }

    this.closeModal();
  }

  deleteLead(id: string | number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (confirm('Are you sure you want to delete this lead?')) {
      this.crmService.deleteLead(id);
      if (this.selectedLead?.id === id) {
        this.selectedLead = null;
      }
    }
  }

  convertLead(lead: Lead, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const result = this.crmService.convertLeadToCustomerAndDeal(lead.id);
    if (result) {
      this.conversionMessage = `🎉 Successfully converted "${lead.name}" (${lead.company}) into a Customer and generated a Pipeline Deal ($${result.deal.amount.toLocaleString()})!`;
      setTimeout(() => {
        this.conversionMessage = null;
      }, 6000);
    }
  }

  selectLead(lead: Lead): void {
    this.selectedLead = lead;
  }

  closeDrawer(): void {
    this.selectedLead = null;
  }

  getStatusBadgeClass(status: LeadStatus): string {
    switch (status) {
      case 'New':
        return 'badge-new';
      case 'Contacted':
        return 'badge-contacted';
      case 'In Discussion':
        return 'badge-discussion';
      case 'Qualified':
        return 'badge-qualified';
      case 'Lost':
        return 'badge-lost';
      default:
        return 'badge-secondary';
    }
  }

  getScoreColorClass(score: number): string {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
}
