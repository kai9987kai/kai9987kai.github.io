/* --- Global Logic --- */

// Loading Screen
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.querySelector('.loading-screen');
        if(loader) loader.style.display = 'none';
    }, 1500);
});

/* --- Modal System --- */
function openModal(modalId) {
    // Close all other modals first
    document.querySelectorAll('.glass-modal').forEach(m => m.style.display = 'none');
    
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.style.display = 'block';
        
        // Trigger specific updates if needed
        if(modalId === 'metrics-modal') updateMetrics();
        if(modalId === 'dashboard-modal') updateDashboard();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('glass-modal')) {
        event.target.style.display = "none";
    }
}

/* --- Feature: Chat Bot --- */
function toggleChat() {
    const chat = document.getElementById('chat-container');
    if(chat) {
        chat.style.display = (chat.style.display === 'none' || chat.style.display === '') ? 'flex' : 'none';
    }
}

function sendMessage() {
    const input = document.getElementById('user-input');
    const body = document.getElementById('chat-body');
    if(!input || !body) return;

    const text = input.value.toLowerCase();
    if(!text) return;

    // User Message
    const userMsg = document.createElement('div');
    userMsg.textContent = `User: ${input.value}`; // Keep original case for display
    userMsg.style.marginBottom = '5px';
    body.appendChild(userMsg);
    
    // AI Processing Indicator
    const processingId = 'processing-' + Date.now();
    const processingMsg = document.createElement('div');
    processingMsg.id = processingId;
    processingMsg.style.color = 'var(--primary-color)';
    processingMsg.style.fontStyle = 'italic';
    processingMsg.textContent = "AI: Processing...";
    body.appendChild(processingMsg);
    body.scrollTop = body.scrollHeight;

    let reply = "I am sorry, I do not understand that command. Try 'help'.";
    
    // Expanded Logic
    if(text.includes('hello') || text.includes('hi')) reply = "Greetings, Commander. Systems are fully operational.";
    else if(text.includes('help')) reply = "Available commands: 'status', 'projects', 'contact', 'flight', 'music', 'clear'.";
    else if(text.includes('status')) reply = "All systems nominal. Shields: 100%. Reactor: Online.";
    else if(text.includes('projects')) {
        reply = "Opening Mission Archive...";
        setTimeout(() => openModal('projects-modal'), 1000);
    }
    else if(text.includes('contact')) {
        reply = "Opening Subspace Frequencies...";
        setTimeout(() => openModal('comms-modal'), 1000);
    }
    else if(text.includes('flight')) {
        reply = "Toggling Flight Mode protocols...";
        setTimeout(() => toggleFlightMode(), 1000);
    }
    else if(text.includes('music')) {
        const audio = document.querySelector('audio[loop]');
        if(audio) {
            if(audio.paused) { audio.play(); reply = "Resuming background audio."; }
            else { audio.pause(); reply = "Pausing background audio."; }
        } else {
            reply = "Audio module not found.";
        }
    }
    else if(text.includes('clear')) {
        body.innerHTML = '<div style="color: var(--primary-color);">System: Chat cleared.</div>';
        input.value = '';
        return;
    }
    
    setTimeout(() => {
        const pMsg = document.getElementById(processingId);
        if(pMsg) pMsg.remove();

        const aiMsg = document.createElement('div');
        aiMsg.style.color = 'var(--primary-color)';
        aiMsg.textContent = `AI: ${reply}`;
        aiMsg.style.marginBottom = '10px';
        body.appendChild(aiMsg);
        body.scrollTop = body.scrollHeight;
    }, 600); // Slight delay for realism
    
    input.value = '';
}

/* --- Feature: Web Plugins (Code Injector) --- */
function applyPlugin() {
    const input = document.getElementById('pluginInput');
    if(input && input.value) {
        const script = document.createElement('script');
        script.innerHTML = input.value;
        document.body.appendChild(script);
        alert('Code injected successfully.');
        closeModal('plugins-modal');
    }
}

