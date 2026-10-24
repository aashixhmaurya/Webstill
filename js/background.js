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
