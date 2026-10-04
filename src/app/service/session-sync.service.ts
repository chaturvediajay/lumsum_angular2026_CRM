import { Injectable, OnDestroy } from "@angular/core";

/** Keys written to sessionStorage for auth state */
const SESSION_KEYS = ["access_token", "refresh_token", "token_type", "user_id", "username", "email", "roles"] as const;

/** localStorage keys used for the short-lived cross-tab init snapshot */
const LS_SNAPSHOT_TOKEN = "lumsum_tab_init_token";
const LS_SNAPSHOT_REFRESH = "lumsum_tab_init_refresh";
const LS_SNAPSHOT_USER_ID = "lumsum_tab_init_user_id";
const LS_SNAPSHOT_USERNAME = "lumsum_tab_init_username";
const LS_SNAPSHOT_EMAIL = "lumsum_tab_init_email";
const LS_SNAPSHOT_ROLES = "lumsum_tab_init_roles";
const LS_SNAPSHOT_EXPIRY = "lumsum_tab_init_expiry";

/** Maximum age (ms) a tab-init snapshot is considered valid for new-tab cloning */
const SNAPSHOT_TTL_MS = 30_000; // 30 seconds

/** BroadcastChannel name shared across all tabs of the same origin */
const CHANNEL_NAME = "lumsum_auth";

type AuthMessage =
  | { type: "LOGIN"; accessToken: string; refreshToken: string; userId: string; username: string; email: string; roles: string }
  | { type: "REFRESH"; accessToken: string; refreshToken?: string }
  | { type: "LOGOUT" };