/* --- Feature: Metrics --- */
function updateMetrics() {
    document.getElementById('metricImages').innerText = document.images.length;
    document.getElementById('metricLinks').innerText = document.links.length;
    document.getElementById('metricRes').innerText = `${window.innerWidth}x${window.innerHeight}`;
}

/* --- Feature: Dashboard / System Monitor --- */
function updateDashboard() {
    // System Specs
    const specs = {
        Platform: navigator.platform,
        Cores: navigator.hardwareConcurrency || '?',
        Memory: (navigator.deviceMemory || '?') + ' GB'
    };
    
    let specHtml = '';
    for(const [k,v] of Object.entries(specs)) {
        specHtml += `${k}: ${v} | `;
    }
    document.getElementById('systemSpecs').innerText = specHtml;
    document.getElementById('ramSpec').innerText = specs.Memory;
    
    // Network
    if(navigator.connection) {
        document.getElementById('NetworkTypeState').innerText = navigator.connection.effectiveType;
    }

    // Battery
    if(navigator.getBattery) {
        navigator.getBattery().then(function(battery) {
            const level = Math.round(battery.level * 100) + '%';
            const charging = battery.charging ? ' (Charging)' : '';
            const el = document.getElementById('batteryState');
            if(el) el.innerText = level + charging;
        });
    }

    // IP & Location (Async)
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById('ipState');
            if(el) el.innerText = `${data.ip} (${data.city}, ${data.country_name})`;
        })
        .catch(() => {});

    // Cookies
    const cookieCount = document.cookie.split(';').length;
    const cookieEl = document.getElementById('cookieState');
    if(cookieEl) cookieEl.innerText = `${cookieCount} Active`;

    
    // CPU Chart (Simulated)
    if(typeof Chart !== 'undefined') {
        const ctx = document.getElementById('cpuChart');
        if(ctx && !window.cpuChartInstance) {
            window.cpuChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array(10).fill(''),
                    datasets: [{
                        label: 'Load',
                        data: Array(10).fill(0).map(() => Math.random() * 100),
                        borderColor: '#00f3ff',
                        tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }
    }
    
    // Cookie Info
    const cookieContainer = document.createElement('div');
    cookieContainer.innerHTML = `<h4>Cookies</h4><p>${document.cookie.split(';').join('<br>')}</p>`;
    const dashboardGrid = document.querySelector('#dashboard-modal .dashboard-grid');
    if(dashboardGrid) dashboardGrid.appendChild(cookieContainer);
}

/* --- Feature: Graphics Settings --- */
function applyGraphicsSettings() {
    const res = document.getElementById('resolution').value;
    document.body.className = ''; // Reset
    if(res === 'medium') document.body.classList.add('medium-res');
    if(res === 'low') document.body.classList.add('low-res');
    
    // Rainbow Mode
    const rainbow = document.getElementById('rainbowMode').checked;
    if(rainbow) document.body.classList.add('rainbow-mode');
    else {
        document.body.classList.remove('rainbow-mode');
        document.body.style.backgroundColor = ''; // Reset
    }
    
    closeModal('settings-modal');
}

/* --- Feature: Accessibility --- */
function toggleAccessibility() {
    const panel = document.getElementById('accessibility-tools');
    panel.classList.toggle('hidden');
}

document.getElementById('toggle-contrast').addEventListener('click', () => {
    document.body.style.filter = document.body.style.filter ? '' : 'contrast(1.5) grayscale(1)';
});

document.getElementById('toggle-font-size').addEventListener('click', () => {
    const current = parseFloat(getComputedStyle(document.body).fontSize);
    document.body.style.fontSize = (current > 16 ? '16px' : '20px');
});

/* --- Feature: Scroll to About --- */
function scrollToAbout() {
    document.getElementById('about').scrollIntoView({ behavior: 'smooth' });
}

/* --- Legacy Support (Shortcuts & Utilities) --- */

// Block Save (Ctrl+S)
document.addEventListener("keydown", function(event) {
    if(event.keyCode == 83 && (navigator.platform.match("Mac") ? event.metaKey : event.ctrlKey)) {
        event.preventDefault();
        console.log("CTRL+S/CMD+S is blocked");
    }
}, false);

// Block Context Menu
document.addEventListener('contextmenu', event => event.preventDefault());

// Mailto Shortcut
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'm') {
        window.location.href = 'mailto:kai9987kai@gmail.com';
    }
});

