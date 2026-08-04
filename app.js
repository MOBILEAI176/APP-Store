JavaScript
// Top of app.js (Line 1) - KEEP THIS ONE ONLY
const API_BASE = '/api';

let currentPage = 1;
let currentCategory = 'ALL';
let isLoading = false;
let hasMore = true;
let isExpandedView = false;
let currentLang = 'en';
let carouselInterval = null;
let currentSlideIndex = 0;

const translations = {
  en: {
    today: 'Today',
    apps: 'Apps',
    search: 'Search',
    worldPremiere: 'WORLD PREMIERE',
    inGameEvent: 'IN-GAME EVENT',
    editorial: 'EDITORIAL',
    get: 'GET',
    seeAll: 'See All ›',
    biggestEvents: "Today's Biggest Events",
    editorsChoice: "App Store Editors' Favourites",
    topGames: "Top Games & Apps Today",
    settings: 'Account Settings',
    appearance: 'APPEARANCE',
    darkMode: 'Dark Mode Theme',
    preferences: 'PREFERENCES',
    language: 'Language',
    searchPlaceholder: 'Games, Apps, Stories and More'
  }
};

const availableLanguages = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' }
];

let pageTitle, headerDate, navItems, viewSections;
let headerUserAvatar, profileBtn, profileModal, profileClose;
let modalUserAvatar, modalUserName, modalUserEmail, modalUserStatus, themeToggle, languageSelect;
let todayHeroStack, todayEventsStack, editorialFavsStack, todayList, seeAllToday;
let mustHaveAppsGrid, editorsChoiceGrid, happeningNowStack, summertimeEssentialsGrid, topGamesGrid;
let heroCarouselTrack, carouselIndicators;
let searchInput, searchResults;
let appsMainContainer, appsExpandedContainer, appsExpandedList, expandedCategoryTitle, btnBackToApps, loadingSpinner;

