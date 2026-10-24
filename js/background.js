const CATEGORY_IDS = [
  "work",
  "education",
  "entertainment",
  "gaming",
  "social",
  "shopping",
  "news",
  "utilities",
  "uncategorized",
];

const CATEGORIES = [
  { id: "work", label: "Work", productiveByDefault: true },
  { id: "education", label: "Education", productiveByDefault: true },
  { id: "utilities", label: "Utilities", productiveByDefault: false },
  { id: "news", label: "News", productiveByDefault: false },
  { id: "social", label: "Social", productiveByDefault: false },
  { id: "entertainment", label: "Entertainment", productiveByDefault: false },
  { id: "gaming", label: "Gaming", productiveByDefault: false },
  { id: "shopping", label: "Shopping", productiveByDefault: false },
  { id: "uncategorized", label: "Uncategorized", productiveByDefault: false },
];

const DEFAULT_CATEGORY = "uncategorized";

const DOMAIN_CATEGORY_MAP = {
  "github.com": "work",
  "gitlab.com": "work",
  "bitbucket.org": "work",
  "notion.so": "work",
  "notion.com": "work",
  "linear.app": "work",
  "atlassian.com": "work",
  "jira.com": "work",
  "trello.com": "work",
  "asana.com": "work",
  "slack.com": "work",
  "figma.com": "work",
  "docs.google.com": "work",
  "sheets.google.com": "work",
  "drive.google.com": "work",
  "mail.google.com": "work",
  "outlook.live.com": "work",
  "outlook.office.com": "work",
  "office.com": "work",
  "stackoverflow.com": "work",
  "stackexchange.com": "work",
  "vercel.com": "work",
  "netlify.com": "work",
  "cloudflare.com": "work",
  "npmjs.com": "work",
  "cursor.com": "work",
  "wikipedia.org": "education",
  "khanacademy.org": "education",
  "coursera.org": "education",
  "udemy.com": "education",
  "edx.org": "education",
  "brilliant.org": "education",
  "developer.mozilla.org": "education",
  "mdn.io": "education",
  "youtube.com": "entertainment",
  "youtu.be": "entertainment",
  "netflix.com": "entertainment",
  "twitch.tv": "entertainment",
  "spotify.com": "entertainment",
  "reddit.com": "entertainment",
  "imgur.com": "entertainment",
  "store.steampowered.com": "gaming",
  "steampowered.com": "gaming",
  "epicgames.com": "gaming",
  "roblox.com": "gaming",
  "minecraft.net": "gaming",
  "ign.com": "gaming",
  "twitter.com": "social",
  "x.com": "social",
  "facebook.com": "social",
  "instagram.com": "social",
  "linkedin.com": "social",
  "tiktok.com": "social",
  "discord.com": "social",
  "whatsapp.com": "social",
  "amazon.com": "shopping",
  "amazon.in": "shopping",
  "flipkart.com": "shopping",
  "ebay.com": "shopping",
  "etsy.com": "shopping",
  "bbc.com": "news",
  "bbc.co.uk": "news",
  "cnn.com": "news",
  "nytimes.com": "news",
  "theguardian.com": "news",
  "reuters.com": "news",
  "news.ycombinator.com": "news",
  "google.com": "utilities",
  "bing.com": "utilities",
  "duckduckgo.com": "utilities",
  "maps.google.com": "utilities",
  "translate.google.com": "utilities",
  "pay.google.com": "utilities",
  "bankofamerica.com": "utilities",
};

const IGNORED_PROTOCOLS = new Set([
  "chrome:",
  "chrome-extension:",
  "devtools:",
  "about:",
  "edge:",
  "brave:",
  "opera:",
  "vivaldi:",
  "file:",
  "data:",
  "blob:",
  "view-source:",
]);

function looksLikeIp(hostname) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  return hostname.includes(":");
}

function toRegistrableDomain(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;

  const multiPartTlds = new Set([
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "co.in",
    "com.au",
    "com.br",
    "co.jp",
    "co.kr",
    "com.mx",
    "co.nz",
    "com.sg",
    "co.za",
  ]);

  const lastTwo = parts.slice(-2).join(".");
  if (multiPartTlds.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function parseSiteUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { domain: "", hostname: "", trackable: false, reason: "missing-url" };
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { domain: "", hostname: "", trackable: false, reason: "invalid-url" };
  }

  if (IGNORED_PROTOCOLS.has(url.protocol)) {
    return {
      domain: "",
      hostname: "",
      trackable: false,
      reason: `ignored-protocol:${url.protocol}`,
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      domain: "",
      hostname: "",
      trackable: false,
      reason: `unsupported-protocol:${url.protocol}`,
    };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || looksLikeIp(hostname)) {
    return {
      domain: hostname || "",
      hostname,
      trackable: false,
      reason: "local-or-ip",
    };
  }

  return {
    domain: toRegistrableDomain(hostname),
    hostname,
    trackable: true,
  };
}

function classifySite(input) {
  const overrides = input.overrides ?? {};
  const host = input.hostname.toLowerCase();
  const domain = input.domain.toLowerCase();

  if (overrides[host]) return overrides[host];
  if (overrides[domain]) return overrides[domain];

  if (DOMAIN_CATEGORY_MAP[host]) return DOMAIN_CATEGORY_MAP[host];
  if (DOMAIN_CATEGORY_MAP[domain]) return DOMAIN_CATEGORY_MAP[domain];

  const parts = host.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (DOMAIN_CATEGORY_MAP[candidate]) return DOMAIN_CATEGORY_MAP[candidate];
  }

  return DEFAULT_CATEGORY;
}

