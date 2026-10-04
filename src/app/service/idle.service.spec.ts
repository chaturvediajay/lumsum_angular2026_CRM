import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IdleService } from './idle.service';
import { UserService } from './user-service';
import { Router } from '@angular/router';

describe('IdleService', () => {
  let service: IdleService;
  let userServiceMock: any;
  let routerMock: any;

  beforeEach(() => {
    sessionStorage.clear();
    userServiceMock = {
      clearSession: vi.fn(),
      isTokenValid: vi.fn().mockReturnValue(true),
    };

    routerMock = {
      navigate: vi.fn(),
      url: '/home',
      events: {
        pipe: vi.fn().mockReturnValue({
          subscribe: vi.fn(),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        IdleService,
        { provide: UserService, useValue: userServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });

    service = TestBed.inject(IdleService);
  });

  afterEach(() => {
    service.stop();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.isWarningVisible()).toBe(false);
  });

  it('isUserLoggedIn should return true when token is present and not on login page', () => {
    sessionStorage.setItem('access_token', 'valid-token');
    routerMock.url = '/dashboard';
    expect(service.isUserLoggedIn()).toBe(true);
  });

  it('isUserLoggedIn should return false when on login page', () => {
    sessionStorage.setItem('access_token', 'valid-token');
    routerMock.url = '/';
    expect(service.isUserLoggedIn()).toBe(false);

    routerMock.url = '/?sessionExpired=true';
    expect(service.isUserLoggedIn()).toBe(false);
  });

  it('isUserLoggedIn should return false when no token exists', () => {
    routerMock.url = '/dashboard';
    expect(service.isUserLoggedIn()).toBe(false);
  });

  it('logoutDueToIdle should clear session and navigate to login with idleTimeout=true', () => {
    service.logoutDueToIdle();

    expect(userServiceMock.clearSession).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { idleTimeout: 'true' },
    });
    expect(service.isWarningVisible()).toBe(false);
  });

  it('stayLoggedIn should reset timer and hide warning dialog', () => {
    service.isWarningVisible.set(true);
    service.stayLoggedIn();

    expect(service.isWarningVisible()).toBe(false);
    expect(service.remainingSeconds()).toBe(60);
  });

  it('resetTimer should reset remaining seconds to 60 and hide warning', () => {
    service.isWarningVisible.set(true);
    service.resetTimer();

    expect(service.isWarningVisible()).toBe(false);
    expect(service.remainingSeconds()).toBe(60);
  });

  it('should show warning dialog and then trigger auto logout after idle timeout', () => {
    vi.useFakeTimers();
    sessionStorage.setItem('access_token', 'active-token');
    routerMock.url = '/home';

    // Configure short timeouts for testing: 3 seconds total idle, 1 second warning
    service.configure(3000, 1000);
    service.start();

    // Advance 1 second: elapsed 1000ms < 2000ms threshold -> no warning
    vi.advanceTimersByTime(1000);
    expect(service.isWarningVisible()).toBe(false);

    // Advance another 1.1 second: elapsed 2100ms >= 2000ms -> warning visible!
    vi.advanceTimersByTime(1100);
    expect(service.isWarningVisible()).toBe(true);
    expect(service.remainingSeconds()).toBeLessThanOrEqual(1);

    // Advance 1 more second: elapsed > 3000ms -> auto logout!
    vi.advanceTimersByTime(1000);
    expect(userServiceMock.clearSession).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { idleTimeout: 'true' },
    });

    service.stop();
  });

  it('should reset idle countdown when user activity occurs during warning window', () => {
    vi.useFakeTimers();
    sessionStorage.setItem('access_token', 'active-token');
    routerMock.url = '/home';

    // Configure: 3s total, 1s warning
    service.configure(3000, 1000);
    service.start();

    // Reach warning window (2.1s)
    vi.advanceTimersByTime(2100);
    expect(service.isWarningVisible()).toBe(true);

    // Simulate user interaction
    service.stayLoggedIn();
    expect(service.isWarningVisible()).toBe(false);

    // Advance 1.5s from reset -> still under 2s warning threshold
    vi.advanceTimersByTime(1500);
    expect(service.isWarningVisible()).toBe(false);
    expect(userServiceMock.clearSession).not.toHaveBeenCalled();

    service.stop();
  });
});