document.addEventListener('DOMContentLoaded', () => {
  pageTitle = document.getElementById('pageTitle');
  headerDate = document.getElementById('headerDate');
  navItems = document.querySelectorAll('.nav-item');
  viewSections = document.querySelectorAll('.view-section');

  headerUserAvatar = document.getElementById('headerUserAvatar');
  profileBtn = document.getElementById('profileBtn');
  profileModal = document.getElementById('profileModal');
  profileClose = document.getElementById('profileClose');

  modalUserAvatar = document.getElementById('modalUserAvatar');
  modalUserName = document.getElementById('modalUserName');
  modalUserEmail = document.getElementById('modalUserEmail');
  modalUserStatus = document.getElementById('modalUserStatus');
  themeToggle = document.getElementById('themeToggle');
  languageSelect = document.getElementById('languageSelect');

  todayHeroStack = document.getElementById('todayHeroStack');
  todayEventsStack = document.getElementById('todayEventsStack');
  editorialFavsStack = document.getElementById('editorialFavsStack');
  todayList = document.getElementById('todayList');
  seeAllToday = document.getElementById('seeAllToday');

  heroCarouselTrack = document.getElementById('heroCarouselTrack');
  carouselIndicators = document.getElementById('carouselIndicators');
  mustHaveAppsGrid = document.getElementById('mustHaveAppsGrid');
  editorsChoiceGrid = document.getElementById('editorsChoiceGrid');
  happeningNowStack = document.getElementById('happeningNowStack');
  summertimeEssentialsGrid = document.getElementById('summertimeEssentialsGrid');
  topGamesGrid = document.getElementById('topGamesGrid');

  searchInput = document.getElementById('searchInput');
  searchResults = document.getElementById('searchResults');

  // Expanded View Elements
  appsMainContainer = document.getElementById('appsMainContainer');
  appsExpandedContainer = document.getElementById('appsExpandedContainer');
  appsExpandedList = document.getElementById('appsExpandedList');
  expandedCategoryTitle = document.getElementById('expandedCategoryTitle');
  btnBackToApps = document.getElementById('btnBackToApps');
  loadingSpinner = document.getElementById('loadingSpinner');

  if (headerDate) {
    headerDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // Bottom Navigation Handling
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      const dict = translations[currentLang] || translations.en;
      
      navItems.forEach(i => i.classList.remove('active'));
      viewSections.forEach(s => s.classList.remove('active'));
      
      item.classList.add('active');
      if (pageTitle) pageTitle.textContent = dict[tabName] || tabName.toUpperCase();
      
      const targetSection = document.getElementById(`view${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
      if (targetSection) targetSection.classList.add('active');

      if (tabName !== 'apps') {
        closeExpandedCategory();
      }
    });
  });

  // Top Category Pills Listener
  const tagPills = document.querySelectorAll('#appsCategoryPills .pill');
  tagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      const category = pill.getAttribute('data-cat');
      if (category === 'ALL') {
        closeExpandedCategory();
      } else {
        openCategoryView(category, pill.innerText);
      }
    });
  });

  // Category Expand / "See All" Buttons
  document.querySelectorAll('.category-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');
      openCategoryView(category, category);
    });
  });

  btnBackToApps?.addEventListener('click', closeExpandedCategory);

  // Dynamic Scroll Listener for Infinite Pagination
  window.addEventListener('scroll', handleInfiniteScroll);

  if (searchInput) {
    searchInput.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      if (!query) {
        if (searchResults) searchResults.innerHTML = '';
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const results = await res.json();
        if (searchResults) {
          searchResults.innerHTML = '';
          if (Array.isArray(results)) {
            results.forEach(app => searchResults.appendChild(createAppCard(app)));
          }
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }));
  }

  initLanguageOptions();
  loadUserProfile();
  loadStoreData();
  setupModalListeners();
});

// Category Expand & Pagination Logic
function openCategoryView(categoryKey, displayTitle) {
  currentCategory = categoryKey;
  currentPage = 1;
  hasMore = true;
  isExpandedView = true;

  if (appsMainContainer) appsMainContainer.style.display = 'none';
  if (appsExpandedContainer) appsExpandedContainer.style.display = 'block';
  if (expandedCategoryTitle) expandedCategoryTitle.textContent = displayTitle;
  if (appsExpandedList) appsExpandedList.innerHTML = '';

  fetchCategoryApps();
}

function closeExpandedCategory() {
  isExpandedView = false;
  if (appsMainContainer) appsMainContainer.style.display = 'block';
  if (appsExpandedContainer) appsExpandedContainer.style.display = 'none';
  
  const tagPills = document.querySelectorAll('#appsCategoryPills .pill');
  tagPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-cat') === 'ALL'));
}

function handleInfiniteScroll() {
  if (!isExpandedView || isLoading || !hasMore) return;

  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.documentElement.offsetHeight - 300;

  if (scrollPosition >= threshold) {
    fetchCategoryApps();
  }
}

function createAppCard(app) {
  const card = document.createElement('div');
  card.className = 'app-card';
  const dict = translations[currentLang] || translations.en;
  const appId = app.appId || app.id;

  card.innerHTML = `
    <img class="app-icon" src="${app.icon}" alt="${app.title}" loading="lazy" />
    <div class="app-details">
      <div class="app-title">${app.title}</div>
      <div class="app-developer">${app.developer || app.summary}</div>
    </div>
    <button class="btn-get" onclick="handleGetClick(event, '${appId}')">${dict.get || 'GET'}</button>
  `;
  card.addEventListener('click', () => openAppDetail(appId));
  return card;
}

function createHeroCard(app, tagKey, description) {
  const card = document.createElement('div');
  card.className = 'today-hero-card in-view';

  const dict = translations[currentLang] || translations.en;
  const tagText = dict[tagKey] || tagKey;
  const appId = app.appId || app.id;
  const bgImage = app.banner || app.icon;

  card.innerHTML = `
    <div class="today-hero-bg" style="background-image: url('${bgImage}');"></div>
    <div class="today-hero-content">
      <div class="hero-header-text">
        <span class="hero-tag">${tagText}</span>
        <h2 class="hero-title">${app.title}</h2>
      </div>
      
      <div class="today-card-footer-bar">
        <div class="ios-card-left-info">
          <img class="ios-card-icon" src="${app.icon}" alt="${app.title}" />
          <div class="ios-card-meta">
            <span class="ios-card-name">${app.title}</span>
            <span class="ios-card-desc">${description || app.summary || 'Featured Application'}</span>
          </div>
        </div>
        <button class="btn-get" onclick="handleGetClick(event, '${appId}')">${dict.get || 'GET'}</button>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openAppDetail(appId));
  return card;
}

function renderBannerSlide(app, tagText, headline) {
  const slide = document.createElement('div');
  slide.className = 'carousel-slide';
  const appId = app.appId || app.id;
  const bgImage = app.banner || app.icon;

  slide.innerHTML = `
    <div class="slide-bg" style="background-image: url('${bgImage}');"></div>
    <div class="slide-content">
      <div>
        <span class="hero-tag">${tagText}</span>
        <h2 class="hero-title">${headline || app.title}</h2>
        <p style="font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 4px;">${app.summary || ''}</p>
      </div>
      <div class="today-card-footer-bar" style="margin-top: auto;">
        <div class="ios-card-left-info">
          <img class="ios-card-icon" src="${app.icon}" alt="${app.title}" />
          <div class="ios-card-meta">
            <span class="ios-card-name">${app.title}</span>
            <span class="ios-card-desc">${app.developer}</span>
          </div>
        </div>
        <button class="btn-get" onclick="handleGetClick(event, '${appId}')">GET</button>
      </div>
    </div>
  `;
  slide.addEventListener('click', () => openAppDetail(appId));
  return slide;
}

function setupAutoCarousel(slidesCount) {
  if (carouselInterval) clearInterval(carouselInterval);
  currentSlideIndex = 0;

  if (carouselIndicators) {
    carouselIndicators.innerHTML = '';
    for (let i = 0; i < slidesCount; i++) {
      const dot = document.createElement('div');
      dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => goToSlide(i));
      carouselIndicators.appendChild(dot);
    }
  }

  carouselInterval = setInterval(() => {
    currentSlideIndex = (currentSlideIndex + 1) % slidesCount;
    goToSlide(currentSlideIndex);
  }, 4500);
}

function goToSlide(index) {
  currentSlideIndex = index;
  if (heroCarouselTrack) {
    heroCarouselTrack.style.transform = `translateX(-${index * 100}%)`;
  }
  const dots = document.querySelectorAll('.carousel-dot');
  dots.forEach((dot, idx) => dot.classList.toggle('active', idx === index));
}

function createHappeningCard(app, tagText, titleText) {
  const card = document.createElement('div');
  card.className = 'happening-card';
  const appId = app.appId || app.id;

  card.innerHTML = `
    <div class="happening-image-wrapper">
      <img src="${app.banner || app.icon}" alt="${app.title}" />
      <div class="happening-overlay-text">
        <span class="tag">${tagText}</span>
        <h4>${titleText}</h4>
      </div>
    </div>
    <div class="happening-card-footer">
      <img src="${app.icon}" class="app-icon" style="width: 40px; height: 40px;" />
      <div class="app-details">
        <div class="app-title">${app.title}</div>
        <div class="app-developer">${app.developer}</div>
      </div>
      <button class="btn-get" onclick="handleGetClick(event, '${appId}')">GET</button>
    </div>
  `;
  card.addEventListener('click', () => openAppDetail(appId));
  return card;
}

async function loadStoreData() {
  try {
    const res = await fetch(`${API_BASE}/trending`);
    if (!res.ok) return;
    const apps = await res.json();
    
    if (!Array.isArray(apps) || apps.length === 0) return;

    if (todayHeroStack) {
      todayHeroStack.innerHTML = '';
      todayHeroStack.appendChild(createHeroCard(apps[0], 'worldPremiere', apps[0].summary));
    }
    if (todayEventsStack) {
      todayEventsStack.innerHTML = '';
      apps.slice(1, 3).forEach(app => todayEventsStack.appendChild(createHeroCard(app, 'inGameEvent', 'Special Event')));
    }
    if (editorialFavsStack) {
      editorialFavsStack.innerHTML = '';
      apps.slice(3, 5).forEach(app => editorialFavsStack.appendChild(createHeroCard(app, 'editorial', "Editor's Choice")));
    }
    if (todayList) {
      todayList.innerHTML = '';
      apps.slice(5, 11).forEach(app => todayList.appendChild(createAppCard(app)));
    }

    if (heroCarouselTrack) {
      heroCarouselTrack.innerHTML = '';
      const carouselItems = [
        { app: apps[0], tag: 'NOW AVAILABLE', title: 'Color Your Own Artwork!' },
        { app: apps[1], tag: 'WORLD PREMIERE', title: 'Unlock Spider-Man Content' },
        { app: apps[2], tag: 'MAJOR UPDATE', title: 'Connect & Share Instantly' }
      ];
      carouselItems.forEach(item => {
        heroCarouselTrack.appendChild(renderBannerSlide(item.app, item.tag, item.title));
      });
      setupAutoCarousel(carouselItems.length);
    }

    if (mustHaveAppsGrid) {
      mustHaveAppsGrid.innerHTML = '';
      apps.slice(0, 6).forEach(app => mustHaveAppsGrid.appendChild(createAppCard(app)));
    }

    if (editorsChoiceGrid) {
      editorsChoiceGrid.innerHTML = '';
      apps.slice(6, 12).forEach(app => editorsChoiceGrid.appendChild(createAppCard(app)));
    }

    if (happeningNowStack) {
      happeningNowStack.innerHTML = '';
      happeningNowStack.appendChild(createHappeningCard(apps[3] || apps[0], 'NOW AVAILABLE', 'Spider-Man: Brand New Day'));
      happeningNowStack.appendChild(createHappeningCard(apps[4] || apps[1], 'SPECIAL EVENT', 'Files that go where you go.'));
    }

    if (summertimeEssentialsGrid) {
      summertimeEssentialsGrid.innerHTML = '';
      apps.slice(12, 18).forEach(app => summertimeEssentialsGrid.appendChild(createAppCard(app)));
    }

    if (topGamesGrid) {
      topGamesGrid.innerHTML = '';
      apps.slice(2, 8).forEach(app => topGamesGrid.appendChild(createAppCard(app)));
    }

  } catch (err) {
    console.error('Error loading store data:', err);
  }
}

async function openAppDetail(appId) {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('app-modal-container');

  overlay.classList.add('active');
  container.innerHTML = '<div style="padding: 40px; text-align: center; color: #fff;">Loading store details...</div>';

  try {
    const response = await fetch(`${API_BASE}/app/${encodeURIComponent(appId)}`);
    if (!response.ok) throw new Error('App dynamic fetch failed');
    const app = await response.json();

    const screenshotsList = Array.isArray(app.screenshots) ? app.screenshots : [];
    const screenshotGalleryHTML = screenshotsList.length > 0 ? `
      <div class="screenshots-container">
        ${screenshotsList.map(url => `<img src="${url}" class="screenshot-img" alt="Screenshot" />`).join('')}
      </div>
    ` : '';

    container.innerHTML = `
      <div class="modal-top-bar">
        <span style="font-weight: 700;">${app.title}</span>
        <button class="circle-btn" onclick="closeAppModal()">&times;</button>
      </div>

      <div class="modal-body-scroll" style="padding: 20px; overflow-y: auto;">
        <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 20px;">
          <img src="${app.icon}" style="width: 80px; height: 80px; border-radius: 18px;" />
          <div>
            <h2 style="font-size: 22px; margin-bottom: 4px;">${app.title}</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">${app.developer}</p>
            <button class="btn-get" style="margin-top: 8px;" onclick="handleDirectGet('${app.appId}')">GET</button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 14px; margin-bottom: 20px; text-align: center;">
          <div>
            <div style="font-size: 11px; color: var(--text-secondary);">RATING</div>
            <div style="font-size: 16px; font-weight: 700;">★ ${app.rating}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-secondary);">AGE</div>
            <div style="font-size: 16px; font-weight: 700;">${app.contentRating}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-secondary);">SIZE</div>
            <div style="font-size: 16px; font-weight: 700;">${app.size}</div>
          </div>
        </div>

        ${screenshotGalleryHTML}

        <div style="margin-top: 20px;">
          <h3 style="font-size: 18px; margin-bottom: 8px;">Description</h3>
          <p style="font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.8);">${app.description}</p>
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `
      <div class="modal-top-bar">
        <span>Error</span>
        <button class="circle-btn" onclick="closeAppModal()">&times;</button>
      </div>
      <div style="text-align: center; padding: 40px; color: #fff;">
        <p style="color: #ff453a;">Unable to load app details.</p>
      </div>
    `;
  }
}

function closeAppModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');
}

function initLanguageOptions() {
  if (!languageSelect) return;
  languageSelect.innerHTML = '';
  availableLanguages.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.label;
    languageSelect.appendChild(opt);
  });

  languageSelect.addEventListener('change', (e) => switchLanguage(e.target.value));
}

function switchLanguage(lang) {
  currentLang = translations[lang] ? lang : 'en';
  const dict = translations[currentLang] || translations.en;
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'today';
  if (pageTitle) pageTitle.textContent = dict[activeTab] || dict.today;
}

async function loadUserProfile() {
  try {
    const res = await fetch(`${API_BASE}/user/profile`);
    if (!res.ok) return;
    const user = await res.json();
    if (user && user.email) {
      if (headerUserAvatar) headerUserAvatar.src = user.avatar;
      if (modalUserAvatar) modalUserAvatar.src = user.avatar;
      if (modalUserName) modalUserName.textContent = user.name;
      if (modalUserEmail) modalUserEmail.textContent = user.email;
      if (modalUserStatus) modalUserStatus.textContent = user.status;
    }
  } catch (err) {
    console.error('Error loading profile:', err);
  }
}

function setupModalListeners() {
  profileBtn?.addEventListener('click', () => profileModal?.classList.add('active'));
  profileClose?.addEventListener('click', () => profileModal?.classList.remove('active'));

  themeToggle?.addEventListener('change', (e) => {
    document.body.classList.toggle('light-theme', !e.target.checked);
    document.body.classList.toggle('dark-theme', e.target.checked);
  });

  seeAllToday?.addEventListener('click', () => {
    document.querySelector('[data-tab="apps"]')?.click();
  });
}

function handleDirectGet(appId) {
  if (!appId) return;
  window.open(`https://play.google.com/store/apps/details?id=${appId}`, '_blank');
}

function handleGetClick(event, appId) {
  if (event) event.stopPropagation();
  handleDirectGet(appId);
}

function debounce(func, delay = 350) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

async function fetchCategoryApps() {
  if (isLoading || !hasMore) return;
  isLoading = true;
  if (loadingSpinner) loadingSpinner.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/apps?category=${encodeURIComponent(currentCategory)}&page=${currentPage}&limit=10`);
    if (!res.ok) throw new Error('Failed to load category apps');

    const responseData = await res.json();

    let apps = [];
    if (Array.isArray(responseData)) {
      apps = responseData;
    } else if (Array.isArray(responseData.apps)) {
      apps = responseData.apps;
    } else if (Array.isArray(responseData.data)) {
      apps = responseData.data;
    }

    if (!appsExpandedList) return;

    if (apps.length === 0 && currentPage === 1) {
      appsExpandedList.innerHTML = `<div style="color: #8e8e93; text-align: center; padding: 40px;">No apps found in this category.</div>`;
      hasMore = false;
      return;
    }

    if (apps.length < 10) {
      hasMore = false;
    }

    apps.forEach(app => {
      appsExpandedList.appendChild(createAppCard(app));
    });

    currentPage++;
  } catch (err) {
    console.error('Error loading category apps:', err);
    if (appsExpandedList && currentPage === 1) {
      appsExpandedList.innerHTML = `<div style="color: #ff453a; text-align: center; padding: 40px;">Failed to load apps.</div>`;
    }
  } finally {
    isLoading = false;
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
}

let gamesCurrentPage = 1;
let gamesCurrentCategory = 'ALL';
let gamesIsLoading = false;
let gamesHasMore = true;
let isGamesExpandedView = false;

document.addEventListener('DOMContentLoaded', () => {
  const gamesPills = document.querySelectorAll('#gamesCategoryPills .pill');
  gamesPills.forEach(pill => {
    pill.addEventListener('click', () => {
      gamesPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const cat = pill.getAttribute('data-cat');
      if (cat === 'ALL') {
        closeGamesExpandedCategory();
      } else {
        openGamesCategoryView(cat, pill.innerText.trim());
      }
    });
  });

  document.querySelectorAll('#viewGames .category-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');
      openGamesCategoryView(category, category);
    });
  });

  document.getElementById('btnBackToGames')?.addEventListener('click', closeGamesExpandedCategory);
  window.addEventListener('scroll', handleGamesInfiniteScroll);
  loadGamesSectionData();
});

function openGamesCategoryView(categoryKey, displayTitle) {
  gamesCurrentCategory = categoryKey;
  gamesCurrentPage = 1;
  gamesHasMore = true;
  isGamesExpandedView = true;

  document.getElementById('gamesMainContainer').style.display = 'none';
  document.getElementById('gamesExpandedContainer').style.display = 'block';
  document.getElementById('expandedGamesCategoryTitle').textContent = displayTitle;
  document.getElementById('gamesExpandedList').innerHTML = '';

  fetchGamesCategoryApps();
}

function closeGamesExpandedCategory() {
  isGamesExpandedView = false;
  document.getElementById('gamesMainContainer').style.display = 'block';
  document.getElementById('gamesExpandedContainer').style.display = 'none';

  const pills = document.querySelectorAll('#gamesCategoryPills .pill');
  pills.forEach(p => p.classList.toggle('active', p.getAttribute('data-cat') === 'ALL'));
}

async function fetchGamesCategoryApps() {
  if (gamesIsLoading || !gamesHasMore) return;
  gamesIsLoading = true;
  const spinner = document.getElementById('gamesLoadingSpinner');
  if (spinner) spinner.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/apps?category=${encodeURIComponent(gamesCurrentCategory)}&page=${gamesCurrentPage}&limit=10`);
    if (!res.ok) throw new Error('Failed to fetch games');

    const data = await res.json();
    const games = Array.isArray(data) ? data : (data.apps || data.data || []);

    const container = document.getElementById('gamesExpandedList');
    if (!container) return;

    if (games.length === 0 && gamesCurrentPage === 1) {
      container.innerHTML = `<div style="color: #8e8e93; text-align: center; padding: 40px;">No games found in this category.</div>`;
      gamesHasMore = false;
      return;
    }

    if (games.length < 10) gamesHasMore = false;

    games.forEach(game => {
      container.appendChild(createAppCard(game));
    });

    gamesCurrentPage++;
  } catch (err) {
    console.error('Error fetching games category:', err);
  } finally {
    gamesIsLoading = false;
    if (spinner) spinner.style.display = 'none';
  }
}

