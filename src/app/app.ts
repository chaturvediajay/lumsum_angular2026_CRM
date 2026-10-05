import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UserService } from './service/user-service';
import { IdleService } from './service/idle.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('lumsumtest');
  public idleService = inject(IdleService);

  /** Guard against multiple rapid redirects from concurrent click events */
  private isRedirecting = false;

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.validateSessionOnClick();
  }

  /**
   * Checks the JWT token whenever a user clicks anywhere in the application.
   * If the token is missing, invalid, or expired on a protected view,
   * cleans the session and redirects the user to localhost:4200 for fresh login.
   */
  validateSessionOnClick(): boolean {
    // Prevent multiple rapid redirects
    if (this.isRedirecting) return false;

    const currentUrl = this.router.url || '';
    const isLoginPage = currentUrl === '/' || currentUrl.startsWith('/?') || currentUrl === '';

    // If on the login page, skip token validation — do not interfere with SSO or login form
    if (isLoginPage) {
      return true;
    }

    const token = sessionStorage.getItem('access_token');
    if (token) {
      if (typeof this.userService?.isTokenValid === 'function' && !this.userService.isTokenValid()) {
        console.warn('Click event detected invalid or expired JWT token. Cleaning session.');
        this.isRedirecting = true;
        if (typeof this.userService?.redirectToAuthApp === 'function') {
          this.userService.redirectToAuthApp(window.location.href, { sessionExpired: 'true' });
        } else {
          this.userService?.clearSession?.();
          this.router.navigate(['/'], { queryParams: { sessionExpired: 'true' } });
        }
        return false;
      }
    } else {
      console.warn('Click event detected missing JWT token on protected view. Cleaning session.');
      this.isRedirecting = true;
      if (typeof this.userService?.redirectToAuthApp === 'function') {
        this.userService.redirectToAuthApp(window.location.href, { sessionExpired: 'true' });
      } else {
        this.userService?.clearSession?.();
        this.router.navigate(['/'], { queryParams: { sessionExpired: 'true' } });
      }
      return false;
    }

    return true;
  }
}
