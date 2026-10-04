import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { UserService } from '../service/user-service';

describe('AuthGuards', () => {
  let userServiceMock: { isTokenValid: any; clearSession: any };
  let routerMock: { createUrlTree: any };

  beforeEach(() => {
    userServiceMock = {
      isTokenValid: vi.fn(),
      clearSession: vi.fn(),
    };

    routerMock = {
      createUrlTree: vi.fn((commands, extras) => ({ commands, extras } as unknown as UrlTree)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  describe('authGuard', () => {
    it('should allow access when token is valid', () => {
      userServiceMock.isTokenValid.mockReturnValue(true);
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as any, { url: '/home' } as any)
      );
      expect(result).toBe(true);
    });

    it('should redirect to login when token is invalid', () => {
      userServiceMock.isTokenValid.mockReturnValue(false);
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as any, { url: '/home' } as any)
      );
      expect(userServiceMock.clearSession).toHaveBeenCalled();
      expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/'], {
        queryParams: { returnUrl: '/home' },
      });
    });
  });

  describe('guestGuard', () => {
    it('should allow access when not logged in', () => {
      userServiceMock.isTokenValid.mockReturnValue(false);
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as any, {} as any)
      );
      expect(result).toBe(true);
    });

    it('should redirect to /home when already logged in with valid token', () => {
      userServiceMock.isTokenValid.mockReturnValue(true);
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as any, {} as any)
      );
      expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/home']);
    });
  });
});