function handleGamesInfiniteScroll() {
  if (!isGamesExpandedView || gamesIsLoading || !gamesHasMore) return;
  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.documentElement.offsetHeight - 300;

  if (scrollPosition >= threshold) {
    fetchGamesCategoryApps();
  }
}

async function loadGamesSectionData() {
  try {
    const res = await fetch(`${API_BASE}/trending`);
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    const games = items;

    const heroSpotlight = document.getElementById('gamesHeroSpotlight');
    if (heroSpotlight && games[0]) {
      heroSpotlight.innerHTML = `
        <div class="games-hero-card" onclick="openAppDetail('${games[0].appId || games[0].id}')">
          <div class="games-hero-bg" style="background-image: url('${games[0].banner || games[0].icon}');"></div>
          <div class="games-hero-content">
            <span class="hero-tag">NEW GAME</span>
            <h2 class="hero-title">${games[0].title}</h2>
            <p class="hero-subtitle">${games[0].summary || 'Explore open-world adventures'}</p>
            <div class="today-card-footer-bar">
              <div class="ios-card-left-info">
                <img class="ios-card-icon" src="${games[0].icon}" alt="${games[0].title}" />
                <div class="ios-card-meta">
                  <span class="ios-card-name">${games[0].title}</span>
                  <span class="ios-card-desc">${games[0].developer}</span>
                </div>
              </div>
              <button class="btn-get" onclick="handleGetClick(event, '${games[0].appId || games[0].id}')">VIEW</button>
            </div>
          </div>
        </div>
      `;
    }

    renderAppGrid('whatWerePlayingGrid', games.slice(1, 7));
    renderAppGrid('mustPlayGamesGrid', games.slice(7, 13));
    renderAppGrid('newGamesWeLoveGrid', games.slice(13, 19));

    const topFreeRow = document.getElementById('topFreeGamesRow');
    if (topFreeRow) {
      topFreeRow.innerHTML = '';
      games.slice(0, 3).forEach((game, index) => {
        const card = document.createElement('div');
        card.className = 'ranked-card';
        card.onclick = () => openAppDetail(game.appId || game.id);
        card.innerHTML = `
          <span class="rank-number">${index + 1}</span>
          <img src="${game.icon}" class="ranked-icon" alt="${game.title}" />
          <div class="ranked-title">${game.title}</div>
          <div class="ranked-category">${game.developer || 'Games'}</div>
          <button class="btn-get" onclick="handleGetClick(event, '${game.appId || game.id}')">GET</button>
        `;
        topFreeRow.appendChild(card);
      });
    }

    const summerRow = document.getElementById('summerEventBanners');
    if (summerRow) {
      summerRow.innerHTML = '';
      games.slice(3, 5).forEach(game => {
        const banner = document.createElement('div');
        banner.className = 'visual-banner-card';
        banner.onclick = () => openAppDetail(game.appId || game.id);
        banner.innerHTML = `
          <img src="${game.banner || game.icon}" alt="${game.title}" />
          <div class="banner-title">${game.title}</div>
        `;
        summerRow.appendChild(banner);
      });
    }

  } catch (err) {
    console.error('Error loading games section:', err);
  }
}

