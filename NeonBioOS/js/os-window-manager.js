// os-window-manager.js
// Handles draggable DOM elements, z-indexing, minimization, and dispatching events to the ecosystem

const windows = document.querySelectorAll('.os-window');
let highestZ = 50;

// Setup Window Logic
windows.forEach(win => {
    const header = win.querySelector('.window-header');
    const closeBtn = win.querySelector('.close');
    const minBtn = win.querySelector('.minimize');
    const id = win.id;

    let isDragging = false;
    let offsetX, offsetY;

    // Bring to front on mousedown anywhere on the window
    win.addEventListener('mousedown', () => bringToFront(win));

    // Drag Logic
    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName.toLowerCase() === 'button') return; // Don't drag if clicking buttons

        isDragging = true;
        bringToFront(win);
        const rect = win.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // Notify ecosystem of disturbance
        window.dispatchEvent(new CustomEvent('bio-disturbance', {
            detail: { x: e.clientX, y: e.clientY, intense: true }
        }));
    });

    // Close logic (hides window, updates dock)
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            win.style.display = 'none';
            updateDock(id, false);
        });
    }

    // Minimize logic
    if (minBtn) {
        minBtn.addEventListener('click', () => {
            win.classList.add('minimized');
            updateDock(id, false);
        });
    }
});

window.addEventListener('mousemove', (e) => {
    windows.forEach(win => {
        const header = win.querySelector('.window-header');
        // We track drag state implicitly via a global variable or attach to window
        // For simplicity, attaching drag state to the element:
    });
});

// A cleaner drag approach attached to document
let draggedWindow = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastDisturbTime = 0;

document.addEventListener('mousedown', (e) => {
    const header = e.target.closest('.window-header');
    if (header && e.target.tagName.toLowerCase() !== 'button') {
        draggedWindow = header.closest('.os-window');
        bringToFront(draggedWindow);
        const rect = draggedWindow.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
    }
});

document.addEventListener('mousemove', (e) => {
    if (draggedWindow) {
        draggedWindow.style.left = `${e.clientX - dragOffsetX}px`;
        draggedWindow.style.top = `${e.clientY - dragOffsetY}px`;

        // Disturb ecosystem periodically while dragging
        const now = performance.now();
        if (now - lastDisturbTime > 50) {
            window.dispatchEvent(new CustomEvent('bio-disturbance', {
                detail: { x: e.clientX, y: e.clientY, intense: true }
            }));
            lastDisturbTime = now;
        }
    }
});

document.addEventListener('mouseup', () => {
    draggedWindow = null;
});

function bringToFront(win) {
    highestZ++;
    windows.forEach(w => w.classList.remove('active'));
    win.classList.add('active');
    win.style.zIndex = highestZ;
}

// Dock Logic
const dockItems = document.querySelectorAll('.dock-item');
dockItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        const targetWin = document.getElementById(targetId);
        if (targetWin) {
            targetWin.style.display = 'flex';
            targetWin.classList.remove('minimized');
            bringToFront(targetWin);
            item.classList.add('active');
        }
    });
});

function updateDock(windowId, isActive) {
    const item = document.querySelector(`.dock-item[data-target="${windowId}"]`);
    if (item) {
        if (isActive) item.classList.add('active');
        else item.classList.remove('active');
    }
}

// API for ecosystem to read window rects for pathfinding/avoidance
window.getOSWindowRects = function () {
    const rects = [];
    windows.forEach(w => {
        if (w.style.display !== 'none' && !w.classList.contains('minimized')) {
            rects.push(w.getBoundingClientRect());
        }
    });
    return rects;
}
