(() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    channelId: 'UClz3lLJyDq5Jh1-Ete2JmJA',
    channelName: 'Star Wars Nuggets',
    defaultEngine: 'channel',
    theme: 'dark',
    history: []
  });

  const ENGINES = Object.freeze({
    channel: {
      label: 'Channel',
      shortcut: '!sw',
      buildUrl: (query, settings) => {
        const scoped = `${query} ${settings.channelName}`.trim();
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(scoped)}`;
      }
    },
    youtube: {
      label: 'YouTube',
      shortcut: '!yt',
      buildUrl: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    },
    google: {
      label: 'Google',
      shortcut: '!g',
      buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    wookieepedia: {
      label: 'Wookieepedia',
      shortcut: '!w',
      buildUrl: (query) => `https://starwars.fandom.com/wiki/Special:Search?query=${encodeURIComponent(query)}`
    }
  });

  const SHORTCUT_ENGINE = Object.freeze(Object.fromEntries(
    Object.entries(ENGINES).map(([engine, config]) => [config.shortcut, engine])
  ));

  const STORAGE_KEY = 'starWarsNuggetsSettings';
  const MAX_HISTORY = 20;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const elements = {
    root: document.documentElement,
    channelLink: $('#channelLink'),
    toggleTheme: $('#toggleTheme'),
    openSettings: $('#openSettings'),
    settingsModal: $('#settingsModal'),
    closeSettings: $('#closeSettings'),
    settingsForm: $('#settingsForm'),
    channelName: $('#channelName'),
    channelId: $('#channelId'),
    defaultEngine: $('#defaultEngine'),
    resetSettings: $('#resetSettings'),
    searchForm: $('#searchForm'),
    searchInput: $('#searchInput'),
    suggestions: $('#suggestions'),
    historyList: $('#historyList'),
    clearHistory: $('#clearHistory'),
    feed: $('#feed'),
    refreshFeed: $('#refreshFeed'),
    showModal: $('#showModal'),
    dalleModal: $('#dalleModal'),
    closeModal: $('#closeModal')
  };

  let settings = { ...DEFAULTS };
  let selectedEngine = DEFAULTS.defaultEngine;

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
  }

  function hasChromeTabs() {
    return typeof chrome !== 'undefined' && Boolean(chrome.tabs?.create);
  }

  async function readSettings() {
    if (hasChromeStorage()) {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
    }

    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  async function writeSettings(nextSettings) {
    settings = { ...DEFAULTS, ...nextSettings };
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }

  function setTheme(theme) {
    const safeTheme = theme === 'light' ? 'light' : 'dark';
    elements.root.dataset.theme = safeTheme;
    elements.toggleTheme.textContent = safeTheme === 'light' ? '☾' : '☀';
    elements.toggleTheme.title = safeTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  }

  function setActiveEngine(engine) {
    selectedEngine = ENGINES[engine] ? engine : DEFAULTS.defaultEngine;
    $$('.chip').forEach((button) => {
      button.classList.toggle('active', button.dataset.engine === selectedEngine);
      button.setAttribute('aria-checked', String(button.dataset.engine === selectedEngine));
    });
    renderSuggestions();
  }

  function parseQuery(input) {
    const raw = input.trim().replace(/\s+/g, ' ');
    const [first, ...rest] = raw.split(' ');
    const shortcutEngine = SHORTCUT_ENGINE[first?.toLowerCase()];
    if (shortcutEngine && rest.join(' ').trim()) {
      return { query: rest.join(' ').trim(), engine: shortcutEngine };
    }
    return { query: raw, engine: selectedEngine };
  }

  function buildSearchUrl(query, engine) {
    return ENGINES[engine].buildUrl(query, settings);
  }

  async function openUrl(url) {
    if (hasChromeTabs()) {
      await chrome.tabs.create({ url });
      window.close();
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function saveHistory(query, engine) {
    const normalized = query.trim();
    if (!normalized) return;

    const now = new Date().toISOString();
    const current = Array.isArray(settings.history) ? settings.history : [];
    const existing = current.find((item) => item.query.toLowerCase() === normalized.toLowerCase() && item.engine === engine);

    const nextHistory = existing
      ? [
          { ...existing, count: (existing.count || 1) + 1, lastUsed: now },
          ...current.filter((item) => item !== existing)
        ]
      : [
          { query: normalized, engine, count: 1, lastUsed: now },
          ...current
        ];

    await writeSettings({ ...settings, history: nextHistory.slice(0, MAX_HISTORY) });
    renderHistory();
  }

  async function performSearch(input = elements.searchInput.value) {
    const { query, engine } = parseQuery(input);
    if (!query) {
      elements.searchInput.focus();
      return;
    }

    await saveHistory(query, engine);
    await openUrl(buildSearchUrl(query, engine));
  }

  function renderSuggestions() {
    const value = elements.searchInput.value.trim();
    elements.suggestions.innerHTML = '';

    if (value.length < 2) return;

    const phrase = parseQuery(value).query;
    const historyMatches = (settings.history || [])
      .filter((item) => item.query.toLowerCase().includes(phrase.toLowerCase()))
      .slice(0, 2)
      .map((item) => ({ label: item.query, note: `${ENGINES[item.engine]?.label || 'Search'} · used ${item.count || 1}x`, engine: item.engine }));

    const generated = [
      `${phrase} trailer`,
      `${phrase} review`,
      `${phrase} explained`,
      `best ${phrase} moments`,
      `${phrase} timeline`
    ].map((label) => ({ label, note: ENGINES[selectedEngine].label, engine: selectedEngine }));

    const seen = new Set();
    [...historyMatches, ...generated].filter((item) => {
      const key = `${item.engine}:${item.label}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5).forEach((item) => {
      const button = document.createElement('button');
      button.className = 'suggestion-item';
      button.type = 'button';
      button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.note)}</small>`;
      button.addEventListener('click', () => {
        elements.searchInput.value = item.label;
        setActiveEngine(item.engine);
        performSearch(item.label);
      });
      elements.suggestions.appendChild(button);
    });
  }

  function renderHistory() {
    elements.historyList.innerHTML = '';
    const history = settings.history || [];

    if (!history.length) {
      elements.historyList.innerHTML = '<li class="empty-state">No searches yet. Your last 20 searches will appear here.</li>';
      return;
    }

    history.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const label = ENGINES[item.engine]?.label || 'Search';
      const date = item.lastUsed ? new Date(item.lastUsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'recently';
      li.innerHTML = `
        <div class="history-top">
          <strong>${escapeHtml(item.query)}</strong>
          <span class="history-actions">
            <button class="mini-button" type="button" data-run="${index}">Run</button>
            <button class="mini-button" type="button" data-remove="${index}" aria-label="Remove history item">×</button>
          </span>
        </div>
        <span>${escapeHtml(label)} · ${escapeHtml(date)} · ${Number(item.count || 1)}x</span>
      `;
      elements.historyList.appendChild(li);
    });
  }

  async function removeHistoryItem(index) {
    const history = [...(settings.history || [])];
    history.splice(index, 1);
    await writeSettings({ ...settings, history });
    renderHistory();
    renderSuggestions();
  }

  async function clearHistory() {
    await writeSettings({ ...settings, history: [] });
    renderHistory();
    renderSuggestions();
  }

  async function renderFeed() {
    const fallback = `https://www.youtube.com/channel/${encodeURIComponent(settings.channelId)}/videos`;
    elements.feed.innerHTML = '<p class="muted">Checking latest uploads…</p>';

    try {
      if (!window.StarWarsNuggetsFeed?.loadLatestVideos) {
        throw new Error('Feed loader is unavailable.');
      }

      const videos = await window.StarWarsNuggetsFeed.loadLatestVideos(settings.channelId, 5);
      if (!videos.length) throw new Error('No videos found in feed.');

      elements.feed.innerHTML = videos.map((video) => {
        const date = video.published
          ? new Date(video.published).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Recently';
        return `
          <a class="feed-item" href="${escapeAttribute(video.link)}" target="_blank" rel="noopener noreferrer">
            <strong>${escapeHtml(video.title)}</strong>
            <span>${escapeHtml(date)}</span>
          </a>
        `;
      }).join('');
    } catch (error) {
      elements.feed.innerHTML = `
        <div class="empty-state">
          Could not load the live feed here. <a href="${escapeAttribute(fallback)}" target="_blank" rel="noopener noreferrer">Open latest videos on YouTube</a>.
        </div>
      `;
    }
  }

  function fillSettingsForm() {
    elements.channelName.value = settings.channelName;
    elements.channelId.value = settings.channelId;
    elements.defaultEngine.value = settings.defaultEngine;
  }

  async function saveSettingsFromForm() {
    const next = {
      ...settings,
      channelName: elements.channelName.value.trim() || DEFAULTS.channelName,
      channelId: elements.channelId.value.trim() || DEFAULTS.channelId,
      defaultEngine: ENGINES[elements.defaultEngine.value] ? elements.defaultEngine.value : DEFAULTS.defaultEngine
    };

    await writeSettings(next);
    setActiveEngine(next.defaultEngine);
    updateChannelLinks();
    await renderFeed();
  }

  async function resetSettings() {
    await writeSettings({ ...DEFAULTS, history: settings.history || [] });
    setTheme(DEFAULTS.theme);
    setActiveEngine(DEFAULTS.defaultEngine);
    fillSettingsForm();
    updateChannelLinks();
    await renderFeed();
  }

  function updateChannelLinks() {
    elements.channelLink.href = `https://www.youtube.com/channel/${encodeURIComponent(settings.channelId)}`;
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function handleKeyboard(event) {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    if (event.key === '/' && document.activeElement !== elements.searchInput) {
      event.preventDefault();
      elements.searchInput.focus();
    }

    if (modKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }

    if (event.key === 'Escape') {
      closeDialog(elements.dalleModal);
      closeDialog(elements.settingsModal);
    }
  }

  function bindEvents() {
    elements.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      performSearch();
    });

    elements.searchInput.addEventListener('input', renderSuggestions);

    $$('.chip').forEach((button) => {
      button.addEventListener('click', () => setActiveEngine(button.dataset.engine));
    });

    elements.toggleTheme.addEventListener('click', async () => {
      const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
      await writeSettings({ ...settings, theme: nextTheme });
      setTheme(nextTheme);
    });

    elements.historyList.addEventListener('click', (event) => {
      const runIndex = event.target.closest('[data-run]')?.dataset.run;
      const removeIndex = event.target.closest('[data-remove]')?.dataset.remove;

      if (runIndex !== undefined) {
        const item = settings.history[Number(runIndex)];
        if (item) {
          setActiveEngine(item.engine);
          elements.searchInput.value = item.query;
          performSearch(item.query);
        }
      }

      if (removeIndex !== undefined) {
        removeHistoryItem(Number(removeIndex));
      }
    });

    elements.clearHistory.addEventListener('click', clearHistory);
    elements.refreshFeed.addEventListener('click', renderFeed);

    elements.showModal.addEventListener('click', () => openDialog(elements.dalleModal));
    elements.closeModal.addEventListener('click', () => closeDialog(elements.dalleModal));

    elements.openSettings.addEventListener('click', () => {
      fillSettingsForm();
      openDialog(elements.settingsModal);
    });
    elements.closeSettings.addEventListener('click', () => closeDialog(elements.settingsModal));
    elements.settingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await saveSettingsFromForm();
      closeDialog(elements.settingsModal);
    });
    elements.resetSettings.addEventListener('click', resetSettings);

    document.addEventListener('keydown', handleKeyboard);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;'
    }[character]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  async function init() {
    settings = await readSettings();
    setTheme(settings.theme);
    setActiveEngine(settings.defaultEngine);
    fillSettingsForm();
    updateChannelLinks();
    renderHistory();
    bindEvents();
    renderSuggestions();
    await renderFeed();
  }

  init().catch((error) => {
    console.error('Star Wars Nuggets extension failed to initialise:', error);
    elements.feed.innerHTML = '<div class="empty-state">The extension hit a startup error. Reload the popup and try again.</div>';
  });
})();
