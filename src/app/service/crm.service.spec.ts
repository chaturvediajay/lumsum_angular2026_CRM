import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CrmService } from './crm.service';
import { firstValueFrom } from 'rxjs';

describe('CrmService', () => {
  let service: CrmService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CrmService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created and initialized with demo records', async () => {
    expect(service).toBeTruthy();
    const leads = await firstValueFrom(service.leads$);
    const deals = await firstValueFrom(service.deals$);
    const customers = await firstValueFrom(service.customers$);
    const activities = await firstValueFrom(service.activities$);

    expect(leads.length).toBeGreaterThan(0);
    expect(deals.length).toBeGreaterThan(0);
    expect(customers.length).toBeGreaterThan(0);
    expect(activities.length).toBeGreaterThan(0);
  });

  it('should add a new lead and update leads$', async () => {
    service.addLead({
      name: 'Test Prospect',
      company: 'Test Corp',
      title: 'VP Sales',
      email: 'test@testcorp.com',
      phone: '+1 555 1111',
      status: 'New',
      score: 80,
      source: 'Website',
      estimatedValue: 50000,
      assignedTo: 'Admin User',
    });

    const leads = await firstValueFrom(service.leads$);
    const found = leads.find((l) => l.name === 'Test Prospect');
    expect(found).toBeDefined();
    expect(found?.company).toBe('Test Corp');
  });

  it('should convert a lead into a customer and an active deal', async () => {
    const leads = await firstValueFrom(service.leads$);
    const targetLead = leads[0];

    const result = service.convertLeadToCustomerAndDeal(targetLead.id);
    expect(result).not.toBeNull();
    expect(result?.customer.companyName).toBe(targetLead.company);
    expect(result?.deal.amount).toBe(targetLead.estimatedValue);

    const customers = await firstValueFrom(service.customers$);
    const deals = await firstValueFrom(service.deals$);
    expect(customers.some((c) => c.companyName === targetLead.company)).toBe(true);
    expect(deals.some((d) => d.title.includes(targetLead.company))).toBe(true);
  });

  it('should advance deal stage and adjust probability', async () => {
    const deals = await firstValueFrom(service.deals$);
    const deal = deals[0];

    service.updateDealStage(deal.id, 'Closed Won');
    const updatedDeals = await firstValueFrom(service.deals$);
    const updated = updatedDeals.find((d) => d.id === deal.id);
    expect(updated?.stage).toBe('Closed Won');
    expect(updated?.probability).toBe(100);
  });

  it('should toggle activity completion', async () => {
    const activities = await firstValueFrom(service.activities$);
    const activity = activities[0];
    const initialStatus = activity.completed;

    service.toggleActivity(activity.id);
    const updatedActivities = await firstValueFrom(service.activities$);
    const updated = updatedActivities.find((a) => a.id === activity.id);
    expect(updated?.completed).toBe(!initialStatus);
  });

  it('should compute aggregated CRM telemetry stats', async () => {
    const stats = await firstValueFrom(service.getStats());
    expect(stats.totalPipelineValue).toBeGreaterThan(0);
    expect(stats.stageDistribution.length).toBe(6);
    expect(stats.leadsBySource.length).toBeGreaterThan(0);
  });
});