function renderAppGrid(elementId, items) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => container.appendChild(createAppCard(item)));
}




// Load saved user profile on application startup
function loadUserProfile() {
  const savedUser = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const name = savedUser.name || 'Alex Developer';
  const email = savedUser.email || 'alex.dev@apple.com';
  const avatar = savedUser.avatar || 'https://ui-avatars.com/api/?name=Alex+Developer&size=80&background=0A84FF&color=fff';

  if (headerUserAvatar) headerUserAvatar.src = avatar;
  if (modalUserAvatar) modalUserAvatar.src = avatar;
  if (editUserName) editUserName.value = name;
  if (editUserEmail) editUserEmail.value = email;
}

// Setup Event Listeners for Profile Editing & Device File Upload
function setupModalListeners() {
  profileBtn?.addEventListener('click', () => profileModal?.classList.add('active'));
  profileClose?.addEventListener('click', () => profileModal?.classList.remove('active'));

  // Handle local image file upload from device
  avatarFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        if (modalUserAvatar) modalUserAvatar.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Save changes to localStorage and update app header
  btnSaveProfile?.addEventListener('click', () => {
    const updatedName = editUserName?.value.trim() || 'User';
    const updatedEmail = editUserEmail?.value.trim() || 'user@example.com';
    const updatedAvatar = modalUserAvatar?.src;

    if (headerUserAvatar) headerUserAvatar.src = updatedAvatar;

    localStorage.setItem('user_profile', JSON.stringify({
      name: updatedName,
      email: updatedEmail,
      avatar: updatedAvatar
    }));

    profileModal?.classList.remove('active');
  });

  // Theme toggle setting listener
  themeToggle?.addEventListener('change', (e) => {
    document.body.classList.toggle('light-theme', !e.target.checked);
    document.body.classList.toggle('dark-theme', e.target.checked);
  });
}



