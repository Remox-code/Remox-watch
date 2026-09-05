const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/";
const STORAGE_KEY = "watchflow-library-v1";
const API_KEY_STORAGE = "watchflow-tmdb-key";
const THEME_KEY = "watchflow-theme";

let library = loadLibrary();
let activeFilter = "all";
let searchTimer = null;
let currentSearchResults = [];
let selectedTitle = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  renderLibrary();
  updateStats();
  applyTheme();
  updateApiHint();
}

function bindEvents() {
  $("#searchInput").addEventListener("input", handleSearch);
  $("#searchInput").addEventListener("focus", () => {
    if (currentSearchResults.length) $("#suggestions").classList.add("show");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-box-wrap")) {
      $("#suggestions").classList.remove("show");
    }
  });

  $$(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".filter").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderLibrary();
    });
  });

  $("#settingsBtn").addEventListener("click", openSettings);
  $("#themeBtn").addEventListener("click", toggleTheme);
  $("#saveApiKey").addEventListener("click", saveApiKey);

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  $("#itemModal").addEventListener("click", (e) => {
    if (e.target.id === "itemModal") closeModal("itemModal");
  });
  $("#settingsModal").addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") closeModal("settingsModal");
  });
}

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE)
    || window.WATCHFLOW_CONFIG?.TMDB_API_KEY
    || "";
}

function updateApiHint() {
  $("#apiHint").textContent = getApiKey()
    ? "TMDB متصل است — جستجو آماده است."
    : "برای شروع، از دکمه ⚙ یک TMDB API Key وارد کن.";
}

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

function posterUrl(path, size = "w500") {
  return path ? `${IMAGE_BASE}${size}${path}` : "https://placehold.co/500x750/17191e/8f95a3?text=No+Poster";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function debounceSearch(query) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchTitles(query), 350);
}

function handleSearch(event) {
  const query = event.target.value.trim();
  currentSearchResults = [];
  $("#suggestions").innerHTML = "";

  if (query.length < 2) {
    $("#suggestions").classList.remove("show");
    return;
  }

  if (!getApiKey()) {
    showToast("اول API Key را از تنظیمات وارد کن.");
    openSettings();
    return;
  }

  debounceSearch(query);
}

async function searchTitles(query) {
  setLoading(true);

  try {
    const data = await tmdbFetch("/search/tv", {
      query,
      language: "fa-IR",
      include_adult: "false",
      page: "1"
    });

    currentSearchResults = (data.results || [])
      .filter(item => item.poster_path || item.backdrop_path)
      .slice(0, 7);

    renderSuggestions(currentSearchResults);
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

function renderSuggestions(results) {
  const box = $("#suggestions");

  if (!results.length) {
    box.innerHTML = `<div class="suggestion"><div class="suggestion-info">نتیجه‌ای پیدا نشد.</div></div>`;
    box.classList.add("show");
    return;
  }

  box.innerHTML = results.map((item, index) => `
    <button class="suggestion" data-result-index="${index}">
      <img src="${posterUrl(item.poster_path, "w185")}" alt="">
      <div class="suggestion-info">
        <div class="suggestion-title">${escapeHtml(item.name || "بدون نام")}</div>
        <div class="suggestion-original">${escapeHtml(item.original_name || "")}</div>
        <div class="suggestion-meta">
          ${escapeHtml(item.first_air_date?.slice(0,4) || "—")}
          · ⭐ ${Number(item.vote_average || 0).toFixed(1)}
        </div>
      </div>
    </button>
  `).join("");

  $$(".suggestion[data-result-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = currentSearchResults[Number(btn.dataset.resultIndex)];
      selectTitle(item);
    });
  });

  box.classList.add("show");
}

async function selectTitle(item) {
  $("#suggestions").classList.remove("show");
  $("#searchInput").value = item.name || "";
  selectedTitle = item;

  try {
    const details = await tmdbFetch(`/tv/${item.id}`, {
      language: "fa-IR",
      append_to_response: "credits"
    });

    selectedTitle = details;
    openItemModal(details);
  } catch (error) {
    showToast(error.message);
  }
}

