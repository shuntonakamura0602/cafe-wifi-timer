const timerCafeName = document.querySelector("#timerCafeName");
const timerStatus = document.querySelector("#timerStatus");
const remainingTime = document.querySelector("#remainingTime");
const endAt = document.querySelector("#endAt");
const duration = document.querySelector("#duration");
const customMinutes = document.querySelector("#customMinutes");
const startCustomTimer = document.querySelector("#startCustomTimer");
const stopTimerButton = document.querySelector("#stopTimer");
const resetTimerButton = document.querySelector("#resetTimer");
const message = document.querySelector("#message");

let timer = { ...DEFAULT_TIMER_STATE };
let renderInterval = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await refreshState();
  bindEvents();
  renderInterval = window.setInterval(renderTimer, 1000);
}

function bindEvents() {
  startCustomTimer.addEventListener("click", startCustomMinuteTimer);
  stopTimerButton.addEventListener("click", sendStop);
  resetTimerButton.addEventListener("click", sendReset);
}

async function refreshState() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!response?.ok) {
    showMessage(response?.error || "状態を取得できませんでした。");
    return;
  }
  timer = normalizeTimerState(response.timer);
  renderTimer();
}

function renderTimer() {
  const remainingMs = getRemainingMs(timer);
  timerCafeName.textContent = timer.cafeName || "未開始";
  remainingTime.textContent = timer.status === TIMER_STATUS.RUNNING ? formatRemaining(remainingMs) : "--:--";
  endAt.textContent = timer.status === TIMER_STATUS.RUNNING ? formatClock(timer.endAt) : "-";
  duration.textContent = timer.durationMinutes ? `${timer.durationMinutes}分` : "-";

  if (timer.status === TIMER_STATUS.RUNNING) {
    timerStatus.textContent = remainingMs > 0 ? "実行中" : "終了";
  } else if (timer.status === TIMER_STATUS.FINISHED) {
    timerStatus.textContent = "終了";
    remainingTime.textContent = "0:00";
  } else {
    timerStatus.textContent = "待機中";
  }
}

async function startCustomMinuteTimer() {
  const minutes = Number.parseInt(customMinutes.value, 10);
  if (!Number.isInteger(minutes) || minutes < 1) {
    showMessage("1分以上の分数を入力してください。");
    customMinutes.focus();
    return;
  }

  await startTimer({
    cafeName: "任意タイマー",
    durationMinutes: minutes
  });
}

async function startTimer(payload) {
  const response = await chrome.runtime.sendMessage({ type: "START_TIMER", payload });
  if (!response?.ok) {
    showMessage(response?.error || "タイマーを開始できませんでした。");
    return;
  }
  timer = normalizeTimerState(response.timer);
  showMessage("");
  renderTimer();
}

async function sendStop() {
  const response = await chrome.runtime.sendMessage({ type: "STOP_TIMER" });
  if (!response?.ok) {
    showMessage(response?.error || "停止できませんでした。");
    return;
  }
  timer = normalizeTimerState(response.timer);
  renderTimer();
}

async function sendReset() {
  const response = await chrome.runtime.sendMessage({ type: "RESET_TIMER" });
  if (!response?.ok) {
    showMessage(response?.error || "リセットできませんでした。");
    return;
  }
  timer = normalizeTimerState(response.timer);
  renderTimer();
}

function showMessage(text) {
  message.textContent = text;
}

window.addEventListener("beforeunload", () => {
  if (renderInterval) {
    window.clearInterval(renderInterval);
  }
});