// Toggle search state depending on whether text is present
function toggleSearchState(query) {
  if (searchClearBtn) searchClearBtn.style.display = query ? 'flex' : 'none';
  if (searchDiscoverSection) searchDiscoverSection.style.display = query ? 'none' : 'block';
  if (searchResults && !query) searchResults.innerHTML = '';
}

// Fetch search results from backend API
async function executeSearch(query) {
  if (!searchResults) return;
  searchResults.innerHTML = '<div style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 30px;">Searching App Store...</div>';
  
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();
    searchResults.innerHTML = '';
    
    if (Array.isArray(results) && results.length > 0) {
      results.forEach(app => searchResults.appendChild(createAppCard(app)));
    } else {
      searchResults.innerHTML = '<div style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 30px;">No results found.</div>';
    }
  } catch (err) {
    console.error('Search error:', err);
  }
}

// Debounce helper to prevent excessive API requests
function debounce(func, delay = 350) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Attach Search Handlers inside DOMContentLoaded
if (searchInput) {
  searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    toggleSearchState(query);
    if (!query) return;

    await executeSearch(query);
  }));
}

searchClearBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  toggleSearchState('');
});

// Trending Search Tag Click Listener
document.querySelectorAll('.trending-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const q = tag.getAttribute('data-query');
    if (searchInput && q) {
      searchInput.value = q;
      toggleSearchState(q);
      executeSearch(q);
    }
  });
});


