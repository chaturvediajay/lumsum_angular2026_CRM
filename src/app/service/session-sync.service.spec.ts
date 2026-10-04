import { TestBed } from "@angular/core/testing";
import { SessionSyncService } from "./session-sync.service";

const LS_SNAPSHOT_TOKEN = "lumsum_tab_init_token";
const LS_SNAPSHOT_REFRESH = "lumsum_tab_init_refresh";
const LS_SNAPSHOT_USER_ID = "lumsum_tab_init_user_id";
const LS_SNAPSHOT_USERNAME = "lumsum_tab_init_username";
const LS_SNAPSHOT_EMAIL = "lumsum_tab_init_email";
const LS_SNAPSHOT_ROLES = "lumsum_tab_init_roles";
const LS_SNAPSHOT_EXPIRY = "lumsum_tab_init_expiry";

if (typeof (globalThis as any).localStorage === 'undefined') {
  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe("SessionSyncService", () => {
  let service: SessionSyncService;

  // Capture BroadcastChannel messages posted by the service
  let postedMessages: any[] = [];
  let mockChannel: any;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    postedMessages = [];

    mockChannel = {
      postMessage: (msg: any) => postedMessages.push(msg),
      close: () => {},
      onmessage: null as any,
    };

    // Stub BroadcastChannel globally
    (globalThis as any).BroadcastChannel = function () {
      return mockChannel;
    };

    TestBed.configureTestingModule({
      providers: [SessionSyncService],
    });
    service = TestBed.inject(SessionSyncService);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    delete (globalThis as any).BroadcastChannel;
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // writeSnapshot / clearSnapshot
  // ---------------------------------------------------------------------------

  it("writeSnapshot should persist all keys to localStorage with a future expiry", () => {
    service.writeSnapshot("tok", "ref", "1", "alice", "alice@x.com", '["ROLE_USER"]');

    expect(localStorage.getItem(LS_SNAPSHOT_TOKEN)).toBe("tok");
    expect(localStorage.getItem(LS_SNAPSHOT_REFRESH)).toBe("ref");
    expect(localStorage.getItem(LS_SNAPSHOT_USER_ID)).toBe("1");
    expect(localStorage.getItem(LS_SNAPSHOT_USERNAME)).toBe("alice");
    expect(localStorage.getItem(LS_SNAPSHOT_EMAIL)).toBe("alice@x.com");
    expect(localStorage.getItem(LS_SNAPSHOT_ROLES)).toBe('["ROLE_USER"]');

    const expiry = parseInt(localStorage.getItem(LS_SNAPSHOT_EXPIRY)!, 10);
    expect(expiry).toBeGreaterThan(Date.now());
  });

  it("clearSnapshot should remove all snapshot keys from localStorage", () => {
    service.writeSnapshot("tok", "ref", "1", "alice", "a@x.com", "[]");
    service.clearSnapshot();

    expect(localStorage.getItem(LS_SNAPSHOT_TOKEN)).toBeNull();
    expect(localStorage.getItem(LS_SNAPSHOT_REFRESH)).toBeNull();
    expect(localStorage.getItem(LS_SNAPSHOT_USER_ID)).toBeNull();
    expect(localStorage.getItem(LS_SNAPSHOT_USERNAME)).toBeNull();
    expect(localStorage.getItem(LS_SNAPSHOT_EMAIL)).toBeNull();
    expect(localStorage.getItem(LS_SNAPSHOT_ROLES)).toBeNull();
    expect(localStorage.getItem(LS_SNAPSHOT_EXPIRY)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // tryRestoreFromSnapshot
  // ---------------------------------------------------------------------------

  it("tryRestoreFromSnapshot should copy localStorage snapshot into sessionStorage when sessionStorage is empty", () => {
    // Pre-populate a valid snapshot
    const expiry = Date.now() + 20_000;
    localStorage.setItem(LS_SNAPSHOT_TOKEN, "valid-token");
    localStorage.setItem(LS_SNAPSHOT_REFRESH, "valid-refresh");
    localStorage.setItem(LS_SNAPSHOT_USER_ID, "42");
    localStorage.setItem(LS_SNAPSHOT_USERNAME, "bob");
    localStorage.setItem(LS_SNAPSHOT_EMAIL, "bob@x.com");
    localStorage.setItem(LS_SNAPSHOT_ROLES, '["ROLE_ADMIN"]');
    localStorage.setItem(LS_SNAPSHOT_EXPIRY, String(expiry));

    sessionStorage.clear(); // ensure empty tab
    service.tryRestoreFromSnapshot();

    expect(sessionStorage.getItem("access_token")).toBe("valid-token");
    expect(sessionStorage.getItem("refresh_token")).toBe("valid-refresh");
    expect(sessionStorage.getItem("user_id")).toBe("42");
    expect(sessionStorage.getItem("username")).toBe("bob");
    expect(sessionStorage.getItem("email")).toBe("bob@x.com");
    expect(sessionStorage.getItem("roles")).toBe('["ROLE_ADMIN"]');
  });

  it("tryRestoreFromSnapshot should NOT overwrite an existing sessionStorage token", () => {
    sessionStorage.setItem("access_token", "existing-token");
    localStorage.setItem(LS_SNAPSHOT_TOKEN, "other-token");
    localStorage.setItem(LS_SNAPSHOT_EXPIRY, String(Date.now() + 20_000));

    service.tryRestoreFromSnapshot();

    expect(sessionStorage.getItem("access_token")).toBe("existing-token");
  });

  it("tryRestoreFromSnapshot should ignore an expired snapshot", () => {
    localStorage.setItem(LS_SNAPSHOT_TOKEN, "old-token");
    localStorage.setItem(LS_SNAPSHOT_EXPIRY, String(Date.now() - 1)); // already expired

    service.tryRestoreFromSnapshot();

    expect(sessionStorage.getItem("access_token")).toBeNull();
  });

  it("tryRestoreFromSnapshot should do nothing when no expiry key exists", () => {
    service.tryRestoreFromSnapshot();
    expect(sessionStorage.getItem("access_token")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // BroadcastChannel messaging
  // ---------------------------------------------------------------------------

  it("broadcastLogin should post a LOGIN message to the channel", () => {
    service.broadcastLogin("tok", "ref", "1", "alice", "a@x.com", "[]");
    expect(postedMessages).toHaveLength(1);
    expect(postedMessages[0]).toEqual({
      type: "LOGIN",
      accessToken: "tok",
      refreshToken: "ref",
      userId: "1",
      username: "alice",
      email: "a@x.com",
      roles: "[]",
    });
  });

  it("broadcastRefresh should post a REFRESH message to the channel", () => {
    service.broadcastRefresh("new-tok", "new-ref");
    expect(postedMessages).toHaveLength(1);
    expect(postedMessages[0]).toEqual({
      type: "REFRESH",
      accessToken: "new-tok",
      refreshToken: "new-ref",
    });
  });

  it("broadcastLogout should post a LOGOUT message to the channel", () => {
    service.broadcastLogout();
    expect(postedMessages).toHaveLength(1);
    expect(postedMessages[0]).toEqual({ type: "LOGOUT" });
  });

  // ---------------------------------------------------------------------------
  // Incoming message handling
  // ---------------------------------------------------------------------------

  it("handleMessage LOGIN should sync tokens into sessionStorage when sessionStorage is empty", () => {
    // Simulate incoming LOGIN from another tab
    mockChannel.onmessage({
      data: {
        type: "LOGIN",
        accessToken: "remote-tok",
        refreshToken: "remote-ref",
        userId: "99",
        username: "carol",
        email: "carol@x.com",
        roles: '["ROLE_USER"]',
      },
    });

    expect(sessionStorage.getItem("access_token")).toBe("remote-tok");
    expect(sessionStorage.getItem("refresh_token")).toBe("remote-ref");
    expect(sessionStorage.getItem("user_id")).toBe("99");
    expect(sessionStorage.getItem("username")).toBe("carol");
    expect(sessionStorage.getItem("email")).toBe("carol@x.com");
  });

  it("handleMessage LOGIN should NOT overwrite when sessionStorage already has a token", () => {
    sessionStorage.setItem("access_token", "my-tok");

    mockChannel.onmessage({
      data: {
        type: "LOGIN",
        accessToken: "remote-tok",
        refreshToken: "remote-ref",
        userId: "99",
        username: "carol",
        email: "carol@x.com",
        roles: "[]",
      },
    });

    expect(sessionStorage.getItem("access_token")).toBe("my-tok");
  });

  it("handleMessage REFRESH should update access_token in sessionStorage", () => {
    sessionStorage.setItem("access_token", "old-tok");
    sessionStorage.setItem("refresh_token", "old-ref");

    mockChannel.onmessage({
      data: { type: "REFRESH", accessToken: "refreshed-tok", refreshToken: "refreshed-ref" },
    });

    expect(sessionStorage.getItem("access_token")).toBe("refreshed-tok");
    expect(sessionStorage.getItem("refresh_token")).toBe("refreshed-ref");
  });

  it("handleMessage LOGOUT should clear all auth keys from sessionStorage", () => {
    sessionStorage.setItem("access_token", "tok");
    sessionStorage.setItem("refresh_token", "ref");
    sessionStorage.setItem("user_id", "1");
    sessionStorage.setItem("username", "alice");
    sessionStorage.setItem("email", "a@x.com");
    sessionStorage.setItem("roles", "[]");

    mockChannel.onmessage({ data: { type: "LOGOUT" } });

    expect(sessionStorage.getItem("access_token")).toBeNull();
    expect(sessionStorage.getItem("refresh_token")).toBeNull();
    expect(sessionStorage.getItem("user_id")).toBeNull();
    expect(sessionStorage.getItem("username")).toBeNull();
    expect(sessionStorage.getItem("email")).toBeNull();
    expect(sessionStorage.getItem("roles")).toBeNull();
  });

  it("handleMessage should be a no-op for unknown message types", () => {
    sessionStorage.setItem("access_token", "safe-tok");
    mockChannel.onmessage({ data: { type: "UNKNOWN" } });
    expect(sessionStorage.getItem("access_token")).toBe("safe-tok");
  });
});
