import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { UserService } from '../service/user-service';

describe('AuthGuards', () => {
  let userServiceMock: {
    isTokenValid: any;
    clearSession: any;
    redirectToAuthApp: any;
    consumeIncomingTokensFromUrl: any;
  };
  let routerMock: { createUrlTree: any };

  beforeEach(() => {
    userServiceMock = {
      isTokenValid: vi.fn(),
      clearSession: vi.fn(),
      redirectToAuthApp: vi.fn(),
      consumeIncomingTokensFromUrl: vi.fn().mockReturnValue(false),
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

    it('should call redirectToAuthApp and return false when token is invalid', () => {
      userServiceMock.isTokenValid.mockReturnValue(false);
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as any, { url: '/home' } as any)
      );
      expect(userServiceMock.redirectToAuthApp).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('guestGuard', () => {
    it('should redirect to /home when already logged in with valid token', () => {
      userServiceMock.isTokenValid.mockReturnValue(true);
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as any, {} as any)
      );
      expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/home']);
    });

    it('should redirect to auth app and return false when no session and no incoming token', () => {
      userServiceMock.isTokenValid.mockReturnValue(false);
      userServiceMock.consumeIncomingTokensFromUrl.mockReturnValue(false);
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as any, {} as any)
      );
      expect(userServiceMock.redirectToAuthApp).toHaveBeenCalled();
      // returns false to stop Angular rendering login component while browser navigates to 4200
      expect(result).toBe(false);
    });
  });
});
