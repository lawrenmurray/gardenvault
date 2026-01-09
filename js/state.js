/* ========================================
   STATE
   Global state and constants
   ======================================== */

'use strict';

const FULLNESS_THRESHOLD = 0.975;
const SEPARATOR = ' • ';

const state = {
    currentStep: 0,
    userData: {
        casualName: '',
        realName: '',
        keptBookmark: false,
        frontInscription: '',
        backInscription: '',
        isPearlsEntry: false
    },
    whisper: {
        texts: [],
        totalCharCount: 0,
        processedCharCount: 0,
        currentRing: 1,
        timingMode: 2000,
        previousTimingMode: 2000,
        emberInterval: null,
        seedEmberInterval: null,
        seedFireflyInterval: null,
        firstWhisperSent: false,
        envelopeHelperCreated: false,
        isEditMode: false,
        seedGlowState: 'dormant'
    },
    poem: {
        currentText: '',
        requestText: '',
        lastLength: 0,
        displayedChars: 0,
        isPending: false,
        helperCreated: false
    },
    previousInputValue: '',
    activeParticles: new Set()
};

const dom = {
    container: null,
    veil: null,
    garden: null,
    glow: null,
    welcomeMessage: null
};

// Initialize DOM references after page load
function initDom() {
    dom.container = document.getElementById('container');
    dom.veil = document.getElementById('veil');
    dom.garden = document.getElementById('garden');
    dom.glow = document.getElementById('glow');
    dom.welcomeMessage = document.getElementById('welcomeMessage');
}
