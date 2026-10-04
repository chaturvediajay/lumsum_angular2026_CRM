import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "@environments/environment";
import { UserInfo } from "../interface/user-info";
import {
  JwtResponse,
  LoginRequest,
  MessageResponse,
  SignupRequest,
  TokenCheckResponse,
  TokenRefreshResponse,
} from "../interface/auth.model";
import { jwtDecode } from "jwt-decode";
import { catchError, map, Observable, of, timeout, throwError } from "rxjs";
import { SessionSyncService } from "./session-sync.service";

@Injectable({
  providedIn: "root",
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private sessionSync: SessionSyncService) {
    this.consumeIncomingTokensFromUrl();
  }

  /**
   * Checks URL query parameters for SSO tokens passed from localhost:4200 upon redirection.
   * If found, sets them in sessionStorage, syncs with sibling tabs, and strips query parameters.
   */
  consumeIncomingTokensFromUrl(): boolean {
    if (typeof window === "undefined" || !window.location || !window.sessionStorage) {
      return false;
    }

    try {
      const url = new URL(window.location.href);
      const accessToken = url.searchParams.get("access_token") || url.searchParams.get("token");
      if (!accessToken) {
        return false;
      }

      sessionStorage.setItem("access_token", accessToken);
      sessionStorage.setItem("token_type", "Bearer");

      const refreshToken = url.searchParams.get("refresh_token");
      if (refreshToken) sessionStorage.setItem("refresh_token", refreshToken);

      const userId = url.searchParams.get("user_id");
      if (userId) sessionStorage.setItem("user_id", userId);

      const username = url.searchParams.get("username");
      if (username) sessionStorage.setItem("username", username);

      const email = url.searchParams.get("email");
      if (email) sessionStorage.setItem("email", email);

      const roles = url.searchParams.get("roles");
      if (roles) sessionStorage.setItem("roles", roles);

      if (this.sessionSync?.writeSnapshot) {
        this.sessionSync.writeSnapshot(
          accessToken,
          refreshToken || "",
          userId || "",
          username || "",
          email || "",
          roles || "[]"
        );
      }

      // Clean the query parameters from browser address bar
      url.searchParams.delete("access_token");
      url.searchParams.delete("token");
      url.searchParams.delete("refresh_token");
      url.searchParams.delete("user_id");
      url.searchParams.delete("username");
      url.searchParams.delete("email");
      url.searchParams.delete("roles");

      const searchStr = url.searchParams.toString();
      const cleanUrl = url.pathname + (searchStr ? "?" + searchStr : "") + url.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Redirects the browser to localhost:4200 (authAppUrl) for login and token generation
   * when accessToken is not valid or expired.
   */
  redirectToAuthApp(returnUrl?: string, queryParams?: Record<string, string>): void {
    this.clearSession();
    if (typeof window !== "undefined" && window.location) {
      try {
        const baseAuthUrl = (environment as any).authAppUrl || "http://localhost:4200";
        const authUrl = new URL(baseAuthUrl);
        const currentUrl = returnUrl || window.location.href;
        authUrl.searchParams.set("returnUrl", currentUrl);
        if (queryParams) {
          Object.entries(queryParams).forEach(([k, v]) => authUrl.searchParams.set(k, v));
        }
        window.location.href = authUrl.toString();
      } catch (e) {
        console.error("Failed to redirect to auth app:", e);
      }
    }
  }

  getDeviceId(): string {
    if (typeof window === "undefined" || !window.localStorage) {
      return "dev_server_default";
    }
    let deviceId = localStorage.getItem("lumsum_device_id");
    if (!deviceId || deviceId.trim() === "") {
      deviceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? "dev_" + crypto.randomUUID()
          : "dev_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
      localStorage.setItem("lumsum_device_id", deviceId);
    }
    return deviceId;
  }

  getDeviceName(): string {
    if (typeof window === "undefined" || !window.localStorage) {
      return "Web Browser";
    }
    const savedName = localStorage.getItem("lumsum_device_name");
    if (savedName && savedName.trim() !== "") {
      return savedName.trim();
    }

    const ua = navigator?.userAgent || "";
    let browser = "Web Browser";
    if (ua.includes("Edg")) browser = "Microsoft Edge";
    else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Google Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";

    let os = "Desktop";
    if (ua.includes("Mac OS") || ua.includes("Macintosh")) os = "macOS";
    else if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("Linux")) os = "Linux";

    return `${browser} on ${os}`;
  }

  setDeviceName(name: string): void {
    if (typeof window !== "undefined" && window.localStorage) {
      if (name && name.trim()) {
        localStorage.setItem("lumsum_device_name", name.trim());
      } else {
        localStorage.removeItem("lumsum_device_name");
      }
    }
  }

  getClientNetwork(): string {
    if (typeof navigator !== "undefined") {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        if (conn.type && conn.type !== "unknown") return conn.type;
        if (conn.effectiveType) return conn.effectiveType;
      }
    }
    return "unknown";
  }

  getClientTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  getClientLocale(): string {
    if (typeof navigator !== "undefined") {
      return navigator.language || "en-US";
    }
    return "en-US";
  }

  getClientResolution(): string {
    if (typeof window !== "undefined" && window.screen) {
      return `${window.screen.width}x${window.screen.height}`;
    }
    return "unknown";
  }

  getClientCores(): string {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      return String(navigator.hardwareConcurrency);
    }
    return "unknown";
  }

  // ---------------------------------------------------------------------------
  // Client-side IP detection (public + private/LAN)
  // ---------------------------------------------------------------------------

  private static readonly PUBLIC_IP_KEY = "lumsum_public_ip";
  private static readonly PUBLIC_IP_TS_KEY = "lumsum_public_ip_ts";
  private static readonly PRIVATE_IP_KEY = "lumsum_private_ip";
  private static readonly IP_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Returns the cached public IP (from localStorage).
   * Returns "unknown" if not yet resolved.
   * Call initClientIp() on app startup to warm the cache.
   */
  getClientPublicIp(): string {
    if (typeof window === "undefined" || !window.localStorage) return "unknown";
    return localStorage.getItem(UserService.PUBLIC_IP_KEY) || "unknown";
  }

  /**
   * Returns the cached private/LAN IP detected via WebRTC (from localStorage).
   * Returns "unknown" if not yet resolved.
   */
  getClientPrivateIp(): string {
    if (typeof window === "undefined" || !window.localStorage) return "unknown";
    return localStorage.getItem(UserService.PRIVATE_IP_KEY) || "unknown";
  }

  /**
   * Initializes both public + private IP caches.
   * Called once on app startup via APP_INITIALIZER.
   * Safe to call repeatedly — respects 10-minute TTL.
   */
  initClientIp(): void {
    this.refreshPublicIpIfStale();
    this.detectPrivateIp();
  }

  /**
   * Fetches public IP from ipify.org if cache is stale or missing.
   * Stores result in localStorage with a timestamp.
   */
  private refreshPublicIpIfStale(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    const ts = parseInt(localStorage.getItem(UserService.PUBLIC_IP_TS_KEY) || "0", 10);
    const isFresh = Date.now() - ts < UserService.IP_CACHE_TTL_MS;
    if (isFresh && localStorage.getItem(UserService.PUBLIC_IP_KEY)) return;

    // Fetch from ipify (CORS-enabled, no API key required)
    fetch("https://api.ipify.org?format=json", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ip: string }) => {
        if (data?.ip) {
          localStorage.setItem(UserService.PUBLIC_IP_KEY, data.ip);
          localStorage.setItem(UserService.PUBLIC_IP_TS_KEY, String(Date.now()));
          console.debug("[ClientIP] Public IP resolved:", data.ip);
        }
      })
      .catch(() => {
        console.debug("[ClientIP] Public IP fetch failed (offline or blocked)");
      });
  }

  /**
   * Detects private/LAN IP using WebRTC RTCPeerConnection ICE candidates.
   * This is purely local — no network traffic beyond STUN candidate generation.
   * Stores result in localStorage.
   */
  private detectPrivateIp(): void {
    if (typeof window === "undefined" || !window.RTCPeerConnection) return;
    // Skip if cache is recent
    if (localStorage.getItem(UserService.PRIVATE_IP_KEY) &&
        localStorage.getItem(UserService.PRIVATE_IP_KEY) !== "unknown") {
      return;
    }

    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      // Dummy data channel forces ICE candidate generation
      pc.createDataChannel("");

      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => {});

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event || !event.candidate) {
          pc.close();
          return;
        }
        // Parse IP from SDP candidate string
        // Format: "candidate:... IP port ..."
        const candidateStr = event.candidate.candidate;
        const ipMatch = candidateStr.match(
          /(?:^|[\s:])(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{4,})(?=\s)/i
        );
        if (ipMatch) {
          const ip = ipMatch[1];
          // Skip link-local (169.254.x.x) and loopback (127.x.x.x)
          if (!ip.startsWith("169.254") && !ip.startsWith("127.")) {
            localStorage.setItem(UserService.PRIVATE_IP_KEY, ip);
            console.debug("[ClientIP] Private/LAN IP detected:", ip);
            pc.close();
          }
        }
      };
    } catch {
      console.debug("[ClientIP] WebRTC private IP detection not available");
    }
  }

  private getPublicHeaders(): HttpHeaders {
    return new HttpHeaders({
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "X-Device-Id": this.getDeviceId(),
      "X-Device-Name": this.getDeviceName(),
      "X-Client-Network": this.getClientNetwork(),
      "X-Client-Timezone": this.getClientTimezone(),
      "X-Client-Locale": this.getClientLocale(),
      "X-Client-Resolution": this.getClientResolution(),
      "X-Client-Cores": this.getClientCores(),
      "X-Client-Public-Ip": this.getClientPublicIp(),
      "X-Client-Private-Ip": this.getClientPrivateIp(),
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = sessionStorage.getItem("access_token");
    let headers = new HttpHeaders({
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "X-Device-Id": this.getDeviceId(),
      "X-Device-Name": this.getDeviceName(),
      "X-Client-Network": this.getClientNetwork(),
      "X-Client-Timezone": this.getClientTimezone(),
      "X-Client-Locale": this.getClientLocale(),
      "X-Client-Resolution": this.getClientResolution(),
      "X-Client-Cores": this.getClientCores(),
      "X-Client-Public-Ip": this.getClientPublicIp(),
      "X-Client-Private-Ip": this.getClientPrivateIp(),
    });
    if (token) {
      headers = headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }

  getMessage(): string {
    return "Hello from MyService!";
  }

  /**
   * Authenticate user with either username or email
   * Endpoint: POST /api/auth/signin
   */
  userLogin(identifier: string, password: string): Observable<JwtResponse> {
    const payload: LoginRequest = identifier.includes("@")
      ? { email: identifier, password }
      : { username: identifier, password };

    return this.http
      .post<JwtResponse>(`${this.apiUrl}/auth/signin`, payload, {
        headers: this.getPublicHeaders(),
      })
      .pipe(
        timeout(10000),
        catchError((err) => {
          if (err.name === "TimeoutError") {
            console.error("Request timed out after 10 seconds");
          } else {
            console.error("HTTP Error:", err);
          }
          return throwError(() => err);
        })
      );
  }

  /**
   * Register a new user
   * Endpoint: POST /api/auth/signup
   */
  userSignup(signupData: SignupRequest): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${this.apiUrl}/auth/signup`, signupData, {
        headers: this.getPublicHeaders(),
      })
      .pipe(
        timeout(10000),
        catchError((err) => {
          console.error("Signup error:", err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Validate token health & expiration against backend
   * Endpoint: GET /api/auth/check-token
   */
  checkToken(token?: string): Observable<TokenCheckResponse> {
    const targetToken = token || sessionStorage.getItem("access_token") || "";
    return this.http
      .get<TokenCheckResponse>(`${this.apiUrl}/auth/check-token?token=${encodeURIComponent(targetToken)}`, {
        headers: this.getPublicHeaders(),
      })
      .pipe(
        timeout(10000),
        catchError((err) => {
          console.error("Token check error:", err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Check whether a username already exists in the system
   * Endpoint: GET /api/v1/user/{username}
   */
  checkUsernameExists(username: string): Observable<boolean> {
    return this.http
      .get<boolean>(`${this.apiUrl}/v1/user/${encodeURIComponent(username)}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        timeout(10000),
        catchError((err) => {
          console.error("Username check error:", err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Retrieves decoded token claims (sub, exp, iat)
   */
  getDecodedToken(): UserInfo | null {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) {
        return null;
      }
      return jwtDecode<UserInfo>(token);
    } catch (error) {
      console.error("Invalid token", error);
      return null;
    }
  }

  /**
   * Retrieves full user session profile (id, username, email, roles)
   * stored from the backend JwtResponse
   */
  getCurrentUserProfile(): {
    id: number | null;
    username: string;
    email: string;
    roles: string[];
  } | null {
    const username = sessionStorage.getItem("username") || "";
    const email = sessionStorage.getItem("email") || "";
    const idStr = sessionStorage.getItem("user_id");
    const rolesStr = sessionStorage.getItem("roles");

    if (!username && !email) {
      return null;
    }

    return {
      id: idStr ? Number(idStr) : null,
      username,
      email,
      roles: rolesStr ? JSON.parse(rolesStr) : [],
    };
  }

  /**
   * Synchronously checks if a valid, non-expired access token exists in sessionStorage.
   * If token is missing, malformed, or expired, session is cleared and false is returned.
   */
  isTokenValid(): boolean {
    this.consumeIncomingTokensFromUrl();
    const token = sessionStorage.getItem("access_token");
    if (!token || token.trim() === "" || token === "null" || token === "undefined") {
      this.clearSession();
      return false;
    }

    try {
      const decoded = jwtDecode<UserInfo>(token);
      if (!decoded || !decoded.exp) {
        this.clearSession();
        return false;
      }

      // exp is in seconds; compare against current time in milliseconds
      const isExpired = decoded.exp * 1000 <= Date.now();
      if (isExpired) {
        console.warn("User session expired, clearing session");
        this.clearSession();
        return false;
      }

      return true;
    } catch (err) {
      console.warn("Invalid JWT token detected:", err);
      this.clearSession();
      return false;
    }
  }

  /**
   * Validates JWT token on user action/click.
   * If the token is missing, invalid, or expired, automatically cleans the session and returns false.
   */
  checkTokenOnClick(): boolean {
    const valid = this.isTokenValid();
    if (!valid) {
      this.clearSession();
      return false;
    }
    return true;
  }

  /**
   * Asynchronously validates token against backend server (/api/auth/check-token).
   * Verifies signature, expiration, and Redis blacklist status on the server.
   * On success, refreshes profile data in sessionStorage.
   */
  validateTokenWithServer(token?: string): Observable<boolean> {
    const targetToken = token || sessionStorage.getItem("access_token") || "";
    if (!targetToken) {
      this.clearSession();
      return of(false);
    }

    return this.checkToken(targetToken).pipe(
      map((res) => {
        if (res && res.valid) {
          // Rehydrate session storage if backend returned profile fields
          if (res.id) sessionStorage.setItem("user_id", String(res.id));
          if (res.username) sessionStorage.setItem("username", res.username);
          if (res.email) sessionStorage.setItem("email", res.email);
          if (res.roles) sessionStorage.setItem("roles", JSON.stringify(res.roles));
          return true;
        } else {
          this.clearSession();
          return false;
        }
      }),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  /**
   * Request a new access token using the stored refresh token
   * Endpoint: POST /api/auth/refreshtoken
   */
  refreshToken(): Observable<TokenRefreshResponse> {
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (!refreshToken) {
      return throwError(() => new Error("No refresh token available"));
    }

    return this.http
      .post<TokenRefreshResponse>(
        `${this.apiUrl}/auth/refreshtoken`,
        { refreshToken },
        { headers: this.getPublicHeaders() }
      )
      .pipe(
        map((response) => {
          if (response?.accessToken) {
            sessionStorage.setItem("access_token", response.accessToken);
            if (response.refreshToken) {
              sessionStorage.setItem("refresh_token", response.refreshToken);
            }
            // Broadcast the refreshed token to all sibling tabs
            this.sessionSync.broadcastRefresh(response.accessToken, response.refreshToken);
          }
          return response;
        }),
        catchError((err) => {
          console.error("Token refresh failed:", err);
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  /**
   * Centralized cleanup of all authentication keys in sessionStorage.
   * Also clears the cross-tab localStorage snapshot and broadcasts logout
   * to all sibling tabs.
   */
  clearSession(): void {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("token_type");
    sessionStorage.removeItem("user_id");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("email");
    sessionStorage.removeItem("roles");
    // Clear localStorage snapshot so no other tab can restore a dead session
    this.sessionSync.clearSnapshot();
    // Notify all sibling tabs to also log out
    this.sessionSync.broadcastLogout();
  }
}