function openItemModal(show) {
  const seasons = (show.seasons || []).filter(s => s.season_number >= 0);
  const watchedExisting = library.find(x => x.id === show.id);

  $("#itemModalContent").innerHTML = `
    <div class="detail-layout">
      <img class="detail-poster" src="${posterUrl(show.poster_path)}" alt="">
      <div>
        <span class="modal-kicker">ADD TO LIBRARY</span>
        <h3 class="detail-title">${escapeHtml(show.name || "بدون نام")}</h3>
        <div class="detail-original">${escapeHtml(show.original_name || "")}</div>

        <div class="detail-tags">
          <span class="pill">⭐ ${Number(show.vote_average || 0).toFixed(1)}</span>
          <span class="pill">${escapeHtml(show.first_air_date?.slice(0,4) || "—")}</span>
          <span class="pill">${show.number_of_seasons || seasons.length} فصل</span>
        </div>

        <p class="detail-overview">${escapeHtml(show.overview || "توضیحی برای این عنوان ثبت نشده است.")}</p>

        <div class="form-row">
          <div class="form-group">
            <label>فصل</label>
            <select class="select-input" id="seasonSelect">
              ${seasons.map(s => `
                <option value="${s.season_number}" ${s.season_number === (watchedExisting?.season ?? 1) ? "selected" : ""}>
                  فصل ${s.season_number} · ${s.episode_count || 0} قسمت
                </option>
              `).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>آخرین قسمت دیده‌شده</label>
            <input class="number-input" id="episodeInput" type="number" min="0" value="${watchedExisting?.episode ?? 0}">
          </div>
        </div>

        <div id="seasonInfo" class="api-hint"></div>

        <div class="action-row">
          <button class="primary-btn" id="saveItemBtn">
            ${watchedExisting ? "به‌روزرسانی لیست" : "افزودن به لیست"}
          </button>
          <button class="secondary-btn" id="cancelItemBtn">انصراف</button>
        </div>
      </div>
    </div>
  `;

  $("#cancelItemBtn").addEventListener("click", () => closeModal("itemModal"));
  $("#saveItemBtn").addEventListener("click", () => saveSelectedShow(show));

  $("#seasonSelect").addEventListener("change", () => {
    loadSeasonInfo(show.id, Number($("#seasonSelect").value));
  });

  loadSeasonInfo(show.id, Number($("#seasonSelect").value));
  $("#itemModal").classList.remove("hidden");
}

async function loadSeasonInfo(showId, seasonNumber) {
  const info = $("#seasonInfo");
  if (!info) return;

  info.textContent = "در حال دریافت اطلاعات فصل...";

  try {
    const season = await tmdbFetch(`/tv/${showId}/season/${seasonNumber}`, {
      language: "fa-IR"
    });

    const total = season.episodes?.length || 0;
    const latestAired = [...(season.episodes || [])]
      .filter(ep => ep.air_date)
      .sort((a,b) => new Date(b.air_date) - new Date(a.air_date))[0];

    info.textContent = `این فصل ${total} قسمت دارد${latestAired ? ` · آخرین پخش: قسمت ${latestAired.episode_number}` : ""}`;

    const episodeInput = $("#episodeInput");
    episodeInput.max = total || "";
  } catch {
    info.textContent = "اطلاعات فصل در دسترس نبود.";
  }
}

function saveSelectedShow(show) {
  const season = Number($("#seasonSelect").value);
  let episode = Number($("#episodeInput").value);

  if (!Number.isFinite(episode) || episode < 0) episode = 0;

  const existing = library.find(x => x.id === show.id);

  const item = {
    id: show.id,
    name: show.name,
    originalName: show.original_name,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    season,
    episode,
    totalSeasons: show.number_of_seasons || 0,
    latestEpisode: show.last_episode_to_air?.episode_number || 0,
    latestSeason: show.last_episode_to_air?.season_number || 0,
    firstAirDate: show.first_air_date || "",
    status: show.status || "",
    updatedAt: Date.now()
  };

  if (existing) {
    Object.assign(existing, item);
    showToast("اطلاعات عنوان به‌روزرسانی شد.");
  } else {
    library.unshift(item);
    showToast("به لیستت اضافه شد.");
  }

  saveLibrary();
  renderLibrary();
  updateStats();
  closeModal("itemModal");
}

function renderLibrary() {
  const grid = $("#watchGrid");
  const empty = $("#emptyState");

  const filtered = library.filter(item => {
    if (activeFilter === "watching") return !isCompleted(item);
    if (activeFilter === "completed") return isCompleted(item);
    return true;
  });

  empty.style.display = filtered.length ? "none" : "block";

  grid.innerHTML = filtered.map(item => {
    const total = item.season === item.latestSeason ? item.latestEpisode : 0;
    const progress = total ? Math.min(100, Math.round((item.episode / total) * 100)) : 0;
    const completed = isCompleted(item);

    return `
      <article class="watch-card">
        <img class="poster" src="${posterUrl(item.posterPath)}" alt="">
        <div class="card-content">
          <div class="card-top">
            <div>
              <h3 class="card-title">${escapeHtml(item.name)}</h3>
              <div class="card-subtitle">${escapeHtml(item.originalName || "")}</div>
            </div>
            <button class="remove-btn" data-remove="${item.id}" title="حذف">×</button>
          </div>

          <div class="progress-label">
            <span>پیشرفت</span>
            <strong>${progress}%</strong>
          </div>
          <div class="progress"><span style="width:${progress}%"></span></div>

          <div class="card-meta">
            <span class="pill">فصل ${item.season}</span>
            <span class="pill">قسمت ${item.episode}</span>
            ${item.latestEpisode ? `<span class="pill ${item.episode < item.latestEpisode ? "green" : ""}">
              آخرین: E${item.latestEpisode}
            </span>` : ""}
            ${completed ? `<span class="pill green">تمام‌شده</span>` : ""}
          </div>

          <div class="card-actions">
            <button class="primary-btn" data-edit="${item.id}">ویرایش</button>
            ${item.episode > 0 ? `<button class="secondary-btn" data-prev="${item.id}">قسمت قبلی</button>` : ""}
            ${item.episode < item.latestEpisode ? `<button class="secondary-btn" data-next="${item.id}">قسمت بعدی</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  $$("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => removeItem(Number(btn.dataset.remove)));
  });

  $$("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => editItem(Number(btn.dataset.edit)));
  });

  $$(`[data-next]`).forEach(btn => {
    btn.addEventListener("click", () => nextEpisode(Number(btn.dataset.next)));
  });

  $$(`[data-prev]`).forEach(btn => {
    btn.addEventListener("click", () => previousEpisode(Number(btn.dataset.prev)));
  });
}

