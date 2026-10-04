import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../service/user-service';

/**
 * Route guard that requires a valid, non-expired JWT access token.
 * If token is missing, invalid, or expired, redirects user to login ('/').
 */
export const authGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  if (userService.isTokenValid()) {
    return true;
  }

  // Clear any residual session data and redirect to login
  userService.clearSession();
  return router.createUrlTree(['/'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Route guard that prevents already authenticated users with valid tokens
 * from landing on the login page ('/'), redirecting them straight to '/home'.
 */
export const guestGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const router = inject(Router);

  if (userService.isTokenValid()) {
    return router.createUrlTree(['/home']);
  }

  return true;
};
