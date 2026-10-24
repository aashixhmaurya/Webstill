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

function render(data) {
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

async function load() {
  try {
    const data = await chrome.runtime.sendMessage({
      type: "webstill.getToday",
    });
    render(data);
  } catch {
    const headline = document.getElementById("headline");
    const subline = document.getElementById("subline");
    if (headline) headline.textContent = "—";
    if (subline) subline.textContent = "Open Webstill while Chrome is running";
  }
}

void load();
