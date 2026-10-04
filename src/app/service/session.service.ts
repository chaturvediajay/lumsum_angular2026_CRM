import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { SessionStats, UserSession } from '../interface/session.model';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private apiUrl = `${environment.apiUrl}/v1/sessions`;

  constructor(private http: HttpClient) {}

  getAllSessions(): Observable<UserSession[]> {
    return this.http.get<UserSession[]>(this.apiUrl);
  }

  getSessionStats(): Observable<SessionStats> {
    return this.http.get<SessionStats>(`${this.apiUrl}/stats`);
  }

  getUserSessions(userId: number): Observable<UserSession[]> {
    return this.http.get<UserSession[]>(`${this.apiUrl}/user/${userId}`);
  }

  getMySessions(): Observable<UserSession[]> {
    return this.http.get<UserSession[]>(`${this.apiUrl}/my`);
  }

  revokeSession(sessionId: number): Observable<{ status: string; message: string; sessionId: number }> {
    return this.http.delete<{ status: string; message: string; sessionId: number }>(`${this.apiUrl}/${sessionId}`);
  }

  revokeAllUserSessions(userId: number): Observable<{ status: string; message: string; userId: number; revokedCount: number }> {
    return this.http.delete<{ status: string; message: string; userId: number; revokedCount: number }>(`${this.apiUrl}/user/${userId}`);
  }

  revokeAllOtherSessions(userId: number): Observable<{ status: string; message: string; userId: number; revokedCount: number }> {
    return this.http.delete<{ status: string; message: string; userId: number; revokedCount: number }>(`${this.apiUrl}/user/${userId}/others`);
  }

  revokeDeviceSession(deviceId: string): Observable<{ status: string; message: string; deviceId: string }> {
    return this.http.delete<{ status: string; message: string; deviceId: string }>(`${this.apiUrl}/device/${deviceId}`);
  }

  updateDeviceName(sessionId: number, deviceName: string): Observable<{ status: string; message: string; sessionId: number; deviceName: string }> {
    return this.http.put<{ status: string; message: string; sessionId: number; deviceName: string }>(`${this.apiUrl}/${sessionId}/device-name`, { deviceName });
  }
}
