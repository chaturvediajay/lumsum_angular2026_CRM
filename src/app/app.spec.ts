import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { App } from './app';
import { UserService } from './service/user-service';

describe('App', () => {
  let mockUserService: any;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    mockUserService = {
      isTokenValid: vi.fn(),
      clearSession: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserService, useValue: mockUserService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should not clear session on click if user is on login page without token', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    vi.spyOn(router, 'url', 'get').mockReturnValue('/');

    const result = app.validateSessionOnClick();

    expect(result).toBe(true);
    expect(mockUserService.isTokenValid).not.toHaveBeenCalled();
    expect(mockUserService.clearSession).not.toHaveBeenCalled();
  });

  it('should allow click and not navigate when token is valid on protected page', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    sessionStorage.setItem('access_token', 'valid-token');
    vi.spyOn(router, 'url', 'get').mockReturnValue('/home');
    mockUserService.isTokenValid.mockReturnValue(true);

    const navigateSpy = vi.spyOn(router, 'navigate');
    const result = app.validateSessionOnClick();

    expect(result).toBe(true);
    expect(mockUserService.isTokenValid).toHaveBeenCalled();
    expect(mockUserService.clearSession).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should clear session and redirect to login when click occurs with expired/invalid token', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    sessionStorage.setItem('access_token', 'expired-token');
    vi.spyOn(router, 'url', 'get').mockReturnValue('/home');
    mockUserService.isTokenValid.mockReturnValue(false);

    const navigateSpy = vi.spyOn(router, 'navigate');
    const result = app.validateSessionOnClick();

    expect(result).toBe(false);
    expect(mockUserService.isTokenValid).toHaveBeenCalled();
    expect(mockUserService.clearSession).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: { sessionExpired: 'true' },
    });
  });

  it('should clear session and redirect to login when click occurs with missing token on protected page', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    vi.spyOn(router, 'url', 'get').mockReturnValue('/deals');

    const navigateSpy = vi.spyOn(router, 'navigate');
    const result = app.validateSessionOnClick();

    expect(result).toBe(false);
    expect(mockUserService.clearSession).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: { sessionExpired: 'true' },
    });
  });

  it('should trigger validateSessionOnClick when onDocumentClick is called', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const validateSpy = vi.spyOn(app, 'validateSessionOnClick');

    app.onDocumentClick();
    expect(validateSpy).toHaveBeenCalled();
  });
});
