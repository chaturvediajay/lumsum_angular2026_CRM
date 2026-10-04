import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CrmService } from './crm.service';
import { firstValueFrom } from 'rxjs';

describe('CrmService', () => {
  let service: CrmService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CrmService);
    httpTestingController = TestBed.inject(HttpTestingController);

    // Flush initial synchronization requests from constructor
    const initialReqs = httpTestingController.match(() => true);
    initialReqs.forEach((r) => r.flush([]));
  });

  afterEach(() => {
    const pendingReqs = httpTestingController.match(() => true);
    pendingReqs.forEach((r) => r.flush([]));
    localStorage.clear();
    sessionStorage.clear();
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

  it('should retrieve user assigned leads via getMyLeads()', async () => {
    const leadsPromise = firstValueFrom(service.getMyLeads());

    const req = httpTestingController.expectOne((r) => r.url.includes('/leads/my'));
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 101, name: 'Lead A', assignedTo: 'admin' }] as any);

    const leads = await leadsPromise;
    expect(Array.isArray(leads)).toBe(true);
    expect(leads.length).toBe(1);
    expect(leads[0].name).toBe('Lead A');
  });

  it('should retrieve user assigned deals via getMyDeals()', async () => {
    const dealsPromise = firstValueFrom(service.getMyDeals());

    const req = httpTestingController.expectOne((r) => r.url.includes('/deals/my'));
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 201, title: 'Cloud Migration Deal', assignedTo: 'admin' }] as any);

    const deals = await dealsPromise;
    expect(Array.isArray(deals)).toBe(true);
    expect(deals.length).toBe(1);
    expect(deals[0].title).toBe('Cloud Migration Deal');
  });

  it('should retrieve user assigned activities via getMyActivities()', async () => {
    const activitiesPromise = firstValueFrom(service.getMyActivities());

    const req = httpTestingController.expectOne((r) => r.url.includes('/activities/my'));
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 301, title: 'Follow up call', assignee: 'admin' }] as any);

    const activities = await activitiesPromise;
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBe(1);
    expect(activities[0].title).toBe('Follow up call');
  });

  it('should return user CRM profile metrics via getUserCrmProfile()', async () => {
    const mockProfile = {
      username: 'admin',
      authSource: 'lumsum_2026',
      tokenValidated: true,
      assignedDealsCount: 3,
      assignedLeadsCount: 5,
    };

    const profilePromise = firstValueFrom(service.getUserCrmProfile());

    const req = httpTestingController.expectOne((r) => r.url.includes('/crm/me'));
    expect(req.request.method).toBe('GET');
    req.flush(mockProfile);

    const profile = await profilePromise;
    expect(profile).toBeDefined();
    expect(profile.username).toBe('admin');
    expect(profile.assignedDealsCount).toBe(3);
  });

  it('should report token status via checkTokenStatus()', async () => {
    const mockStatus = {
      valid: true,
      username: 'admin',
      roles: ['ROLE_ADMIN'],
      remainingTimeMs: 3600000,
    };

    const statusPromise = firstValueFrom(service.checkTokenStatus());

    const req = httpTestingController.expectOne((r) => r.url.includes('/token-status'));
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);

    const status = await statusPromise;
    expect(status).toBeDefined();
    expect(status.valid).toBe(true);
    expect(status.username).toBe('admin');
  });
});
