'use strict';

const DEFAULT_CHANNEL_NAME = 'Star Wars Nuggets';
const STORAGE_KEY = 'starWarsNuggetsSettings';

const SEARCHERS = {
  channel: (query, settings) => {
    const scoped = `${query} ${settings.channelName || DEFAULT_CHANNEL_NAME}`.trim();
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(scoped)}`;
  },
  youtube: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  wookieepedia: (query) => `https://starwars.fandom.com/wiki/Special:Search?query=${encodeURIComponent(query)}`
};

async function getSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return {
    channelName: DEFAULT_CHANNEL_NAME,
    defaultEngine: 'channel',
    ...(data[STORAGE_KEY] || {})
  };
}

async function openSearch(query, engine = 'channel') {
  const trimmed = String(query || '').trim();
  if (!trimmed) return;

  const settings = await getSettings();
  const builder = SEARCHERS[engine] || SEARCHERS.channel;
  await chrome.tabs.create({ url: builder(trimmed, settings) });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'search-channel',
      title: 'Search Star Wars Nuggets for "%s"',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'search-youtube',
      title: 'Search YouTube for "%s"',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'search-wookieepedia',
      title: 'Search Wookieepedia for "%s"',
      contexts: ['selection']
    });
  });

  await chrome.action.setBadgeBackgroundColor({ color: '#ff4d1d' });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const text = info.selectionText || '';
  if (info.menuItemId === 'search-youtube') openSearch(text, 'youtube');
  if (info.menuItemId === 'search-channel') openSearch(text, 'channel');
  if (info.menuItemId === 'search-wookieepedia') openSearch(text, 'wookieepedia');
});

chrome.omnibox.setDefaultSuggestion({
  description: 'Search Star Wars Nuggets videos for: %s'
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const query = text.trim();
  if (!query) return;

  suggest([
    { content: query, description: `Search Star Wars Nuggets for "${escapeDescription(query)}"` },
    { content: `!yt ${query}`, description: `Search all YouTube for "${escapeDescription(query)}"` },
    { content: `!w ${query}`, description: `Search Wookieepedia for "${escapeDescription(query)}"` }
  ]);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  const trimmed = text.trim();
  if (trimmed.toLowerCase().startsWith('!yt ')) {
    openSearch(trimmed.slice(4), 'youtube');
    return;
  }
  if (trimmed.toLowerCase().startsWith('!w ')) {
    openSearch(trimmed.slice(3), 'wookieepedia');
    return;
  }
  openSearch(trimmed, 'channel');
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
  const historyLength = changes[STORAGE_KEY].newValue?.history?.length || 0;
  await chrome.action.setBadgeText({ text: historyLength ? String(Math.min(historyLength, 99)) : '' });
});

function escapeDescription(value) {
  return String(value).replace(/[&<>]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  }[character]));
}
