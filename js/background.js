import {
  DEFAULT_CATEGORY,
  MAX_TICK_DELTA_MS,
  DEFAULT_IDLE_SECONDS,
  toLocalDateKey,
  defaultSettings,
  emptyDay,
  createVault,
  assertSafeStoredSite,
  initialRuntimeState,
  deriveTarget,
} from "./tracker.js";

class TrackingEngine {
  constructor(
    store,
    newId = () => crypto.randomUUID(),
    maxDeltaMs = MAX_TICK_DELTA_MS,
  ) {
    this.store = store;
    this.newId = newId;
    this.maxDeltaMs = maxDeltaMs;
  }

  async handle(event, prev) {
    const { snapshot } = event;
    const settings = await this.store.getSettings();
    const target = deriveTarget(snapshot, settings);
    const credited = await this.creditElapsed(prev, snapshot.now);

    let state = {
      ...prev,
      lastTickAt: snapshot.now,
      chromeFocused: target.chromeFocused,
      idleState: snapshot.idleState,
      isAccruing: false,
    };

    const switched =
      Boolean(state.sessionId) &&
      (state.domain !== target.domain ||
        state.hostname !== target.hostname ||
        state.tabId !== target.tabId);

    let closedSessionId = null;

    if (state.sessionId && (!target.canAccrue || switched)) {
      closedSessionId = await this.closeSession(state.sessionId, snapshot.now);
      state = {
        ...state,
        sessionId: null,
        domain: null,
        hostname: null,
        title: undefined,
        categoryId: null,
        tabId: null,
        windowId: null,
      };
    }

    if (target.canAccrue && target.domain && target.hostname) {
      if (!state.sessionId) {
        const session = await this.openSession({
          domain: target.domain,
          hostname: target.hostname,
          title: target.title,
          categoryId: target.categoryId,
          tabId: target.tabId,
          windowId: target.windowId,
          now: snapshot.now,
        });

        state = {
          ...state,
          sessionId: session.id,
          domain: session.domain,
          hostname: session.hostname,
          title: session.title,
          categoryId: session.categoryId,
          tabId: session.tabId ?? null,
          windowId: session.windowId ?? null,
          isAccruing: true,
        };

        if (switched) await this.recordTabSwitch(snapshot.now);
      } else {
        const sessionId = state.sessionId;
        state = {
          ...state,
          isAccruing: true,
          title: target.title,
        };
        await this.touchSessionTitle(sessionId, target.title);
      }

      if (
        event.type === "heartbeat" ||
        event.type === "recovery" ||
        event.type === "tab-activated"
      ) {
        await this.sampleTabCount(snapshot.now, snapshot.openTabCount);
      }
    }

    return { state, creditedMs: credited, switched, closedSessionId };
  }

  async creditElapsed(prev, now) {
    if (!prev.isAccruing || !prev.sessionId || prev.lastTickAt == null) {
      return 0;
    }

    const raw = now - prev.lastTickAt;
    if (raw <= 0) return 0;

    const delta = Math.min(raw, this.maxDeltaMs);
    await this.addActiveMs(prev.sessionId, delta, now);
    return delta;
  }

  async addActiveMs(sessionId, delta, now) {
    const session = await this.store.getSession(sessionId);
    if (!session) return;

    session.activeMs += delta;
    await this.store.putSession(session);

    const date = toLocalDateKey(now);
    const day = (await this.store.getDay(date)) ?? emptyDay(date, now);
    day.totalActiveMs += delta;
    day.byCategory[session.categoryId] =
      (day.byCategory[session.categoryId] ?? 0) + delta;
    day.byDomain[session.domain] = (day.byDomain[session.domain] ?? 0) + delta;
    day.updatedAt = now;
    await this.store.putDay(day);
  }

  async openSession(input) {
    const session = {
      id: this.newId(),
      domain: input.domain,
      hostname: input.hostname,
      categoryId: input.categoryId,
      startedAt: input.now,
      activeMs: 0,
    };
    if (input.title) session.title = input.title;
    if (input.tabId != null) session.tabId = input.tabId;
    if (input.windowId != null) session.windowId = input.windowId;

    await this.store.putSession(session);
    return session;
  }

  async closeSession(sessionId, now) {
    const session = await this.store.getSession(sessionId);
    if (session && session.endedAt == null) {
      session.endedAt = now;
      await this.store.putSession(session);
    }
    return sessionId;
  }

  async touchSessionTitle(sessionId, title) {
    if (!title) return;
    const session = await this.store.getSession(sessionId);
    if (!session || session.title === title) return;
    session.title = title;
    await this.store.putSession(session);
  }

