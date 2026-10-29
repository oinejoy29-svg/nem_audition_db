
(() => {
  "use strict";

  /* ========================================
     基本設定
  ======================================== */

  const DATA_URL = "./data/candidates.json";
  const MEMBERS_URL = "./data/nem_members.json";
  const STORAGE_KEY = "nem_audition_db_personal_v1";

  const TEAM_ORDER = ["WHITE", "BLACK", "BLUE"];

  const TEAM_COLORS = {
    WHITE: "#c5bda9",
    BLACK: "#333431",
    BLUE: "#7c9db9"
  };

  const LIKE_TYPES = [
    { key: "overall", label: "総合" },
    { key: "singing", label: "歌唱" },
    { key: "performance", label: "パフォーマンス" }
  ];

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

  /* ========================================
     DOM
  ======================================== */

  const listView = document.getElementById("list-view");
  const detailView = document.getElementById("detail-view");
  const grid = document.getElementById("candidate-grid");
  const emptyState = document.getElementById("empty-state");
  const listStatus = document.getElementById("list-status");

  const sortSelect = document.getElementById("sort-select");
  const filterSelect = document.getElementById("filter-select");
  
　const originFilter = document.getElementById("origin-filter");
　const ageMinInput = document.getElementById("age-min");
　const ageMaxInput = document.getElementById("age-max");


  const membersToggleWrap =
    document.getElementById("members-toggle-wrap");

  const showMembersCheckbox =
    document.getElementById("show-members");

  const detailContent =
    document.getElementById("detail-content");

  const backButton =
    document.getElementById("back-button");

  /* ========================================
     状態
  ======================================== */

  let candidates = [];
  let members = [];

  let personalData = loadPersonalData();

  let activeCandidateId = null;
  let activeTab = "profile";

  /* ========================================
     ローカル保存
  ======================================== */

  function loadPersonalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object"
        ? parsed
        : {};
    } catch (error) {
      console.warn("保存データの読み込みに失敗しました", error);
      return {};
    }
  }

  function savePersonalData() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(personalData)
      );
      return true;
    } catch (error) {
      console.error("保存に失敗しました", error);
      return false;
    }
  }

  function getPersonal(id) {
    if (!personalData[id] ||
        typeof personalData[id] !== "object") {
      personalData[id] = {};
    }

    const data = personalData[id];

    if (!data.likes ||
        typeof data.likes !== "object") {
      data.likes = {};
    }

    if (typeof data.favorite !== "boolean") {
      data.favorite = false;
    }

    /*
      旧メモを維持する。

      以前の memo は削除せず、
      初回のみ memoGood に引き継ぐ。
    */

    if (typeof data.memoGood !== "string") {
      data.memoGood =
        typeof data.memo === "string"
          ? data.memo
          : "";
    }

    if (typeof data.memoBad !== "string") {
      data.memoBad = "";
    }

    return data;
  }

  /* ========================================
     安全な文字列表示
  ======================================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );
  }

  function safeUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(value, location.href);

      return ["https:", "http:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function valueOrFallback(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "未登録";
    }

    return escapeHTML(value);
  }

  /* ========================================
     生年月日・年齢・学年
  ======================================== */

  function parseBirthDate(value) {
    if (!value) return null;

    const normalized = String(value)
      .trim()
      .replace(/年|月/g, "/")
      .replace(/日/g, "")
      .replace(/-/g, "/");

    const match = normalized.match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    );

    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return { year, month, day };
  }

  function getAge(birthDate) {
    const birth = parseBirthDate(birthDate);
    if (!birth) return null;

    const now = new Date();

    // 日本時間で年齢を判定
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(now);

    const values = Object.fromEntries(
      parts.map(part => [part.type, Number(part.value)])
    );

    let age = values.year - birth.year;

    if (
      values.month < birth.month ||
      (
        values.month === birth.month &&
        values.day < birth.day
      )
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  }


function ageMarkup(birthDate) {
  const age = getAge(birthDate);

  return age === null
    ? ""
    : `<span class="candidate-age">（${age}）</span>`;
}


  /*
    日本の学校年度:
    4月2日〜翌年4月1日
  */

  function schoolYear(birthDate) {
    const birth = parseBirthDate(birthDate);
    if (!birth) return null;

    if (
      birth.month < 4 ||
      (birth.month === 4 && birth.day === 1)
    ) {
      return birth.year - 1;
    }

    return birth.year;
  }

  /* ========================================
     身長・名前
  ======================================== */

  function getHeight(value) {
    const number = parseFloat(String(value ?? ""));

    return Number.isFinite(number)
      ? number
      : null;
  }

  function getBirthDate(item) {
    return item.profile?.birthDate ||
      item.birthDate ||
      "";
  }

  function getItemHeight(item) {
    return item.profile?.height ??
      item.height ??
      "";
  }


  /* ========================================
     名前順：候補者32人＋≠MEメンバー11人
  ======================================== */

  const NAME_ORDER = [
    "イ・ソユル",
    "イ・ダイン",
    "石田 千穂",
    "石原 愛梨沙",
    "井上 弥生",
    "今枝 桜",
    "井餘田 華",
    "小笠原 愛桜",
    "岡野 詩慧",
    "尾木波菜",
    "荻山 さくら",
    "落合希来里",
    "蟹沢萌子",
    "河口夏音",
    "川中子奈月心",
    "河野 奈々帆",
    "北野 心絆",
    "木村 莉子",
    "小泉 のん",
    "櫻井もも",
    "佐藤 涼風",
    "柴田 みつる",
    "白石 美空",
    "鈴木瞳美",
    "鈴木 麗衣",
    "谷崎早耶",
    "徳永 心葉",
    "冨田菜々風",
    "永田詩央里",
    "中村 釉香",
    "那須 咲月",
    "成石 亜里紗",
    "林 美澪",
    "樋口 美沙",
    "日野 美羽",
    "本田珠由記",
    "宮内 菜々美",
    "宮野 陽菜",
    "森 真梨子",
    "矢野 咲香",
    "横山 結愛",
    "吉野 心春",
    "羅瑞婷"
  ];

  function normalizeCandidateName(name) {
    return String(name || "")
      .replace(/[\s　]/g, "")
      .normalize("NFKC");
  }

  const NAME_RANK = new Map(
    NAME_ORDER.map((name, index) => [
      normalizeCandidateName(name),
      index
    ])
  );

  function compareNames(a, b) {
    const nameA = normalizeCandidateName(a.name);
    const nameB = normalizeCandidateName(b.name);

    const rankA = NAME_RANK.get(nameA);
    const rankB = NAME_RANK.get(nameB);

    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }

    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;

    return nameA.localeCompare(nameB, "ja");
  }


  /* ========================================
     チーム
  ======================================== */

  function teamName(team) {
    return TEAM_ORDER.includes(team)
      ? team
      : "未設定";
  }

  function teamMarkup(team) {
    const name = teamName(team);

    const color =
      TEAM_COLORS[name] || "#aaaaaa";

    return `
      <span class="team-label">
        <span
          class="team-dot"
          style="--team-color:${color}"
        ></span>
        ${escapeHTML(name)}
      </span>
    `;
  }

  /* ========================================
     絞り込み
  ======================================== */


