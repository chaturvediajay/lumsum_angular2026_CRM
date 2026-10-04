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
import { Customer, CustomerStatus, Deal } from '../../interface/crm.model';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DashboardLayout],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers implements OnInit {
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  deals: Deal[] = [];

  searchTerm = '';
  selectedStatus: CustomerStatus | 'All' = 'All';
  selectedIndustry: string = 'All';

  selectedCustomer: Customer | null = null;
  customerDeals: Deal[] = [];

  showModal = false;
  isEditing = false;
  editingCustomerId: string | number | null = null;
  customerForm: FormGroup;

  industries: string[] = [
    'Technology',
    'Logistics & Supply Chain',
    'Healthcare',
    'Retail & E-commerce',
    'Financial Services',
    'Manufacturing',
    'Energy',
  ];

  constructor(
    private crmService: CrmService,
    private fb: FormBuilder
  ) {
    this.customerForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      contactName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      industry: ['Technology', Validators.required],
      status: ['Active' as CustomerStatus, Validators.required],
      totalSpent: [0, [Validators.min(0)]],
      dealsCount: [0, [Validators.min(0)]],
      city: [''],
      country: [''],
      address: [''],
    });
  }

  ngOnInit(): void {
    this.crmService.customers$.subscribe((customers) => {
      this.customers = customers;
      this.applyFilter();
    });

    this.crmService.deals$.subscribe((deals) => {
      this.deals = deals;
      if (this.selectedCustomer) {
        this.loadCustomerDeals(this.selectedCustomer.id);
      }
    });
  }

  applyFilter(): void {
    let result = [...this.customers];

    if (this.selectedStatus !== 'All') {
      result = result.filter((c) => c.status === this.selectedStatus);
    }

    if (this.selectedIndustry !== 'All') {
      result = result.filter((c) => c.industry === this.selectedIndustry);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.companyName.toLowerCase().includes(term) ||
          c.contactName.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.industry.toLowerCase().includes(term)
      );
    }

    this.filteredCustomers = result;
  }

  getTotalClientValue(): number {
    return this.customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  }

  selectCustomer(cust: Customer): void {
    this.selectedCustomer = cust;
    this.loadCustomerDeals(cust.id);
  }

  loadCustomerDeals(customerId: string | number): void {
    this.customerDeals = this.deals.filter(
      (d) => String(d.customerId) === String(customerId) || d.companyName.toLowerCase() === this.selectedCustomer?.companyName.toLowerCase()
    );
  }

  closeDrawer(): void {
    this.selectedCustomer = null;
    this.customerDeals = [];
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.editingCustomerId = null;
    this.customerForm.reset({
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      industry: 'Technology',
      status: 'Active',
      totalSpent: 0,
      dealsCount: 0,
      city: '',
      country: '',
      address: '',
    });
    this.showModal = true;
  }

  openEditModal(cust: Customer, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    this.editingCustomerId = cust.id;
    this.customerForm.patchValue({
      companyName: cust.companyName,
      contactName: cust.contactName,
      email: cust.email,
      phone: cust.phone,
      industry: cust.industry,
      status: cust.status,
      totalSpent: cust.totalSpent,
      dealsCount: cust.dealsCount,
      city: cust.city || '',
      country: cust.country || '',
      address: cust.address || '',
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCustomerId = null;
  }

  saveCustomer(): void {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    const val = this.customerForm.value;

    if (this.isEditing && this.editingCustomerId) {
      const existing = this.customers.find((c) => c.id === this.editingCustomerId);
      if (existing) {
        this.crmService.updateCustomer({
          ...existing,
          ...val,
        });
      }
    } else {
      this.crmService.addCustomer({
        ...val,
        lastContactDate: new Date().toISOString(),
      });
    }

    this.closeModal();
  }

  deleteCustomer(id: string | number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (confirm('Are you sure you want to delete this customer account?')) {
      this.crmService.deleteCustomer(id);
      if (this.selectedCustomer?.id === id) {
        this.closeDrawer();
      }
    }
  }

  getStatusBadgeClass(status: CustomerStatus): string {
    switch (status) {
      case 'Active':
        return 'badge-active';
      case 'Inactive':
        return 'badge-inactive';
      case 'Churned':
        return 'badge-churned';
    }
  }
}
