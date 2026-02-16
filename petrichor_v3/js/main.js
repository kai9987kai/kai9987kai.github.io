import AudioChassis from './AudioChassis.js?v=3';
import VisualCore from './VisualCore.js?v=3';
import UIHub from './UIHub.js?v=3';
import ErrorHandler from './modules/ErrorHandler.js';
import PerformanceMonitor from './modules/PerformanceMonitor.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Error Handler
    window.errorHandler = new ErrorHandler();

    // 2. Performance Monitor (Optimization Phase)
    window.perfMonitor = new PerformanceMonitor();

    const audio = new AudioChassis();
    const visual = new VisualCore(audio);

    // Debug Access
    window.audio = audio;
    window.visual = visual;
    const ui = new UIHub(audio, visual);

    console.log("Petrichor Lab v3 System Ready");
});