function isCompleted(item) {
  return item.latestEpisode > 0
    && item.season === item.latestSeason
    && item.episode >= item.latestEpisode;
}

function removeItem(id) {
  library = library.filter(item => item.id !== id);
  saveLibrary();
  renderLibrary();
  updateStats();
  showToast("از لیست حذف شد.");
}

async function editItem(id) {
  const item = library.find(x => x.id === id);
  if (!item) return;

  try {
    const show = await tmdbFetch(`/tv/${id}`, { language: "fa-IR" });
    openItemModal(show);
    setTimeout(() => {
      const season = $("#seasonSelect");
      const episode = $("#episodeInput");
      if (season) season.value = item.season;
      if (episode) episode.value = item.episode;
      loadSeasonInfo(id, item.season);
    }, 0);
  } catch (error) {
    showToast(error.message);
  }
}

function nextEpisode(id) {
  const item = library.find(x => x.id === id);
  if (!item) return;

  item.episode += 1;
  item.updatedAt = Date.now();
  saveLibrary();
  renderLibrary();
  updateStats();
  showToast(`رسیدی به قسمت ${item.episode}.`);
}

function previousEpisode(id) {
  const item = library.find(x => x.id === id);
  if (!item) return;

  if (item.episode <= 0) {
    showToast("قسمت فعلی نمی‌تواند کمتر از 0 باشد.");
    return;
  }

  item.episode -= 1;
  item.updatedAt = Date.now();
  saveLibrary();
  renderLibrary();
  updateStats();
  showToast(`برگشتی به قسمت ${item.episode}.`);
}

function updateStats() {
  $("#totalCount").textContent = library.length;
  $("#watchingCount").textContent = library.filter(x => !isCompleted(x)).length;
  $("#completedCount").textContent = library.filter(isCompleted).length;
  $("#episodeCount").textContent = library.reduce((sum, x) => sum + (Number(x.episode) || 0), 0);
}

async function tmdbFetch(path, params = {}) {
  const key = getApiKey();
  if (!key) throw new Error("TMDB API Key وارد نشده است.");

  const url = new URL(TMDB_BASE + path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set("api_key", key);

  const response = await fetch(url);

  if (response.status === 401) {
    throw new Error("API Key اشتباه است یا اعتبار ندارد.");
  }
  if (response.status === 429) {
    throw new Error("تعداد درخواست‌ها زیاد شده؛ چند لحظه صبر کن.");
  }
  if (!response.ok) {
    throw new Error(`خطا در ارتباط با TMDB (${response.status})`);
  }

  return response.json();
}

function setLoading(value) {
  $("#searchSpinner").classList.toggle("show", value);
}

function openSettings() {
  $("#apiKeyInput").value = getApiKey();
  $("#settingsStatus").textContent = "";
  $("#settingsModal").classList.remove("hidden");
}

async function saveApiKey() {
  const key = $("#apiKeyInput").value.trim();
  const status = $("#settingsStatus");

  if (!key) {
    status.textContent = "یک API Key وارد کن.";
    return;
  }

  status.textContent = "در حال تست اتصال...";

  try {
    const previous = localStorage.getItem(API_KEY_STORAGE);
    localStorage.setItem(API_KEY_STORAGE, key);

    await tmdbFetch("/configuration");
    status.textContent = "اتصال موفق بود.";
    updateApiHint();
    showToast("TMDB با موفقیت متصل شد.");
    setTimeout(() => closeModal("settingsModal"), 700);
  } catch (error) {
    if (previous) localStorage.setItem(API_KEY_STORAGE, previous);
    else localStorage.removeItem(API_KEY_STORAGE);
    status.textContent = error.message;
  }
}

function closeModal(id) {
  $(`#${id}`).classList.add("hidden");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.dataset.theme = theme;
}