  async recordTabSwitch(now) {
    const date = toLocalDateKey(now);
    const day = (await this.store.getDay(date)) ?? emptyDay(date, now);
    day.tabSwitches += 1;
    day.updatedAt = now;
    await this.store.putDay(day);
  }

  async sampleTabCount(now, count) {
    if (count < 0) return;
    const date = toLocalDateKey(now);
    const day = (await this.store.getDay(date)) ?? emptyDay(date, now);
    day.tabCountSamples.push(count);
    if (day.tabCountSamples.length > 500) {
      day.tabCountSamples = day.tabCountSamples.slice(-500);
    }
    day.updatedAt = now;
    await this.store.putDay(day);
  }
}

function scoreProductivity(byCategory, productiveCategories) {
  const counted = new Set(productiveCategories);
  let productiveMs = 0;
  let totalActiveMs = 0;

  for (const [key, ms] of Object.entries(byCategory)) {
    const value = ms ?? 0;
    if (value <= 0) continue;
    totalActiveMs += value;
    if (counted.has(key)) productiveMs += value;
  }

  if (totalActiveMs <= 0) {
    return {
      percent: null,
      level: null,
      productiveMs: 0,
      totalActiveMs: 0,
      countedCategories: [...counted],
    };
  }

  const percent = (productiveMs / totalActiveMs) * 100;
  return {
    percent,
    level: levelForPercent(percent),
    productiveMs,
    totalActiveMs,
    countedCategories: [...counted],
  };
}

function scoreDay(day, productiveCategories) {
  return scoreProductivity(day.byCategory, productiveCategories);
}

function levelForPercent(percent) {
  if (percent <= 25) return "drift";
  if (percent <= 50) return "mixed";
  if (percent <= 75) return "focused";
  return "locked-in";
}

function levelLabel(level) {
  switch (level) {
    case "drift":
      return "Drift";
    case "mixed":
      return "Mixed";
    case "focused":
      return "Focused";
    case "locked-in":
      return "Locked in";
  }
}

function defaultConfigIncludesUncategorized(productiveCategories) {
  return productiveCategories.includes(DEFAULT_CATEGORY);
}

const HEARTBEAT_ALARM = "webstill-heartbeat";
const HEARTBEAT_PERIOD_MINUTES = 0.5;
const SETTINGS_KEY = "webstill.settings";
const RUNTIME_STATE_KEY = "webstill.runtime";
const DB_NAME = "webstill";
const DB_VERSION = 1;
const SESSIONS = "sessions";
const DAYS = "days";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SESSIONS)) {
        const store = db.createObjectStore(SESSIONS, { keyPath: "id" });
        store.createIndex("startedAt", "startedAt", { unique: false });
        store.createIndex("domain", "domain", { unique: false });
      }
      if (!db.objectStoreNames.contains(DAYS)) {
        db.createObjectStore(DAYS, { keyPath: "date" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("indexedDB request failed"));
  });
}

class ChromeSessionStore {
  constructor(vault = createVault(false)) {
    this.dbPromise = null;
    this.vault = vault;
  }

  db() {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  async getSession(id) {
    const db = await this.db();
    const tx = db.transaction(SESSIONS, "readonly");
    const row = await idbReq(tx.objectStore(SESSIONS).get(id));
    return row ?? null;
  }

  async putSession(session) {
    assertSafeStoredSite({
      domain: session.domain,
      hostname: session.hostname,
    });
    const sealed = await this.vault.seal(session.id, session);
    const opened = await this.vault.open(sealed);
    const db = await this.db();
    const tx = db.transaction(SESSIONS, "readwrite");
    await idbReq(tx.objectStore(SESSIONS).put(opened));
  }

  async listSessions() {
    const db = await this.db();
    const tx = db.transaction(SESSIONS, "readonly");
    return await idbReq(tx.objectStore(SESSIONS).getAll());
  }

  async getDay(date) {
    const db = await this.db();
    const tx = db.transaction(DAYS, "readonly");
    const row = await idbReq(tx.objectStore(DAYS).get(date));
    return row ?? null;
  }

  async putDay(day) {
    const db = await this.db();
    const tx = db.transaction(DAYS, "readwrite");
    await idbReq(tx.objectStore(DAYS).put(day));
  }

  async getSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const raw = result[SETTINGS_KEY];
    if (!raw) return defaultSettings();
    return {
      ...defaultSettings(),
      ...raw,
      productiveCategories:
        raw.productiveCategories ?? defaultSettings().productiveCategories,
      categoryOverrides: raw.categoryOverrides ?? {},
    };
  }

