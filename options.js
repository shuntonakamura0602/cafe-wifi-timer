const cafeForm = document.querySelector("#cafeForm");
const formTitle = document.querySelector("#formTitle");
const cafeId = document.querySelector("#cafeId");
const cafeName = document.querySelector("#cafeName");
const durationMinutes = document.querySelector("#durationMinutes");
const loginUrl = document.querySelector("#loginUrl");
const cancelEdit = document.querySelector("#cancelEdit");
const cafeList = document.querySelector("#cafeList");
const cafeCount = document.querySelector("#cafeCount");
const formMessage = document.querySelector("#formMessage");

let cafes = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadCafes();
  cafeForm.addEventListener("submit", saveCafe);
  cancelEdit.addEventListener("click", resetForm);
}

async function loadCafes() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEYS.CAFES]: [] });
  cafes = stored[STORAGE_KEYS.CAFES].map(normalizeCafe);
  renderCafes();
}

async function saveCafe(event) {
  event.preventDefault();
  const name = cafeName.value.trim();
  const minutes = Number.parseInt(durationMinutes.value, 10);
  const url = loginUrl.value.trim();

  if (!name) {
    showMessage("カフェ名を入力してください。");
    cafeName.focus();
    return;
  }
  if (!Number.isInteger(minutes) || minutes < 1) {
    showMessage("接続時間は1分以上で入力してください。");
    durationMinutes.focus();
    return;
  }
  if (url && !isHttpUrl(url)) {
    showMessage("ログインページURLは http または https のURLを入力してください。");
    loginUrl.focus();
    return;
  }

  const editingId = cafeId.value;
  const nextCafe = normalizeCafe({
    id: editingId || makeId("cafe"),
    name,
    durationMinutes: minutes,
    loginUrl: url
  });

  if (url) {
    const pattern = toOriginPattern(url);
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) {
      showMessage("URL検出を使うには、このサイトへのアクセス許可が必要です。URLなしで保存することもできます。");
      return;
    }
  }

  cafes = editingId
    ? cafes.map((cafe) => cafe.id === editingId ? nextCafe : cafe)
    : [...cafes, nextCafe];

  await chrome.storage.local.set({ [STORAGE_KEYS.CAFES]: cafes });
  resetForm();
  renderCafes();
  showMessage("保存しました。");
}

function renderCafes() {
  cafeList.textContent = "";
  cafeCount.textContent = `${cafes.length}件`;

  if (cafes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "まだ登録されていません。";
    cafeList.append(empty);
    return;
  }

  for (const cafe of cafes) {
    const item = document.createElement("article");
    item.className = "cafe-item";

    const main = document.createElement("div");
    main.className = "cafe-main";

    const copy = document.createElement("div");
    const title = document.createElement("p");
    title.className = "cafe-title";
    title.textContent = cafe.name;
    const meta = document.createElement("p");
    meta.className = "cafe-meta";
    meta.textContent = `${cafe.durationMinutes}分${cafe.loginUrl ? ` / ${cafe.loginUrl}` : ""}`;
    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "編集";
    edit.addEventListener("click", () => editCafe(cafe.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "削除";
    remove.addEventListener("click", () => deleteCafe(cafe.id));

    actions.append(edit, remove);
    main.append(copy);
    item.append(main, actions);
    cafeList.append(item);
  }
}

function editCafe(id) {
  const cafe = cafes.find((item) => item.id === id);
  if (!cafe) {
    return;
  }
  formTitle.textContent = "編集";
  cafeId.value = cafe.id;
  cafeName.value = cafe.name;
  durationMinutes.value = cafe.durationMinutes;
  loginUrl.value = cafe.loginUrl;
  cafeName.focus();
  showMessage("");
}

async function deleteCafe(id) {
  const cafe = cafes.find((item) => item.id === id);
  if (!cafe) {
    return;
  }
  const confirmed = window.confirm(`${cafe.name}を削除しますか？`);
  if (!confirmed) {
    return;
  }
  cafes = cafes.filter((item) => item.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.CAFES]: cafes });
  renderCafes();
  resetForm();
  showMessage("削除しました。");
}

function resetForm() {
  cafeForm.reset();
  formTitle.textContent = "新規登録";
  cafeId.value = "";
  durationMinutes.value = "60";
}

function showMessage(text) {
  formMessage.textContent = text;
}
