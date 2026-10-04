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
import { Deal, DealStage, Customer, PriorityLevel } from '../../interface/crm.model';

@Component({
  selector: 'app-deals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DashboardLayout],
  templateUrl: './deals.html',
  styleUrl: './deals.scss',
})
export class Deals implements OnInit {
  deals: Deal[] = [];
  customers: Customer[] = [];

  stages: DealStage[] = [
    'Prospecting',
    'Qualification',
    'Proposal',
    'Negotiation',
    'Closed Won',
    'Closed Lost',
  ];

  searchTerm = '';
  selectedPriority: PriorityLevel | 'All' = 'All';

  // Modal State
  showModal = false;
  isEditing = false;
  editingDealId: string | number | null = null;
  dealForm: FormGroup;

  constructor(
    private crmService: CrmService,
    private fb: FormBuilder
  ) {
    this.dealForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      customerId: [''],
      companyName: ['', Validators.required],
      customerName: ['', Validators.required],
      amount: [50000, [Validators.required, Validators.min(0)]],
      stage: ['Prospecting' as DealStage, Validators.required],
      probability: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
      expectedCloseDate: [new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], Validators.required],
      priority: ['Medium' as PriorityLevel, Validators.required],
      assignedTo: ['Admin User'],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.crmService.deals$.subscribe((deals) => {
      this.deals = deals;
    });

    this.crmService.customers$.subscribe((customers) => {
      this.customers = customers;
    });
  }

  getDealsByStage(stage: DealStage): Deal[] {
    let list = this.deals.filter((d) => d.stage === stage);

    if (this.selectedPriority !== 'All') {
      list = list.filter((d) => d.priority === this.selectedPriority);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(term) ||
          d.companyName.toLowerCase().includes(term) ||
          d.customerName.toLowerCase().includes(term)
      );
    }

    return list;
  }

  getStageTotalValue(stage: DealStage): number {
    return this.deals
      .filter((d) => d.stage === stage)
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  getTotalPipelineValue(): number {
    return this.deals
      .filter((d) => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  getWonRevenue(): number {
    return this.deals
      .filter((d) => d.stage === 'Closed Won')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  moveDeal(deal: Deal, targetStage: DealStage, event?: Event): void {
    if (event) event.stopPropagation();
    this.crmService.updateDealStage(deal.id, targetStage);
  }

  moveToNextStage(deal: Deal, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const currentIndex = this.stages.indexOf(deal.stage);
    if (currentIndex < this.stages.length - 2) {
      // Don't auto advance into closed lost
      this.crmService.updateDealStage(deal.id, this.stages[currentIndex + 1]);
    } else if (currentIndex === this.stages.indexOf('Negotiation')) {
      this.crmService.updateDealStage(deal.id, 'Closed Won');
    }
  }

  moveToPrevStage(deal: Deal, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const currentIndex = this.stages.indexOf(deal.stage);
    if (currentIndex > 0) {
      this.crmService.updateDealStage(deal.id, this.stages[currentIndex - 1]);
    }
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingDealId = null;
    this.dealForm.reset({
      title: '',
      customerId: this.customers.length ? this.customers[0].id : '',
      companyName: this.customers.length ? this.customers[0].companyName : '',
      customerName: this.customers.length ? this.customers[0].contactName : '',
      amount: 45000,
      stage: 'Prospecting',
      probability: 20,
      expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      priority: 'Medium',
      assignedTo: 'Admin User',
      notes: '',
    });
    this.showModal = true;
  }

  onCustomerSelect(event: Event): void {
    const custId = (event.target as HTMLSelectElement).value;
    const cust = this.customers.find((c) => String(c.id) === String(custId));
    if (cust) {
      this.dealForm.patchValue({
        companyName: cust.companyName,
        customerName: cust.contactName,
      });
    }
  }

  openEditModal(deal: Deal, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    this.editingDealId = deal.id;
    this.dealForm.patchValue({
      title: deal.title,
      customerId: deal.customerId,
      companyName: deal.companyName,
      customerName: deal.customerName,
      amount: deal.amount,
      stage: deal.stage,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      priority: deal.priority,
      assignedTo: deal.assignedTo,
      notes: deal.notes || '',
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingDealId = null;
  }

  saveDeal(): void {
    if (this.dealForm.invalid) {
      this.dealForm.markAllAsTouched();
      return;
    }

    const formVal = this.dealForm.value;

    if (this.isEditing && this.editingDealId) {
      const existing = this.deals.find((d) => d.id === this.editingDealId);
      if (existing) {
        this.crmService.updateDeal({
          ...existing,
          ...formVal,
        });
      }
    } else {
      this.crmService.addDeal(formVal);
    }

    this.closeModal();
  }

  deleteDeal(id: string | number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (confirm('Are you sure you want to delete this deal?')) {
      this.crmService.deleteDeal(id);
    }
  }

  getPriorityBadgeClass(priority: PriorityLevel): string {
    switch (priority) {
      case 'High':
        return 'priority-high';
      case 'Medium':
        return 'priority-medium';
      case 'Low':
        return 'priority-low';
    }
  }

  getStageBadgeClass(stage: DealStage): string {
    switch (stage) {
      case 'Prospecting':
        return 'stage-prospecting';
      case 'Qualification':
        return 'stage-qualification';
      case 'Proposal':
        return 'stage-proposal';
      case 'Negotiation':
        return 'stage-negotiation';
      case 'Closed Won':
        return 'stage-won';
      case 'Closed Lost':
        return 'stage-lost';
    }
  }
}
