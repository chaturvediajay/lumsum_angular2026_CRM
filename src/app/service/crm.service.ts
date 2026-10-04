import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '@environments/environment';
import {
  Lead,
  Customer,
  Deal,
  Activity,
  CrmStats,
  DealStage,
  LeadStatus,
} from '../interface/crm.model';

const STORAGE_KEY_PREFIX = 'crm_data_';

@Injectable({
  providedIn: 'root',
})
export class CrmService {
  private apiUrl = (environment as any).crmApiUrl || environment.apiUrl;

  private leadsSubject = new BehaviorSubject<Lead[]>([]);
  private customersSubject = new BehaviorSubject<Customer[]>([]);
  private dealsSubject = new BehaviorSubject<Deal[]>([]);
  private activitiesSubject = new BehaviorSubject<Activity[]>([]);

  public leads$: Observable<Lead[]> = this.leadsSubject.asObservable();
  public customers$: Observable<Customer[]> = this.customersSubject.asObservable();
  public deals$: Observable<Deal[]> = this.dealsSubject.asObservable();
  public activities$: Observable<Activity[]> = this.activitiesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeData();
    this.syncWithBackend();
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });
    const token = sessionStorage.getItem('access_token');
    if (token && token.trim() !== '' && token !== 'null') {
      headers = headers.set('Authorization', `Bearer ${token.trim()}`);
    }
    return headers;
  }

  // ==================== INITIALIZATION & LOCAL SEEDING ====================
  private initializeData(): void {
    const savedLeads = localStorage.getItem(STORAGE_KEY_PREFIX + 'leads');
    const savedCustomers = localStorage.getItem(STORAGE_KEY_PREFIX + 'customers');
    const savedDeals = localStorage.getItem(STORAGE_KEY_PREFIX + 'deals');
    const savedActivities = localStorage.getItem(STORAGE_KEY_PREFIX + 'activities');

    if (savedLeads && savedCustomers && savedDeals && savedActivities) {
      try {
        this.leadsSubject.next(JSON.parse(savedLeads));
        this.customersSubject.next(JSON.parse(savedCustomers));
        this.dealsSubject.next(JSON.parse(savedDeals));
        this.activitiesSubject.next(JSON.parse(savedActivities));
        return;
      } catch (e) {
        console.warn('Failed to parse CRM local cache, resetting demo data', e);
      }
    }

    this.resetToLocalDemoData();
  }

  /**
   * Syncs initial state with backend REST API if available
   */
  public syncWithBackend(): void {
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    const headers = this.getAuthHeaders();

    this.http
      .get<Lead[]>(`${crmBase}/leads`, { headers })
      .pipe(
        catchError(() => of(null)),
        tap((backendLeads) => {
          if (backendLeads && backendLeads.length > 0) {
            this.leadsSubject.next(backendLeads);
            this.saveLocal('leads', backendLeads);
          }
        })
      )
      .subscribe();

    this.http
      .get<Deal[]>(`${crmBase}/deals`, { headers })
      .pipe(
        catchError(() => of(null)),
        tap((backendDeals) => {
          if (backendDeals && backendDeals.length > 0) {
            this.dealsSubject.next(backendDeals);
            this.saveLocal('deals', backendDeals);
          }
        })
      )
      .subscribe();

    this.http
      .get<Customer[]>(`${crmBase}/customers`, { headers })
      .pipe(
        catchError(() => of(null)),
        tap((backendCusts) => {
          if (backendCusts && backendCusts.length > 0) {
            this.customersSubject.next(backendCusts);
            this.saveLocal('customers', backendCusts);
          }
        })
      )
      .subscribe();

    this.http
      .get<Activity[]>(`${crmBase}/activities`, { headers })
      .pipe(
        catchError(() => of(null)),
        tap((backendActs) => {
          if (backendActs && backendActs.length > 0) {
            this.activitiesSubject.next(backendActs);
            this.saveLocal('activities', backendActs);
          }
        })
      )
      .subscribe();
  }

  private saveLocal(key: string, data: any): void {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
  }

  private saveAllLocal(): void {
    this.saveLocal('leads', this.leadsSubject.value);
    this.saveLocal('customers', this.customersSubject.value);
    this.saveLocal('deals', this.dealsSubject.value);
    this.saveLocal('activities', this.activitiesSubject.value);
  }

  public resetToLocalDemoData(): void {
    const initialCustomers: Customer[] = [
      {
        id: 'cust-1',
        companyName: 'Apex Cloud Solutions',
        contactName: 'Elena Rostova',
        email: 'elena@apexcloud.io',
        phone: '+1 (555) 234-5678',
        industry: 'Technology',
        status: 'Active',
        totalSpent: 84500,
        dealsCount: 3,
        city: 'San Francisco, CA',
        country: 'USA',
        lastContactDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        createdAt: '2025-11-12T10:00:00Z',
      },
      {
        id: 'cust-2',
        companyName: 'Nordic Logistics Group',
        contactName: 'Lukas Lindholm',
        email: 'lukas@nordiclogistics.se',
        phone: '+46 8 123 4567',
        industry: 'Logistics & Supply Chain',
        status: 'Active',
        totalSpent: 120000,
        dealsCount: 4,
        city: 'Stockholm',
        country: 'Sweden',
        lastContactDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        createdAt: '2025-09-18T14:30:00Z',
      },
      {
        id: 'cust-3',
        companyName: 'Meridian Health Systems',
        contactName: 'Dr. Sarah Patel',
        email: 'spatel@meridian-health.org',
        phone: '+1 (555) 890-1234',
        industry: 'Healthcare',
        status: 'Active',
        totalSpent: 45000,
        dealsCount: 2,
        city: 'Boston, MA',
        country: 'USA',
        lastContactDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        createdAt: '2026-01-05T09:15:00Z',
      },
      {
        id: 'cust-4',
        companyName: 'Vanguard Retailers',
        contactName: 'Marcus Bennett',
        email: 'm.bennett@vanguardretail.com',
        phone: '+44 20 7946 0912',
        industry: 'Retail & E-commerce',
        status: 'Inactive',
        totalSpent: 18500,
        dealsCount: 1,
        city: 'London',
        country: 'UK',
        lastContactDate: new Date(Date.now() - 25 * 86400000).toISOString(),
        createdAt: '2025-08-20T11:00:00Z',
      },
    ];

    const initialLeads: Lead[] = [
      {
        id: 'lead-1',
        name: 'Jordan Vance',
        company: 'HyperScale AI',
        title: 'VP of Infrastructure',
        email: 'jordan@hyperscale.ai',
        phone: '+1 (555) 345-9876',
        status: 'In Discussion',
        score: 88,
        source: 'LinkedIn',
        estimatedValue: 65000,
        assignedTo: 'Admin User',
        notes: 'Interested in enterprise cloud optimization suite. Budget approved for Q3.',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 'lead-2',
        name: 'Sophia Chang',
        company: 'FinTech Velocity',
        title: 'Chief Technology Officer',
        email: 'schang@fintechvelocity.com',
        phone: '+1 (555) 678-1234',
        status: 'Qualified',
        score: 95,
        source: 'Referral',
        estimatedValue: 120000,
        assignedTo: 'Admin User',
        notes: 'Demo completed. Proposal requested by end of week.',
        createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
      },
      {
        id: 'lead-3',
        name: 'Mateo Rossi',
        company: 'Solaris Energy',
        title: 'Operations Director',
        email: 'mrossi@solarisenergy.eu',
        phone: '+39 02 555 1234',
        status: 'Contacted',
        score: 62,
        source: 'Website',
        estimatedValue: 35000,
        assignedTo: 'Admin User',
        notes: 'Requested product whitepaper and security architecture overview.',
        createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      },
      {
        id: 'lead-4',
        name: 'Amira Al-Mansoor',
        company: 'Oasis Smart Logistics',
        title: 'Head of Procurement',
        email: 'amira@oasislogistics.ae',
        phone: '+971 4 321 9876',
        status: 'New',
        score: 75,
        source: 'Event',
        estimatedValue: 80000,
        assignedTo: 'Admin User',
        notes: 'Met at Dubai Tech Expo. Follow up call scheduled next Tuesday.',
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'lead-5',
        name: 'David Miller',
        company: 'Beacon Analytics',
        title: 'Managing Director',
        email: 'dmiller@beaconanalytics.com',
        phone: '+1 (555) 432-8765',
        status: 'Lost',
        score: 30,
        source: 'Cold Call',
        estimatedValue: 22000,
        assignedTo: 'Admin User',
        notes: 'Chose competitor due to existing ERP legacy integration.',
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      },
    ];

    const initialDeals: Deal[] = [
      {
        id: 'deal-1',
        title: 'Enterprise Cloud Migration Contract',
        customerId: 'cust-1',
        customerName: 'Elena Rostova',
        companyName: 'Apex Cloud Solutions',
        amount: 85000,
        stage: 'Proposal',
        probability: 70,
        expectedCloseDate: '2026-10-15',
        priority: 'High',
        notes: 'Final RFP submitted with cybersecurity addendum.',
        assignedTo: 'Admin User',
        createdAt: '2026-02-01T10:00:00Z',
      },
      {
        id: 'deal-2',
        title: 'Fleet Tracking & Telematics License',
        customerId: 'cust-2',
        customerName: 'Lukas Lindholm',
        companyName: 'Nordic Logistics Group',
        amount: 64000,
        stage: 'Negotiation',
        probability: 85,
        expectedCloseDate: '2026-09-30',
        priority: 'High',
        notes: 'Finalizing payment terms and SLA agreement.',
        assignedTo: 'Admin User',
        createdAt: '2026-01-15T12:00:00Z',
      },
      {
        id: 'deal-3',
        title: 'Patient Portal UI/UX Modernization',
        customerId: 'cust-3',
        customerName: 'Dr. Sarah Patel',
        companyName: 'Meridian Health Systems',
        amount: 42000,
        stage: 'Qualification',
        probability: 40,
        expectedCloseDate: '2026-11-20',
        priority: 'Medium',
        notes: 'HIPAA compliance audit in review before contract issuance.',
        assignedTo: 'Admin User',
        createdAt: '2026-02-10T15:00:00Z',
      },
      {
        id: 'deal-4',
        title: 'Multi-Region Data Sync Module',
        customerId: 'cust-1',
        customerName: 'Elena Rostova',
        companyName: 'Apex Cloud Solutions',
        amount: 38000,
        stage: 'Closed Won',
        probability: 100,
        expectedCloseDate: '2026-02-18',
        priority: 'Medium',
        notes: 'Won and kicked off engineering onboarding.',
        assignedTo: 'Admin User',
        createdAt: '2025-12-05T09:00:00Z',
      },
      {
        id: 'deal-5',
        title: 'Global Supply Route Analytics Suite',
        customerId: 'cust-2',
        customerName: 'Lukas Lindholm',
        companyName: 'Nordic Logistics Group',
        amount: 95000,
        stage: 'Closed Won',
        probability: 100,
        expectedCloseDate: '2026-01-30',
        priority: 'High',
        notes: 'Signed 2-year annual recurring contract.',
        assignedTo: 'Admin User',
        createdAt: '2025-10-10T11:00:00Z',
      },
      {
        id: 'deal-6',
        title: 'AI Automated Customer Support Desk',
        customerId: 'cust-4',
        customerName: 'Marcus Bennett',
        companyName: 'Vanguard Retailers',
        amount: 28000,
        stage: 'Prospecting',
        probability: 25,
        expectedCloseDate: '2026-12-10',
        priority: 'Low',
        notes: 'Initial discovery questionnaire sent.',
        assignedTo: 'Admin User',
        createdAt: '2026-02-20T08:30:00Z',
      },
    ];

    const initialActivities: Activity[] = [
      {
        id: 'act-1',
        type: 'Call',
        title: 'Follow-up on Cloud Migration RFP terms',
        relatedType: 'Deal',
        relatedId: 'deal-1',
        relatedName: 'Apex Cloud Solutions',
        dueDate: new Date().toISOString(),
        completed: false,
        priority: 'High',
        assignee: 'Admin User',
        notes: 'Check if CIO signed off on data protection terms.',
        createdAt: '2026-02-18T10:00:00Z',
      },
      {
        id: 'act-2',
        type: 'Meeting',
        title: 'Product Demonstration for FinTech Velocity',
        relatedType: 'Lead',
        relatedId: 'lead-2',
        relatedName: 'Sophia Chang (FinTech Velocity)',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        completed: false,
        priority: 'High',
        assignee: 'Admin User',
        notes: 'Prepare slide deck focusing on latency benchmarks.',
        createdAt: '2026-02-19T14:00:00Z',
      },
      {
        id: 'act-3',
        type: 'Email',
        title: 'Send contract revision to Lukas',
        relatedType: 'Customer',
        relatedId: 'cust-2',
        relatedName: 'Nordic Logistics Group',
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
        completed: false,
        priority: 'Medium',
        assignee: 'Admin User',
        notes: 'Attach updated appendix with 24/7 uptime guarantee.',
        createdAt: '2026-02-19T16:00:00Z',
      },
      {
        id: 'act-4',
        type: 'Task',
        title: 'Conduct weekly pipeline review',
        relatedType: 'Deal',
        relatedId: 'deal-2',
        relatedName: 'Pipeline Health',
        dueDate: new Date(Date.now() - 86400000).toISOString(),
        completed: true,
        priority: 'Medium',
        assignee: 'Admin User',
        notes: 'All stage metrics updated.',
        createdAt: '2026-02-15T09:00:00Z',
      },
    ];

    this.leadsSubject.next(initialLeads);
    this.customersSubject.next(initialCustomers);
    this.dealsSubject.next(initialDeals);
    this.activitiesSubject.next(initialActivities);

    this.saveAllLocal();
  }

  // ==================== LEADS MANAGEMENT ====================
  public addLead(leadData: Omit<Lead, 'id' | 'createdAt'>): Lead {
    const tempLead: Lead = {
      ...leadData,
      id: 'lead-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [tempLead, ...this.leadsSubject.value];
    this.leadsSubject.next(updated);
    this.saveAllLocal();

    // Call backend API
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    this.http
      .post<Lead>(`${crmBase}/leads`, leadData, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() => of(null)),
        tap((saved) => {
          if (saved) {
            const list = this.leadsSubject.value.map((l) => (l.id === tempLead.id ? saved : l));
            this.leadsSubject.next(list);
            this.saveAllLocal();
          }
        })
      )
      .subscribe();

    return tempLead;
  }

  public updateLead(updatedLead: Lead): void {
    const updated = this.leadsSubject.value.map((lead) =>
      lead.id === updatedLead.id ? updatedLead : lead
    );
    this.leadsSubject.next(updated);
    this.saveAllLocal();

    if (typeof updatedLead.id === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .put(`${crmBase}/leads/${updatedLead.id}`, updatedLead, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  public deleteLead(leadId: string | number): void {
    const updated = this.leadsSubject.value.filter((l) => l.id !== leadId);
    this.leadsSubject.next(updated);
    this.saveAllLocal();

    if (typeof leadId === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .delete(`${crmBase}/leads/${leadId}`, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  public convertLeadToCustomerAndDeal(leadId: string | number): { customer: Customer; deal: Deal } | null {
    const lead = this.leadsSubject.value.find((l) => l.id === leadId);
    if (!lead) return null;

    // Local conversion
    const newCustomer: Customer = {
      id: 'cust-' + Date.now(),
      companyName: lead.company,
      contactName: lead.name,
      email: lead.email,
      phone: lead.phone,
      industry: 'Enterprise',
      status: 'Active',
      totalSpent: 0,
      dealsCount: 1,
      lastContactDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const updatedCustomers = [newCustomer, ...this.customersSubject.value];
    this.customersSubject.next(updatedCustomers);

    const newDeal: Deal = {
      id: 'deal-' + Date.now(),
      title: `${lead.company} - Expansion Deal`,
      customerId: newCustomer.id,
      customerName: newCustomer.contactName,
      companyName: newCustomer.companyName,
      amount: lead.estimatedValue || 50000,
      stage: 'Qualification',
      probability: 40,
      expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      priority: 'High',
      assignedTo: lead.assignedTo || 'Admin User',
      notes: `Converted from lead "${lead.name}". Notes: ${lead.notes || ''}`,
      createdAt: new Date().toISOString(),
    };
    const updatedDeals = [newDeal, ...this.dealsSubject.value];
    this.dealsSubject.next(updatedDeals);

    const updatedLeads = this.leadsSubject.value.map((l) =>
      l.id === leadId ? { ...l, status: 'Qualified' as LeadStatus } : l
    );
    this.leadsSubject.next(updatedLeads);

    this.addActivity({
      type: 'Task',
      title: `Converted lead ${lead.name} (${lead.company}) to Customer`,
      relatedType: 'Customer',
      relatedId: newCustomer.id,
      relatedName: newCustomer.companyName,
      dueDate: new Date().toISOString(),
      completed: true,
      priority: 'High',
      assignee: 'Admin User',
      notes: `Generated Deal: ${newDeal.title} ($${newDeal.amount.toLocaleString()})`,
    });

    this.saveAllLocal();

    // Call backend API if numeric ID
    if (typeof leadId === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .post<{ customer: Customer; deal: Deal }>(`${crmBase}/leads/${leadId}/convert`, {}, { headers: this.getAuthHeaders() })
        .pipe(
          catchError(() => of(null)),
          tap((backendResult) => {
            if (backendResult) {
              this.syncWithBackend();
            }
          })
        )
        .subscribe();
    }

    return { customer: newCustomer, deal: newDeal };
  }

  // ==================== DEALS & PIPELINE ====================
  public addDeal(dealData: Omit<Deal, 'id' | 'createdAt'>): Deal {
    const tempDeal: Deal = {
      ...dealData,
      id: 'deal-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [tempDeal, ...this.dealsSubject.value];
    this.dealsSubject.next(updated);
    this.saveAllLocal();

    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    this.http
      .post<Deal>(`${crmBase}/deals`, dealData, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() => of(null)),
        tap((saved) => {
          if (saved) {
            const list = this.dealsSubject.value.map((d) => (d.id === tempDeal.id ? saved : d));
            this.dealsSubject.next(list);
            this.saveAllLocal();
          }
        })
      )
      .subscribe();

    return tempDeal;
  }

  public updateDeal(updatedDeal: Deal): void {
    const updated = this.dealsSubject.value.map((deal) =>
      deal.id === updatedDeal.id ? { ...updatedDeal, updatedAt: new Date().toISOString() } : deal
    );
    this.dealsSubject.next(updated);
    this.saveAllLocal();

    if (typeof updatedDeal.id === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .put(`${crmBase}/deals/${updatedDeal.id}`, updatedDeal, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  public updateDealStage(dealId: string | number, newStage: DealStage): void {
    const updated = this.dealsSubject.value.map((deal) => {
      if (deal.id === dealId) {
        let probability = deal.probability;
        if (newStage === 'Prospecting') probability = 20;
        else if (newStage === 'Qualification') probability = 40;
        else if (newStage === 'Proposal') probability = 65;
        else if (newStage === 'Negotiation') probability = 85;
        else if (newStage === 'Closed Won') probability = 100;
        else if (newStage === 'Closed Lost') probability = 0;

        return {
          ...deal,
          stage: newStage,
          probability,
          updatedAt: new Date().toISOString(),
        };
      }
      return deal;
    });

    this.dealsSubject.next(updated);
    this.saveAllLocal();

    if (typeof dealId === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .patch(`${crmBase}/deals/${dealId}/stage`, { stage: newStage }, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  public deleteDeal(dealId: string | number): void {
    const updated = this.dealsSubject.value.filter((d) => d.id !== dealId);
    this.dealsSubject.next(updated);
    this.saveAllLocal();

    if (typeof dealId === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .delete(`${crmBase}/deals/${dealId}`, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  // ==================== CUSTOMERS ====================
  public addCustomer(customerData: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const tempCust: Customer = {
      ...customerData,
      id: 'cust-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [tempCust, ...this.customersSubject.value];
    this.customersSubject.next(updated);
    this.saveAllLocal();

    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    this.http
      .post<Customer>(`${crmBase}/customers`, customerData, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() => of(null)),
        tap((saved) => {
          if (saved) {
            const list = this.customersSubject.value.map((c) => (c.id === tempCust.id ? saved : c));
            this.customersSubject.next(list);
            this.saveAllLocal();
          }
        })
      )
      .subscribe();

    return tempCust;
  }

  public updateCustomer(updatedCustomer: Customer): void {
    const updated = this.customersSubject.value.map((c) =>
      c.id === updatedCustomer.id ? updatedCustomer : c
    );
    this.customersSubject.next(updated);
    this.saveAllLocal();

    if (typeof updatedCustomer.id === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .put(`${crmBase}/customers/${updatedCustomer.id}`, updatedCustomer, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  public deleteCustomer(customerId: string | number): void {
    const updated = this.customersSubject.value.filter((c) => c.id !== customerId);
    this.customersSubject.next(updated);
    this.saveAllLocal();

    if (typeof customerId === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .delete(`${crmBase}/customers/${customerId}`, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  // ==================== ACTIVITIES ====================
  public addActivity(activityData: Omit<Activity, 'id' | 'createdAt'>): Activity {
    const tempAct: Activity = {
      ...activityData,
      id: 'act-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [tempAct, ...this.activitiesSubject.value];
    this.activitiesSubject.next(updated);
    this.saveAllLocal();

    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    this.http
      .post<Activity>(`${crmBase}/activities`, activityData, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() => of(null)),
        tap((saved) => {
          if (saved) {
            const list = this.activitiesSubject.value.map((a) => (a.id === tempAct.id ? saved : a));
            this.activitiesSubject.next(list);
            this.saveAllLocal();
          }
        })
      )
      .subscribe();

    return tempAct;
  }

  public toggleActivity(id: string | number): void {
    const updated = this.activitiesSubject.value.map((act) =>
      act.id === id ? { ...act, completed: !act.completed } : act
    );
    this.activitiesSubject.next(updated);
    this.saveAllLocal();

    if (typeof id === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .patch(`${crmBase}/activities/${id}/toggle`, {}, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  public deleteActivity(id: string | number): void {
    const updated = this.activitiesSubject.value.filter((act) => act.id !== id);
    this.activitiesSubject.next(updated);
    this.saveAllLocal();

    if (typeof id === 'number') {
      const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
      this.http
        .delete(`${crmBase}/activities/${id}`, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
  }

  // ==================== AGGREGATED METRICS ====================
  public getStats(): Observable<CrmStats> {
    return this.deals$.pipe(
      map((deals) => {
        const leads = this.leadsSubject.value;
        const customers = this.customersSubject.value;

        const stages: DealStage[] = [
          'Prospecting',
          'Qualification',
          'Proposal',
          'Negotiation',
          'Closed Won',
          'Closed Lost',
        ];

        const activeDeals = deals.filter(
          (d) => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost'
        );
        const wonDeals = deals.filter((d) => d.stage === 'Closed Won');
        const closedDeals = deals.filter(
          (d) => d.stage === 'Closed Won' || d.stage === 'Closed Lost'
        );

        const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
        const wonRevenue = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
        const winRate =
          closedDeals.length > 0
            ? Math.round((wonDeals.length / closedDeals.length) * 100)
            : 0;

        const qualifiedLeads = leads.filter((l) => l.status === 'Qualified').length;
        const leadConversionRate =
          leads.length > 0 ? Math.round((qualifiedLeads / leads.length) * 100) : 0;

        const stageDistribution = stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          return {
            stage,
            count: stageDeals.length,
            value: stageDeals.reduce((s, d) => s + (d.amount || 0), 0),
          };
        });

        const sourcesMap = new Map<string, number>();
        leads.forEach((l) => {
          const count = sourcesMap.get(l.source) || 0;
          sourcesMap.set(l.source, count + 1);
        });

        const leadsBySource = Array.from(sourcesMap.entries()).map(([source, count]) => ({
          source: source as any,
          count,
        }));

        return {
          totalPipelineValue,
          activeDealsCount: activeDeals.length,
          wonRevenue,
          wonDealsCount: wonDeals.length,
          winRate,
          totalLeadsCount: leads.length,
          qualifiedLeadsCount: qualifiedLeads,
          leadConversionRate,
          totalCustomersCount: customers.length,
          stageDistribution,
          leadsBySource,
        };
      })
    );
  }

  public resetToDemoData(): void {
    this.resetToLocalDemoData();

    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    this.http
      .post(`${crmBase}/reset-demo`, {}, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() => of(null)),
        tap(() => this.syncWithBackend())
      )
      .subscribe();
  }

  // ==================== USER WORKLOAD & TOKEN INTEGRATION ====================
  public getMyLeads(): Observable<Lead[]> {
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    return this.http.get<Lead[]>(`${crmBase}/leads/my`, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => {
        const username = (sessionStorage.getItem('username') || '').toLowerCase();
        return of(
          this.leadsSubject.value.filter(
            (l) => !username || (l.assignedTo && l.assignedTo.toLowerCase() === username)
          )
        );
      })
    );
  }

  public getMyDeals(): Observable<Deal[]> {
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    return this.http.get<Deal[]>(`${crmBase}/deals/my`, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => {
        const username = (sessionStorage.getItem('username') || '').toLowerCase();
        return of(
          this.dealsSubject.value.filter(
            (d) => !username || (d.assignedTo && d.assignedTo.toLowerCase() === username)
          )
        );
      })
    );
  }

  public getMyActivities(): Observable<Activity[]> {
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    return this.http.get<Activity[]>(`${crmBase}/activities/my`, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => {
        const username = (sessionStorage.getItem('username') || '').toLowerCase();
        return of(
          this.activitiesSubject.value.filter(
            (a) => !username || (a.assignee && a.assignee.toLowerCase() === username)
          )
        );
      })
    );
  }

  public getUserCrmProfile(): Observable<any> {
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    return this.http.get<any>(`${crmBase}/me`, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => {
        const username = sessionStorage.getItem('username') || 'Admin User';
        return of({
          username,
          authSource: 'lumsum_2026',
          tokenValidated: true,
          assignedDealsCount: this.dealsSubject.value.length,
          assignedLeadsCount: this.leadsSubject.value.length,
          assignedActivitiesCount: this.activitiesSubject.value.length,
        });
      })
    );
  }

  public checkTokenStatus(): Observable<any> {
    const crmBase = `${this.apiUrl.replace(/\/+$/, '')}/v1/crm`;
    return this.http.get<any>(`${crmBase}/token-status`, { headers: this.getAuthHeaders() }).pipe(
      catchError(() => of({ valid: !!sessionStorage.getItem('access_token'), source: 'lumsum_2026' }))
    );
  }
}
