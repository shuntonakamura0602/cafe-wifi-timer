importScripts("common.js");

const TIMER_ALARM = "cafeWifiTimer.tick";
const LOGIN_NOTIFICATION_PREFIX = "login-suggest:";
const TIMER_NOTIFICATION_PREFIX = "timer:";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({
    [STORAGE_KEYS.CAFES]: [],
    [STORAGE_KEYS.TIMER]: DEFAULT_TIMER_STATE
  }).then(async (stored) => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAFES]: stored[STORAGE_KEYS.CAFES],
      [STORAGE_KEYS.TIMER]: normalizeTimerState(stored[STORAGE_KEYS.TIMER])
    });
    await syncAll();
  });
});

chrome.runtime.onStartup.addListener(() => {
  syncAll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TIMER_ALARM) {
    syncAll();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes[STORAGE_KEYS.TIMER] || changes[STORAGE_KEYS.CAFES]) {
    syncAll();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: error.message || String(error) });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }
  detectLoginPage(tab.url, tabId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith(LOGIN_NOTIFICATION_PREFIX)) {
    chrome.action.openPopup?.();
  }
});

async function handleMessage(message) {
  switch (message?.type) {
    case "START_TIMER":
      return startTimer(message.payload);
    case "STOP_TIMER":
      return stopTimer();
    case "RESET_TIMER":
      return resetTimer();
    case "GET_STATE":
      return getFullState();
    case "REQUEST_LOGIN_PERMISSION":
      return requestLoginPermission(message.payload?.url);
    default:
      return { ok: false, error: "未対応の操作です。" };
  }
}

async function getFullState() {
  const stored = await chrome.storage.local.get({
    [STORAGE_KEYS.CAFES]: [],
    [STORAGE_KEYS.TIMER]: DEFAULT_TIMER_STATE
  });
  return {
    ok: true,
    cafes: stored[STORAGE_KEYS.CAFES].map(normalizeCafe),
    timer: normalizeTimerState(stored[STORAGE_KEYS.TIMER])
  };
}

async function startTimer(payload = {}) {
  const durationMinutes = Math.max(1, Number.parseInt(payload.durationMinutes, 10) || 0);
  if (!durationMinutes) {
    throw new Error("タイマー時間を指定してください。");
  }

  const now = Date.now();
  const timer = {
    status: TIMER_STATUS.RUNNING,
    cafeId: payload.cafeId || null,
    cafeName: String(payload.cafeName || "任意タイマー").trim() || "任意タイマー",
    durationMinutes,
    startedAt: now,
    endAt: now + durationMinutes * 60000,
    notifiedOffsets: []
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.TIMER]: timer });
  await syncAll();
  return { ok: true, timer };
}

async function stopTimer() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEYS.TIMER]: DEFAULT_TIMER_STATE });
  const timer = normalizeTimerState(stored[STORAGE_KEYS.TIMER]);
  const stopped = {
    ...timer,
    status: TIMER_STATUS.IDLE,
    endAt: null
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.TIMER]: stopped });
  await syncAll();
  return { ok: true, timer: stopped };
}

async function resetTimer() {
  await chrome.storage.local.set({ [STORAGE_KEYS.TIMER]: { ...DEFAULT_TIMER_STATE } });
  await syncAll();
  return { ok: true, timer: { ...DEFAULT_TIMER_STATE } };
}

async function syncAll() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEYS.TIMER]: DEFAULT_TIMER_STATE });
  let timer = normalizeTimerState(stored[STORAGE_KEYS.TIMER]);
  const now = Date.now();

  if (timer.status === TIMER_STATUS.RUNNING) {
    timer = await sendDueNotifications(timer, now);

    if (timer.endAt && timer.endAt <= now) {
      timer = {
        ...timer,
        status: TIMER_STATUS.FINISHED,
        notifiedOffsets: Array.from(new Set([...timer.notifiedOffsets, 0]))
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.TIMER]: timer });
    }
  }

  await updateBadge(timer, now);
  await updateAlarm(timer, now);
}

