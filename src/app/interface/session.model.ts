export interface UserSession {
  id: number;
  userId: number;
  username: string;
  email: string;
  roles: string[];
  token?: string;
  ipAddress: string;
  userAgent?: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | string;
  browser: string;
  operatingSystem: string;
  createdAt: string;
  lastAccessedAt?: string;
  expiryDate: string;
  active: boolean;
  currentSession: boolean;
  deviceId?: string;
  deviceName?: string;
  clientPort?: number;
  networkType?: string;
  timezone?: string;
  locale?: string;
  screenResolution?: string;
  clientSystemInfo?: string;
}

export interface SessionStats {
  totalActiveSessions: number;
  uniqueActiveUsers: number;
  activeToday: number;
  deviceBreakdown?: { [key: string]: number };
  browserBreakdown?: { [key: string]: number };
}
