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

  // Clear any residual session data and redirect to localhost:4200 for login
  if (userService.redirectToAuthApp) {
    userService.redirectToAuthApp(state.url);
  } else {
    userService.clearSession();
  }
  return router.createUrlTree(['/'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Route guard that prevents already authenticated users with valid tokens
 * from landing on the login page ('/'), redirecting them straight to '/home'.
 * If not authenticated, redirects to localhost:4200 to log in and generate token.
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  if (userService.isTokenValid()) {
    return router.createUrlTree(['/home']);
  }

  if (userService.redirectToAuthApp) {
    userService.redirectToAuthApp(window.location.origin + '/home');
  }

  return true;
};
