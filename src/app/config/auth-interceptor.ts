import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UserService } from '../service/user-service';
import { environment } from '@environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private userService = inject(UserService);
  private router = inject(Router);

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let authReq = req;

    // Automatically attach Authorization header and X-Refresh-Token if tokens exist in sessionStorage
    const token = sessionStorage.getItem('access_token');
    const refreshToken = sessionStorage.getItem('refresh_token');

    let headersToSet: { [key: string]: string } = {};
    if (token && token.trim() !== '' && token !== 'null' && !req.headers.has('Authorization')) {
      headersToSet['Authorization'] = `Bearer ${token.trim()}`;
    }
    if (refreshToken && refreshToken.trim() !== '' && refreshToken !== 'null' && !req.headers.has('X-Refresh-Token')) {
      headersToSet['X-Refresh-Token'] = refreshToken.trim();
    }
    if (this.userService?.getDeviceId && !req.headers.has('X-Device-Id')) {
      headersToSet['X-Device-Id'] = this.userService.getDeviceId();
    }
    if (this.userService?.getDeviceName && !req.headers.has('X-Device-Name')) {
      headersToSet['X-Device-Name'] = this.userService.getDeviceName();
    }
    if (this.userService?.getClientNetwork && !req.headers.has('X-Client-Network')) {
      headersToSet['X-Client-Network'] = this.userService.getClientNetwork();
    }
    if (this.userService?.getClientTimezone && !req.headers.has('X-Client-Timezone')) {
      headersToSet['X-Client-Timezone'] = this.userService.getClientTimezone();
    }
    if (this.userService?.getClientLocale && !req.headers.has('X-Client-Locale')) {
      headersToSet['X-Client-Locale'] = this.userService.getClientLocale();
    }
    if (this.userService?.getClientResolution && !req.headers.has('X-Client-Resolution')) {
      headersToSet['X-Client-Resolution'] = this.userService.getClientResolution();
    }
    if (this.userService?.getClientCores && !req.headers.has('X-Client-Cores')) {
      headersToSet['X-Client-Cores'] = this.userService.getClientCores();
    }
    if (this.userService?.getClientPublicIp && !req.headers.has('X-Client-Public-Ip')) {
      headersToSet['X-Client-Public-Ip'] = this.userService.getClientPublicIp();
    }
    if (this.userService?.getClientPrivateIp && !req.headers.has('X-Client-Private-Ip')) {
      headersToSet['X-Client-Private-Ip'] = this.userService.getClientPrivateIp();
    }

    if (Object.keys(headersToSet).length > 0) {
      authReq = req.clone({ setHeaders: headersToSet });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        const isBackendApi =
          req.url.startsWith(environment.apiUrl) ||
          ((environment as any).crmApiUrl && req.url.startsWith((environment as any).crmApiUrl)) ||
          req.url.includes('/api/') ||
          req.url.startsWith('/api');

        // Detect connection refused (status 0, net::ERR_CONNECTION_REFUSED) or backend server unavailable (502, 503, 504)
        const isConnectionError =
          error.status === 0 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504;

        if (isBackendApi && isConnectionError) {
          console.warn(
            `Backend server connection refused or unavailable (status ${error.status}) for URL: ${req.url}. Automatically logging out in Angular.`
          );
          this.userService.clearSession();

          // Only navigate if not already on the login page or /auth/signin to prevent duplicate navigation
          const isLoginPage = this.router.url === '/' || this.router.url.startsWith('/?');
          if (!req.url.includes('/auth/signin') && !isLoginPage) {
            this.router.navigate(['/'], {
              queryParams: { connectionRefused: 'true' },
            });
          }
          return throwError(() => error);
        }

        // Handle 401 Unauthorized globally (exclude auth endpoints)
        if (
          error.status === 401 &&
          !req.url.includes('/auth/signin') &&
          !req.url.includes('/auth/signup') &&
          !req.url.includes('/auth/refreshtoken')
        ) {
          return this.handle401Error(req, next, error);
        }

        return throwError(() => error);
      })
    );
  }

  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler,
    originalError: HttpErrorResponse
  ): Observable<HttpEvent<any>> {
    // If backend reports session is revoked or terminated, immediately clear session and redirect
    const errorMsg =
      typeof originalError.error?.message === 'string'
        ? originalError.error.message.toLowerCase()
        : '';
    if (errorMsg.includes('revoked') || errorMsg.includes('terminated')) {
      console.warn('Session has been revoked or terminated on server; logging out immediately');
      if (this.userService.redirectToAuthApp) {
        this.userService.redirectToAuthApp(window.location.href, { sessionTerminated: 'true' });
      } else {
        this.userService.clearSession();
      }
      this.router.navigate(['/'], {
        queryParams: { sessionTerminated: 'true' },
      });
      return throwError(() => originalError);
    }

    const refreshToken = sessionStorage.getItem('refresh_token');

    // If no refresh token available, session is expired
    if (!refreshToken) {
      console.warn('Unauthorized (401) with no refresh token available; clearing session');
      if (this.userService.redirectToAuthApp) {
        this.userService.redirectToAuthApp(window.location.href, { sessionExpired: 'true' });
      } else {
        this.userService.clearSession();
      }
      this.router.navigate(['/'], {
        queryParams: { sessionExpired: 'true' },
      });
      return throwError(() => originalError);
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.userService.refreshToken().pipe(
        switchMap((tokenResponse) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(tokenResponse.accessToken);
          return next.handle(this.addTokenHeader(request, tokenResponse.accessToken));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          const isConnError =
            err?.status === 0 || err?.status === 502 || err?.status === 503 || err?.status === 504;
          const isRevoked =
            typeof err?.error?.message === 'string' &&
            (err.error.message.toLowerCase().includes('revoked') ||
              err.error.message.toLowerCase().includes('terminated') ||
              err.error.message.toLowerCase().includes('not in database'));
          const queryParams: Record<string, string> = isConnError
            ? { connectionRefused: 'true' }
            : isRevoked
            ? { sessionTerminated: 'true' }
            : { sessionExpired: 'true' };

          if (this.userService.redirectToAuthApp) {
            this.userService.redirectToAuthApp(window.location.href, queryParams);
          } else {
            this.userService.clearSession();
          }

          this.router.navigate(['/'], {
            queryParams,
          });
          return throwError(() => err);
        })
      );
    } else {
      // Refresh in progress: wait for new token and retry
      return this.refreshTokenSubject.pipe(
        filter((token): token is string => token !== null),
        take(1),
        switchMap((token) => next.handle(this.addTokenHeader(request, token)))
      );
    }
  }

  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    const refreshToken = sessionStorage.getItem('refresh_token');
    const headers: { [key: string]: string } = {
      Authorization: `Bearer ${token}`,
    };
    if (refreshToken && refreshToken.trim() !== '' && refreshToken !== 'null') {
      headers['X-Refresh-Token'] = refreshToken.trim();
    }
    return request.clone({
      setHeaders: headers,
    });
  }
}
