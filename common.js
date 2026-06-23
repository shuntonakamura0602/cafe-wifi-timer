const STORAGE_KEYS = Object.freeze({
  CAFES: "cafes",
  TIMER: "timerState"
});

const TIMER_STATUS = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  FINISHED: "finished"
});

const NOTIFICATION_OFFSETS = Object.freeze([5, 1, 0]);

const DEFAULT_TIMER_STATE = Object.freeze({
  status: TIMER_STATUS.IDLE,
  cafeId: null,
  cafeName: "",
  durationMinutes: 0,
  endAt: null,
  startedAt: null,
  notifiedOffsets: []
});

function makeId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCafe(rawCafe) {
  return {
    id: String(rawCafe.id || makeId("cafe")),
    name: String(rawCafe.name || "").trim(),
    durationMinutes: Math.max(1, Number.parseInt(rawCafe.durationMinutes, 10) || 60),
    loginUrl: String(rawCafe.loginUrl || "").trim()
  };
}

function normalizeTimerState(rawTimer) {
  return {
    ...DEFAULT_TIMER_STATE,
    ...(rawTimer || {}),
    notifiedOffsets: Array.isArray(rawTimer?.notifiedOffsets) ? rawTimer.notifiedOffsets : []
  };
}

function getRemainingMs(timer, now = Date.now()) {
  if (!timer || timer.status !== TIMER_STATUS.RUNNING || !timer.endAt) {
    return 0;
  }
  return Math.max(0, timer.endAt - now);
}

function getRemainingMinutesForBadge(timer, now = Date.now()) {
  const remainingMs = getRemainingMs(timer, now);
  if (remainingMs <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(remainingMs / 60000));
}

function formatRemaining(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(timestamp) {
  if (!timestamp) {
    return "-";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toOriginPattern(value) {
  if (!isHttpUrl(value)) {
    return null;
  }
  const url = new URL(value);
  return `${url.origin}/*`;
}

function loginUrlMatches(targetUrl, registeredUrl) {
  if (!isHttpUrl(targetUrl) || !isHttpUrl(registeredUrl)) {
    return false;
  }

  const target = new URL(targetUrl);
  const registered = new URL(registeredUrl);
  const normalizedRegisteredPath = registered.pathname.endsWith("/")
    ? registered.pathname
    : registered.pathname.replace(/\/$/, "");

  return target.origin === registered.origin
    && (target.pathname === registered.pathname
      || target.pathname.startsWith(`${normalizedRegisteredPath}/`));
}

function chromeStorageGet(defaults) {
  return chrome.storage.local.get(defaults);
}

function chromeStorageSet(values) {
  return chrome.storage.local.set(values);
}