async function sendDueNotifications(timer, now) {
  const remainingMs = getRemainingMs(timer, now);
  const remainingMinutes = remainingMs / 60000;
  const sent = new Set(timer.notifiedOffsets);
  const dueOffset = getDueNotificationOffset(remainingMs, remainingMinutes, sent);

  if (dueOffset === null) {
    return timer;
  }

  await createTimerNotification(timer, dueOffset);
  sent.add(dueOffset);
  const nextTimer = { ...timer, notifiedOffsets: Array.from(sent) };
  await chrome.storage.local.set({ [STORAGE_KEYS.TIMER]: nextTimer });
  return nextTimer;
}

function getDueNotificationOffset(remainingMs, remainingMinutes, sent) {
  if (remainingMs <= 0) {
    return sent.has(0) ? null : 0;
  }

  const dueOffsets = NOTIFICATION_OFFSETS
    .filter((offset) => offset > 0 && !sent.has(offset) && remainingMinutes <= offset)
    .sort((a, b) => a - b);

  return dueOffsets[0] ?? null;
}

async function createTimerNotification(timer, offset) {
  const title = offset === 0 ? "Wi-Fi接続時間が終了しました" : `終了${offset}分前です`;
  const message = offset === 0
    ? `${timer.cafeName}のタイマーが終了しました。必要に応じて接続状態を確認してください。`
    : `${timer.cafeName}の終了予定は${formatClock(timer.endAt)}です。`;

  await chrome.notifications.create(`${TIMER_NOTIFICATION_PREFIX}${offset}:${timer.endAt}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2
  });
}

async function updateBadge(timer, now) {
  if (timer.status !== TIMER_STATUS.RUNNING) {
    await chrome.action.setBadgeText({ text: timer.status === TIMER_STATUS.FINISHED ? "END" : "" });
    await chrome.action.setBadgeBackgroundColor({ color: timer.status === TIMER_STATUS.FINISHED ? "#9d2f2f" : "#4f5d75" });
    return;
  }

  const remainingMinutes = getRemainingMinutesForBadge(timer, now);
  await chrome.action.setBadgeText({ text: remainingMinutes > 999 ? "999+" : String(remainingMinutes) });
  await chrome.action.setBadgeBackgroundColor({ color: remainingMinutes <= 5 ? "#b54708" : "#2f6f5e" });
}

async function updateAlarm(timer, now) {
  await chrome.alarms.clear(TIMER_ALARM);

  if (timer.status !== TIMER_STATUS.RUNNING || !timer.endAt) {
    return;
  }

  const futureOffsets = NOTIFICATION_OFFSETS
    .filter((offset) => !timer.notifiedOffsets.includes(offset))
    .map((offset) => timer.endAt - offset * 60000)
    .filter((timestamp) => timestamp > now)
    .sort((a, b) => a - b);

  const nextWhen = futureOffsets[0] || Math.min(timer.endAt, now + 60000);
  await chrome.alarms.create(TIMER_ALARM, { when: Math.max(now + 1000, nextWhen) });
}

async function requestLoginPermission(rawUrl) {
  const pattern = toOriginPattern(rawUrl);
  if (!pattern) {
    return { ok: false, error: "有効なログインページURLを入力してください。" };
  }

  const granted = await chrome.permissions.request({ origins: [pattern] });
  return { ok: granted, pattern };
}

async function detectLoginPage(url, tabId) {
  const stored = await chrome.storage.local.get({
    [STORAGE_KEYS.CAFES]: [],
    [STORAGE_KEYS.TIMER]: DEFAULT_TIMER_STATE
  });
  const timer = normalizeTimerState(stored[STORAGE_KEYS.TIMER]);

  if (timer.status === TIMER_STATUS.RUNNING) {
    return;
  }

  const cafes = stored[STORAGE_KEYS.CAFES].map(normalizeCafe);
  const matchedCafe = cafes.find((cafe) => cafe.loginUrl && loginUrlMatches(url, cafe.loginUrl));
  if (!matchedCafe) {
    return;
  }

  const pattern = toOriginPattern(matchedCafe.loginUrl);
  const hasPermission = pattern ? await chrome.permissions.contains({ origins: [pattern] }) : false;
  if (!hasPermission) {
    return;
  }

  await chrome.notifications.create(`${LOGIN_NOTIFICATION_PREFIX}${matchedCafe.id}:${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Wi-Fiタイマーを開始しますか",
    message: `${matchedCafe.name}のログインページを検出しました。拡張機能を開いてタイマーを開始できます。`,
    priority: 1
  });
}
