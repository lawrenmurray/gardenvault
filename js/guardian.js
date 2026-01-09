/* ========================================
   GUARDIAN - Telemetry & Verification System
   Maximum-fidelity interaction capture with
   real-time Google Forms transmission
   ======================================== */

'use strict';

const Guardian = {
    // ========================================
    // CONFIGURATION
    // ========================================
    config: {
        formUrl: 'https://docs.google.com/forms/u/0/d/e/1FAIpQLSfWWneGkygp_pImcrhfbO7KcD6Llj33tMz_sTekTt5iWxhDDA/formResponse',
        fields: {
            visit_id: 'entry.99657608',
            persistent_id: 'entry.1252075505',
            event_type: 'entry.1140106371',
            section: 'entry.75256911',
            artifact_id: 'entry.1509851328',
            timestamp_iso: 'entry.794719559',
            payload_json: 'entry.1925252025',
            device_fingerprint_json: 'entry.1396868347',
            flags: 'entry.1003393738'
        },
        rawBatchInterval: 500,      // ms between raw input batches
        maxRetries: 3,
        retryBaseDelay: 1000,       // ms
        offlineQueueKey: 'guardian_offline_queue',
        persistentIdKey: 'guardian_persistent_id',
        visitDataKey: 'guardian_visit_data'
    },

    // ========================================
    // IDENTITY & STATE
    // ========================================
    identity: {
        persistent_id: null,
        visit_id: null,
        first_visit_iso: null,
        last_visit_iso: null,
        visit_count: 0,
        session_start_iso: null
    },

    device_fingerprint: null,

    context: {
        section: null,
        artifact_id: null
    },

    // ========================================
    // BUFFERS & QUEUES
    // ========================================
    rawBuffer: {},          // { [field_id]: { artifact_id, events: [], lastFlush } }
    eventQueue: [],         // Non-raw events waiting to send
    offlineQueue: [],       // Events that failed to send
    activeArtifacts: {},    // { [artifact_id]: { section, kind, startTime, data } }

    // Intervals & Counters
    rawFlushInterval: null,
    initialized: false,
    sessionEndEmitted: false,
    eventsSentCount: 0,
    lastInputTime: {},  // { [field_id]: timestamp } for cursor-only detection

    // ========================================
    // INITIALIZATION
    // ========================================
    init() {
        if (this.initialized) return;
        this.initialized = true;

        this._loadIdentity();
        this._generateVisitId();
        this._buildDeviceFingerprint();
        this._loadOfflineQueue();
        this._startRawFlushLoop();

        // Emit session start
        this.capture('session.start', {
            visit_count: this.identity.visit_count,
            first_visit_iso: this.identity.first_visit_iso,
            returning: this.identity.visit_count > 1
        });

        // Flush and emit session.end on page unload
        window.addEventListener('beforeunload', () => this._endSession('page_unload'));
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this._endSession('visibility_hidden');
            }
        });
    },

    _loadIdentity() {
        try {
            // Load or create persistent ID
            let persistentId = localStorage.getItem(this.config.persistentIdKey);
            if (!persistentId) {
                persistentId = this._generateId('pid');
                localStorage.setItem(this.config.persistentIdKey, persistentId);
            }
            this.identity.persistent_id = persistentId;

            // Load visit data
            const visitDataStr = localStorage.getItem(this.config.visitDataKey);
            if (visitDataStr) {
                const visitData = JSON.parse(visitDataStr);
                this.identity.first_visit_iso = visitData.first_visit_iso;
                this.identity.visit_count = (visitData.visit_count || 0) + 1;
            } else {
                this.identity.first_visit_iso = new Date().toISOString();
                this.identity.visit_count = 1;
            }

            // Update stored visit data
            this.identity.last_visit_iso = new Date().toISOString();
            localStorage.setItem(this.config.visitDataKey, JSON.stringify({
                first_visit_iso: this.identity.first_visit_iso,
                last_visit_iso: this.identity.last_visit_iso,
                visit_count: this.identity.visit_count
            }));
        } catch (e) {
            // localStorage not available
            this.identity.persistent_id = this._generateId('pid');
            this.identity.first_visit_iso = new Date().toISOString();
            this.identity.visit_count = 1;
        }
    },

    _generateVisitId() {
        this.identity.visit_id = this._generateId('vid');
        this.identity.session_start_iso = new Date().toISOString();
    },

    _generateId(prefix) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${prefix}_${timestamp}_${random}`;
    },

    _buildDeviceFingerprint() {
        this.device_fingerprint = {
            userAgent: navigator.userAgent || '',
            platform: navigator.platform || '',
            language: navigator.language || '',
            languages: navigator.languages ? [...navigator.languages] : [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            timezoneOffset: new Date().getTimezoneOffset(),
            screenWidth: screen.width,
            screenHeight: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            colorDepth: screen.colorDepth,
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            hardwareConcurrency: navigator.hardwareConcurrency || null,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            online: navigator.onLine,
            connectionType: navigator.connection ? navigator.connection.effectiveType : null,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };
    },

    _loadOfflineQueue() {
        try {
            const stored = localStorage.getItem(this.config.offlineQueueKey);
            if (stored) {
                this.offlineQueue = JSON.parse(stored);
                // Attempt to flush offline queue
                this._flushOfflineQueue();
            }
        } catch (e) {
            this.offlineQueue = [];
        }
    },

    _saveOfflineQueue() {
        try {
            localStorage.setItem(this.config.offlineQueueKey, JSON.stringify(this.offlineQueue));
        } catch (e) {
            // Storage full or unavailable
        }
    },

    _endSession(reason) {
        if (this.sessionEndEmitted) return;
        this.sessionEndEmitted = true;

        // Flush all pending data first
        const rawBuffersFlushed = Object.keys(this.rawBuffer).filter(
            k => this.rawBuffer[k].events.length > 0
        ).length;
        this._flushAllRawBuffers(reason);
        this._flushEventQueue();

        // Calculate session duration
        const sessionStart = new Date(this.identity.session_start_iso).getTime();
        const sessionDuration = Date.now() - sessionStart;

        // Build session signature (descriptive, no scoring)
        const signature = this._buildSessionSignature();

        // Emit session.end
        this.capture('session.end', {
            session_duration_ms: sessionDuration,
            flush_reason: reason,
            raw_buffers_flushed_count: rawBuffersFlushed,
            events_sent_count: this.eventsSentCount,
            session_signature: signature
        }, { immediate: true });

        // Try offline queue last
        this._flushOfflineQueue();
    },

    _buildSessionSignature() {
        // Derive descriptive session signature (no scoring, no verdicts)
        const signature = {
            device: {},
            timing: {},
            entrance: {},
            interaction: {}
        };

        // Device consistency vs stored fingerprint
        try {
            const storedFp = localStorage.getItem('guardian_last_fingerprint');
            if (storedFp) {
                const lastFp = JSON.parse(storedFp);
                signature.device.same_timezone = lastFp.timezone === this.device_fingerprint.timezone;
                signature.device.same_language = lastFp.language === this.device_fingerprint.language;
                signature.device.same_screen = lastFp.screenWidth === this.device_fingerprint.screenWidth &&
                                               lastFp.screenHeight === this.device_fingerprint.screenHeight;
            } else {
                signature.device.first_device = true;
            }
            // Store current fingerprint for next visit comparison
            localStorage.setItem('guardian_last_fingerprint', JSON.stringify(this.device_fingerprint));
        } catch (e) {
            signature.device.storage_unavailable = true;
        }

        // Time window bucket
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) signature.timing.window = 'morning';
        else if (hour >= 12 && hour < 17) signature.timing.window = 'afternoon';
        else if (hour >= 17 && hour < 21) signature.timing.window = 'evening';
        else signature.timing.window = 'night';

        // Entrance behavior (from entrance helper state if available)
        if (this.entrance.stepsCompleted > 0 || this.entrance.artifact_id) {
            signature.entrance.pearls_used = this.entrance.failureCounts ?
                Object.keys(this.entrance.failureCounts).length === 0 && this.entrance.stepsCompleted <= 2 : false;
            signature.entrance.total_failures = this.entrance.failureCounts ?
                Object.values(this.entrance.failureCounts).reduce((a, b) => a + b, 0) : 0;
        }

        // Interaction style from active artifacts
        let totalTyped = 0, totalDeleted = 0, artifactCount = 0;
        for (const art of Object.values(this.activeArtifacts)) {
            totalTyped += art.data.charsTyped || 0;
            totalDeleted += art.data.charsDeleted || 0;
            artifactCount++;
        }
        signature.interaction.edit_ratio = totalTyped > 0 ?
            Math.round((totalDeleted / totalTyped) * 100) / 100 : 0;
        signature.interaction.active_artifacts_at_end = artifactCount;

        return signature;
    },

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Capture a telemetry event
     * @param {string} event_type - Event type identifier
     * @param {object} payload - Event payload data
     * @param {object} options - Optional: { immediate, flags }
     */
    capture(event_type, payload = {}, options = {}) {
        const event = this._buildEvent(event_type, payload, options.flags);

        if (options.immediate) {
            this._send(event);
        } else {
            this.eventQueue.push(event);
            // Auto-flush if queue gets large
            if (this.eventQueue.length >= 10) {
                this._flushEventQueue();
            }
        }
    },

    /**
     * Set current context (section, artifact_id, etc.)
     * @param {object} ctx - Context fields to set
     */
    setContext(ctx) {
        if (ctx.section !== undefined) this.context.section = ctx.section;
        if (ctx.artifact_id !== undefined) this.context.artifact_id = ctx.artifact_id;
    },

    /**
     * Start a new artifact tracking session
     * @param {object} config - { section, kind }
     * @returns {string} artifact_id
     */
    startArtifact(config) {
        const artifact_id = this._generateId('art');
        const now = Date.now();

        this.activeArtifacts[artifact_id] = {
            section: config.section || this.context.section,
            kind: config.kind,
            startTime: now,
            startIso: new Date(now).toISOString(),
            data: {
                charsTyped: 0,
                charsDeleted: 0,
                pasteCount: 0,
                events: []
            }
        };

        this.setContext({ artifact_id });

        return artifact_id;
    },

    /**
     * End an artifact and emit its summary
     * @param {object} config - { artifact_id, status, finalText, summary }
     */
    endArtifact(config) {
        const artifact_id = config.artifact_id || this.context.artifact_id;
        const artifact = this.activeArtifacts[artifact_id];

        if (!artifact) return;

        const duration = Date.now() - artifact.startTime;

        // Flush any pending raw input for this artifact
        this._flushRawBufferForArtifact(artifact_id);

        // Build artifact event
        const event_type = `${artifact.section}.artifact`;
        const payload = {
            kind: artifact.kind,
            status: config.status,
            duration_ms: duration,
            chars_typed: artifact.data.charsTyped,
            chars_deleted: artifact.data.charsDeleted,
            paste_count: artifact.data.pasteCount,
            ...config.summary
        };

        if (config.finalText !== undefined) {
            payload.final_text = config.finalText;
            payload.final_length = config.finalText.length;
        }

        this.capture(event_type, payload, { immediate: true });

        // Cleanup
        delete this.activeArtifacts[artifact_id];
        if (this.context.artifact_id === artifact_id) {
            this.context.artifact_id = null;
        }
    },

    /**
     * Flush all pending events
     * @param {string} reason - Reason for flush
     */
    flush(reason) {
        // Flush raw buffers
        this._flushAllRawBuffers(reason);

        // Flush event queue
        this._flushEventQueue();

        // Try offline queue
        this._flushOfflineQueue();
    },

    /**
     * Capture raw per-character input
     * @param {object} config - { field_id, value, cursor, inputType, delta, artifact_id }
     */
    captureRawInput(config) {
        const field_id = config.field_id;
        const artifact_id = config.artifact_id || this.context.artifact_id;
        const now = Date.now();

        // Track last input time for cursor-only detection
        this.lastInputTime[field_id] = now;

        // Initialize buffer for this field if needed
        if (!this.rawBuffer[field_id]) {
            const artifactStartIso = artifact_id && this.activeArtifacts[artifact_id]
                ? this.activeArtifacts[artifact_id].startIso
                : this.identity.session_start_iso;

            this.rawBuffer[field_id] = {
                artifact_id,
                artifact_start_iso: artifactStartIso,
                events: [],
                lastFlush: now,
                sessionStart: now
            };
        }

        const buffer = this.rawBuffer[field_id];

        // ARTIFACT ATTRIBUTION HARDENING: flush and reinitialize if artifact changed
        if (buffer.artifact_id !== artifact_id && buffer.events.length > 0) {
            this._flushRawBuffer(field_id, 'artifact_switch');
            // Reinitialize for new artifact
            const newArtifactStartIso = artifact_id && this.activeArtifacts[artifact_id]
                ? this.activeArtifacts[artifact_id].startIso
                : this.identity.session_start_iso;
            buffer.artifact_id = artifact_id;
            buffer.artifact_start_iso = newArtifactStartIso;
            buffer.sessionStart = now;
        }

        const msSinceStart = now - buffer.sessionStart;

        // Build raw event
        const rawEvent = {
            t: msSinceStart,
            v: config.value,
            len: config.value.length
        };

        if (config.cursor !== undefined) rawEvent.cursor = config.cursor;
        if (config.inputType) rawEvent.inputType = config.inputType;
        if (config.delta) rawEvent.delta = config.delta;
        if (config.timeSinceLastKey !== undefined) rawEvent.dt = config.timeSinceLastKey;

        buffer.events.push(rawEvent);

        // Update artifact stats
        if (artifact_id && this.activeArtifacts[artifact_id]) {
            const artifact = this.activeArtifacts[artifact_id];
            if (config.delta > 0) artifact.data.charsTyped += config.delta;
            else if (config.delta < 0) artifact.data.charsDeleted += Math.abs(config.delta);
            if (config.inputType === 'insertFromPaste') artifact.data.pasteCount++;
        }

        // Flush on critical size
        if (buffer.events.length > 100) {
            this._flushRawBuffer(field_id, 'buffer_full');
        }
    },

    /**
     * Capture semantic interaction feedback
     * @param {string} semantic_type - e.g., 'typing.feedback', 'commit.absorb'
     * @param {object} data - Additional data
     */
    captureInteraction(semantic_type, data = {}) {
        this.capture(`interaction.${semantic_type}`, {
            section: this.context.section,
            artifact_id: this.context.artifact_id,
            ...data
        });
    },

    // ========================================
    // RAW BUFFER MANAGEMENT
    // ========================================

    _startRawFlushLoop() {
        this.rawFlushInterval = setInterval(() => {
            this._flushAllRawBuffers('interval');
        }, this.config.rawBatchInterval);
    },

    _flushAllRawBuffers(reason) {
        for (const field_id of Object.keys(this.rawBuffer)) {
            this._flushRawBuffer(field_id, reason);
        }
    },

    _flushRawBuffer(field_id, reason) {
        const buffer = this.rawBuffer[field_id];
        if (!buffer || buffer.events.length === 0) return;

        // Calculate aggregates
        let charsAdded = 0, charsRemoved = 0, pasteCount = 0;
        for (const evt of buffer.events) {
            if (evt.delta > 0) charsAdded += evt.delta;
            else if (evt.delta < 0) charsRemoved += Math.abs(evt.delta);
            if (evt.inputType === 'insertFromPaste') pasteCount++;
        }

        // Calculate artifact elapsed time at flush
        const now = Date.now();
        let artifactElapsedMs = null;
        if (buffer.artifact_id && this.activeArtifacts[buffer.artifact_id]) {
            artifactElapsedMs = now - this.activeArtifacts[buffer.artifact_id].startTime;
        }

        const payload = {
            field_id,
            artifact_start_iso: buffer.artifact_start_iso,
            artifact_elapsed_ms_at_flush: artifactElapsedMs,
            events: buffer.events,
            aggregates: { charsAdded, charsRemoved, pasteCount },
            flush_reason: reason
        };

        // Use flags for artifact_switch_flush
        const flags = reason === 'artifact_switch' ? 'artifact_switch_flush' : null;

        this.capture('raw.input.batch', payload, { immediate: true, flags });

        // Reset buffer
        buffer.events = [];
        buffer.lastFlush = now;
    },

    _flushRawBufferForArtifact(artifact_id) {
        for (const field_id of Object.keys(this.rawBuffer)) {
            const buffer = this.rawBuffer[field_id];
            if (buffer && buffer.artifact_id === artifact_id) {
                this._flushRawBuffer(field_id, 'artifact_end');
            }
        }
    },

    // ========================================
    // EVENT BUILDING & SENDING
    // ========================================

    _buildEvent(event_type, payload, flags) {
        return {
            visit_id: this.identity.visit_id,
            persistent_id: this.identity.persistent_id,
            event_type,
            section: this.context.section,
            artifact_id: this.context.artifact_id,
            timestamp_iso: new Date().toISOString(),
            payload_json: JSON.stringify(payload),
            device_fingerprint_json: JSON.stringify(this.device_fingerprint),
            flags: flags || ''
        };
    },

    _flushEventQueue() {
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            this._send(event);
        }
    },

    _flushOfflineQueue() {
        if (this.offlineQueue.length === 0) return;

        const toRetry = [...this.offlineQueue];
        this.offlineQueue = [];
        this._saveOfflineQueue();

        for (const event of toRetry) {
            this._send(event, true);
        }
    },

    _send(event, isRetry = false) {
        // Add offline_retry flag if this is a retry
        if (isRetry && !event.flags) {
            event.flags = 'offline_retry';
        } else if (isRetry && event.flags && !event.flags.includes('offline_retry')) {
            event.flags += ',offline_retry';
        }

        const formData = new URLSearchParams();

        for (const [key, fieldId] of Object.entries(this.config.fields)) {
            const value = event[key];
            if (value !== null && value !== undefined) {
                formData.append(fieldId, String(value));
            }
        }

        const body = formData.toString();

        // Track sent count
        this.eventsSentCount++;

        // Try sendBeacon first (best for unload scenarios)
        if (navigator.sendBeacon && !isRetry) {
            const blob = new Blob([body], { type: 'application/x-www-form-urlencoded' });
            const success = navigator.sendBeacon(this.config.formUrl, blob);
            if (success) return;
        }

        // Fallback to fetch
        fetch(this.config.formUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        }).catch(() => {
            // Queue for offline retry
            if (!isRetry) {
                event._retryCount = (event._retryCount || 0) + 1;
                if (event._retryCount <= this.config.maxRetries) {
                    this.offlineQueue.push(event);
                    this._saveOfflineQueue();
                }
            }
        });
    },

    // ========================================
    // INPUT INSTRUMENTATION HELPERS
    // ========================================

    /**
     * Instrument a text input or textarea for raw capture
     * @param {HTMLElement} element - Input or textarea element
     * @param {string} field_id - Field identifier (e.g., 'entrance.casualName')
     */
    instrumentInput(element, field_id) {
        if (!element || element._guardianInstrumented) return;
        element._guardianInstrumented = true;
        element._guardianFieldId = field_id;

        let lastValue = element.value || '';
        let lastKeyTime = Date.now();

        // beforeinput for inputType (when available)
        element.addEventListener('beforeinput', (e) => {
            element._pendingInputType = e.inputType;
        });

        // Main input handler
        element.addEventListener('input', (e) => {
            const now = Date.now();
            const newValue = element.value;
            const delta = newValue.length - lastValue.length;
            const timeSinceLastKey = now - lastKeyTime;

            // Get cursor position
            let cursor = null;
            try {
                cursor = element.selectionStart;
            } catch (e) {}

            this.captureRawInput({
                field_id,
                value: newValue,
                cursor,
                inputType: element._pendingInputType || e.inputType || 'unknown',
                delta,
                timeSinceLastKey
            });

            lastValue = newValue;
            lastKeyTime = now;
            element._pendingInputType = null;
        });

        // Flush on blur
        element.addEventListener('blur', () => {
            this._flushRawBuffer(field_id, 'blur');
        });

        // Capture paste events specifically
        element.addEventListener('paste', (e) => {
            this.captureInteraction('typing.paste', {
                field_id,
                hasData: !!e.clipboardData
            });
        });

        // Capture copy events (read-only signal, no clipboard content)
        element.addEventListener('copy', () => {
            let selectionLength = 0;
            try {
                selectionLength = Math.abs(element.selectionEnd - element.selectionStart);
            } catch (e) {}
            this.captureInteraction('typing.copy', {
                field_id,
                selection_length: selectionLength
            });
        });

        // Cursor-only movement detection via selectionchange
        // Only fires if no input occurred in last 250ms
        const checkCursorMove = () => {
            if (document.activeElement !== element) return;
            const now = Date.now();
            const lastInput = this.lastInputTime[field_id] || 0;
            if (now - lastInput < 250) return; // Skip if recent input

            let cursorStart = null, cursorEnd = null;
            try {
                cursorStart = element.selectionStart;
                cursorEnd = element.selectionEnd;
            } catch (e) { return; }

            this.capture('interaction.cursor.move', {
                field_id,
                cursor_start: cursorStart,
                cursor_end: cursorEnd
            });
        };

        document.addEventListener('selectionchange', checkCursorMove);

        // Store cleanup reference
        element._guardianCleanup = () => {
            document.removeEventListener('selectionchange', checkCursorMove);
        };
    },

    // ========================================
    // ENTRANCE FLOW HELPERS
    // ========================================

    entrance: {
        artifact_id: null,
        stepStartTime: null,
        failureCounts: {},
        stepsCompleted: 0,

        start() {
            Guardian.setContext({ section: 'entrance' });
            this.artifact_id = Guardian.startArtifact({ section: 'entrance', kind: 'entrance_flow' });
            this.stepStartTime = Date.now();
            this.failureCounts = {};
            this.stepsCompleted = 0;
        },

        stepEnter(stepNum, stepName) {
            this.stepStartTime = Date.now();
            Guardian.capture('entrance.step.enter', {
                step_num: stepNum,
                step_name: stepName
            });
        },

        stepExit(stepNum, stepName) {
            const duration = Date.now() - this.stepStartTime;
            this.stepsCompleted++;
            Guardian.capture('entrance.step.exit', {
                step_num: stepNum,
                step_name: stepName,
                duration_ms: duration
            });
        },

        recordFailure(stepName, reason) {
            this.failureCounts[stepName] = (this.failureCounts[stepName] || 0) + 1;
            Guardian.capture('entrance.verification.failure', {
                step_name: stepName,
                reason,
                attempt_num: this.failureCounts[stepName]
            });
        },

        recordSuccess(stepName) {
            Guardian.capture('entrance.verification.success', {
                step_name: stepName,
                attempts: this.failureCounts[stepName] || 1
            });
        },

        recordPearlsShortcut() {
            Guardian.capture('entrance.shortcut.pearls_used', {});
        },

        recordSpecialPath(path) {
            Guardian.capture('entrance.special_path', { path });
        },

        complete(accepted, userData) {
            Guardian.endArtifact({
                artifact_id: this.artifact_id,
                status: accepted ? 'accepted' : 'rejected',
                summary: {
                    pearls_used: userData.isPearlsEntry,
                    steps_completed: this.stepsCompleted,
                    failure_counts: this.failureCounts,
                    casual_name: userData.casualName,
                    real_name: userData.realName,
                    kept_bookmark: userData.keptBookmark
                }
            });
            this.artifact_id = null;
        }
    },

    // ========================================
    // MENU HELPERS
    // ========================================

    menu: {
        showTime: null,
        helpOpenTime: null,
        helpOpenCount: 0,
        totalHelpDwell: 0,

        onShow() {
            Guardian.setContext({ section: 'menu', artifact_id: null });
            this.showTime = Date.now();
            this.helpOpenCount = 0;
            this.totalHelpDwell = 0;
            Guardian.capture('menu.opened', {});
        },

        onIntentSelected(optionText) {
            const timeToDecision = this.showTime ? Date.now() - this.showTime : null;
            Guardian.capture('menu.intent', {
                option: optionText,
                time_to_decision_ms: timeToDecision,
                help_opened_count: this.helpOpenCount,
                total_help_dwell_ms: this.totalHelpDwell
            }, { immediate: true });
        },

        onHelpOpen() {
            this.helpOpenTime = Date.now();
            this.helpOpenCount++;
            Guardian.capture('menu.help.opened', {
                open_count: this.helpOpenCount
            });
        },

        onHelpClose() {
            if (this.helpOpenTime) {
                const dwell = Date.now() - this.helpOpenTime;
                this.totalHelpDwell += dwell;
                Guardian.capture('menu.help.closed', {
                    dwell_ms: dwell
                });
                this.helpOpenTime = null;
            }
        }
    },

    // ========================================
    // WHISPER HELPERS
    // ========================================

    whisper: {
        artifact_id: null,
        editModeUsed: false,
        timingModeChanges: [],
        confirmationShown: false,

        start() {
            Guardian.setContext({ section: 'whisper' });
            this.artifact_id = Guardian.startArtifact({ section: 'whisper', kind: 'whisper_attempt' });
            this.editModeUsed = false;
            this.timingModeChanges = [];
            this.confirmationShown = false;
        },

        onTextareaFocus() {
            Guardian.capture('whisper.textarea.focus', {});
        },

        onTimingChange(newMode, previousMode) {
            this.timingModeChanges.push({ from: previousMode, to: newMode, time: Date.now() });
            Guardian.capture('whisper.timing.changed', {
                from: previousMode,
                to: newMode
            });
        },

        onEditMode() {
            this.editModeUsed = true;
            Guardian.capture('whisper.edit_mode.entered', {});
        },

        onWhisperSubmit(text, isEdit) {
            Guardian.capture('whisper.submit', {
                length: text.length,
                is_edit: isEdit
            });
        },

        onRingFill(ringNum) {
            Guardian.capture('whisper.ring.filled', { ring: ringNum });
        },

        onAbsorb() {
            Guardian.captureInteraction('commit.absorb', { type: 'ring_overflow' });
        },

        onConfirmationShown() {
            this.confirmationShown = true;
            Guardian.capture('whisper.confirmation.shown', {});
        },

        onConfirmationChoice(choice) {
            Guardian.capture('whisper.confirmation.choice', { choice });
        },

        complete(status, finalText, whisperCount) {
            Guardian.endArtifact({
                artifact_id: this.artifact_id,
                status,
                finalText,
                summary: {
                    whisper_count: whisperCount,
                    edit_mode_used: this.editModeUsed,
                    timing_mode_changes: this.timingModeChanges.length,
                    confirmation_shown: this.confirmationShown
                }
            });
            this.artifact_id = null;
        },

        abandon(draftText) {
            this.complete('abandoned', draftText, 0);
        }
    },

    // ========================================
    // POEM HELPERS
    // ========================================

    poem: {
        artifact_id: null,
        overflowOccurred: false,
        swipeConfirmShown: false,
        typingTempoSummary: { fast: 0, normal: 0, slow: 0 },

        start() {
            Guardian.setContext({ section: 'poem' });
            this.artifact_id = Guardian.startArtifact({ section: 'poem', kind: 'poem_request' });
            this.overflowOccurred = false;
            this.swipeConfirmShown = false;
            this.typingTempoSummary = { fast: 0, normal: 0, slow: 0 };
        },

        onBookOpen() {
            Guardian.capture('poem.book.opened', {});
        },

        onTextareaFocus() {
            Guardian.capture('poem.textarea.focus', {});
        },

        recordTypingTempo(weight) {
            if (this.typingTempoSummary[weight] !== undefined) {
                this.typingTempoSummary[weight]++;
            }
        },

        onOverflow() {
            this.overflowOccurred = true;
            Guardian.capture('poem.page.overflow', {});
        },

        onSwipeConfirmShown() {
            this.swipeConfirmShown = true;
            Guardian.capture('poem.swipe_confirm.shown', {});
        },

        onSwipeConfirmChoice(choice) {
            Guardian.capture('poem.swipe_confirm.choice', { choice });
        },

        onReturnConfirmShown() {
            Guardian.capture('poem.return_confirm.shown', {});
        },

        onReturnConfirmChoice(choice) {
            Guardian.capture('poem.return_confirm.choice', { choice });
        },

        complete(status, finalText) {
            Guardian.endArtifact({
                artifact_id: this.artifact_id,
                status,
                finalText,
                summary: {
                    overflow_occurred: this.overflowOccurred,
                    swipe_confirm_shown: this.swipeConfirmShown,
                    typing_tempo: this.typingTempoSummary
                }
            });
            this.artifact_id = null;
        },

        abandon(draftText) {
            this.complete('abandoned', draftText);
        }
    }
};

// Expose globally
window.Guardian = Guardian;
