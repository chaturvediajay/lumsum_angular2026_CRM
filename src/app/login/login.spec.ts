import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Login } from './login';
import { SessionSyncService } from '../service/session-sync.service';

const mockSessionSync = {
  init: () => {},
  tryRestoreFromSnapshot: () => {},
  writeSnapshot: () => {},
  clearSnapshot: () => {},
  broadcastLogin: () => {},
  broadcastRefresh: () => {},
  broadcastLogout: () => {},
};

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionSyncService, useValue: mockSessionSync },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display server down message when connectionRefused is true in query params', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route as any).queryParams = of({ connectionRefused: 'true' });

    component.ngOnInit();

    expect(component.errorMessage).toBe(
      'Server is down: The backend application or service is stopped or crashed or Backend server connection refused'
    );
  });

  it('should display server down message when serverUnavailable is true in query params', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route as any).queryParams = of({ serverUnavailable: 'true' });

    component.ngOnInit();

    expect(component.errorMessage).toBe(
      'Server is down: The backend application or service is stopped or crashed or Backend server connection refused'
    );
  });

  it('should display session expired message when sessionExpired is true in query params', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route as any).queryParams = of({ sessionExpired: 'true' });

    component.ngOnInit();

    expect(component.errorMessage).toBe('Your session has expired. Please log in again.');
  });

  it('should display idle timeout message when idleTimeout is true in query params', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route as any).queryParams = of({ idleTimeout: 'true' });

    component.ngOnInit();

    expect(component.errorMessage).toBe(
      'You have been automatically logged out due to 5 minutes of inactivity. Please log in again.'
    );
  });
});

