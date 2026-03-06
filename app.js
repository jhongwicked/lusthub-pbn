const API_BASE = "https://www.eporner.com/api/v2/video/search/";
const API_ID_BASE = "https://www.eporner.com/api/v2/video/id/";
window.staticVideoIndex = {};
/* =========================================
   PWA & AGE VERIFICATION SETUP
   ========================================= */
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js").catch((err) => console.log(err));

let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function checkAgeVerification() {
  if (!localStorage.getItem("lusthub_age_verified")) {
    const overlay = document.createElement("div");
    overlay.className = "age-overlay";
    overlay.innerHTML = `
            <div class="age-modal">
                <h2>LustHub</h2>
                <p>This website contains adult material. You must be 18 years of age or older to enter. By clicking "I am 18 or older", you agree to our Terms of Service and Privacy Policy.</p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="age-btn btn-no" onclick="window.location.href='https://google.com'">Exit</button>
                    <button class="age-btn btn-yes" onclick="verifyAge(this)">I am 18 or older</button>
                </div>
            </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
  }
}
window.verifyAge = function (btn) {
  localStorage.setItem("lusthub_age_verified", "true");
  btn.closest(".age-overlay").remove();
  document.body.style.overflow = "auto";
};

/* =========================================
   FAVORITES / WATCH LATER LOGIC
   ========================================= */
function getFavorites() {
  return JSON.parse(localStorage.getItem("lusthub_favs")) || {};
}

window.toggleFavorite = function (e, id, title, thumb, duration, views) {
  e.stopPropagation(); // Pigilan ang pag-click sa video card
  let favs = getFavorites();
  const btn = e.target.closest(".fav-btn");

  if (favs[id]) {
    delete favs[id];
    btn.classList.remove("active");
    btn.innerHTML = '<i class="far fa-heart"></i>';
  } else {
    favs[id] = {
      id,
      title,
      default_thumb: { src: thumb },
      duration,
      views: parseInt(views),
    };
    btn.classList.add("active");
    btn.innerHTML = '<i class="fas fa-heart"></i>';
  }
  localStorage.setItem("lusthub_favs", JSON.stringify(favs));

  // Kung nasa favorites page tayo, i-refresh agad ang listahan
  if (document.getElementById("fav-grid")) initFavoritesPage();
};

/* =========================================
   UI & DATA FUNCTIONS
   ========================================= */
window.addEventListener("scroll", () => {
  const header = document.getElementById("mainHeader");
  if (header) {
    window.scrollY > 20
      ? header.classList.add("scrolled")
      : header.classList.remove("scrolled");
  }
});

const observerOptions = { root: null, rootMargin: "0px", threshold: 0.1 };
const scrollObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

function observeElements() {
  document
    .querySelectorAll(".animate-on-scroll")
    .forEach((el) => scrollObserver.observe(el));
}

function initSidebar() {
  const btnOpen = document.getElementById("menuToggleBtn"),
    btnClose = document.getElementById("menuCloseBtn");
  const sidebar = document.getElementById("sidebarMenu"),
    overlay = document.getElementById("sidebarOverlay");
  function toggleMenu() {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
  }
  if (btnOpen) btnOpen.addEventListener("click", toggleMenu);
  if (btnClose) btnClose.addEventListener("click", toggleMenu);
  if (overlay) overlay.addEventListener("click", toggleMenu);
}

window.triggerMenuSearch = function (query) {
  if (document.getElementById("searchInput")) {
    const input = document.getElementById("searchInput");
    input.value = query;
    input.dispatchEvent(new Event("input"));
    document.getElementById("menuCloseBtn").click();
    window.scrollTo({ top: 500, behavior: "smooth" });
  } else {
    window.location.href = `/?search=${encodeURIComponent(query)}`;
  }
};

function loadFooter() {
  // GINAMITAN NG ABSOLUTE PATH "/" PARA GUMANA KAHIT NASAANG FOLDER
  fetch("/footer.html")
    .then((res) => res.text())
    .then((data) => {
      const ph = document.getElementById("footer-placeholder");
      if (ph) {
        ph.innerHTML = data;
        setTimeout(() => {
          const installBtn = document.getElementById("installAppBtn");
          if (installBtn && deferredPrompt) {
            installBtn.style.display = "block";
            installBtn.addEventListener("click", async () => {
              deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === "accepted") installBtn.style.display = "none";
              deferredPrompt = null;
            });
          }
        }, 1000);
      }
    })
    .catch((err) => console.log(err));
}

async function fetchVideos(query = "latest", perPage = 20, page = 1) {
  try {
    const res = await fetch(
      `${API_BASE}?query=${query}&per_page=${perPage}&page=${page}&format=json&thumb_size=big`,
    );
    const data = await res.json();
    return data.videos || [];
  } catch (error) {
    return [];
  }
}

async function fetchVideoById(id) {
  try {
    const res = await fetch(`${API_ID_BASE}?id=${id}&format=json`);
    return await res.json();
  } catch (error) {
    return null;
  }
}

window.startHover = function (el) {
  const thumbsData = el.getAttribute("data-thumbs");
  if (!thumbsData) return;
  const thumbs = thumbsData.split(",");
  let i = 0;
  const img = el.querySelector("img");
  el.hoverInterval = setInterval(() => {
    i = (i + 1) % thumbs.length;
    if (img) img.src = thumbs[i];
  }, 500);
};

window.stopHover = function (el) {
  if (el.hoverInterval) {
    clearInterval(el.hoverInterval);
    el.hoverInterval = null;
  }
  const img = el.querySelector("img");
  const defaultThumb = el.getAttribute("data-default");
  if (img && defaultThumb) img.src = defaultThumb;
};

// BAGONG CARD CREATOR (May Badges at Heart Icon)
function createCard(video) {
  const thumbsStr = video.thumbs
    ? video.thumbs.map((t) => t.src).join(",")
    : "";
  const defaultThumb = video.default_thumb?.src || "";
  const title = video.title || "Untitled";
  const rawViews = video.views || 0;
  let views =
    rawViews > 1000000
      ? (rawViews / 1000000).toFixed(1) + "M"
      : rawViews > 1000
        ? (rawViews / 1000).toFixed(1) + "K"
        : rawViews;
  const duration = video.length_min || "00:00";
  const safeTitle = title.replace(/'/g, "\\'"); // Iwas error sa Javascript

  const favs = getFavorites();
  const isFav = !!favs[video.id];
  const heartIcon = isFav
    ? '<i class="fas fa-heart"></i>'
    : '<i class="far fa-heart"></i>';

  // LOGIC PARA SA STATIC REDIRECTION
  let videoUrl = `/player.html?id=${video.id}`; // Default fallback
  if (window.staticVideoIndex && window.staticVideoIndex[video.id]) {
    videoUrl = `/watch/${window.staticVideoIndex[video.id]}.html`; // Static page!
  }

  return `
    <div class="card" onclick="window.location.href='${videoUrl}'"
         data-thumbs="${thumbsStr}" data-default="${defaultThumb}"
         onmouseenter="startHover(this)" onmouseleave="stopHover(this)">
        <div class="card-thumb">
            <img src="${defaultThumb}" alt="${title}" loading="lazy">
            <div class="duration-badge">${duration}</div>
            <div class="quality-badge">HD</div>
            <button class="fav-btn ${isFav ? "active" : ""}" onclick="toggleFavorite(event, '${video.id}', '${safeTitle}', '${defaultThumb}', '${duration}', '${rawViews}')">
                ${heartIcon}
            </button>
        </div>
        <div class="card-info">
            <strong>${title}</strong>
            <div class="card-views">${views} views</div>
        </div>
    </div>`;
}

window.scrollRow = function (id, direction) {
  const row = document.getElementById(id);
  if (row) {
    row.scrollBy({
      left: direction * (row.clientWidth * 0.75),
      behavior: "smooth",
    });
  }
};

async function initHeroSlider() {
  const slider = document.getElementById("heroSlider");
  if (!slider) return;
  const videos = await fetchVideos("hd", 5);

  videos.forEach((item, i) => {
    slider.innerHTML += `
        <div class="slide ${i === 0 ? "active" : ""}" style="background-image:url(${item.default_thumb?.src || ""})">
            <div class="hero-content">
                <h1 class="hero-title animate-on-scroll is-visible">${item.title}</h1>
                <button class="hero-btn animate-on-scroll is-visible" onclick="window.location.href='player.html?id=${item.id}'">
                    <i class="fas fa-play"></i> Play Now
                </button>
            </div>
        </div>`;
  });

  let current = 0;
  setInterval(() => {
    const slides = document.querySelectorAll(".slide");
    if (slides.length > 0) {
      slides[current].classList.remove("active");
      current = (current + 1) % slides.length;
      slides[current].classList.add("active");
    }
  }, 5000);
}

async function buildSectionRow(title, query, sectionId) {
  const container = document.getElementById("rows-container");
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.className = "animate-on-scroll";
  wrapper.innerHTML = `
        <div class="section-header"><h2 class="section-title">${title}</h2></div>
        <div class="row-container">
            <button class="nav-btn prev" onclick="scrollRow('${sectionId}', -1)"><i class="fas fa-chevron-left"></i></button>
            <div class="movie-row" id="${sectionId}">
                <div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div>
            </div>
            <button class="nav-btn next" onclick="scrollRow('${sectionId}', 1)"><i class="fas fa-chevron-right"></i></button>
        </div>`;
  container.appendChild(wrapper);

  const rowGrid = document.getElementById(sectionId);
  const videos = await fetchVideos(query, 18);
  rowGrid.innerHTML = videos.map((v) => createCard(v)).join("");
  scrollObserver.observe(wrapper);
}

let currentBrowsePage = 1; // Para matandaan kung nasaang page na tayo

async function buildFullList() {
  const container = document.getElementById("rows-container");
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.style.marginTop = "60px";
  wrapper.style.paddingBottom = "50px";

  // Maghanda ng 18 skeleton loaders
  let skeletons = "";
  for (let i = 0; i < 18; i++) {
    skeletons += '<div class="card skeleton"></div>';
  }

  // Idinagdag natin ang "View More" button sa ilalim
  wrapper.innerHTML = `
        <div class="section-header">
            <h2 class="section-title">Browse All Videos</h2>
        </div>
        <div class="movie-grid" id="browse-all-grid">
            ${skeletons}
        </div>
        <div style="text-align: center; margin-top: 30px;">
            <button id="viewMoreBtn" onclick="loadMoreVideos()" style="padding: 12px 40px; background: var(--netflix-red); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 800; font-size: 16px; text-transform: uppercase; transition: 0.3s; box-shadow: 0 4px 15px rgba(229, 9, 20, 0.4);">
                View More
            </button>
        </div>
    `;

  container.appendChild(wrapper);

  // Kumuha muna ng unang 18 videos
  const grid = document.getElementById("browse-all-grid");
  const videos = await fetchVideos("top", 18, currentBrowsePage);

  grid.innerHTML =
    videos.length > 0
      ? videos.map((v) => createCard(v)).join("")
      : "<p style='color: #ffffff; padding: 20px; font-size: 18px;'>No videos found. Please refresh.</p>";
}

// Function kapag pinindot ang View More Button
window.loadMoreVideos = async function () {
  const btn = document.getElementById("viewMoreBtn");
  const grid = document.getElementById("browse-all-grid");
  if (!btn || !grid) return;

  // Baguhin muna ang text ng button para alam ng user na naglo-load
  btn.innerText = "Loading...";
  btn.disabled = true;

  // Dagdagan ang page number para makakuha ng bagong videos sa API
  currentBrowsePage++;

  // Kumuha ng bagong 18 videos mula sa susunod na page
  const newVideos = await fetchVideos("top", 18, currentBrowsePage);

  if (newVideos.length > 0) {
    // Idikit ang mga bagong videos sa ilalim ng existing grid
    const newHtml = newVideos.map((v) => createCard(v)).join("");
    grid.insertAdjacentHTML("beforeend", newHtml);

    // Ibalik sa normal ang button
    btn.innerText = "View More";
    btn.disabled = false;
  } else {
    // Kapag wala nang mahanap na video ang API
    btn.innerText = "No More Videos";
    btn.style.background = "#555";
    btn.style.boxShadow = "none";
  }
};

function initSmartSearch() {
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");
  const searchSection = document.getElementById("search-section");
  const searchGrid = document.getElementById("search-grid");
  const rowsContainer = document.getElementById("rows-container");
  const searchTitle = document.getElementById("search-title");
  let timeoutId;

  if (searchInput && searchDropdown) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(timeoutId);
      const query = e.target.value.trim();

      if (query.length > 2) {
        searchDropdown.style.display = "flex";
        searchDropdown.innerHTML = `<div style="padding: 15px; text-align: center; color: #888; font-weight: 600;">Searching...</div>`;
        rowsContainer.style.display = "none";
        searchSection.style.display = "block";
        searchSection.classList.add("is-visible");
        searchTitle.innerText = `Results for "${query}"`;
        searchGrid.innerHTML = `<p style="padding: 20px;">Loading...</p>`;

        timeoutId = setTimeout(async () => {
          const results = await fetchVideos(query, 6);
          if (results.length > 0) {
            searchDropdown.innerHTML = results
              .map((video) => {
                // --- STATIC REDIRECTION LOGIC PARA SA DROPDOWN ---
                let dropUrl = `/player.html?id=${video.id}`; // Default fallback
                if (
                  window.staticVideoIndex &&
                  window.staticVideoIndex[video.id]
                ) {
                  dropUrl = `/watch/${window.staticVideoIndex[video.id]}.html`; // Static page
                }

                return `
                  <div class="search-item" onclick="window.location.href='${dropUrl}'">
                      <img src="${video.default_thumb.src}" alt="">
                      <div class="search-item-info">
                          <div class="search-item-title">${video.title.substring(0, 40)}...</div>
                          <div class="search-item-meta">${video.length_min} &bull; ${video.views} views</div>
                      </div>
                  </div>
                  `;
              })
              .join("");
          } else {
            searchDropdown.innerHTML = `<div style="padding: 15px; text-align: center; color: #888;">No results found.</div>`;
          }

          const gridResults = await fetchVideos(query, 30);
          searchGrid.innerHTML =
            gridResults.length > 0
              ? gridResults.map((v) => createCard(v)).join("")
              : "<p>No videos found.</p>";
        }, 500);
      } else if (query.length === 0) {
        searchDropdown.style.display = "none";
        rowsContainer.style.display = "block";
        searchSection.style.display = "none";
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-container"))
        searchDropdown.style.display = "none";
    });
  }
}

async function initPlayerPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("id");
  if (!videoId) return;

  document.getElementById("playerContainer").innerHTML =
    `<iframe src="https://www.eporner.com/embed/${videoId}/" frameborder="0" width="100%" height="100%" allowfullscreen scrolling="no"></iframe>`;

  const details = await fetchVideoById(videoId);
  if (details && details.id) {
    // 1. DYNAMIC SEO TITLE
    document.title = `Watch ${details.title} - LustHub`;

    // 2. SCHEMA.ORG INJECTION (Para ma-index ng Google/Search Engines)
    const schemaObj = {
      "@context": "https://schema.org",
      "@type": "AdultVideo",
      name: details.title,
      description: `Watch ${details.title} on LustHub. Premium HD streaming.`,
      thumbnailUrl: details.default_thumb?.src,
      uploadDate: details.added || new Date().toISOString(),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(schemaObj);
    document.head.appendChild(script);

    // 3. UPDATE PLAYER UI
    document.getElementById("videoTitle").innerText =
      details.title || "Untitled";
    let vFormatted = details.views;
    if (vFormatted > 1000000)
      vFormatted = (vFormatted / 1000000).toFixed(1) + "M";
    else if (vFormatted > 1000)
      vFormatted = (vFormatted / 1000).toFixed(1) + "K";
    document.getElementById("videoViews").innerText = `${vFormatted} views`;
    document.getElementById("videoDuration").innerText =
      details.length_min || "00:00";

    const tagsContainer = document.getElementById("actorsContainer");
    const keywords = details.keywords
      ? details.keywords.split(",").slice(0, 10)
      : [];
    tagsContainer.innerHTML = keywords
      .map(
        (tag) =>
          `<button class="tag-pill" onclick="window.location.href='/?search=${encodeURIComponent(tag.trim())}'">${tag.trim()}</button>`,
      )
      .join("");

    const recGrid = document.getElementById("recommendationsGrid");
    if (recGrid && keywords.length > 0) {
      const recs = await fetchVideos(keywords[0].trim(), 18);
      recGrid.innerHTML = recs.map((v) => createCard(v)).join("");
    }
  }
  observeElements();
}

function initFavoritesPage() {
  const favGrid = document.getElementById("fav-grid");
  if (!favGrid) return;
  const favs = getFavorites();
  const favArray = Object.values(favs);

  if (favArray.length === 0) {
    favGrid.innerHTML =
      '<p style="color: #888; font-size: 18px; padding: 20px;">You haven\'t saved any videos yet. Go watch and click the heart icon!</p>';
    return;
  }
  // Gagamitin natin ang createCard, ire-reverse para latest saved ang nasa unahan
  favGrid.innerHTML = favArray
    .reverse()
    .map((v) => createCard(v))
    .join("");
}

async function initStaticRecommendations() {
  const recGrid = document.getElementById("recommendationsGrid");
  if (!recGrid) return;

  // Hanapin ang mga tags na nilagay ng Python sa HTML
  const tagElements = document.querySelectorAll(".player-tags .tag-pill");

  if (tagElements.length > 0) {
    // Kunin ang pinakaunang tag bilang keyword natin
    const firstKeyword = tagElements[0].innerText.trim();

    // Maglagay muna ng skeleton loaders habang naglo-load
    let skeletons = "";
    for (let i = 0; i < 12; i++) {
      skeletons += '<div class="card skeleton"></div>';
    }
    recGrid.innerHTML = skeletons;

    // Kumuha ng 12 na videos mula sa API gamit ang keyword
    const recs = await fetchVideos(firstKeyword, 12);

    if (recs.length > 0) {
      // I-render ang mga cards
      recGrid.innerHTML = recs.map((v) => createCard(v)).join("");
      observeElements(); // I-trigger ang animation
    } else {
      recGrid.innerHTML =
        "<p style='color: #888; padding: 20px 0;'>No related videos found.</p>";
    }
  }
}

// --- ON PAGE LOAD ---
document.addEventListener("DOMContentLoaded", () => {
  // Dinagdag natin ang ?v=timestamp para hindi ito ma-cache ng browser
  const timestamp = new Date().getTime();
  fetch(`/search_index.json?v=${timestamp}`)
    .then((res) => {
      if (!res.ok) throw new Error("File not found");
      return res.json();
    })
    // ... (tuloy lang ang dating code sa ilalim) ...
    .then((data) => {
      data.forEach((item) => {
        window.staticVideoIndex[item.id] = item.slug;
      });
    })
    .catch((err) => console.error("Static index not found", err));

  checkAgeVerification();
  loadFooter();
  initSidebar();

  // DAGDAG ITO: Ilagay natin dito sa labas para laging tumakbo kahit sa Static Pages!
  observeElements();

  if (document.getElementById("heroSlider")) {
    initHeroSlider();
    initSmartSearch();
    buildSectionRow("Trending Now", "trending", "row-trending");

    buildSectionRow("Trending Now", "trending", "row-trending");
    buildSectionRow("New Uploads", "latest", "row-latest");
    buildSectionRow("Top Rated HD", "hd", "row-toprated");
    buildSectionRow("POV Experience", "pov", "row-pov");
    buildSectionRow("Asian Collection", "asian", "row-asian");
    buildSectionRow("Latina Heat", "latina", "row-latina");
    buildSectionRow("Amateur Homemade", "amateur", "row-amateur");
    buildFullList();

    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get("search");
    if (searchQuery) {
      const input = document.getElementById("searchInput");
      if (input) {
        input.value = searchQuery;
        input.focus();
        input.dispatchEvent(new Event("input"));
      }
    }
  } else if (document.getElementById("playerContainer")) {
    initPlayerPage(); // Para ito sa dynamic /player.html
  } else if (document.getElementById("fav-grid")) {
    initFavoritesPage(); // Para ito sa favorites
  } else if (
    document.getElementById("recommendationsGrid") &&
    window.location.pathname.includes("/watch/")
  ) {
    // DAGDAG ITO: Para ito sa mga Python-generated static pages!
    initStaticRecommendations();
  }
});
