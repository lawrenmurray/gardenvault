/* ========================================
   POEM STATE
   Backend state management for poems
   Silent backend telephone only - no UI
   ======================================== */

'use strict';

const PoemState = (function() {
    // Backend endpoint
    const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbydeGUf6hNmMHda5PjUv2li8Dv_1FN9pOURy9Gr2za0T8sI5FfxOhw3COM8Ll0iZ99W/exec';

    // Internal state
    let _poems = [];
    let _requestPending = false;
    let _lastFetchTime = 0;
    let _jsonpCounter = 0;
    let _subscribers = [];

    // ========================================
    // JSONP Transport (GET)
    // ========================================

    function fetchStateJsonp(callback) {
        const callbackName = '_poemStateCallback_' + (++_jsonpCounter) + '_' + Date.now();
        const script = document.createElement('script');

        // Timeout handler (30s to handle Apps Script cold starts)
        const timeoutId = setTimeout(function() {
            cleanup();
            callback(new Error('JSONP timeout'), null);
        }, 30000);

        function cleanup() {
            clearTimeout(timeoutId);
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }

        window[callbackName] = function(data) {
            cleanup();
            callback(null, data);
        };

        script.onerror = function() {
            cleanup();
            callback(new Error('JSONP script error'), null);
        };

        script.src = BACKEND_URL + '?action=getState&callback=' + callbackName;
        document.head.appendChild(script);
    }

    // ========================================
    // POST Transport (Request Submission)
    // ========================================

    function submitRequest(requestText) {
        // Fire-and-forget POST with unique iframe to prevent cancellation
        const frameId = '_poemRequestFrame_' + Date.now();

        const iframe = document.createElement('iframe');
        iframe.id = frameId;
        iframe.name = frameId;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = BACKEND_URL;
        form.target = frameId;
        form.style.display = 'none';

        const actionInput = document.createElement('input');
        actionInput.type = 'hidden';
        actionInput.name = 'action';
        actionInput.value = 'requestPoem';
        form.appendChild(actionInput);

        const textInput = document.createElement('input');
        textInput.type = 'hidden';
        textInput.name = 'request_text';
        textInput.value = requestText;
        form.appendChild(textInput);

        document.body.appendChild(form);
        form.submit();
        form.remove();

        // Clean up iframe after delay
        setTimeout(function() {
            var oldFrame = document.getElementById(frameId);
            if (oldFrame) oldFrame.remove();
        }, 10000);

        // Mark pending locally (optimistic)
        _requestPending = true;
    }

    // ========================================
    // Subscriber Pattern
    // ========================================

    function subscribe(fn) {
        if (typeof fn === 'function') {
            _subscribers.push(fn);
        }
    }

    function notifySubscribers() {
        const data = { poems: _poems.slice(), requestPending: _requestPending };
        _subscribers.forEach(function(fn) {
            try {
                fn(data);
            } catch (e) {
                console.error('[PoemState] Subscriber error:', e);
            }
        });
    }

    // ========================================
    // State Management
    // ========================================

    function fetchState(callback) {
        fetchStateJsonp(function(err, data) {
            if (err) {
                console.error('[PoemState] Fetch error:', err.message);
                if (callback) callback(err);
                return;
            }

            // Update internal state
            if (data && Array.isArray(data.poems)) {
                _poems = data.poems;
            }
            // Derive pending from backend state.status (primary), fallback to requestPending
            if (data && data.state && typeof data.state.status === 'string') {
                _requestPending = data.state.status === 'pending';
            } else if (data && typeof data.requestPending === 'boolean') {
                _requestPending = data.requestPending;
            }
            _lastFetchTime = Date.now();

            // Notify subscribers
            notifySubscribers();

            if (callback) callback(null, { poems: _poems, requestPending: _requestPending });
        });
    }

    function getPoems() {
        return _poems.slice(); // Return copy
    }

    function isRequestPending() {
        return _requestPending;
    }

    // ========================================
    // Request CTA State
    // ========================================

    function updateRequestCta(ctaEl) {
        if (!ctaEl) return;

        // Always show "Request a Poem" - pending state shown inside section
        ctaEl.textContent = 'Request a Poem';
        if (_requestPending) {
            ctaEl.classList.add('pending');
        } else {
            ctaEl.classList.remove('pending');
        }
    }

    // ========================================
    // Initialization
    // ========================================

    function init(callback) {
        fetchState(callback);
    }

    // ========================================
    // Public API
    // ========================================

    return {
        init: init,
        fetchState: fetchState,
        getPoems: getPoems,
        isRequestPending: isRequestPending,
        submitRequest: submitRequest,
        updateRequestCta: updateRequestCta,
        subscribe: subscribe
    };

})();
