/* ========================================
   GUARDIAN - Telemetry & Verification System
   Maximum-fidelity interaction capture with
   real-time Google Apps Script transmission
   ======================================== */

'use strict';

const Guardian = {
    // ========================================
    // CONFIGURATION
    // ========================================
    config: {
        endpointUrl: 'https://script.google.com/macros/s/AKfycbydeGUf6hNmMHda5PjUv2li8Dv_1FN9pOURy9Gr2za0T8sI5FfxOhw3COM8Ll0iZ99W/exec',
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
    rawBuffer: {},          // { [field_id]: { artifact_id, words: [], aggregates, lastWordTime, currentWord, lastValue } }
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

        // NOTE: No session.start row - session.end contains complete data
        // (started_at, ended_at, duration, signature, device_fingerprint, visit_count)
        // This ensures ONE row per session in the sessions sheet

        // Flush and emit session.end on page unload
        window.addEventListener('beforeunload', () => this._endSession('page_unload'));

        // visibilitychange can fire spuriously on mobile (keyboard open, scroll, etc.)
        // Only treat as session end if page has been open for at least 5 seconds
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                const sessionAge = Date.now() - new Date(this.identity.session_start_iso).getTime();
                if (sessionAge >= 5000) {
                    this._endSession('visibility_hidden');
                }
                // If session is too young, ignore - user is still here
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
            k => this.rawBuffer[k].words.length > 0 || (this.rawBuffer[k].lastValue && this.rawBuffer[k].lastValue.trim())
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
            session_start_iso: this.identity.session_start_iso,
            session_duration_ms: sessionDuration,
            visit_count: this.identity.visit_count,  // Include for session.end rows too
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
        if (this.entrance.stepsCompleted > 0 || this.entrance.currentArtifactId) {
            signature.entrance.steps_completed = this.entrance.stepsCompleted;
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

        // Calculate edit_ratio (MUST be populated if chars_typed > 0)
        const charsTyped = artifact.data.charsTyped || 0;
        const charsDeleted = artifact.data.charsDeleted || 0;
        const editRatio = charsTyped > 0 ? Math.round((charsDeleted / charsTyped) * 100) / 100 : 0;

        const payload = {
            kind: artifact.kind,
            status: config.status,
            duration_ms: duration,
            chars_typed: charsTyped,
            chars_deleted: charsDeleted,
            edit_ratio: editRatio,
            paste_count: artifact.data.pasteCount,
            ...config.summary
        };

        if (config.finalText !== undefined) {
            payload.final_text = config.finalText;
            payload.final_length = config.finalText.length;
            // Word count for artifact payload
            payload.word_count = config.finalText.trim().split(/\s+/).filter(w => w).length;
        }

        // Generate narrative summary client-side
        payload.narrative_summary = this._buildNarrative(artifact, config);

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
     * Capture raw input with word-boundary detection
     * STRICT RULE: Words are captured ONLY when user types a literal SPACE character
     * NOT on: interval flush, blur, enter/newline, tab, or any other trigger
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
                words: [],
                lastFlush: now,
                sessionStart: now,
                lastWordTime: now,
                currentWordStart: now,
                lastValue: '',
                committedLength: 0,  // Tracks how much text has been committed as words
                aggregates: {
                    wordCount: 0,
                    totalCharsTyped: 0,
                    totalCharsDeleted: 0,
                    pasteDetected: false,
                    pauses: []  // track inter-keystroke pauses for analysis
                }
            };
        }

        const buffer = this.rawBuffer[field_id];

        // ARTIFACT ATTRIBUTION HARDENING: flush and reinitialize if artifact changed
        if (buffer.artifact_id !== artifact_id && buffer.words.length > 0) {
            this._flushRawBuffer(field_id, 'artifact_switch');
            // Reinitialize for new artifact
            const newArtifactStartIso = artifact_id && this.activeArtifacts[artifact_id]
                ? this.activeArtifacts[artifact_id].startIso
                : this.identity.session_start_iso;
            buffer.artifact_id = artifact_id;
            buffer.artifact_start_iso = newArtifactStartIso;
            buffer.sessionStart = now;
            buffer.lastWordTime = now;
            buffer.currentWordStart = now;
            buffer.lastValue = '';
            buffer.committedLength = 0;  // Reset for new artifact
            buffer.aggregates = {
                wordCount: 0,
                totalCharsTyped: 0,
                totalCharsDeleted: 0,
                pasteDetected: false,
                pauses: []
            };
        }

        const newValue = config.value;
        const oldValue = buffer.lastValue;
        const delta = config.delta || 0;

        // Update char aggregates
        if (delta > 0) buffer.aggregates.totalCharsTyped += delta;
        else if (delta < 0) {
            buffer.aggregates.totalCharsDeleted += Math.abs(delta);
            // Adjust committedLength if deletion occurred before committed position
            if (buffer.committedLength !== undefined && newValue.length < buffer.committedLength) {
                buffer.committedLength = newValue.length;
            }
        }

        // Track paste detection
        if (config.inputType === 'insertFromPaste') {
            buffer.aggregates.pasteDetected = true;
        }

        // Track pause if significant (> 100ms)
        if (config.timeSinceLastKey && config.timeSinceLastKey > 100) {
            buffer.aggregates.pauses.push(config.timeSinceLastKey);
        }

        // Update artifact stats
        if (artifact_id && this.activeArtifacts[artifact_id]) {
            const artifact = this.activeArtifacts[artifact_id];
            if (delta > 0) artifact.data.charsTyped += delta;
            else if (delta < 0) artifact.data.charsDeleted += Math.abs(delta);
            if (config.inputType === 'insertFromPaste') artifact.data.pasteCount++;
        }

        // STRICT WORD BOUNDARY: capture ONLY on literal SPACE character (ASCII 32)
        // NOT on: tab, enter, newline, blur, flush, or any other trigger
        const lastChar = newValue.length > 0 ? newValue[newValue.length - 1] : '';
        const isLiteralSpace = lastChar === ' ';  // Only ASCII space (0x20)

        if (isLiteralSpace && oldValue.length > 0) {
            // Extract the word that was just completed (before the space)
            this._captureCompletedWord(field_id, oldValue, now);
        }

        buffer.lastValue = newValue;

        // Flush on critical word count
        if (buffer.words.length >= 50) {
            this._flushRawBuffer(field_id, 'buffer_full');
        }
    },

    /**
     * Extract and capture EXACTLY ONE word when space is pressed
     * Uses cumulative position tracking to prevent word order scrambling
     * @param {string} field_id - Field identifier
     * @param {string} value - Current field value (WITHOUT the trailing space)
     * @param {number} now - Current timestamp
     */
    _captureCompletedWord(field_id, value, now) {
        const buffer = this.rawBuffer[field_id];
        if (!buffer) return;

        // Find the last word in the value (the one just completed before space)
        const trimmedValue = value.trimEnd();
        if (!trimmedValue) return;

        // Find start of last word by looking for last space (or start of string)
        const lastSpaceIndex = trimmedValue.lastIndexOf(' ');
        const lastWord = lastSpaceIndex === -1
            ? trimmedValue
            : trimmedValue.substring(lastSpaceIndex + 1);

        if (!lastWord || lastWord.length === 0) return;

        // CUMULATIVE POSITION TRACKING: Only capture if text extends beyond what we've already captured
        // This prevents re-capturing words when user edits earlier in the text
        const wordEndPosition = trimmedValue.length;
        buffer._lastCapturedEndPosition = buffer._lastCapturedEndPosition || 0;

        // If user deleted back before our captured position, reset tracking
        if (wordEndPosition < buffer._lastCapturedEndPosition) {
            buffer._lastCapturedEndPosition = wordEndPosition;
            return;  // Don't capture - user is editing previously captured content
        }

        // If this word ends at or before our last captured position, skip it
        if (wordEndPosition <= buffer._lastCapturedEndPosition) {
            return;
        }

        // Update the cumulative position marker
        buffer._lastCapturedEndPosition = wordEndPosition;

        const timeSinceLastWord = now - buffer.lastWordTime;
        const msSinceStart = now - buffer.sessionStart;

        buffer.words.push({
            word: lastWord,
            t: msSinceStart,
            timeSinceLastWord
        });

        buffer.aggregates.wordCount++;
        buffer.lastWordTime = now;
        buffer.currentWordStart = now;
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
        if (!buffer) return;

        // ARTIFACT_END EXCEPTION: Capture the final trailing word when artifact completes
        // This ensures "Write a poem about stars" captures "stars" on submit
        // Still prevents fragment capture on blur/interval (like "Jessi" while typing "Jessica")
        if (reason === 'artifact_end' && buffer.lastValue) {
            const trimmedValue = buffer.lastValue.trimEnd();
            if (trimmedValue) {
                // Find the last word (after last space, or entire string if no space)
                const lastSpaceIndex = trimmedValue.lastIndexOf(' ');
                const trailingWord = lastSpaceIndex === -1
                    ? trimmedValue
                    : trimmedValue.substring(lastSpaceIndex + 1);

                // Use cumulative position tracking (same as _captureCompletedWord)
                const wordEndPosition = trimmedValue.length;
                buffer._lastCapturedEndPosition = buffer._lastCapturedEndPosition || 0;

                if (trailingWord && trailingWord.length > 0 && wordEndPosition > buffer._lastCapturedEndPosition) {
                    const now = Date.now();
                    const timeSinceLastWord = now - buffer.lastWordTime;
                    const msSinceStart = now - buffer.sessionStart;

                    buffer.words.push({
                        word: trailingWord,
                        t: msSinceStart,
                        timeSinceLastWord,
                        trailing: true  // Flag to indicate this was captured on artifact_end
                    });

                    buffer.aggregates.wordCount++;
                    buffer._lastCapturedEndPosition = wordEndPosition;
                }
            }
        }

        // Skip if no words captured
        if (buffer.words.length === 0) return;

        // Calculate artifact elapsed time at flush
        const now = Date.now();
        let artifactElapsedMs = null;
        if (buffer.artifact_id && this.activeArtifacts[buffer.artifact_id]) {
            artifactElapsedMs = now - this.activeArtifacts[buffer.artifact_id].startTime;
        }

        // Calculate derived aggregates from pauses
        const pauses = buffer.aggregates.pauses;
        const avgPauseDuration = pauses.length > 0
            ? Math.round(pauses.reduce((a, b) => a + b, 0) / pauses.length)
            : 0;
        const maxPause = pauses.length > 0 ? Math.max(...pauses) : 0;
        const longPauseThreshold = 2000; // 2 seconds
        const longPauses = pauses.filter(p => p >= longPauseThreshold);

        // Calculate edit ratio
        const totalTyped = buffer.aggregates.totalCharsTyped;
        const totalDeleted = buffer.aggregates.totalCharsDeleted;
        const editRatio = totalTyped > 0 ? Math.round((totalDeleted / totalTyped) * 100) / 100 : 0;

        // Calculate average word duration and identify slow words
        const wordDurations = buffer.words.map(w => w.timeSinceLastWord);
        const avgWordDuration = wordDurations.length > 0
            ? Math.round(wordDurations.reduce((a, b) => a + b, 0) / wordDurations.length)
            : 0;
        const slowWordThreshold = avgWordDuration * 2;
        const slowWords = buffer.words.filter(w => w.timeSinceLastWord > slowWordThreshold).map(w => w.word);

        // Identify words typed after long pauses
        const longPauseWords = buffer.words.filter(w => w.timeSinceLastWord >= longPauseThreshold).map(w => w.word);

        const payload = {
            field_id,
            artifact_start_iso: buffer.artifact_start_iso,
            artifact_elapsed_ms_at_flush: artifactElapsedMs,
            words: buffer.words,
            aggregates: {
                wordCount: buffer.aggregates.wordCount,
                totalCharsTyped: buffer.aggregates.totalCharsTyped,
                totalCharsDeleted: buffer.aggregates.totalCharsDeleted,
                editRatio,
                avgPauseDuration,
                maxPause,
                longPauseCount: longPauses.length,
                longPauseWords,
                avgWordDuration,
                slowWords,
                pasteDetected: buffer.aggregates.pasteDetected
            },
            flush_reason: reason
        };

        // Use flags for artifact_switch_flush
        const flags = reason === 'artifact_switch' ? 'artifact_switch_flush' : null;

        this.capture('raw.input.batch', payload, { immediate: true, flags });

        // Reset buffer (keep committedLength to prevent re-capturing same words)
        buffer.words = [];
        buffer.lastFlush = now;
        buffer.aggregates = {
            wordCount: 0,
            totalCharsTyped: 0,
            totalCharsDeleted: 0,
            pasteDetected: false,
            pauses: []
        };
        // Note: committedLength is NOT reset - it tracks absolute position in text
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
    // NARRATIVE GENERATION
    // ========================================

    /**
     * Build a factual, template-based narrative summary for an artifact
     * No scoring, no inference, no identity claims - purely descriptive
     * @param {object} artifact - The artifact data
     * @param {object} config - { status, finalText, summary }
     * @returns {string} Human-readable narrative
     */
    _buildNarrative(artifact, config) {
        const clauses = [];
        const duration = Date.now() - artifact.startTime;
        const durationSec = Math.round(duration / 1000);

        // Duration clause
        if (durationSec < 60) {
            clauses.push(`Completed in ${durationSec} seconds`);
        } else {
            const mins = Math.floor(durationSec / 60);
            const secs = durationSec % 60;
            clauses.push(`Completed in ${mins}m ${secs}s`);
        }

        // Typing activity clause
        const typed = artifact.data.charsTyped || 0;
        const deleted = artifact.data.charsDeleted || 0;
        if (typed > 0) {
            const editRatio = Math.round((deleted / typed) * 100);
            if (editRatio === 0) {
                clauses.push(`${typed} characters typed with no deletions`);
            } else if (editRatio < 20) {
                clauses.push(`${typed} characters typed with minimal editing (${editRatio}%)`);
            } else if (editRatio < 50) {
                clauses.push(`${typed} characters typed with moderate editing (${editRatio}%)`);
            } else {
                clauses.push(`${typed} characters typed with heavy editing (${editRatio}%)`);
            }
        }

        // Paste clause
        if (artifact.data.pasteCount > 0) {
            clauses.push(`${artifact.data.pasteCount} paste operation${artifact.data.pasteCount > 1 ? 's' : ''}`);
        }

        // Final text clause
        if (config.finalText !== undefined) {
            const wordCount = config.finalText.trim().split(/\s+/).filter(w => w).length;
            clauses.push(`Final text: ${wordCount} words, ${config.finalText.length} characters`);
        }

        // Status clause
        clauses.push(`Status: ${config.status}`);

        return clauses.join('. ') + '.';
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

        // Build JSON payload for Apps Script
        const payload = this._buildAppsScriptPayload(event);

        // Track sent count
        this.eventsSentCount++;

        // Use hidden form + iframe POST (same pattern as poemState.js)
        // This uses application/x-www-form-urlencoded which Apps Script parses reliably
        // IMPORTANT: Use unique iframe per POST to prevent cancellation of concurrent requests
        const frameId = '_guardianFrame_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        const iframe = document.createElement('iframe');
        iframe.id = frameId;
        iframe.name = frameId;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = this.config.endpointUrl;
        form.target = frameId;
        form.style.display = 'none';

        // Send payload as JSON string in a hidden field
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify(payload);
        form.appendChild(input);

        document.body.appendChild(form);
        form.submit();
        form.remove();

        // Clean up iframe after a delay (allow time for POST to complete)
        setTimeout(() => {
            const oldFrame = document.getElementById(frameId);
            if (oldFrame) oldFrame.remove();
        }, 10000);
    },

    /**
     * Build Apps Script payload with correct record_type routing
     */
    _buildAppsScriptPayload(event) {
        const eventType = event.event_type;
        const payload = JSON.parse(event.payload_json || '{}');

        // Route to correct record_type based on event_type
        if (eventType === 'session.start' || eventType === 'session.end') {
            return {
                record_type: 'session',
                session_id: event.visit_id,
                persistent_id: event.persistent_id,
                visit_count: payload.visit_count,
                started_at: eventType === 'session.start' ? event.timestamp_iso : payload.session_start_iso,
                ended_at: eventType === 'session.end' ? event.timestamp_iso : null,
                duration_ms: payload.session_duration_ms,
                events_sent: payload.events_sent_count,
                session_signature: payload.session_signature,
                device_fingerprint: JSON.parse(event.device_fingerprint_json || '{}')
            };
        }

        if (eventType.endsWith('.artifact')) {
            return {
                record_type: 'artifact',
                artifact_id: event.artifact_id,
                session_id: event.visit_id,
                section: event.section,
                kind: payload.kind,
                status: payload.status,
                started_at: payload.started_at,
                ended_at: event.timestamp_iso,
                duration_ms: payload.duration_ms,
                final_text: payload.final_text,
                word_count: payload.word_count,
                chars_typed: payload.chars_typed,
                chars_deleted: payload.chars_deleted,
                edit_ratio: payload.edit_ratio,
                narrative_summary: payload.narrative_summary
            };
        }

        if (eventType === 'raw.input.batch') {
            return {
                record_type: 'raw_event',
                event_id: this._generateId('rev'),
                session_id: event.visit_id,
                artifact_id: event.artifact_id,
                event_type: eventType,
                timestamp_iso: event.timestamp_iso,
                field_id: payload.field_id,
                words: payload.words,
                aggregates: payload.aggregates,
                flags: event.flags
            };
        }

        // Default: interaction record
        return {
            record_type: 'interaction',
            event_id: this._generateId('iev'),
            session_id: event.visit_id,
            artifact_id: event.artifact_id,
            event_type: eventType,
            timestamp_iso: event.timestamp_iso,
            details: payload
        };
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

            // Track text for entrance artifacts (extract step name from field_id)
            if (field_id.startsWith('entrance.')) {
                const stepName = field_id.replace('entrance.', '');
                this.entrance.trackText(stepName, newValue);
            }

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
        currentArtifactId: null,
        currentStepName: null,
        stepStartTime: null,
        failureCounts: {},
        stepsCompleted: 0,
        lastTypedText: {},  // { [stepName]: text } tracks last text for each step

        // Map step names to artifact kinds
        // Note: bookmarkQuestion is NOT here - it's handled separately by recordBookmarkChoice
        _stepToKind: {
            'casualName': 'entrance_casual',
            'realName': 'entrance_name',
            'finalName': 'entrance_name',
            'frontInscription': 'entrance_front',
            'backInscription': 'entrance_back'
        },

        start() {
            Guardian.setContext({ section: 'entrance' });
            this.stepStartTime = Date.now();
            this.failureCounts = {};
            this.stepsCompleted = 0;
            this.currentArtifactId = null;
            this.currentStepName = null;
            this.lastTypedText = {};
        },

        /**
         * Enter a step - begins tracking if this step type has an artifact kind
         * @param {number} stepNum - Step index
         * @param {string} stepName - Step name from stepNames array
         */
        stepEnter(stepNum, stepName) {
            // Get artifact kind for this step (if any)
            const kind = this._stepToKind[stepName];

            // If there's an open artifact, close it before doing anything else
            // This handles steps that don't call recordSuccess (like casualName)
            if (this.currentArtifactId !== null) {
                const prevStepName = this.currentStepName;
                const text = this.lastTypedText[prevStepName] || '';
                // Use 'submitted' for steps that accept any input (no validation)
                Guardian.endArtifact({
                    artifact_id: this.currentArtifactId,
                    status: 'submitted',
                    finalText: text,
                    summary: {
                        attempt_count: (this.failureCounts[prevStepName] || 0) + 1
                    }
                });
                this.stepsCompleted++;
                this.currentArtifactId = null;
                this.currentStepName = null;
            }

            // Start new artifact if this step type has one
            if (kind) {
                this.stepStartTime = Date.now();
                this.currentStepName = stepName;
                this.currentArtifactId = Guardian.startArtifact({ section: 'entrance', kind: kind });
            }

            Guardian.capture('entrance.step.enter', {
                step_num: stepNum,
                step_name: stepName
            });
        },

        /**
         * Exit a step - captures duration
         * @param {number} stepNum - Step index
         * @param {string} stepName - Step name
         */
        stepExit(stepNum, stepName) {
            const duration = this.stepStartTime ? Date.now() - this.stepStartTime : 0;
            Guardian.capture('entrance.step.exit', {
                step_num: stepNum,
                step_name: stepName,
                duration_ms: duration
            });
        },

        /**
         * Record successful validation for a step (correct answer to a question)
         * Uses 'accepted' status for question-type artifacts
         * @param {string} stepName - Step name (e.g., 'realName', 'frontInscription')
         */
        recordSuccess(stepName) {
            const text = this.lastTypedText[stepName] || '';

            // If this step has an artifact, complete it with 'accepted' status
            if (this.currentArtifactId && this.currentStepName === stepName) {
                this._endCurrentStep('accepted', text);
                this.stepsCompleted++;
            }

            // Track verification success
            this.failureCounts[stepName] = this.failureCounts[stepName] || 0;
            Guardian.capture('entrance.verification.success', {
                step_name: stepName,
                attempts: (this.failureCounts[stepName] || 0) + 1
            });
        },

        /**
         * Record failed validation for a step (wrong answer to a question)
         * Emits artifact with 'failed' status and starts new attempt
         * @param {string} stepName - Step name
         * @param {string} reason - Failure reason
         */
        recordFailure(stepName, reason) {
            this.failureCounts[stepName] = (this.failureCounts[stepName] || 0) + 1;
            const attemptNum = this.failureCounts[stepName];
            const text = this.lastTypedText[stepName] || '';

            // If this step has an artifact, emit failed artifact and start a new one
            if (this.currentArtifactId && this.currentStepName === stepName) {
                this._endCurrentStep('failed', text, { failure_reason: reason });
                // Begin new attempt artifact for same step
                const kind = this._stepToKind[stepName];
                if (kind) {
                    this.stepStartTime = Date.now();
                    this.currentArtifactId = Guardian.startArtifact({ section: 'entrance', kind });
                    // Keep tracking same stepName for the new attempt
                    this.currentStepName = stepName;
                }
            }

            // Clear the text for next attempt (user will retype)
            this.lastTypedText[stepName] = '';

            Guardian.capture('entrance.verification.failure', {
                step_name: stepName,
                reason: reason,
                attempt_num: attemptNum
            });
        },

        /**
         * Track typed text for a step (called from captureRawInput)
         * @param {string} stepName - Step name
         * @param {string} text - Current text value
         */
        trackText(stepName, text) {
            this.lastTypedText[stepName] = text;
        },

        /**
         * Record pearls shortcut used
         * Clears casualName artifact without emitting (pearls is a shortcut, not a name)
         * Only emits entrance_path artifact with status 'accepted'
         */
        recordPearlsShortcut() {
            // Flush raw buffer before clearing artifact (so typing is still captured)
            if (this.currentArtifactId) {
                Guardian._flushRawBufferForArtifact(this.currentArtifactId);
                this.currentArtifactId = null;
                this.currentStepName = null;
            }
            // Create path artifact with 'accepted' (correct secret word)
            const artifactId = Guardian.startArtifact({ section: 'entrance', kind: 'entrance_path' });
            Guardian.endArtifact({
                artifact_id: artifactId,
                status: 'accepted',
                finalText: 'pearls',
                summary: { path_type: 'pearls' }
            });
        },

        /**
         * Record special path (beloved/rose) - emits only entrance_path artifact
         * Clears casualName artifact without emitting (like pearls shortcut)
         * Only emits entrance_path artifact with status 'accepted'
         * @param {string} path - Path identifier
         */
        recordSpecialPath(path) {
            // Flush raw buffer before clearing artifact (so typing is still captured)
            if (this.currentArtifactId) {
                Guardian._flushRawBufferForArtifact(this.currentArtifactId);
                this.currentArtifactId = null;
                this.currentStepName = null;
            }
            // Create path artifact with 'accepted' (correct secret word, like pearls)
            const artifactId = Guardian.startArtifact({ section: 'entrance', kind: 'entrance_path' });
            Guardian.endArtifact({
                artifact_id: artifactId,
                status: 'accepted',
                finalText: path,
                summary: { path_type: path }
            });
        },

        /**
         * Record bookmark choice (yes/no) - called when buttons clicked
         * Bookmark is a decision artifact (submitted), not a question (accepted/failed)
         * @param {string} choice - "yes" or "no"
         */
        recordBookmarkChoice(choice) {
            // Note: No previous artifact to close - bookmark step doesn't have an artifact kind
            // Create bookmark artifact with 'submitted' status (it's a choice, not a question)
            const artifactId = Guardian.startArtifact({ section: 'entrance', kind: 'entrance_bookmark' });
            Guardian.endArtifact({
                artifact_id: artifactId,
                status: 'submitted',
                finalText: choice,
                summary: { kept_bookmark: choice === 'yes' }
            });
            this.stepsCompleted++;
        },

        _endCurrentStep(status, finalText, extraSummary = {}) {
            if (!this.currentArtifactId) return;

            Guardian.endArtifact({
                artifact_id: this.currentArtifactId,
                status,
                finalText,
                summary: {
                    attempt_count: (this.failureCounts[this.currentStepName] || 0) + 1,
                    ...extraSummary
                }
            });
            this.currentArtifactId = null;
            this.currentStepName = null;
        },

        // Flow completion - emit summary interaction
        complete(accepted, userData) {
            // End any open step artifact with 'accepted' if flow completed successfully
            if (this.currentArtifactId) {
                this._endCurrentStep(accepted ? 'accepted' : 'abandoned',
                    this.lastTypedText[this.currentStepName] || '');
                if (accepted) this.stepsCompleted++;
            }

            // Emit flow summary as interaction (not artifact)
            Guardian.capture('entrance.flow.complete', {
                accepted,
                pearls_used: userData.isPearlsEntry,
                steps_completed: this.stepsCompleted,
                failure_counts: this.failureCounts,
                casual_name: userData.casualName,
                real_name: userData.realName,
                kept_bookmark: userData.keptBookmark
            }, { immediate: true });
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
        currentArtifactId: null,
        whispersSent: 0,
        editModeUsed: false,
        timingModeChanges: [],
        confirmationShown: false,

        start() {
            Guardian.setContext({ section: 'whisper' });
            this.whispersSent = 0;
            this.editModeUsed = false;
            this.timingModeChanges = [];
            this.confirmationShown = false;
            // Start first artifact for typing
            this._beginNewAttempt();
        },

        _beginNewAttempt() {
            this.currentArtifactId = Guardian.startArtifact({ section: 'whisper', kind: 'whisper_attempt' });
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

        /**
         * Each whisper send = one artifact
         * @param {string} text - The whisper text being sent
         * @param {boolean} isEdit - Whether this is an edit of previous whisper
         */
        onWhisperSubmit(text, isEdit) {
            // If this is an edit-mode send, DON'T emit attempt - completeSent will emit the final
            // This prevents duplicate artifacts (attempt + final for same edited text)
            if (isEdit) {
                // Discard the pending attempt artifact without emitting
                if (this.currentArtifactId) {
                    delete Guardian.activeArtifacts[this.currentArtifactId];
                    if (Guardian.context.artifact_id === this.currentArtifactId) {
                        Guardian.context.artifact_id = null;
                    }
                    this.currentArtifactId = null;
                }
                this.whispersSent++;

                Guardian.capture('whisper.submit', {
                    length: text.length,
                    is_edit: isEdit,
                    whisper_number: this.whispersSent
                });
                return;
            }

            // Normal flow: emit attempt artifact
            if (this.currentArtifactId && text && text.trim().length > 0) {
                Guardian.endArtifact({
                    artifact_id: this.currentArtifactId,
                    status: 'submitted',
                    finalText: text,
                    summary: {
                        whisper_number: this.whispersSent + 1,
                        is_edit: isEdit,
                        edit_mode_used: this.editModeUsed,
                        timing_mode_changes: this.timingModeChanges.length
                    }
                });
                this.whispersSent++;
                // Start new artifact for potential next whisper
                this._beginNewAttempt();
            }

            Guardian.capture('whisper.submit', {
                length: text.length,
                is_edit: isEdit,
                whisper_number: this.whispersSent
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

        /**
         * Called when whispers are confirmed and sent to garden
         * Emits whisper_sent artifact with status 'submitted'
         * @param {string} allWhisperText - Combined text of all sent whispers
         */
        completeSent(allWhisperText) {
            // Close any pending attempt artifact without emitting (it was just tracking typing)
            if (this.currentArtifactId) {
                delete Guardian.activeArtifacts[this.currentArtifactId];
                if (Guardian.context.artifact_id === this.currentArtifactId) {
                    Guardian.context.artifact_id = null;
                }
            }

            // Emit the final whisper_sent artifact
            const artifactId = Guardian.startArtifact({ section: 'whisper', kind: 'whisper_sent' });
            Guardian.endArtifact({
                artifact_id: artifactId,
                status: 'submitted',
                finalText: allWhisperText,
                summary: {
                    total_whispers: this.whispersSent,
                    edit_mode_used: this.editModeUsed,
                    timing_mode_changes: this.timingModeChanges.length
                }
            });

            // Emit section summary interaction
            Guardian.capture('whisper.section.complete', {
                total_whispers_sent: this.whispersSent,
                confirmation_shown: this.confirmationShown,
                outcome: 'sent'
            }, { immediate: true });

            // Reset state and start new attempt for potential next whisper
            this.whispersSent = 0;
            this.confirmationShown = false;
            this._beginNewAttempt();
        },

        /**
         * Called when user silences whispers (confirms leaving with unsent content)
         * Emits whisper_silenced artifact with status 'abandoned'
         * @param {string} draftText - The unsent whisper content that was silenced
         */
        completeSilenced(draftText) {
            // Close any pending attempt artifact without emitting
            if (this.currentArtifactId) {
                delete Guardian.activeArtifacts[this.currentArtifactId];
                if (Guardian.context.artifact_id === this.currentArtifactId) {
                    Guardian.context.artifact_id = null;
                }
            }

            // Emit whisper_silenced artifact
            const artifactId = Guardian.startArtifact({ section: 'whisper', kind: 'whisper_silenced' });
            Guardian.endArtifact({
                artifact_id: artifactId,
                status: 'abandoned',
                finalText: draftText,
                summary: {
                    whispers_typed: this.whispersSent,
                    edit_mode_used: this.editModeUsed,
                    timing_mode_changes: this.timingModeChanges.length
                }
            });

            this.currentArtifactId = null;

            // Emit section summary interaction
            Guardian.capture('whisper.section.complete', {
                total_whispers_sent: this.whispersSent,
                confirmation_shown: this.confirmationShown,
                outcome: 'silenced'
            }, { immediate: true });
        },

        /**
         * Called when leaving whisper section with no content (empty exit)
         */
        completeEmpty() {
            // Close any pending attempt artifact without emitting
            if (this.currentArtifactId) {
                delete Guardian.activeArtifacts[this.currentArtifactId];
                if (Guardian.context.artifact_id === this.currentArtifactId) {
                    Guardian.context.artifact_id = null;
                }
            }

            this.currentArtifactId = null;

            // Emit section summary interaction
            Guardian.capture('whisper.section.complete', {
                total_whispers_sent: 0,
                confirmation_shown: false,
                outcome: 'empty'
            }, { immediate: true });
        },

        /**
         * @deprecated Use completeSent, completeSilenced, or completeEmpty instead
         */
        complete(status, draftText, whisperCount) {
            // Legacy compatibility - route to appropriate method
            if (status === 'submitted' && draftText) {
                this.completeSent(draftText);
            } else if (draftText && draftText.trim().length > 0) {
                this.completeSilenced(draftText);
            } else {
                this.completeEmpty();
            }
        },

        /**
         * @deprecated Use completeSilenced instead
         */
        abandon(draftText) {
            this.completeSilenced(draftText);
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
            // EXPRESSIVE ARTIFACT RULE: suppress empty artifacts
            // Only emit if user typed ≥1 word OR pasted content
            const artifact = Guardian.activeArtifacts[this.artifact_id];
            const hasTypedContent = artifact && (artifact.data.charsTyped > 0 || artifact.data.pasteCount > 0);
            const hasFinalText = finalText && finalText.trim().length > 0;

            if (!hasTypedContent && !hasFinalText) {
                // No meaningful engagement - suppress artifact, just cleanup
                delete Guardian.activeArtifacts[this.artifact_id];
                if (Guardian.context.artifact_id === this.artifact_id) {
                    Guardian.context.artifact_id = null;
                }
                this.artifact_id = null;
                return;
            }

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