  async putSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }
}

async function loadRuntimeState() {
  const result = await chrome.storage.local.get(RUNTIME_STATE_KEY);
  const raw = result[RUNTIME_STATE_KEY];
  return raw ? { ...initialRuntimeState(), ...raw } : initialRuntimeState();
}

async function saveRuntimeState(state) {
  await chrome.storage.local.set({ [RUNTIME_STATE_KEY]: state });
}

async function captureSnapshot(now = Date.now()) {
  const windowIdNone = chrome.windows.WINDOW_ID_NONE;
  const focusedWindowId = await getFocusedWindowId(windowIdNone);
  const idleState = await queryIdleState();
  const openTabCount = await countOpenTabs();

  let activeTab = null;

  if (focusedWindowId !== windowIdNone) {
    const tabs = await chrome.tabs.query({
      active: true,
      windowId: focusedWindowId,
    });
    const tab = tabs[0];
    if (tab?.id != null) {
      activeTab = {
        id: tab.id,
        windowId: tab.windowId,
        active: tab.active ?? true,
        url: tab.url,
        title: tab.title,
      };
    }
  }

  return {
    now,
    focusedWindowId,
    windowIdNone,
    activeTab,
    idleState,
    openTabCount,
  };
}

async function getFocusedWindowId(windowIdNone) {
  try {
    const win = await chrome.windows.getLastFocused({ populate: false });
    if (!win.focused) return windowIdNone;
    return win.id ?? windowIdNone;
  } catch {
    return windowIdNone;
  }
}

async function queryIdleState() {
  const bag = await chrome.storage.local.get(SETTINGS_KEY);
  const idleSeconds = bag[SETTINGS_KEY]?.idleSeconds ?? 60;

  return new Promise((resolve) => {
    chrome.idle.queryState(idleSeconds, (state) => {
      if (state === "locked") resolve("locked");
      else if (state === "idle") resolve("idle");
      else resolve("active");
    });
  });
}

async function countOpenTabs() {
  try {
    return (await chrome.tabs.query({})).length;
  } catch {
    return 0;
  }
}

const store = new ChromeSessionStore();
const engine = new TrackingEngine(store);

let ready = false;

async function ensureSettings() {
  const existing = await chrome.storage.local.get(SETTINGS_KEY);
  if (!existing[SETTINGS_KEY]) {
    await store.putSettings(defaultSettings());
  }
}

async function ensureHeartbeat() {
  const existing = await chrome.alarms.get(HEARTBEAT_ALARM);
  if (!existing) {
    await chrome.alarms.create(HEARTBEAT_ALARM, {
      periodInMinutes: HEARTBEAT_PERIOD_MINUTES,
    });
  }
}

async function bootstrap() {
  if (ready) return;
  await ensureSettings();
  await ensureHeartbeat();

  const settings = await store.getSettings();
  chrome.idle.setDetectionInterval(settings.idleSeconds || DEFAULT_IDLE_SECONDS);

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }

  ready = true;
}

async function run(type) {
  await bootstrap();
  const prev = await loadRuntimeState();
  const snapshot = await captureSnapshot();
  const result = await engine.handle({ type, snapshot }, prev);
  await saveRuntimeState(result.state);
  return result.state;
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureSettings();
    await ensureHeartbeat();
    await saveRuntimeState(initialRuntimeState(Date.now()));
    await run("recovery");
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await ensureHeartbeat();
    await run("recovery");
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) void run("heartbeat");
});

chrome.tabs.onActivated.addListener(() => {
  void run("tab-activated");
});

chrome.tabs.onUpdated.addListener((_tabId, change) => {
  if (change.status === "complete" || change.url || change.title) {
    void run("tab-updated");
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  void run("focus-changed");
});

chrome.idle.onStateChanged.addListener(() => {
  void run("idle-changed");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.type !== "webstill.getToday" &&
    message?.type !== "webstill.getDashboard"
  ) {
    return false;
  }

  void (async () => {
    const settings = await store.getSettings();
    const date = toLocalDateKey(Date.now());
    const day = await store.getDay(date);
    const score = day ? scoreDay(day, settings.productiveCategories) : null;
    const runtime = await loadRuntimeState();

    if (message.type === "webstill.getToday") {
      sendResponse({ day, score, runtime });
      return;
    }

    const sessions = await store.listSessions();
    sendResponse({ date, day, score, runtime, sessions });
  })();

  return true;
});

void (async () => {
  await bootstrap();
  await run("recovery");
})();