// Copy Button Logic
document.addEventListener('selectionchange', function() {
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        if (document.getSelection().toString().length > 0) {
            copyBtn.style.display = 'block';
        } else {
            copyBtn.style.display = 'none';
        }
    }
});
document.addEventListener('click', function(e) {
    if(e.target && e.target.id == 'copy-btn') {
        document.execCommand('copy');
    }
});

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful: ', registration.scope);
        }, function(err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

/* --- Draggable & Resizable --- */
// Apply to elements with class 'draggable' or 'resizable'
function makeDraggable(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function makeResizable(elmnt) {
    let resizer = document.createElement('div');
    resizer.style.width = '10px';
    resizer.style.height = '10px';
    resizer.style.background = 'red';
    resizer.style.position = 'absolute';
    resizer.style.right = '0';
    resizer.style.bottom = '0';
    resizer.style.cursor = 'se-resize';
    elmnt.appendChild(resizer);
    elmnt.style.position = 'relative';
    
    resizer.addEventListener('mousedown', function(e) {
        window.addEventListener('mousemove', resize, false);
        window.addEventListener('mouseup', stopResize, false);
    }, false);

    function resize(e) {
        elmnt.style.width = (e.clientX - elmnt.getBoundingClientRect().left) + 'px';
        elmnt.style.height = (e.clientY - elmnt.getBoundingClientRect().top) + 'px';
    }

    function stopResize() {
        window.removeEventListener('mousemove', resize, false);
        window.removeEventListener('mouseup', stopResize, false);
    }
}

// Initialize Draggable/Resizable
window.addEventListener('load', () => {
    document.querySelectorAll('.draggable').forEach(makeDraggable);
    document.querySelectorAll('.resizable').forEach(makeResizable);
    
    // Auto-Optimization
    autoLazyLoadImages();
    autoDeferScripts();
    
    // Visitor Check
    checkVisitor();
});

/* --- Advanced Features (WASM, Workers, Bluetooth, etc.) --- */

// WebAssembly & SharedArrayBuffer
try {
    const importObject = { imports: { imported_func: (arg) => console.log(arg) } };
    WebAssembly.instantiateStreaming(fetch("simple.wasm"), importObject)
        .then((obj) => obj.instance.exports.exported_func())
        .catch(() => {}); // Ignore if file missing

    if (typeof SharedArrayBuffer !== 'undefined') {
        const buffer = new SharedArrayBuffer(16);
        const int32View = new Int32Array(buffer);
        int32View[1] = 42;
        console.log('SharedArrayBuffer:', int32View[1]);
    }
} catch(e) { console.log("WASM/Buffer not supported"); }

// Web Worker
(function() {
    const workerCode = `
        onmessage = function(event) {
            if (event.data.type === 'init') postMessage("Worker Initialized");
        };
    `;
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerBlobURL = URL.createObjectURL(workerBlob);
    try {
        const worker = new Worker(workerBlobURL);
        worker.onmessage = (e) => console.log('Worker says:', e.data);
        worker.postMessage({ type: 'init' });
    } catch(e) {}
})();

// Touch Gestures
let xDown = null, yDown = null;
document.addEventListener('touchstart', (evt) => {
    xDown = evt.touches[0].clientX;
    yDown = evt.touches[0].clientY;
}, false);
document.addEventListener('touchmove', (evt) => {
    if (!xDown || !yDown) return;
    let xDiff = xDown - evt.touches[0].clientX;
    let yDiff = yDown - evt.touches[0].clientY;
    
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0) console.log('Swipe Left');
        else console.log('Swipe Right');
    }
    xDown = null; yDown = null;
}, false);