/* ========================================
   自己評価・プロフィールで絞り込み
======================================== */

function getItemOrigin(item) {
  return String(
    item.profile?.hometown ??
    item.profile?.birthplace ??
    item.hometown ??
    item.birthplace ??
    ""
  ).trim();
}

function matchesFilters(item) {
  const mode = filterSelect.value;

  // 自己評価
  if (mode !== "all") {
    const personal = getPersonal(item.id);

    if (mode === "favorite") {
      if (!personal.favorite) return false;
    } else {
      if (!personal.likes?.[mode]) return false;
    }
  }

  // 出身地
  const selectedOrigin = originFilter.value;

  if (
    selectedOrigin !== "all" &&
    getItemOrigin(item) !== selectedOrigin
  ) {
    return false;
  }

  // 年齢
  const age = getAge(getBirthDate(item));
  const minText = ageMinInput.value.trim();
  const maxText = ageMaxInput.value.trim();

  if (minText !== "" || maxText !== "") {
    if (age === null) return false;

    if (minText !== "" && age < Number(minText)) {
      return false;
    }

    if (maxText !== "" && age > Number(maxText)) {
      return false;
    }
  }

  return true;
}

function filteredCandidates() {
  return candidates.filter(matchesFilters);
}

function filteredMembers() {
  return members.filter(matchesFilters);
}