@Injectable({
  providedIn: "root",
})
export class SessionSyncService implements OnDestroy {
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.init();
  }

  /**
   * Called once on service construction (via APP_INITIALIZER or injection).
   * 1. Tries to restore session from a fresh localStorage snapshot (new-tab scenario).
   * 2. Opens a BroadcastChannel to receive auth events from sibling tabs.
   */
  init(): void {
    this.tryRestoreFromSnapshot();
    this.openChannel();
  }

  // ---------------------------------------------------------------------------
  // New-tab snapshot restore
  // ---------------------------------------------------------------------------

  /**
   * If sessionStorage is empty (new tab) but a valid localStorage snapshot exists,
   * copy the snapshot into sessionStorage so the user is immediately logged in.
   */
  tryRestoreFromSnapshot(): void {
    if (typeof window === "undefined" || !window.sessionStorage || !window.localStorage) {
      return;
    }

    // Only restore if the current tab has no active session
    if (sessionStorage.getItem("access_token")) {
      return;
    }

    const expiry = localStorage.getItem(LS_SNAPSHOT_EXPIRY);
    if (!expiry) return;

    const expiryMs = parseInt(expiry, 10);
    if (isNaN(expiryMs) || Date.now() > expiryMs) {
      this.clearSnapshot();
      return;
    }

    const token = localStorage.getItem(LS_SNAPSHOT_TOKEN);
    if (!token) return;

    sessionStorage.setItem("access_token", token);

    const refreshToken = localStorage.getItem(LS_SNAPSHOT_REFRESH);
    if (refreshToken) sessionStorage.setItem("refresh_token", refreshToken);

    const userId = localStorage.getItem(LS_SNAPSHOT_USER_ID);
    if (userId) sessionStorage.setItem("user_id", userId);

    const username = localStorage.getItem(LS_SNAPSHOT_USERNAME);
    if (username) sessionStorage.setItem("username", username);

    const email = localStorage.getItem(LS_SNAPSHOT_EMAIL);
    if (email) sessionStorage.setItem("email", email);

    const roles = localStorage.getItem(LS_SNAPSHOT_ROLES);
    if (roles) sessionStorage.setItem("roles", roles);

    console.debug("[SessionSync] Session restored from tab-init snapshot");
  }

  // ---------------------------------------------------------------------------
  // Snapshot write / clear
  // ---------------------------------------------------------------------------

  /**
   * Write a short-lived snapshot to localStorage.
   * Call this immediately after storing tokens in sessionStorage on login.
   */
  writeSnapshot(
    accessToken: string,
    refreshToken: string,
    userId: string,
    username: string,
    email: string,
    roles: string
  ): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    const expiry = Date.now() + SNAPSHOT_TTL_MS;
    localStorage.setItem(LS_SNAPSHOT_TOKEN, accessToken);
    localStorage.setItem(LS_SNAPSHOT_REFRESH, refreshToken);
    localStorage.setItem(LS_SNAPSHOT_USER_ID, userId);
    localStorage.setItem(LS_SNAPSHOT_USERNAME, username);
    localStorage.setItem(LS_SNAPSHOT_EMAIL, email);
    localStorage.setItem(LS_SNAPSHOT_ROLES, roles);
    localStorage.setItem(LS_SNAPSHOT_EXPIRY, String(expiry));
  }

  /**
   * Remove the localStorage snapshot (called on logout or session clear).
   */
  clearSnapshot(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.removeItem(LS_SNAPSHOT_TOKEN);
    localStorage.removeItem(LS_SNAPSHOT_REFRESH);
    localStorage.removeItem(LS_SNAPSHOT_USER_ID);
    localStorage.removeItem(LS_SNAPSHOT_USERNAME);
    localStorage.removeItem(LS_SNAPSHOT_EMAIL);
    localStorage.removeItem(LS_SNAPSHOT_ROLES);
    localStorage.removeItem(LS_SNAPSHOT_EXPIRY);
  }

  // ---------------------------------------------------------------------------
  // BroadcastChannel messaging
  // ---------------------------------------------------------------------------

  private openChannel(): void {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<AuthMessage>) => {
        this.handleMessage(event.data);
      };
    } catch {
      console.warn("[SessionSync] BroadcastChannel not supported in this environment");
    }
  }

  private handleMessage(msg: AuthMessage): void {
    if (!msg?.type) return;

    switch (msg.type) {
      case "LOGIN":
        // Another tab logged in — sync tokens into this tab's sessionStorage
        if (!sessionStorage.getItem("access_token")) {
          sessionStorage.setItem("access_token", msg.accessToken);
          sessionStorage.setItem("refresh_token", msg.refreshToken);
          if (msg.userId) sessionStorage.setItem("user_id", msg.userId);
          if (msg.username) sessionStorage.setItem("username", msg.username);
          if (msg.email) sessionStorage.setItem("email", msg.email);
          if (msg.roles) sessionStorage.setItem("roles", msg.roles);
          console.debug("[SessionSync] Session synced from sibling tab (LOGIN)");
        }
        break;

      case "REFRESH":
        // Another tab refreshed the access token — update ours too
        if (msg.accessToken) {
          sessionStorage.setItem("access_token", msg.accessToken);
          if (msg.refreshToken) sessionStorage.setItem("refresh_token", msg.refreshToken);
          console.debug("[SessionSync] Access token updated from sibling tab (REFRESH)");
        }
        break;

      case "LOGOUT":
        // Another tab logged out — clear our session too
        SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
        this.clearSnapshot();
        console.debug("[SessionSync] Session cleared from sibling tab (LOGOUT)");
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Public broadcast helpers (called by login / clearSession / refreshToken)
  // ---------------------------------------------------------------------------

  broadcastLogin(
    accessToken: string,
    refreshToken: string,
    userId: string,
    username: string,
    email: string,
    roles: string
  ): void {
    this.postMessage({
      type: "LOGIN",
      accessToken,
      refreshToken,
      userId,
      username,
      email,
      roles,
    });
  }

  broadcastRefresh(accessToken: string, refreshToken?: string): void {
    this.postMessage({ type: "REFRESH", accessToken, refreshToken });
  }

  broadcastLogout(): void {
    this.postMessage({ type: "LOGOUT" });
  }

  private postMessage(msg: AuthMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch (e) {
      console.warn("[SessionSync] Failed to broadcast message:", e);
    }
  }

  ngOnDestroy(): void {
    this.channel?.close();
    this.channel = null;
  }
}
