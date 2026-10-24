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

function categoryLabel(id) {
  return CATEGORIES.find((cat) => cat.id === id)?.label ?? "Uncategorized";
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h <= 0 && m <= 0) {
    if (ms > 0 && ms < 60_000) return "<1m";
    return "0m";
  }
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDateHeading(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
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

function localDayBounds(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function sessionsOverlappingDate(sessions, dateKey, now) {
  const { start, end } = localDayBounds(dateKey);
  return sessions.filter((session) => {
    const from = session.startedAt;
    const to = session.endedAt ?? now;
    return from < end && to > start;
  });
}

function categoryRows(day) {
  const total = day?.totalActiveMs ?? 0;
  if (!day || total <= 0) return [];

  return CATEGORIES.flatMap((cat) => {
    const ms = day.byCategory[cat.id] ?? 0;
    if (ms <= 0) return [];
    return [
      {
        id: cat.id,
        label: cat.label,
        ms,
        share: ms / total,
      },
    ];
  });
}

function siteRows(day, sessions) {
  const totals = new Map();

  for (const session of sessions) {
    if (session.activeMs <= 0) continue;
    const prev = totals.get(session.domain);
    if (!prev) {
      totals.set(session.domain, {
        ms: session.activeMs,
        categoryId: session.categoryId,
      });
    } else {
      prev.ms += session.activeMs;
      prev.categoryId = session.categoryId;
    }
  }

  if (totals.size === 0 && day) {
    for (const [domain, ms] of Object.entries(day.byDomain)) {
      if (ms <= 0) continue;
      totals.set(domain, {
        ms,
        categoryId: classifySite({ domain, hostname: domain }),
      });
    }
  }

  return [...totals.entries()]
    .map(([domain, row]) => ({ domain, ...row }))
    .sort((a, b) => b.ms - a.ms);
}

function hourlyFromSessions(sessions, dateKey, now) {
  const { start, end } = localDayBounds(dateKey);
  const hours = [];
  for (let hour = 0; hour < 24; hour++) {
    hours.push({ hour, ms: 0 });
  }

  const hourMs = 60 * 60 * 1000;

  for (const session of sessions) {
    if (session.activeMs <= 0) continue;
    const winStart = Math.max(session.startedAt, start);
    const winEnd = Math.min(session.endedAt ?? now, end);
    const win = winEnd - winStart;
    if (win <= 0) continue;

    for (const bucket of hours) {
      const hStart = start + bucket.hour * hourMs;
      const hEnd = hStart + hourMs;
      const overlap = Math.min(winEnd, hEnd) - Math.max(winStart, hStart);
      if (overlap > 0) {
        bucket.ms += (session.activeMs * overlap) / win;
      }
    }
  }

  return hours;
}

function hasHourlySignal(hours) {
  return hours.some((bucket) => bucket.ms > 0);
}

function renderPopup(data) {
  const headline = document.getElementById("headline");
  const subline = document.getElementById("subline");
  const meta = document.getElementById("meta");
  if (!headline || !subline || !meta) return;

  const total = data.day?.totalActiveMs ?? 0;
  const percent = data.score?.percent;
  const level = data.score?.level;

  if (total <= 0) {
    headline.textContent = "0m";
    subline.textContent = data.runtime.isAccruing
      ? "Tracking now"
      : "No active time yet today";
  } else if (percent == null || level == null) {
    headline.textContent = formatDuration(total);
    subline.textContent = "Active today";
  } else {
    headline.textContent = `${Math.round(percent)}%`;
    subline.textContent = `${levelLabel(level)} · ${formatDuration(total)} today`;
  }

  if (data.runtime.isAccruing && data.runtime.domain) {
    meta.textContent = `Now · ${data.runtime.domain}`;
  } else if (data.runtime.idleState !== "active") {
    meta.textContent = "Paused · idle";
  } else if (!data.runtime.chromeFocused) {
    meta.textContent = "Paused · Chrome unfocused";
  } else {
    meta.textContent = "Still";
  }
}

async function loadPopup() {
  try {
    const data = await chrome.runtime.sendMessage({
      type: "webstill.getToday",
    });
    renderPopup(data);
  } catch {
    const headline = document.getElementById("headline");
    const subline = document.getElementById("subline");
    if (headline) headline.textContent = "—";
    if (subline) subline.textContent = "Open Webstill while Chrome is running";
  }
}

async function openDashboard() {
  const win = await chrome.windows.getCurrent();
  if (win.id == null || !chrome.sidePanel?.open) return;
  await chrome.sidePanel.open({ windowId: win.id });
  window.close();
}

function trackingStatus(runtime) {
  if (runtime.isAccruing && runtime.domain) return `Tracking · ${runtime.domain}`;
  if (runtime.idleState !== "active") return "Paused · idle";
  if (!runtime.chromeFocused) return "Paused · Chrome unfocused";
  return "Still";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title) {
  const wrap = el("section", "section");
  wrap.append(el("h2", undefined, title));
  return wrap;
}

function renderDashboard(data) {
  const banner = document.getElementById("banner");
  const app = document.getElementById("app");
  const dateLine = document.getElementById("date-line");
  if (!banner || !app || !dateLine) return;

  dateLine.textContent = formatDateHeading(data.date);
  app.replaceChildren();

  const total = data.day?.totalActiveMs ?? 0;
  if (total <= 0) {
    banner.hidden = false;
    banner.textContent =
      "No active time yet today. Keep Chrome focused on a tab — Webstill only counts the tab you are actually looking at.";
    app.hidden = true;
    return;
  }

  banner.hidden = true;
  app.hidden = false;

  const percent = data.score?.percent;
  const level = data.score?.level;

  const pulse = el("section", "pulse");
  const left = el("div");
  const headline =
    percent == null || level == null
      ? formatDuration(total)
      : `${Math.round(percent)}%`;
  left.append(el("p", "big", headline));
  left.append(
    el(
      "p",
      "pulse-copy",
      level
        ? `${levelLabel(level)} · ${formatDuration(total)} active`
        : `${formatDuration(total)} active today`,
    ),
  );
  pulse.append(left);
  pulse.append(el("p", "status", trackingStatus(data.runtime)));
  app.append(pulse);

  const cats = categoryRows(data.day);
  const where = section("Where time went");
  if (cats.length === 0) {
    where.append(
      el("p", "note", "Categories will show here once today's time has a breakdown."),
    );
  } else {
    for (const row of cats) {
      const line = el("div", "cat-row");
      const head = el("div", "row-head");
      head.append(el("span", "label", row.label));
      head.append(el("span", "num", formatDuration(row.ms)));
      const track = el("div", "track");
      const fill = el("div", "fill");
      fill.style.width = `${Math.max(row.share * 100, 1.5)}%`;
      track.append(fill);
      line.append(head, track);
      where.append(line);
    }
  }
  app.append(where);

  const todaySessions = sessionsOverlappingDate(
    data.sessions,
    data.date,
    Date.now(),
  );
  const sites = siteRows(data.day, todaySessions);
  const siteSection = section("Sites");
  if (sites.length === 0) {
    siteSection.append(el("p", "note", "No domains stored for today yet."));
  } else {
    for (const site of sites) {
      const line = el("div", "site-row");
      const head = el("div", "row-head");
      const name = el("div");
      name.append(el("span", "label", site.domain));
      name.append(el("span", "muted", categoryLabel(site.categoryId)));
      head.append(name);
      head.append(el("span", "num", formatDuration(site.ms)));
      line.append(head);
      siteSection.append(line);
    }
  }
  app.append(siteSection);

  const hours = hourlyFromSessions(todaySessions, data.date, Date.now());
  const rhythm = section("Today");
  if (!hasHourlySignal(hours)) {
    rhythm.append(
      el(
        "p",
        "note",
        "Hourly view needs session history. Category and site totals above still use today's saved rollup.",
      ),
    );
  } else {
    const max = Math.max(...hours.map((h) => h.ms), 1);
    const chart = el("div", "hours");
    for (const bucket of hours) {
      const col = el("div", bucket.ms > 0 ? "hour" : "hour is-empty");
      col.title = `${String(bucket.hour).padStart(2, "0")}:00 · ${formatDuration(bucket.ms)}`;
      const bar = el("span");
      bar.style.height = `${Math.max((bucket.ms / max) * 100, bucket.ms > 0 ? 6 : 2)}%`;
      col.append(bar);
      chart.append(col);
    }
    rhythm.append(chart);
    const axis = el("div", "axis");
    axis.append(el("span", undefined, "00"));
    axis.append(el("span", undefined, "06"));
    axis.append(el("span", undefined, "12"));
    axis.append(el("span", undefined, "18"));
    axis.append(el("span", undefined, "24"));
    rhythm.append(axis);
  }
  app.append(rhythm);

  app.append(el("p", "foot", "Stored only on this device."));
}

async function loadDashboard() {
  const banner = document.getElementById("banner");
  if (!banner) return;
  try {
    const data = await chrome.runtime.sendMessage({
      type: "webstill.getDashboard",
    });
    renderDashboard(data);
  } catch {
    banner.hidden = false;
    banner.textContent =
      "Could not read today's data. Keep Webstill enabled and reopen this page.";
  }
}

if (document.getElementById("app")) {
  void loadDashboard();
} else {
  document.getElementById("open-day")?.addEventListener("click", () => {
    void openDashboard();
  });
  void loadPopup();
}