// Attach event listeners to Profile Button and all Edit Pen Icons
function setupProfileEditTriggers() {
  const profileModal = document.getElementById('profileModal');
  const profileClose = document.getElementById('profileClose');

  // Select any button or icon intended for editing (e.g., pen icons)
  const editTriggers = document.querySelectorAll('#profileBtn, .edit-pen-btn, .edit-icon, #editPenBtn');

  // Open modal on clicking avatar OR any edit pen button
  editTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileModal();
    });
  });

  // Close modal listener
  profileClose?.addEventListener('click', () => {
    profileModal?.classList.remove('active');
  });
}

// Function to open modal and pre-fill existing user data
function openProfileModal() {
  const profileModal = document.getElementById('profileModal');
  const modalUserAvatar = document.getElementById('modalUserAvatar');
  const editUserName = document.getElementById('editUserName');
  const editUserEmail = document.getElementById('editUserEmail');

  const savedUser = JSON.parse(localStorage.getItem('user_profile') || '{}');
  
  if (editUserName) editUserName.value = savedUser.name || 'Alex Developer';
  if (editUserEmail) editUserEmail.value = savedUser.email || 'alex.dev@apple.com';
  if (modalUserAvatar) modalUserAvatar.src = savedUser.avatar || 'https://ui-avatars.com/api/?name=Alex+Developer&size=80&background=0A84FF&color=fff';

  profileModal?.classList.add('active');
}

