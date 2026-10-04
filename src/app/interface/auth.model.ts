export interface LoginRequest {
  username?: string;
  email?: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  role?: string[]; // e.g. ["USER", "ADMIN", "MOD"]
}

export interface JwtResponse {
  token?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  id: number;
  username: string;
  email: string;
  roles: string[];
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface MessageResponse {
  message: string;
}

export interface TokenCheckResponse {
  status: string;
  valid: boolean;
  reason?: string;
  username?: string;
  id?: number;
  email?: string;
  roles?: string[];
  issuedAt?: string;
  expiresAt?: string;
  remainingTimeMs?: number;
  remainingTimeSeconds?: number;
  isBlacklisted?: boolean;
  timestamp?: number;
  timezone?: string;
}

export interface UserRole {
  id: number;
  name: 'ROLE_USER' | 'ROLE_MODERATOR' | 'ROLE_ADMIN' | string;
}

export interface BackendUser {
  id: number;
  username: string;
  email: string;
  roles: UserRole[];
}