function defaultProductiveCategories() {
  return CATEGORIES.filter((c) => c.productiveByDefault).map((c) => c.id);
}

function isCategoryId(value) {
  return CATEGORY_IDS.includes(value);
}

function categoryLabel(id) {
  return CATEGORIES.find((cat) => cat.id === id)?.label ?? "Uncategorized";
}

const MAX_TICK_DELTA_MS = 45_000;
const DEFAULT_IDLE_SECONDS = 60;
const MAX_TITLE_LENGTH = 80;
const WINDOW_ID_NONE = -1;

function sanitizeTitle(title, maxLength) {
  if (!title) return undefined;
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

function assertSafeStoredSite(value) {
  const joined = `${value.domain}\0${value.hostname ?? ""}`;
  if (joined.includes("?") || joined.includes("#") || joined.includes("@")) {
    throw new Error("Refusing to store URL query, hash, or credentials");
  }
  if (value.domain.includes("/") || value.hostname?.includes("/")) {
    throw new Error("Refusing to store URL path in domain fields");
  }
}

function toLocalDateKey(epochMs, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

function defaultSettings() {
  return {
    idleSeconds: DEFAULT_IDLE_SECONDS,
    productiveCategories: defaultProductiveCategories(),
    categoryOverrides: {},
    retentionDays: 90,
    encryptionEnabled: false,
  };
}

function emptyDay(date, now = Date.now()) {
  return {
    date,
    totalActiveMs: 0,
    byCategory: {},
    byDomain: {},
    tabSwitches: 0,
    tabCountSamples: [],
    updatedAt: now,
  };
}

class PlainVault {
  constructor() {
    this.mode = "none";
  }

  async seal(id, payload) {
    return {
      id,
      v: 1,
      encryption: "none",
      payload,
      updatedAt: Date.now(),
    };
  }

  async open(record) {
    if (record.encryption !== "none") {
      throw new Error(
        `PlainVault cannot open encryption mode "${record.encryption}"`,
      );
    }
    if (typeof record.payload === "string") {
      throw new Error("PlainVault received ciphertext payload");
    }
    return record.payload;
  }
}

function createVault(encryptionEnabled) {
  if (encryptionEnabled) {
    throw new Error("Encryption not implemented yet");
  }
  return new PlainVault();
}

class MemorySessionStore {
  constructor(vault = createVault(false)) {
    this.sessions = new Map();
    this.days = new Map();
    this.settings = defaultSettings();
    this.vault = vault;
  }

  async getSession(id) {
    return this.sessions.get(id) ?? null;
  }

  async putSession(session) {
    assertSafeStoredSite({
      domain: session.domain,
      hostname: session.hostname,
    });
    const sealed = await this.vault.seal(session.id, session);
    const opened = await this.vault.open(sealed);
    this.sessions.set(session.id, { ...opened });
  }

  async listSessions() {
    return [...this.sessions.values()].map((s) => ({ ...s }));
  }

  async getDay(date) {
    const day = this.days.get(date);
    return day ? structuredClone(day) : null;
  }

  async putDay(day) {
    this.days.set(day.date, structuredClone(day));
  }

  async getSettings() {
    return structuredClone(this.settings);
  }

  async putSettings(settings) {
    this.settings = structuredClone(settings);
  }
}

function initialRuntimeState(now = 0) {
  return {
    sessionId: null,
    domain: null,
    hostname: null,
    categoryId: null,
    tabId: null,
    windowId: null,
    lastTickAt: now || null,
    chromeFocused: false,
    idleState: "active",
    isAccruing: false,
  };
}

function deriveTarget(snapshot, settings) {
  const none = snapshot.windowIdNone ?? WINDOW_ID_NONE;
  const chromeFocused =
    snapshot.focusedWindowId !== none && snapshot.focusedWindowId !== undefined;

  const idle = {
    canAccrue: false,
    chromeFocused,
    domain: null,
    hostname: null,
    categoryId: "uncategorized",
    tabId: null,
    windowId: null,
  };

  if (!chromeFocused) return idle;
  if (snapshot.idleState !== "active") return { ...idle, chromeFocused: true };
  if (!snapshot.activeTab?.active) return idle;
  if (snapshot.activeTab.windowId !== snapshot.focusedWindowId) return idle;

  const parsed = parseSiteUrl(snapshot.activeTab.url);
  if (!parsed.trackable) return { ...idle, chromeFocused: true };

  return {
    canAccrue: true,
    chromeFocused: true,
    domain: parsed.domain,
    hostname: parsed.hostname,
    title: sanitizeTitle(snapshot.activeTab.title, MAX_TITLE_LENGTH),
    categoryId: classifySite({
      domain: parsed.domain,
      hostname: parsed.hostname,
      overrides: settings.categoryOverrides,
    }),
    tabId: snapshot.activeTab.id,
    windowId: snapshot.activeTab.windowId,
  };
}

function clampDelta(rawMs, maxDeltaMs = MAX_TICK_DELTA_MS) {
  if (rawMs <= 0) return 0;
  return Math.min(rawMs, maxDeltaMs);
}

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