/* 出身地の選択肢をデータから作成 */
function setupOriginFilter() {
  const origins = new Set();

  for (const item of [...candidates, ...members]) {
    const origin = getItemOrigin(item);

    if (origin) origins.add(origin);
  }

  const sorted = [...origins].sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  originFilter.innerHTML =
    '<option value="all">出身地：すべて</option>';

  for (const origin of sorted) {
    const option = document.createElement("option");
    option.value = origin;
    option.textContent = origin;
    originFilter.appendChild(option);
  }
}


  /* ========================================
     並び替え
  ======================================== */

  function sortItems(items, mode) {
    const sorted = [...items];

    if (mode === "name") {
      sorted.sort(compareNames);
    }

    if (mode === "age") {
      sorted.sort((a, b) => {
        const ageA = getAge(getBirthDate(a));
        const ageB = getAge(getBirthDate(b));

        if (ageA === null && ageB === null) {
          return compareNames(a, b);
        }

        if (ageA === null) return 1;
        if (ageB === null) return -1;

        return ageA - ageB || compareNames(a, b);
      });
    }

    if (mode === "height") {
      sorted.sort((a, b) => {
        const heightA = getHeight(getItemHeight(a));
        const heightB = getHeight(getItemHeight(b));

        if (heightA === null && heightB === null) {
          return compareNames(a, b);
        }

        if (heightA === null) return 1;
        if (heightB === null) return -1;

        return heightB - heightA || compareNames(a, b);
      });
    }

    return sorted;
  }

  /* ========================================
     候補者カード
  ======================================== */

  function candidateCard(candidate) {
    const personal = getPersonal(candidate.id);

    const article = document.createElement("article");

    article.className = "candidate-card";

    article.style.setProperty(
      "--team-color",
      TEAM_COLORS[candidate.team] || "#e5e0d7"
    );

    article.innerHTML = `
      <button
        class="card-open"
        type="button"
        data-open="${escapeHTML(candidate.id)}"
        aria-label="${escapeHTML(candidate.name)}のプロフィールを開く"
      >
        <div class="card-copy">
          ${teamMarkup(candidate.team)}

          <div class="candidate-name-row">
            <span class="candidate-name">
              ${escapeHTML(candidate.name)}
            </span>
            ${ageMarkup(getBirthDate(candidate))}
          </div>
        </div>
      </button>

      <div class="card-actions">
        <button
          class="favorite-button"
          type="button"
          data-favorite="${escapeHTML(candidate.id)}"
          aria-pressed="${Boolean(personal.favorite)}"
          aria-label="${escapeHTML(candidate.name)}のお気に入りを切り替え"
        >
          ${personal.favorite ? "★" : "☆"}
        </button>
      </div>
    `;

    return article;
  }

  /* ========================================
     ≠MEメンバー比較カード
  ======================================== */

  function memberCard(member) {
    const article = document.createElement("article");

    article.className =
      "candidate-card reference-card";

    const height = getItemHeight(member);

    article.innerHTML = `
      <div class="card-copy">
        <span class="reference-label">
          ≠ME メンバー
        </span>

        <div class="candidate-name-row">
          <span class="candidate-name">
            ${escapeHTML(member.name)}
          </span>

          ${ageMarkup(getBirthDate(member))}
        </div>

        <div class="reference-meta">
          ${height !== "" && height !== null
            ? `${escapeHTML(height)}${typeof height === "number" ? "cm" : ""}`
            : ""}
        </div>
      </div>
    `;

    return article;
  }

  /* ========================================
     チーム別一覧
  ======================================== */

  function renderTeamGroups(list) {
    for (const team of TEAM_ORDER) {
      const teamCandidates = list.filter(
        candidate => candidate.team === team
      );

      if (!teamCandidates.length) continue;

      const section = document.createElement("section");

      section.className = "team-group";

      section.style.setProperty(
        "--team-color",
        TEAM_COLORS[team]
      );

      section.innerHTML = `
        <div class="team-group-heading">
          <h2>${team}</h2>
          <span>${teamCandidates.length}人</span>
        </div>

        <div class="team-candidate-grid candidate-grid"></div>
      `;

      const teamGrid =
        section.querySelector(".team-candidate-grid");

      for (const candidate of teamCandidates) {
        teamGrid.appendChild(candidateCard(candidate));
      }

      grid.appendChild(section);
    }
  }

  /* ========================================
     一覧全体
  ======================================== */


