(() => {
  "use strict";

  const DATA_URL = "./data/candidates.json";
  const STORAGE_KEY = "nem_audition_db_personal_v1";
  const TEAM_ORDER = { WHITE: 0, BLUE: 1, BLACK: 2 };
  const TEAM_COLORS = { WHITE: "#c5bda9", BLACK: "#333431", BLUE: "#7c9db9" };
  const LIKE_TYPES = [
    { key: "overall", label: "総合" },
    { key: "singing", label: "歌唱" },
    { key: "performance", label: "パフォーマンス" }
  ];

  const listView = document.getElementById("list-view");
  const detailView = document.getElementById("detail-view");
  const grid = document.getElementById("candidate-grid");
  const emptyState = document.getElementById("empty-state");
  const listStatus = document.getElementById("list-status");
  const sortSelect = document.getElementById("sort-select");
  const detailContent = document.getElementById("detail-content");
  const backButton = document.getElementById("back-button");

  let candidates = [];
  let personalData = loadPersonalData();
  let activeCandidateId = null;
  let activeTab = "profile";

  function loadPersonalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn("Personal data could not be read from local storage.");
      return {};
    }
  }

  function savePersonalData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(personalData));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getPersonal(id) {
    if (!personalData[id]) personalData[id] = { likes: {}, favorite: false, memo: "" };
    return personalData[id];
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function teamName(team) {
    return ["WHITE", "BLACK", "BLUE"].includes(team) ? team : "未設定";
  }

  function sortCandidates() {
    const mode = sortSelect.value;
    const list = [...candidates];
    const indexById = new Map(candidates.map((candidate, index) => [candidate.id, index]));
    if (mode === "default") {
      return list.sort((a, b) =>
        (TEAM_ORDER[teamName(a.team)] ?? 99) - (TEAM_ORDER[teamName(b.team)] ?? 99) ||
        indexById.get(a.id) - indexById.get(b.id)
      );
    }
    return list.sort((a, b) => {
      const pa = getPersonal(a.id);
      const pb = getPersonal(b.id);
      let delta = 0;
      if (mode === "favorite") {
        delta = Number(Boolean(pb.favorite)) - Number(Boolean(pa.favorite));
      } else {
        delta = Number(Boolean(pb.likes?.[mode])) - Number(Boolean(pa.likes?.[mode]));
      }
      return delta || indexById.get(a.id) - indexById.get(b.id);
    });
  }

  function teamMarkup(team) {
    const name = teamName(team);
    const color = TEAM_COLORS[name] || "#aaa";
    return `<span class="team-label"><span class="team-dot" style="--team-color:${color}"></span>${escapeHTML(name)}</span>`;
  }

  function renderList() {
    const sorted = sortCandidates();
    grid.innerHTML = "";
    emptyState.hidden = sorted.length !== 0;
    listStatus.textContent = "";
    if (!sorted.length) return;

    for (const candidate of sorted) {
      const personal = getPersonal(candidate.id);
      const article = document.createElement("article");
      article.className = "candidate-card";
      article.style.setProperty(
        "--team-color",
        TEAM_COLORS[candidate.team] || "#e5e0d7"
      );
      
      article.innerHTML = `
        <button class="card-open" type="button" data-open="${escapeHTML(candidate.id)}" aria-label="${escapeHTML(candidate.name)}のプロフィールを開く">
          <div class="card-copy">
            ${teamMarkup(candidate.team)}
            <span class="candidate-name">${escapeHTML(candidate.name)}</span>
          </div>
        </button>
        <div class="card-actions">
          <div class="like-summary">
            ${LIKE_TYPES.map(type => `<button class="mini-like" type="button" data-like="${type.key}" data-id="${escapeHTML(candidate.id)}" aria-pressed="${Boolean(personal.likes?.[type.key])}" aria-label="${type.label}いいねを切り替え">${type.label}</button>`).join("")}
          </div>
          <button class="favorite-button" type="button" data-favorite="${escapeHTML(candidate.id)}" aria-pressed="${Boolean(personal.favorite)}" aria-label="お気に入りを切り替え">${personal.favorite ? "★" : "☆"}</button>
        </div>`;
      grid.appendChild(article);
    }
  }

  function toggleLike(id, type) {
    const personal = getPersonal(id);
    personal.likes[type] = !personal.likes[type];
    if (!savePersonalData()) alert("ブラウザ内に保存できませんでした。ブラウザの設定や空き容量を確認してください。");
    renderList();
    if (activeCandidateId === id) renderDetail();
  }

  function toggleFavorite(id) {
    const personal = getPersonal(id);
    personal.favorite = !personal.favorite;
    if (!savePersonalData()) alert("ブラウザ内に保存できませんでした。ブラウザの設定や空き容量を確認してください。");
    renderList();
    if (activeCandidateId === id) renderDetail();
  }

  function showList() {
    activeCandidateId = null;
    detailView.hidden = true;
    listView.hidden = false;
    renderList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDetail(id, tab = "profile") {
    const candidate = candidates.find(item => item.id === id);
    if (!candidate) return;
    activeCandidateId = id;
    activeTab = tab;
    listView.hidden = true;
    detailView.hidden = false;
    renderDetail();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function valueOrFallback(value) {
    return value === null || value === undefined || String(value).trim() === ""
      ? "未登録"
      : escapeHTML(value);
  }

  function infoItem(label, value) {
    return `<div class="info-item"><span class="info-label">${escapeHTML(label)}</span><div class="info-value">${valueOrFallback(value)}</div></div>`;
  }

  function tabButton(key, label) {
    return `<button class="tab-button" type="button" role="tab" data-tab="${key}" aria-selected="${activeTab === key}">${label}</button>`;
  }


const ACTIVITY_GENRE_COLORS = {
  "アイドル": "#f9dce7",
  "アイドル練習生": "#fce8ef",
  "モデル": "#e5dcf8",
  "ミュージカル・舞台": "#ffe2c7",
  "子役・俳優": "#f9e9bd",
  "ダンス・振付": "#d9e9fb",
  "芸能スクール": "#d6eee4",
  "オーディション番組": "#f9e9a8",
  "オーディション": "#fff0cc",
  "コンテスト": "#e4dff9",
  "SNS・クリエイター": "#d9f0f2",
  "芸能事務所": "#e8e8e8"
};

function activityMarkup(candidate) {
  const activities = candidate.activityHistory || [];

  if (!activities.length) return "";

  return `
    <section class="info-section">
      <h3>活動歴</h3>
      <div class="activity-tags">
        ${activities.map(activity => {
          const color =
            ACTIVITY_GENRE_COLORS[activity.genre] || "#eeeeee";

          return `
            <span
              class="activity-tag"
              style="background-color:${color}"
              title="${escapeHTML(activity.genre)}"
            >
              ${escapeHTML(activity.name)}
            </span>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

  function profilePanel(candidate) {
    const profile = candidate.profile || {};
    const officialUrl = safeUrl(candidate.officialUrl);
    return `
      <div class="info-grid">
        ${infoItem("読み方", profile.reading)}
        ${infoItem("生年月日", profile.birthDate)}
        ${infoItem("出身地", profile.hometown)}
        ${infoItem("身長", profile.height)}
        ${infoItem("血液型", profile.bloodType)}
        ${infoItem("趣味", profile.hobbies)}
        ${infoItem("特技", profile.skills)}
      </div>
      ${profile.enthusiasm ? `<section class="info-section"><h3>意気込み</h3><div class="info-value">${valueOrFallback(profile.enthusiasm)}</div></section>` : ""}
      ${officialUrl ? `<p><a class="external-link" href="${escapeHTML(officialUrl)}" target="_blank" rel="noopener noreferrer">公式プロフィールを見る ↗</a></p>` : `<p class="memo-help">公式プロフィールURLは未登録です。</p>`}
    `;
  }

  function screeningPanel(candidate) {
    const screenings = Array.isArray(candidate.screenings) ? candidate.screenings : [];
    if (!screenings.length) return `<div class="empty-panel">審査情報はまだ登録されていません。</div>`;
    return screenings.map(item => `
      <article class="statement">
        <div class="statement-speaker">${valueOrFallback(item.stage)}</div>
        <div class="info-grid">
          ${infoItem("課題・課題曲", item.assignment)}
          ${infoItem("パフォーマンス公開状況", item.performanceShown)}
        </div>
        ${item.judgeComments ? `<section class="info-section"><h3>公開された審査員コメント</h3><div class="info-value">${valueOrFallback(item.judgeComments)}</div></section>` : ""}
      </article>`).join("");
  }

  function statementsPanel(candidate) {
    const statements = Array.isArray(candidate.statements) ? candidate.statements : [];
    if (!statements.length) return `<div class="empty-panel">発言・エピソードはまだ登録されていません。</div>`;
    return `<div class="statement-list">${statements.map(item => `
      <article class="statement">
        <div class="statement-speaker">${valueOrFallback(item.speaker)}</div>
        <div class="statement-context">発言の元：${valueOrFallback(item.context)}</div>
        <div class="statement-quote">${valueOrFallback(item.quote)}</div>
      </article>`).join("")}</div>`;
  }

  function memoPanel(candidate) {
    const personal = getPersonal(candidate.id);
    return `
      <label for="personal-memo" class="info-label">この候補者についての自分用メモ</label>
      <textarea id="personal-memo" class="memo-textarea" maxlength="20000" placeholder="自分用のメモを入力…">${escapeHTML(personal.memo || "")}</textarea>
      <p class="memo-help">メモはこのブラウザ内だけに保存され、サイト運営者や他の閲覧者には送信されません。同じ端末・ブラウザを使える人に見られる可能性があります。ブラウザデータを削除すると失われることがあります。</p>
      <p id="memo-save-status" class="save-status" aria-live="polite">保存先：このブラウザのみ</p>`;
  }

  function renderDetail() {
    const candidate = candidates.find(item => item.id === activeCandidateId);
    if (!candidate) return;
    const personal = getPersonal(candidate.id);

    let panel = "";
    if (activeTab === "profile") panel = profilePanel(candidate);
    if (activeTab === "screening") panel = screeningPanel(candidate);
    if (activeTab === "statements") panel = statementsPanel(candidate);
    if (activeTab === "memo") panel = memoPanel(candidate);

    detailContent.innerHTML = `
      <section class="profile-heading">
        <div class="profile-meta">
          ${teamMarkup(candidate.team)}
          <h1>${escapeHTML(candidate.name)}</h1>
          ${candidate.profile?.reading ? `<p class="profile-reading">${escapeHTML(candidate.profile.reading)}</p>` : ""}
          <div class="profile-basics">
            ${candidate.profile?.birthDate ? `<span class="basic-chip">${escapeHTML(candidate.profile.birthDate)}</span>` : ""}
            ${candidate.profile?.hometown ? `<span class="basic-chip">${escapeHTML(candidate.profile.hometown)}</span>` : ""}
          </div>
        </div>
      </section>
      ${activityMarkup(candidate)}
      <section class="personal-panel">
        <h2>自分用の評価</h2>
        <div class="evaluation-row">
          ${LIKE_TYPES.map(type => `<button class="eval-button" type="button" data-detail-like="${type.key}" aria-pressed="${Boolean(personal.likes?.[type.key])}">${type.label} ${personal.likes?.[type.key] ? "♥" : "♡"}</button>`).join("")}
          <button class="favorite-large" type="button" data-detail-favorite aria-pressed="${Boolean(personal.favorite)}">${personal.favorite ? "★ お気に入り登録済み" : "☆ お気に入りに登録"}</button>
        </div>
      </section>
      <div class="tab-list" role="tablist" aria-label="候補者の情報">
        ${tabButton("profile", "プロフィール")}
        ${tabButton("screening", "審査")}
        ${tabButton("statements", "発言")}
        ${tabButton("memo", "自分用メモ")}
      </div>
      <section class="tab-panel" role="tabpanel">${panel}</section>`;

    detailContent.querySelectorAll("[data-tab]").forEach(button => {
      button.addEventListener("click", () => showDetail(candidate.id, button.dataset.tab));
    });
    detailContent.querySelectorAll("[data-detail-like]").forEach(button => {
      button.addEventListener("click", () => toggleLike(candidate.id, button.dataset.detailLike));
    });
    const fav = detailContent.querySelector("[data-detail-favorite]");
    if (fav) fav.addEventListener("click", () => toggleFavorite(candidate.id));

    const memo = detailContent.querySelector("#personal-memo");
    if (memo) {
      let debounceHandle;
      memo.addEventListener("input", () => {
        clearTimeout(debounceHandle);
        const status = detailContent.querySelector("#memo-save-status");
        status.textContent = "保存中…";
        debounceHandle = setTimeout(() => {
          getPersonal(candidate.id).memo = memo.value;
          const saved = savePersonalData();
          status.textContent = saved ? "保存しました（このブラウザ内のみ）" : "保存できませんでした。内容をコピーして保管してください。";
          if (!saved) status.style.color = "#a33";
        }, 250);
      });
    }
  }

  grid.addEventListener("click", event => {
    const likeButton = event.target.closest("[data-like]");
    if (likeButton) {
      toggleLike(likeButton.dataset.id, likeButton.dataset.like);
      return;
    }
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favorite);
      return;
    }
    const openButton = event.target.closest("[data-open]");
    if (openButton) showDetail(openButton.dataset.open);
  });

  sortSelect.addEventListener("change", renderList);
  backButton.addEventListener("click", showList);

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load candidate data.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Candidate data must be an array.");
      const ids = new Set();
      candidates = data.filter(candidate => {
        if (!candidate || typeof candidate.id !== "string" || !candidate.id.trim() ||
            typeof candidate.name !== "string" || !candidate.name.trim()) return false;
        if (ids.has(candidate.id)) return false;
        ids.add(candidate.id);
        return true;
      });
      renderList();
    } catch (error) {
      console.error("Candidate data could not be loaded:", error);
      listStatus.textContent = "候補者データを読み込めませんでした。ファイル構成とJSON形式を確認してください。";
      emptyState.hidden = false;
      emptyState.querySelector("h2").textContent = "データを読み込めませんでした";
      emptyState.querySelector("p").textContent = "data/candidates.json が存在し、正しいJSON形式になっているか確認してください。";
    }
  }

  init();
})();
