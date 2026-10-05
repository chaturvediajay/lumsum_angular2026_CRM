import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../service/user-service';

/**
 * Route guard that requires a valid, non-expired JWT access token.
 * If token is missing, invalid, or expired, redirects user to login ('/')
 * or to localhost:4200 to generate a new token.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  if (userService.isTokenValid()) {
    return true;
  }

  // Redirect to localhost:4200 for fresh login, passing the current CRM URL as returnUrl
  if (typeof userService.redirectToAuthApp === 'function') {
    // redirectToAuthApp does window.location.href so return false to cancel Angular navigation
    userService.redirectToAuthApp(window.location.origin + state.url);
    return false;
  }

  // Fallback: clear session and show login page within CRM
  userService.clearSession();
  return router.createUrlTree(['/'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Route guard for the login page ('/').
 * - First tries to consume any incoming SSO tokens from URL query params.
 * - If a valid token exists (either already stored or just consumed from URL), redirect to /home.
 * - If no token and no incoming token, redirect to localhost:4200 so the user can login.
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const userService = inject(UserService);
  const router = inject(Router);

  // Step 1: Try to consume SSO tokens from URL params first (before any redirect logic)
  const hadIncomingToken = userService.consumeIncomingTokensFromUrl();

  // Step 2: Now check if token is valid (either pre-existing or just consumed from URL)
  if (userService.isTokenValid()) {
    // Valid session — go straight to the CRM dashboard
    return router.createUrlTree(['/home']);
  }

  // Step 3: No valid token at all. If this was an SSO attempt (had token in URL but it was bad), redirect back to auth app.
  // Otherwise, just show the login page (allows direct navigation to localhost:4201).
  if (hadIncomingToken) {
    // The token from SSO was invalid — force re-login
    if (typeof userService.redirectToAuthApp === 'function') {
      userService.redirectToAuthApp(window.location.origin + '/home', { sessionExpired: 'true' });
    }
    return false;
  }

  // No incoming token and no session — redirect to localhost:4200 for login
  if (typeof userService.redirectToAuthApp === 'function') {
    userService.redirectToAuthApp(window.location.origin + '/home');
    return false;
  }

  // Fallback: render the login page (no redirect function available)
  return true;
};