// Local Avatar Upload & Save Handler
function setupProfileSaveLogic() {
  const avatarFileInput = document.getElementById('avatarFileInput');
  const modalUserAvatar = document.getElementById('modalUserAvatar');
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  const editUserName = document.getElementById('editUserName');
  const editUserEmail = document.getElementById('editUserEmail');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const profileModal = document.getElementById('profileModal');

  // Local device file upload handler
  avatarFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        if (modalUserAvatar) modalUserAvatar.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Save updated details to localStorage
  btnSaveProfile?.addEventListener('click', () => {
    const updatedName = editUserName?.value.trim() || 'User';
    const updatedEmail = editUserEmail?.value.trim() || 'user@example.com';
    const updatedAvatar = modalUserAvatar?.src;

    if (headerUserAvatar) headerUserAvatar.src = updatedAvatar;

    localStorage.setItem('user_profile', JSON.stringify({
      name: updatedName,
      email: updatedEmail,
      avatar: updatedAvatar
    }));

    profileModal?.classList.remove('active');
  });
}

// Initialize handlers once DOM content is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  setupProfileEditTriggers();
  setupProfileSaveLogic();
});



// Base API definition (Place at the very top of app.js)


// Overwrite loadStoreData (Lines ~340-420)
async function loadStoreData() {
    try {
        const response = await fetch(`${API_BASE}/trending`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        renderStoreSection(data);
    } catch (error) {
        console.error('Error loading store data:', error);
    }
}

// Overwrite loadGamesSectionData (Lines ~710-790)
async function loadGamesSectionData() {
    try {
        const response = await fetch(`${API_BASE}/apps?category=GAMES`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        renderGamesSection(data.data || []);
    } catch (error) {
        console.error('Error loading games section:', error);
    }
}