// Bluetooth
function connectBluetooth() {
    if(navigator.bluetooth) {
        navigator.bluetooth.requestDevice({ filters: [{ services: ['battery_service'] }] }) // Example service
            .then(device => device.gatt.connect())
            .then(server => console.log('Bluetooth Connected'))
            .catch(error => console.log('Bluetooth Error:', error));
    } else {
        alert('Bluetooth API not supported.');
    }
}

// Notifications
function requestNotifications() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            new Notification('System Ready', { body: 'Welcome to the portfolio.' });
        }
    });
}

// Visitor IP & Cookie Logic
function checkVisitor() {
    const visitorIPCookie = document.cookie.match(/visitorIP=([^;]+)/);
    if (visitorIPCookie) {
        console.log(`Welcome back: ${visitorIPCookie[1]}`);
        setTimeout(() => openModal('return-modal'), 2000); // Show return modal
    } else {
        fetch("https://api.ipify.org/?format=json")
            .then(res => res.json())
            .then(data => {
                document.cookie = `visitorIP=${data.ip}; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/`;
                console.log(`New visitor: ${data.ip}`);
                setTimeout(() => openModal('welcome-modal'), 2000); // Show welcome modal
            })
            .catch(() => {});
    }
}

function autoLazyLoadImages() {
    document.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src');
        if(src) {
            img.setAttribute('data-src', src);
            img.removeAttribute('src');
            img.setAttribute('src', img.getAttribute('data-src'));
        }
    });
}

function autoDeferScripts() {
    document.querySelectorAll('script[src]').forEach((script) => script.defer = true);
}

// Scroll Colors (Rainbow Mode)
let scrollPos = 0;
const rainbowColors = ['#050510', '#1a0510', '#1a1a05', '#051a05', '#051a1a', '#05051a', '#1a051a'];
window.addEventListener('scroll', () => {
    if(document.body.classList.contains('rainbow-mode')) {
        let newScrollPos = window.scrollY;
        let colorIndex = Math.floor((newScrollPos / 100) % rainbowColors.length);
        document.body.style.backgroundColor = rainbowColors[colorIndex];
        scrollPos = newScrollPos;
    }
});

/* --- Innovation: PWA Install Logic --- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installAppBtn');
    if(btn) {
        btn.style.display = 'block';
        btn.addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                }
                deferredPrompt = null;
                btn.style.display = 'none';
            });
        });
    }
});

/* --- Innovation: UI Sound Effects --- */
document.querySelectorAll('button, a').forEach(el => {
    el.addEventListener('mouseenter', () => {
        const audio = document.getElementById('sfx-hover');
        if(audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
    });
    el.addEventListener('click', () => {
        const audio = document.getElementById('sfx-click');
        if(audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
    });
});

/* --- Innovation: Starfield Background --- */
(function() {
    const canvas = document.createElement('canvas');
    canvas.id = 'starfield';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let stars = [];
    const numStars = 200;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    for(let i=0; i<numStars; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            
            star.y += star.speed;
            if(star.y > canvas.height) star.y = 0;
        });
        
        requestAnimationFrame(animate);
    }
    animate();
})();

/* --- Innovation: Voice Control --- */
function startVoice() {
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.start();
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('user-input').value = transcript;
            sendMessage();
        };
        
        recognition.onerror = function(event) {
            console.log('Voice Error:', event.error);
        };
    } else {
        alert('Voice control not supported in this browser.');
    }
}

/* --- Innovation: Flight Mode --- */
let flightMode = false;
let flightKeys = { w: false, a: false, s: false, d: false };
let flightLoopId = null;

function toggleFlightMode() {
    flightMode = !flightMode;
    const model = document.getElementById('model');
    if(flightMode) {
        alert('FLIGHT MODE ENGAGED. Use WASD to rotate camera.');
        model.removeAttribute('auto-rotate');
        document.addEventListener('keydown', flightKeyDown);
        document.addEventListener('keyup', flightKeyUp);
        flightLoopId = requestAnimationFrame(updateFlightLoop);
    } else {
        alert('FLIGHT MODE DISENGAGED.');
        model.setAttribute('auto-rotate', '');
        document.removeEventListener('keydown', flightKeyDown);
        document.removeEventListener('keyup', flightKeyUp);
        if(flightLoopId) cancelAnimationFrame(flightLoopId);
    }
}

