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

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.idleService.start();
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.handleWindowCaptureClick, true);
    }
  }

  ngOnDestroy(): void {
    this.idleService.stop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', this.handleWindowCaptureClick, true);
    }
  }

  private handleWindowCaptureClick = (): void => {
    this.validateSessionOnClick();
  };

  @HostListener('document:click')
  onDocumentClick(): void {
    this.validateSessionOnClick();
  }

  /**
   * Checks the JWT token whenever a user clicks anywhere in the application.
   * If the token is missing, invalid, or expired on a protected view,
   * cleans the session and redirects the user to the login screen.
   */
  validateSessionOnClick(): boolean {
    const currentUrl = this.router.url || '';
    const isLoginPage = currentUrl === '/' || currentUrl.startsWith('/?') || currentUrl === '';

    // If on the login page without an active session, no token validation needed
    if (isLoginPage && !sessionStorage.getItem('access_token')) {
      return true;
    }

    const token = sessionStorage.getItem('access_token');
    if (token) {
      if (!this.userService.isTokenValid()) {
        console.warn('Click event detected invalid or expired JWT token. Cleaning session.');
        if (this.userService.redirectToAuthApp) {
          this.userService.redirectToAuthApp(window.location.href, { sessionExpired: 'true' });
        } else {
          this.userService.clearSession();
        }
        this.router.navigate(['/'], {
          queryParams: { sessionExpired: 'true' },
        });
        return false;
      }
    } else if (!isLoginPage) {
      console.warn('Click event detected missing JWT token on protected view. Cleaning session.');
      if (this.userService.redirectToAuthApp) {
        this.userService.redirectToAuthApp(window.location.href, { sessionExpired: 'true' });
      } else {
        this.userService.clearSession();
      }
      this.router.navigate(['/'], {
        queryParams: { sessionExpired: 'true' },
      });
      return false;
    }

    return true;
  }
}
