import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { LoadingInterceptor } from './config/loading-interceptor';
import { AuthInterceptor } from './config/auth-interceptor';
import { SessionSyncService } from './service/session-sync.service';
import { UserService } from './service/user-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    // Restore session from localStorage snapshot before route guards fire
    {
      provide: APP_INITIALIZER,
      useFactory: (sync: SessionSyncService) => () => sync.init(),
      deps: [SessionSyncService],
      multi: true,
    },
    // Warm client-side IP cache (public via ipify + private via WebRTC)
    {
      provide: APP_INITIALIZER,
      useFactory: (userService: UserService) => () => userService.initClientIp(),
      deps: [UserService],
      multi: true,
    },
  ],
};
