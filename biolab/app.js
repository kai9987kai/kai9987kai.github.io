const storageKey = 'bioLabState';
const defaultState = {
    welcomeSeen: false,
    activeModule: 'genetic-algorithm',
    ga: {},
    crispr: { guides: [] },
    protein: {},
    ca: {},
    research: { saved: [] }
};

const bioState = loadState();
const exporters = {};

function loadState() {
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            return { ...defaultState, ...JSON.parse(stored) };
        }
    } catch (err) {
        console.warn('Unable to load state', err);
    }
    return JSON.parse(JSON.stringify(defaultState));
}

function persistState() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(bioState));
    } catch (err) {
        console.warn('Unable to persist state', err);
    }
}

function updateSection(section, data) {
    bioState[section] = { ...(bioState[section] || {}), ...data };
    persistState();
}

function registerExporter(name, fn) {
    exporters[name] = fn;
}

function exportData() {
    const payload = {
        exportedAt: new Date().toISOString(),
        state: bioState
    };
    Object.entries(exporters).forEach(([name, fn]) => {
        try {
            payload[name] = fn();
        } catch (err) {
            console.warn(`Export for ${name} failed`, err);
        }
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bio-innovation-lab-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function showModule(moduleId) {
    document.querySelectorAll('.module').forEach(mod => {
        mod.classList.toggle('active', mod.id === moduleId);
    });
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.module === moduleId);
    });
    bioState.activeModule = moduleId;
    persistState();
}

function initNavigation() {
    const mainApp = document.getElementById('main-app');
    const welcome = document.getElementById('welcome-screen');
    const enterBtn = document.getElementById('enter-lab');
    const exportBtn = document.getElementById('export-data');

    enterBtn?.addEventListener('click', () => {
        welcome?.classList.remove('active');
        mainApp?.classList.add('active');
        bioState.welcomeSeen = true;
        persistState();
    });

    if (bioState.welcomeSeen) {
        welcome?.classList.remove('active');
        mainApp?.classList.add('active');
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => showModule(tab.dataset.module));
    });

    exportBtn?.addEventListener('click', exportData);

    if (bioState.activeModule) {
        showModule(bioState.activeModule);
    }
}

function initValueMirrors() {
    const mutation = document.getElementById('ga-mutation');
    const mutationVal = document.getElementById('ga-mutation-val');
    const caSpeed = document.getElementById('ca-speed');
    const caSpeedVal = document.getElementById('ca-speed-val');

    const syncMutation = () => mutationVal && (mutationVal.textContent = `${mutation.value}%`);
    const syncSpeed = () => caSpeedVal && (caSpeedVal.textContent = `${caSpeed.value} FPS`);

    mutation?.addEventListener('input', () => {
        syncMutation();
        updateSection('ga', { mutation: Number(mutation.value) });
    });
    caSpeed?.addEventListener('input', () => {
        syncSpeed();
        updateSection('ca', { speed: Number(caSpeed.value) });
    });

    if (bioState.ga?.mutation && mutation) {
        mutation.value = bioState.ga.mutation;
        syncMutation();
    } else {
        syncMutation();
    }

    if (bioState.ca?.speed && caSpeed) {
        caSpeed.value = bioState.ca.speed;
        syncSpeed();
    } else {
        syncSpeed();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initValueMirrors();
});

window.bioLab = {
    state: bioState,
    updateSection,
    persistState,
    registerExporter,
    showModule
};
