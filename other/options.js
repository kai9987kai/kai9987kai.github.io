(() => {
  'use strict';

  const STORAGE_KEY = 'starWarsNuggetsSettings';
  const DEFAULTS = {
    channelId: 'UClz3lLJyDq5Jh1-Ete2JmJA',
    channelName: 'Star Wars Nuggets',
    defaultEngine: 'channel',
    theme: 'dark',
    history: []
  };

  const elements = {
    root: document.documentElement,
    form: document.querySelector('#optionsForm'),
    channelName: document.querySelector('#channelName'),
    channelId: document.querySelector('#channelId'),
    defaultEngine: document.querySelector('#defaultEngine'),
    theme: document.querySelector('#theme'),
    resetButton: document.querySelector('#resetButton'),
    wipeHistory: document.querySelector('#wipeHistory'),
    exportButton: document.querySelector('#exportButton'),
    copyButton: document.querySelector('#copyButton'),
    exportBox: document.querySelector('#exportBox'),
    status: document.querySelector('#status')
  };

  let settings = { ...DEFAULTS };

  async function readSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
  }

  async function writeSettings(nextSettings) {
    settings = { ...DEFAULTS, ...nextSettings };
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    render();
  }

  function render() {
    elements.root.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
    elements.channelName.value = settings.channelName;
    elements.channelId.value = settings.channelId;
    elements.defaultEngine.value = settings.defaultEngine;
    elements.theme.value = settings.theme;
    elements.exportBox.value = JSON.stringify(settings, null, 2);
  }

  function setStatus(message) {
    elements.status.textContent = message;
    window.setTimeout(() => {
      if (elements.status.textContent === message) elements.status.textContent = '';
    }, 2400);
  }

  function bindEvents() {
    elements.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await writeSettings({
        ...settings,
        channelName: elements.channelName.value.trim() || DEFAULTS.channelName,
        channelId: elements.channelId.value.trim() || DEFAULTS.channelId,
        defaultEngine: elements.defaultEngine.value,
        theme: elements.theme.value
      });
      setStatus('Options saved.');
    });

    elements.resetButton.addEventListener('click', async () => {
      await writeSettings({ ...DEFAULTS, history: settings.history || [] });
      setStatus('Defaults restored.');
    });

    elements.wipeHistory.addEventListener('click', async () => {
      await writeSettings({ ...settings, history: [] });
      setStatus('History wiped.');
    });

    elements.exportButton.addEventListener('click', () => {
      elements.exportBox.value = JSON.stringify(settings, null, 2);
      elements.exportBox.select();
      setStatus('Export refreshed.');
    });

    elements.copyButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(elements.exportBox.value);
      setStatus('Export copied.');
    });
  }

  async function init() {
    settings = await readSettings();
    render();
    bindEvents();
  }

  init().catch((error) => {
    console.error(error);
    setStatus('Options failed to load.');
  });
})();
