import { TestBed } from '@angular/core/testing';
import { AuthInterceptor } from './auth-interceptor';
import { UserService } from '../service/user-service';
import { Router } from '@angular/router';
import { HttpRequest, HttpHandler, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let userServiceMock: any;
  let routerMock: any;

  beforeEach(() => {
    sessionStorage.clear();
    userServiceMock = {
      clearSession: vi.fn(),
      refreshToken: vi.fn(),
      getDeviceId: vi.fn().mockReturnValue('dev_mock_id'),
      getDeviceName: vi.fn().mockReturnValue('Mock Device'),
      getClientPublicIp: vi.fn().mockReturnValue('unknown'),
      getClientPrivateIp: vi.fn().mockReturnValue('unknown'),
    };
    routerMock = {
      navigate: vi.fn(),
      url: '/home',
    };

    TestBed.configureTestingModule({
      providers: [
        AuthInterceptor,
        { provide: UserService, useValue: userServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
    interceptor = TestBed.inject(AuthInterceptor);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  it('should attach Bearer token to request when access_token is in sessionStorage', () => {
    sessionStorage.setItem('access_token', 'test-token-123');
    const req = new HttpRequest('GET', '/api/v1/crm/customers');
    const next: HttpHandler = {
      handle: vi.fn((modifiedReq: HttpRequest<any>) => {
        expect(modifiedReq.headers.get('Authorization')).toBe('Bearer test-token-123');
        return of(new HttpResponse({ status: 200 }));
      }),
    };

    interceptor.intercept(req, next).subscribe();
    expect(next.handle).toHaveBeenCalled();
  });

  it('should not attach Bearer token when no token exists', () => {
    const req = new HttpRequest('GET', '/api/v1/crm/customers');
    const next: HttpHandler = {
      handle: vi.fn((modifiedReq: HttpRequest<any>) => {
        expect(modifiedReq.headers.has('Authorization')).toBe(false);
        return of(new HttpResponse({ status: 200 }));
      }),
    };

    interceptor.intercept(req, next).subscribe();
    expect(next.handle).toHaveBeenCalled();
  });

  it('should handle 401 when no refresh_token exists by clearing session and redirecting', () => {
    const req = new HttpRequest('GET', '/api/v1/crm/customers');
    const error401 = new HttpErrorResponse({ status: 401, url: '/api/v1/crm/customers' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => error401)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
        expect(userServiceMock.clearSession).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
          queryParams: { sessionExpired: 'true' },
        });
      },
    });
  });

  it('should refresh token and retry request on 401 when refresh_token exists', () => {
    sessionStorage.setItem('access_token', 'expired-token');
    sessionStorage.setItem('refresh_token', 'valid-refresh-token');

    userServiceMock.refreshToken.mockReturnValue(
      of({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token', tokenType: 'Bearer' })
    );

    const req = new HttpRequest('GET', '/api/v1/crm/customers');
    const error401 = new HttpErrorResponse({ status: 401, url: '/api/v1/crm/customers' });

    let callCount = 0;
    const next: HttpHandler = {
      handle: vi.fn((handledReq: HttpRequest<any>) => {
        callCount++;
        if (callCount === 1) {
          return throwError(() => error401);
        }
        expect(handledReq.headers.get('Authorization')).toBe('Bearer new-access-token');
        return of(new HttpResponse({ status: 200 }));
      }),
    };

    interceptor.intercept(req, next).subscribe({
      next: (event) => {
        expect(event).toBeInstanceOf(HttpResponse);
        expect(userServiceMock.refreshToken).toHaveBeenCalled();
      },
    });
  });

  it('should clear session and redirect when token refresh fails on 401', () => {
    sessionStorage.setItem('refresh_token', 'invalid-refresh-token');
    userServiceMock.refreshToken.mockReturnValue(
      throwError(() => new Error('Refresh failed'))
    );

    const req = new HttpRequest('GET', '/api/v1/crm/customers');
    const error401 = new HttpErrorResponse({ status: 401, url: '/api/v1/crm/customers' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => error401)),
    };

    interceptor.intercept(req, next).subscribe({
      error: () => {
        expect(userServiceMock.clearSession).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
          queryParams: { sessionExpired: 'true' },
        });
      },
    });
  });

  it('should bypass 401 refresh flow on /auth/signin and /auth/signup', () => {
    sessionStorage.setItem('refresh_token', 'valid-refresh');
    const req = new HttpRequest('POST', '/api/auth/signin', {});
    const error401 = new HttpErrorResponse({ status: 401, url: '/api/auth/signin' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => error401)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
        expect(userServiceMock.refreshToken).not.toHaveBeenCalled();
      },
    });
  });

  it('should automatically logout and redirect when backend request fails with status 0 (ERR_CONNECTION_REFUSED)', () => {
    const req = new HttpRequest('GET', '/api/v1/crm/deals');
    const errorConnRefused = new HttpErrorResponse({ status: 0, url: '/api/v1/crm/deals' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => errorConnRefused)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(0);
        expect(userServiceMock.clearSession).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
          queryParams: { connectionRefused: 'true' },
        });
      },
    });
  });

  it('should automatically logout and redirect when backend /api returns 502/503/504 (server not working)', () => {
    const req = new HttpRequest('GET', '/api/v1/crm/deals');
    const error503 = new HttpErrorResponse({ status: 503, url: '/api/v1/crm/deals' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => error503)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(503);
        expect(userServiceMock.clearSession).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
          queryParams: { connectionRefused: 'true' },
        });
      },
    });
  });

  it('should clear session but not navigate when status 0 occurs on /auth/signin', () => {
    routerMock.url = '/';
    const req = new HttpRequest('POST', '/api/auth/signin', {});
    const errorConnRefused = new HttpErrorResponse({ status: 0, url: '/api/auth/signin' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => errorConnRefused)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(0);
        expect(userServiceMock.clearSession).toHaveBeenCalled();
        expect(routerMock.navigate).not.toHaveBeenCalled();
      },
    });
  });

  it('should not logout or redirect when an external non-api request encounters status 0', () => {
    const req = new HttpRequest('GET', 'https://jsonplaceholder.typicode.com/posts');
    const errorExternal = new HttpErrorResponse({ status: 0, url: 'https://jsonplaceholder.typicode.com/posts' });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => errorExternal)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(0);
        expect(userServiceMock.clearSession).not.toHaveBeenCalled();
        expect(routerMock.navigate).not.toHaveBeenCalled();
      },
    });
  });

  it('should attach X-Refresh-Token header when refresh_token exists in sessionStorage', () => {
    sessionStorage.setItem('access_token', 'test-access');
    sessionStorage.setItem('refresh_token', 'test-refresh');
    const req = new HttpRequest('GET', '/api/v1/sessions');
    const next: HttpHandler = {
      handle: vi.fn((modifiedReq: HttpRequest<any>) => {
        expect(modifiedReq.headers.get('Authorization')).toBe('Bearer test-access');
        expect(modifiedReq.headers.get('X-Refresh-Token')).toBe('test-refresh');
        return of(new HttpResponse({ status: 200 }));
      }),
    };

    interceptor.intercept(req, next).subscribe();
    expect(next.handle).toHaveBeenCalled();
  });

  it('should immediately clear session and redirect with sessionTerminated when 401 has revoked message', () => {
    sessionStorage.setItem('access_token', 'revoked-token');
    sessionStorage.setItem('refresh_token', 'revoked-refresh');
    const req = new HttpRequest('GET', '/api/v1/crm/customers');
    const errorRevoked = new HttpErrorResponse({
      status: 401,
      url: '/api/v1/crm/customers',
      error: { message: 'Session has been revoked or terminated.' },
    });
    const next: HttpHandler = {
      handle: vi.fn(() => throwError(() => errorRevoked)),
    };

    interceptor.intercept(req, next).subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
        expect(userServiceMock.clearSession).toHaveBeenCalled();
        expect(userServiceMock.refreshToken).not.toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/'], {
          queryParams: { sessionTerminated: 'true' },
        });
      },
    });
  });
});
