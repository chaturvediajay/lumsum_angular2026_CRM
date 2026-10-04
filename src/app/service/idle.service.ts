import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { UserService } from './user-service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

/**
 * IdleService tracks user activity and automatically logs out inactive sessions after 5 minutes.
 * A warning dialog appears 60 seconds before expiration with a countdown and 'Stay Logged In' option.
 */
@Injectable({
  providedIn: 'root',
})
export class IdleService implements OnDestroy {
  private router = inject(Router);
  private userService = inject(UserService);
  private ngZone = inject(NgZone);

  // Default configuration: 5 minutes idle timeout (300,000 ms) with 60s warning (60,000 ms)
  private idleTimeoutMs = 5 * 60 * 1000;
  private warningTimeMs = 60 * 1000;

  private lastActivityTime = Date.now();
  private checkIntervalTimer: any = null;
  private isRunning = false;
  private routerSubscription?: Subscription;

  // Reactive state signals for UI components
  readonly isWarningVisible = signal<boolean>(false);
  readonly remainingSeconds = signal<number>(60);

  // User activity events to monitor
  private readonly activityEvents: (keyof WindowEventMap)[] = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];

  constructor() {
    // Listen to route changes to reset timer when entering protected views
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isUserLoggedIn()) {
          this.resetTimer();
        } else {
          this.isWarningVisible.set(false);
        }
      });
  }

  /**
   * Starts tracking user idle time. Attaches throttled event listeners outside Angular zone for optimal performance.
   */
  start(): void {
    if (this.isRunning || typeof window === 'undefined') {
      return;
    }
    this.isRunning = true;
    this.lastActivityTime = Date.now();

    // Attach listeners outside Angular zone so mouse movements don't trigger unnecessary change detection cycles
    this.ngZone.runOutsideAngular(() => {
      this.activityEvents.forEach((eventName) => {
        window.addEventListener(eventName, this.handleUserActivity, { passive: true, capture: true });
      });

      // Periodic check every 1 second
      this.checkIntervalTimer = setInterval(() => {
        this.checkIdleState();
      }, 1000);
    });
  }

  /**
   * Stops tracking and clears all listeners and interval timers.
   */
  stop(): void {
    this.isRunning = false;
    if (typeof window !== 'undefined') {
      this.activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, this.handleUserActivity, { capture: true });
      });
    }

    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }

    this.isWarningVisible.set(false);
  }

  /**
   * Handles user activity events throttled to at most once per 1 second.
   */
  private handleUserActivity = (): void => {
    const now = Date.now();
    // Throttle user activity tracking to once every second
    if (now - this.lastActivityTime < 1000) {
      return;
    }

    this.lastActivityTime = now;

    // If warning was visible and user becomes active, hide warning inside Angular zone
    if (this.isWarningVisible()) {
      this.ngZone.run(() => {
        this.isWarningVisible.set(false);
      });
    }
  };

  /**
   * Evaluates the elapsed idle time and triggers warning or automatic logout.
   */
  private checkIdleState(): void {
    if (!this.isRunning || !this.isUserLoggedIn()) {
      if (this.isWarningVisible()) {
        this.ngZone.run(() => this.isWarningVisible.set(false));
      }
      return;
    }

    const elapsed = Date.now() - this.lastActivityTime;

    // Check if idle timeout reached (e.g. 5 minutes)
    if (elapsed >= this.idleTimeoutMs) {
      this.ngZone.run(() => {
        this.logoutDueToIdle();
      });
      return;
    }

    // Check if warning threshold reached (e.g. within final 60 seconds)
    const warningThreshold = this.idleTimeoutMs - this.warningTimeMs;
    if (elapsed >= warningThreshold) {
      const remainingMs = Math.max(0, this.idleTimeoutMs - elapsed);
      const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));

      this.ngZone.run(() => {
        this.remainingSeconds.set(remainingSec);
        if (!this.isWarningVisible()) {
          this.isWarningVisible.set(true);
        }
      });
    } else if (this.isWarningVisible()) {
      this.ngZone.run(() => {
        this.isWarningVisible.set(false);
      });
    }
  }

  /**
   * Resets the idle timer back to full duration.
   */
  resetTimer(): void {
    this.lastActivityTime = Date.now();
    this.isWarningVisible.set(false);
    this.remainingSeconds.set(Math.ceil(this.warningTimeMs / 1000));
  }

  /**
   * Action called when the user clicks 'Keep Me Logged In' on the inactivity warning modal.
   */
  stayLoggedIn(): void {
    this.resetTimer();
  }

  /**
   * Clears the user session and redirects to login with idleTimeout query parameter.
   */
  logoutDueToIdle(): void {
    console.warn('Session idle timeout exceeded (5 minutes of inactivity). Automatically logging out.');
    this.stop();
    this.isWarningVisible.set(false);
    this.userService.clearSession();
    this.router.navigate(['/'], {
      queryParams: { idleTimeout: 'true' },
    });
  }

  /**
   * Checks whether there is an active authenticated session.
   */
  isUserLoggedIn(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const token = sessionStorage.getItem('access_token');
    const currentUrl = this.router.url || '';
    const isLoginPage = currentUrl === '/' || currentUrl.startsWith('/?') || currentUrl === '';

    return !!token && !isLoginPage;
  }

  /**
   * Helper to configure timeouts (useful for testing or customized duration).
   */
  configure(timeoutMs: number, warningMs: number): void {
    this.idleTimeoutMs = timeoutMs;
    this.warningTimeMs = warningMs;
    this.resetTimer();
  }

  ngOnDestroy(): void {
    this.stop();
    this.routerSubscription?.unsubscribe();
  }
}