function renderList() {
  const mode = sortSelect.value;
  const isTeamMode = mode === "team";

  const filtered = filteredCandidates();

  const visibleMembers =
    !isTeamMode && showMembersCheckbox.checked
      ? filteredMembers()
      : [];

  membersToggleWrap.hidden = isTeamMode;

  grid.innerHTML = "";

  grid.classList.toggle(
    "team-list-container",
    isTeamMode
  );

  grid.classList.toggle(
    "mixed-list-container",
    !isTeamMode
  );

  if (isTeamMode) {
    renderTeamGroups(filtered);
  } else {
    let items = [
      ...filtered.map(candidate => ({
        ...candidate,
        _reference: false
      })),
      ...visibleMembers.map(member => ({
        ...member,
        _reference: true
      }))
    ];

    items = sortItems(items, mode);

    for (const item of items) {
      grid.appendChild(
        item._reference
          ? memberCard(item)
          : candidateCard(item)
      );
    }
  }

  const total =
    filtered.length + visibleMembers.length;

  emptyState.hidden = total !== 0;

  listStatus.textContent =
    `候補者 ${filtered.length}人` +
    (
      !isTeamMode && showMembersCheckbox.checked
        ? ` ／ ≠MEメンバー ${visibleMembers.length}人`
        : ""
    );
}


  /* ========================================
     お気に入り・いいね
  ======================================== */

  function toggleFavorite(id) {
    const personal = getPersonal(id);

    personal.favorite = !personal.favorite;

    if (!savePersonalData()) {
      alert("お気に入りを保存できませんでした。");
    }

    renderList();

    if (activeCandidateId === id) {
      renderDetail();
    }
  }

  function toggleLike(id, type) {
    if (!LIKE_TYPES.some(item => item.key === type)) {
      return;
    }

    const personal = getPersonal(id);

    personal.likes[type] =
      !personal.likes[type];

    if (!savePersonalData()) {
      alert("いいねを保存できませんでした。");
    }

    renderList();

    if (activeCandidateId === id) {
      renderDetail();
    }
  }

  /* ========================================
     ページ切り替え
  ======================================== */

  function showList() {
    activeCandidateId = null;

    detailView.hidden = true;
    listView.hidden = false;

    renderList();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function showDetail(id, tab = "profile") {
    const candidate = candidates.find(
      item => item.id === id
    );

    if (!candidate) return;

    const changingCandidate =
      activeCandidateId !== id;

    activeCandidateId = id;
    activeTab = tab;

    listView.hidden = true;
    detailView.hidden = false;

    renderDetail();

    if (changingCandidate) {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  }

  /* ========================================
     プロフィール情報
  ======================================== */

  function infoItem(label, value, extra = "") {
    return `
      <div class="info-item">
        <span class="info-label">
          ${escapeHTML(label)}
        </span>

        <div class="info-value">
          ${valueOrFallback(value)}
        </div>

        ${extra}
      </div>
    `;
  }

  /* ========================================
     ≠MEメンバーとの一致
  ======================================== */

  function matchingMembers(candidate, type) {
    const profile = candidate.profile || {};

    return members.filter(member => {
      if (type === "hometown") {
        const hometown = profile.hometown;

        return Boolean(
          hometown &&
          member.birthplace &&
          hometown === member.birthplace
        );
      }

      if (type === "bloodType") {
        const bloodType = profile.bloodType;

        return Boolean(
          bloodType &&
          bloodType !== "不明" &&
          member.bloodType &&
          bloodType === member.bloodType
        );
      }

      if (type === "schoolYear") {
        const yearA = schoolYear(profile.birthDate);
        const yearB = schoolYear(member.birthDate);

        return (
          yearA !== null &&
          yearB !== null &&
          yearA === yearB
        );
      }

      return false;
    });
  }

  function matchMarkup(candidate, type) {
    const matches = matchingMembers(candidate, type);

    if (!matches.length) return "";

    return `
      <div class="member-match">
        <span class="member-match-label">
          ≠ME：
        </span>
        ${matches.map(member => `
          <span class="member-match-name">
            ${escapeHTML(member.name)}
          </span>
        `).join("")}
      </div>
    `;
  }

  /* ========================================
     活動歴
  ======================================== */

  function activityMarkup(candidate) {
    const activities = Array.isArray(candidate.activityHistory)
      ? candidate.activityHistory
      : [];

    if (!activities.length) return "";

    return `
      <section class="info-section">
        <h3>活動歴</h3>

        <div class="activity-tags">
          ${activities.map(activity => {
            const color =
              ACTIVITY_GENRE_COLORS[activity.genre] ||
              "#eeeeee";

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

  /* ========================================
     プロフィールタブ
  ======================================== */

  function profilePanel(candidate) {
    const profile = candidate.profile || {};

    const officialUrl = safeUrl(
      candidate.officialUrl
    );

    const schoolMatches =
      matchingMembers(candidate, "schoolYear");

    return `
      <div class="info-grid">
        ${infoItem(
          "生年月日",
          profile.birthDate
        )}

        ${infoItem(
          "出身地",
          profile.hometown,
          matchMarkup(candidate, "hometown")
        )}

        ${infoItem(
          "身長",
          profile.height
        )}

        ${infoItem(
          "血液型",
          profile.bloodType,
          matchMarkup(candidate, "bloodType")
        )}

        ${infoItem(
          "趣味",
          profile.hobbies
        )}

        ${infoItem(
          "特技",
          profile.skills
        )}
      </div>

      ${schoolMatches.length ? `
        <section class="info-section">
          <h3>同学年の≠MEメンバー</h3>
          <div class="member-match">
            ${schoolMatches.map(member => `
              <span class="member-match-name">
                ${escapeHTML(member.name)}
              </span>
            `).join("")}
          </div>
        </section>
      ` : ""}

      ${officialUrl ? `
        <p>
          <a
            class="external-link"
            href="${escapeHTML(officialUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            公式プロフィールを見る ↗
          </a>
        </p>
      ` : ""}
    `;
  }

  /* ========================================
     メンバー等の評価
  ======================================== */

  function screeningPanel(candidate) {
    const screenings = Array.isArray(candidate.screenings)
      ? candidate.screenings
      : [];

    if (!screenings.length) {
      return `
        <div class="empty-panel">
          メンバー等の評価はまだ登録されていません。
        </div>
      `;
    }

    return screenings.map(item => `
      <article class="statement">
        <div class="statement-speaker">
          ${valueOrFallback(item.stage)}
        </div>

        <div class="info-grid">
          ${infoItem(
            "課題・課題曲",
            item.assignment
          )}

          ${infoItem(
            "パフォーマンス公開状況",
            item.performanceShown
          )}
        </div>

        ${item.judgeComments ? `
          <section class="info-section">
            <h3>公開されたコメント・評価</h3>
            <div class="info-value">
              ${valueOrFallback(item.judgeComments)}
            </div>
          </section>
        ` : ""}
      </article>
    `).join("");
  }

  /* ========================================
     メモ（〇）（△）
  ======================================== */

  function memoPanel(candidate) {
    const personal = getPersonal(candidate.id);

    return `
      <div class="memo-group">
        <label
          for="memo-good"
          class="memo-heading memo-good-heading"
        >
          メモ（〇）
        </label>

        <textarea
          id="memo-good"
          class="memo-textarea"
          data-memo-field="memoGood"
          maxlength="20000"
          placeholder="良かった点・魅力など"
        >${escapeHTML(personal.memoGood)}</textarea>
      </div>

      <div class="memo-group">
        <label
          for="memo-bad"
          class="memo-heading memo-bad-heading"
        >
          メモ（△）
        </label>

        <textarea
          id="memo-bad"
          class="memo-textarea"
          data-memo-field="memoBad"
          maxlength="20000"
          placeholder="気になった点・改善点など"
        >${escapeHTML(personal.memoBad)}</textarea>
      </div>

      <p class="memo-help">
        メモはこのブラウザ内にのみ保存されます。
        同じ端末・ブラウザを使える人には見られる可能性があります。
        ブラウザのデータを削除すると失われることがあります。
      </p>

      <p
        id="memo-save-status"
        class="save-status"
        aria-live="polite"
      >
        保存先：このブラウザのみ
      </p>
    `;
  }

  /* ========================================
     タブ
  ======================================== */

  function tabButton(key, label) {
    return `
      <button
        class="tab-button"
        type="button"
        role="tab"
        data-tab="${key}"
        aria-selected="${activeTab === key}"
      >
        ${label}
      </button>
    `;
  }

  /* ========================================
     課題曲
  ======================================== */

  function getAssignmentSongs(candidate) {
    /*
      今後 candidates.json に追加する項目。

      singingSong:
        歌唱課題曲

      performanceSong:
        パフォーマンス課題曲
    */

    return {
      singing: candidate.singingSong ||
        candidate.assignments?.singing ||
        "",

      performance: candidate.performanceSong ||
        candidate.assignments?.performance ||
        ""
    };
  }

  /* ========================================
     個人詳細
  ======================================== */

  function renderDetail() {
    const candidate = candidates.find(
      item => item.id === activeCandidateId
    );

    if (!candidate) return;

    const personal = getPersonal(candidate.id);
    const songs = getAssignmentSongs(candidate);

    let panel = "";

    if (activeTab === "profile") {
      panel = profilePanel(candidate);
    }

    if (activeTab === "screening") {
      panel = screeningPanel(candidate);
    }

    if (activeTab === "memo") {
      panel = memoPanel(candidate);
    }

    detailContent.innerHTML = `
      <section class="profile-heading">
        <div class="profile-heading-layout">
          <div class="profile-meta">
            <div class="profile-name-row">
              <h1>${escapeHTML(candidate.name)}</h1>

              ${ageMarkup(
                getBirthDate(candidate)
              )}
            </div>

            <div class="profile-basics">
              ${candidate.profile?.birthDate ? `
                <span class="basic-chip">
                  ${escapeHTML(candidate.profile.birthDate)}
                </span>
              ` : ""}

              ${candidate.profile?.hometown ? `
                <span class="basic-chip">
                  ${escapeHTML(candidate.profile.hometown)}
                </span>
              ` : ""}
            </div>
          </div>

          <div class="profile-assignment">
            <div class="assignment-item">
              <span>4次審査チーム</span>
              ${teamMarkup(candidate.team)}
            </div>

            <div class="assignment-item">
              <span>歌唱課題曲</span>
              <strong>${valueOrFallback(songs.singing)}</strong>
            </div>

            <div class="assignment-item">
              <span>パフォーマンス課題曲</span>
              <strong>${valueOrFallback(songs.performance)}</strong>
            </div>
          </div>
        </div>
      </section>

      ${activityMarkup(candidate)}

      <section class="personal-panel">
        <h2>自分用の評価</h2>

        <div class="evaluation-row">
          ${LIKE_TYPES.map(type => `
            <button
              class="eval-button"
              type="button"
              data-detail-like="${type.key}"
              aria-pressed="${Boolean(
                personal.likes?.[type.key]
              )}"
            >
              ${type.label}
              ${personal.likes?.[type.key] ? "♥" : "♡"}
            </button>
          `).join("")}

          <button
            class="favorite-large"
            type="button"
            data-detail-favorite
            aria-pressed="${Boolean(personal.favorite)}"
          >
            ${personal.favorite
              ? "★ お気に入り登録済み"
              : "☆ お気に入りに登録"}
          </button>
        </div>
      </section>

      <div
        class="tab-list"
        role="tablist"
        aria-label="候補者の情報"
      >
        ${tabButton("profile", "プロフィール")}
        ${tabButton("screening", "メンバー等の評価")}
        ${tabButton("memo", "自分用メモ")}
      </div>

      <section
        class="tab-panel"
        role="tabpanel"
      >
        ${panel}
      </section>
    `;

    /* タブ切り替え */

    detailContent
      .querySelectorAll("[data-tab]")
      .forEach(button => {
        button.addEventListener("click", () => {
          showDetail(
            candidate.id,
            button.dataset.tab
          );
        });
      });

    /* いいね */

    detailContent
      .querySelectorAll("[data-detail-like]")
      .forEach(button => {
        button.addEventListener("click", () => {
          toggleLike(
            candidate.id,
            button.dataset.detailLike
          );
        });
      });

    /* お気に入り */

    const favoriteButton =
      detailContent.querySelector(
        "[data-detail-favorite]"
      );

    if (favoriteButton) {
      favoriteButton.addEventListener(
        "click",
        () => toggleFavorite(candidate.id)
      );
    }

    /* メモの自動保存 */

    detailContent
      .querySelectorAll("[data-memo-field]")
      .forEach(textarea => {
        let debounceHandle;

        textarea.addEventListener("input", () => {
          const field = textarea.dataset.memoField;

          /*
            入力値はすぐメモリ上に反映。
            保存だけ少し遅らせる。
          */

          getPersonal(candidate.id)[field] =
            textarea.value;

          const status =
            detailContent.querySelector(
              "#memo-save-status"
            );

          if (status) {
            status.textContent = "保存中…";
          }

          clearTimeout(debounceHandle);

          debounceHandle = setTimeout(() => {
            const saved = savePersonalData();

            if (status && status.isConnected) {
              status.textContent = saved
                ? "保存しました（このブラウザ内のみ）"
                : "保存できませんでした。内容をコピーして保管してください。";

              status.style.color = saved
                ? ""
                : "#a33";
            }
          }, 250);
        });

        textarea.addEventListener("change", () => {
          savePersonalData();
        });
      });
  }

  /* ========================================
     一覧クリック
  ======================================== */

  grid.addEventListener("click", event => {
    const favoriteButton =
      event.target.closest("[data-favorite]");

    if (favoriteButton) {
      toggleFavorite(
        favoriteButton.dataset.favorite
      );
      return;
    }

    const openButton =
      event.target.closest("[data-open]");

    if (openButton) {
      showDetail(openButton.dataset.open);
    }
  });

  /* ========================================
     操作イベント
  ======================================== */

  sortSelect.addEventListener(
    "change",
    renderList
  );

  filterSelect.addEventListener(
    "change",
    renderList
  );

  showMembersCheckbox.addEventListener(
    "change",
    renderList
  );

  
originFilter.addEventListener("change", renderList);

ageMinInput.addEventListener("input", renderList);
ageMaxInput.addEventListener("input", renderList);


  backButton.addEventListener(
    "click",
    showList
  );

  /* ========================================
     データ読み込み
  ======================================== */

  async function loadJSON(url) {
    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `${url} の読み込みに失敗しました`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        `${url} は配列形式である必要があります`
      );
    }

    return data;
  }

  async function init() {
    try {
      const candidateData =
        await loadJSON(DATA_URL);

      const ids = new Set();

      candidates = candidateData.filter(candidate => {
        if (
          !candidate ||
          typeof candidate.id !== "string" ||
          !candidate.id.trim() ||
          typeof candidate.name !== "string" ||
          !candidate.name.trim()
        ) {
          return false;
        }

        if (ids.has(candidate.id)) {
          return false;
        }

        ids.add(candidate.id);
        return true;
      });

      /*
        ≠MEメンバーの読み込み失敗時も
        候補者一覧は表示できるようにする。
      */

      try {
        members = await loadJSON(MEMBERS_URL);

        members = members.filter(member =>
          member &&
          typeof member.name === "string" &&
          member.name.trim()
        );
      } catch (error) {
        console.warn(
          "≠MEメンバーデータを読み込めませんでした",
          error
        );

        members = [];
      }

      
      setupOriginFilter();
      renderList();


    } catch (error) {
      console.error(
        "候補者データを読み込めませんでした",
        error
      );

      listStatus.textContent =
        "候補者データを読み込めませんでした。";

      emptyState.hidden = false;

      const title = emptyState.querySelector("h2");
      const description = emptyState.querySelector("p");

      if (title) {
        title.textContent =
          "データを読み込めませんでした";
      }

      if (description) {
        description.textContent =
          "data/candidates.json の配置とJSON形式を確認してください。";
      }
    }
  }

  init();

})();