function flightKeyDown(e) {
    if(flightKeys.hasOwnProperty(e.key)) flightKeys[e.key] = true;
}

function flightKeyUp(e) {
    if(flightKeys.hasOwnProperty(e.key)) flightKeys[e.key] = false;
}

function updateFlightLoop() {
    if(!flightMode) return;
    
    const model = document.getElementById('model');
    let orbit = model.getCameraOrbit(); // {theta, phi, radius}
    let theta = orbit.theta;
    let phi = orbit.phi;
    
    const speed = 0.05; // Smoother speed
    
    if(flightKeys.a) theta -= speed;
    if(flightKeys.d) theta += speed;
    if(flightKeys.w) phi -= speed;
    if(flightKeys.s) phi += speed;
    
    // Clamp phi to avoid flipping
    // phi = Math.max(0, Math.min(Math.PI, phi)); 

    model.cameraOrbit = `${theta}rad ${phi}rad auto`;
    
    flightLoopId = requestAnimationFrame(updateFlightLoop);
}

/* --- Innovation: Intro Animation & Initialization --- */
window.addEventListener('load', () => {
    // Animate Dock
    anime({
        targets: '.dock-btn',
        translateY: [100, 0],
        opacity: [0, 1],
        delay: anime.stagger(100, {start: 1500}),
        easing: 'spring(1, 80, 10, 0)'
    });
    
    // Animate Hero Text
    anime({
        targets: '.hero-content',
        scale: [0.8, 1],
        opacity: [0, 1],
        duration: 2000,
        delay: 1000
    });

    // Initialize New Features
    initTOC();
    initLightbox();
    initAuth();
    initSystemExtras();
});

/* --- Innovation: Scroll to Top --- */
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollTopBtn');
    if(btn) {
        if(window.scrollY > 300) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }
});

/* --- Innovation: Table of Contents --- */
function initTOC() {
    const list = document.getElementById('toc-list');
    if(!list) return;
    
    document.querySelectorAll('h1, h2, h3').forEach((header, index) => {
        if(!header.id) header.id = `section-${index}`;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${header.id}`;
        a.textContent = header.textContent;
        a.onclick = (e) => {
            e.preventDefault();
            header.scrollIntoView({ behavior: 'smooth' });
            toggleTOC(); // Close on click
        };
        li.appendChild(a);
        list.appendChild(li);
    });
}

function toggleTOC() {
    document.getElementById('toc-sidebar').classList.toggle('visible');
}

/* --- Innovation: Lightbox --- */
function initLightbox() {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('lightbox-img');
    
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('click', () => {
            if(modal && modalImg) {
                modal.style.display = 'block';
                modalImg.src = img.src;
            }
        });
    });
}

/* --- Innovation: Narrator --- */
let narratorEnabled = false;
const toggleNarratorBtn = document.getElementById('toggle-narrator');
if(toggleNarratorBtn) {
    toggleNarratorBtn.addEventListener('click', () => {
        narratorEnabled = !narratorEnabled;
        alert(narratorEnabled ? "Narrator Enabled. Click text to read." : "Narrator Disabled.");
    });
}

document.addEventListener('click', (e) => {
    if(narratorEnabled && ['P', 'H1', 'H2', 'H3', 'LI'].includes(e.target.tagName)) {
        const utterance = new SpeechSynthesisUtterance(e.target.textContent);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
});

/* --- Innovation: Auth & System Extras --- */
function initAuth() {
    // Placeholder for Xano Auth Logic
    console.log("Auth System Initialized");
}

function initSystemExtras() {
    // Scroll Position Restore
    const scrollPos = localStorage.getItem('scrollPos');
    if(scrollPos) window.scrollTo(0, parseInt(scrollPos));
    
    window.addEventListener('scroll', () => {
        localStorage.setItem('scrollPos', window.scrollY);
    });
}

