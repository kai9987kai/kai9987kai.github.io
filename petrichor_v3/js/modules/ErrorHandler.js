export default class ErrorHandler {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create container if not exists
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }

        // Global Listeners
        window.addEventListener('error', (event) => {
            this.showToast(`Error: ${event.message}`, 'error');
            console.error('[Global Error]', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.showToast(`Promise Error: ${event.reason}`, 'error');
            console.error('[Unhandled Rejection]', event.reason);
        });

        console.log("Global Error Handler Initialized");
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Styles
        toast.style.cssText = `
            background: ${type === 'error' ? 'rgba(255, 68, 68, 0.9)' : 'rgba(100, 255, 218, 0.9)'};
            color: ${type === 'error' ? '#fff' : '#05070a'};
            padding: 12px 20px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
            cursor: pointer;
            max-width: 300px;
            word-wrap: break-word;
        `;

        this.container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Auto Dismiss
        const timeout = setTimeout(() => {
            this.dismiss(toast);
        }, 5000);

        // Click to dismiss
        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            this.dismiss(toast);
        });
    }

    dismiss(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }
}
