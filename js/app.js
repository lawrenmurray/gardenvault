/* ========================================
   APP INITIALIZATION
   Ties everything together
   ======================================== */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // CSS-ready check: ensure critical styles are applied before initializing
    // This prevents race conditions where JS runs before CSS is fully loaded
    const initApp = () => {
        // Initialize DOM references
        initDom();

        // Initialize Guardian telemetry (before any interactions)
        Guardian.init();

        // Prefetch poem state (non-blocking)
        PoemState.init();

        // Start ambient particles
        ParticleSystem.createAmbient();

        // Begin entrance flow
        EntranceFlow.executeStep();
    };

    // Check if critical CSS is loaded by testing a known style property
    // Uses .container which exists in HTML (not dynamically created)
    const checkCSSReady = () => {
        const container = document.querySelector('.container');
        if (container && getComputedStyle(container).position === 'relative') {
            // CSS is loaded - initialize the app
            initApp();
        } else {
            // CSS not ready yet - check again next frame
            requestAnimationFrame(checkCSSReady);
        }
    };

    checkCSSReady();
});
