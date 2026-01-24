/* ========================================
   WHISPER SECTION
   Whisper input, seed, rings, send animation
   ======================================== */

const WhisperSection = {
    seedEmberInterval: null,
    cleanupInterval: null,
    dropdownClickHandler: null,

    show() {
        this.resetWhisperState();

        // Start whisper artifact tracking
        Guardian.whisper.start();

        const menu = document.getElementById('mainMenu');
        const helpIcon = document.getElementById('helpIcon');
        if (menu) menu.classList.remove('visible');
        if (helpIcon) {
            helpIcon.classList.remove('visible');
            helpIcon.style.pointerEvents = 'none';
        }

        const whisperContainer = document.createElement('div');
        whisperContainer.classList.add('whisper-container');
        whisperContainer.id = 'whisperContainer';

        const introMsg = document.createElement('div');
        introMsg.classList.add('message');
        introMsg.innerHTML = '<span class="nowrap">Plant your whispers;</span> <br class="mobile-break">the garden will listen.';
        whisperContainer.appendChild(introMsg);

        document.body.appendChild(whisperContainer);

        const backBtn = document.createElement('button');
        backBtn.classList.add('back-button');
        backBtn.textContent = '← Return';
        backBtn.id = 'whisperBackBtn';
        backBtn.addEventListener('click', () => {
            const textarea = document.getElementById('whisperTextarea');
            const hasUnsentWhispers = state.whisper.texts.length > 0 ||
                (textarea && textarea.value.trim().length > 0);

            if (hasUnsentWhispers) {
                this.showReturnConfirmation((confirmed) => {
                    if (confirmed) {
                        // Track silenced whisper - user chose to leave without sending
                        const draftText = state.whisper.texts.filter(t => t !== SEPARATOR).join(' ') +
                            (textarea && textarea.value.trim() ? ' ' + textarea.value.trim() : '');
                        Guardian.whisper.completeSilenced(draftText.trim());

                        Helpers.createButtonFocusEffect(backBtn, () => {
                            this.resetWhisperState();
                            ParticleSystem.stopWhisperEmbers();
                            whisperContainer.remove();
                            backBtn.remove();
                            const envelopeHelper = document.getElementById('envelopeHelper');
                            if (envelopeHelper) envelopeHelper.remove();
                            if (menu) menu.classList.add('visible');
                            if (helpIcon) {
                                helpIcon.classList.add('visible');
                                helpIcon.style.pointerEvents = 'auto';
                            }
                        });
                    }
                });
            } else {
                // Track empty exit - no whispers typed
                Guardian.whisper.completeEmpty();

                Helpers.createButtonFocusEffect(backBtn, () => {
                    this.resetWhisperState();
                    ParticleSystem.stopWhisperEmbers();
                    whisperContainer.remove();
                    backBtn.remove();
                    const envelopeHelper = document.getElementById('envelopeHelper');
                    if (envelopeHelper) envelopeHelper.remove();
                    if (menu) menu.classList.add('visible');
                    if (helpIcon) {
                        helpIcon.classList.add('visible');
                        helpIcon.style.pointerEvents = 'auto';
                    }
                });
            }
        });
        document.body.appendChild(backBtn);

        backBtn.style.opacity = '0';
        backBtn.style.transition = 'opacity 1.5s ease';
        backBtn.style.pointerEvents = 'none';

        setTimeout(() => introMsg.classList.add('visible'), 100);
        setTimeout(() => {
            introMsg.classList.add('fading');
            setTimeout(() => {
                introMsg.remove();
                this.showInput();
            }, 1500);
        }, 2500);
    },

    showInput() {
        const envelopeHelper = document.getElementById('envelopeHelper');
        if (state.whisper.envelopeHelperCreated) {
            if (envelopeHelper) {
                envelopeHelper.style.filter = '';
                envelopeHelper.classList.add('visible');
                envelopeHelper.style.opacity = '1';
                envelopeHelper.style.pointerEvents = 'auto';
            } else {
                this.createEnvelopeHelper();
            }
        }

        const whisperContainer = document.getElementById('whisperContainer');
        if (!whisperContainer) return;

        const prompt = document.createElement('div');
        prompt.classList.add('whisper-prompt');
        prompt.textContent = 'Whatever you wish to say...';

        const inputWrapper = document.createElement('div');
        inputWrapper.classList.add('whisper-input-wrapper');
        inputWrapper.id = 'whisperInputWrapper';

        const glowBg = document.createElement('div');
        glowBg.classList.add('whisper-glow-bg');

        const textarea = document.createElement('textarea');
        textarea.classList.add('whisper-textarea');
        textarea.placeholder = ' ';
        textarea.autocomplete = 'off';
        textarea.spellcheck = false; /* Chrome mobile: disable word underline */
        textarea.setAttribute('autocorrect', 'off'); /* iOS: disable autocorrect */
        textarea.setAttribute('autocapitalize', 'sentences'); /* iOS: allow sentence capitalization */
        textarea.id = 'whisperTextarea';
        textarea.rows = 1;
        textarea.maxLength = 216;

        const envelopeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        envelopeIcon.classList.add('envelope-icon');
        envelopeIcon.id = 'envelopeIcon';
        envelopeIcon.setAttribute('viewBox', '0 0 24 24');
        envelopeIcon.setAttribute('fill', 'none');
        envelopeIcon.setAttribute('stroke', 'currentColor');
        envelopeIcon.setAttribute('stroke-width', '1');
        envelopeIcon.innerHTML = `
            <circle cx="12" cy="12" r="10" opacity="0.3"/>
            <path d="M4 8l8 5 8-5M4 8v8a2 2 0 002 2h12a2 2 0 002-2V8"/>
        `;

        const plusBtn = document.createElement('div');
        plusBtn.classList.add('plus-button');
        plusBtn.textContent = '+';
        plusBtn.id = 'plusButton';

        const dropdown = this.createTimingDropdown();
        plusBtn.appendChild(dropdown);

        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('visible');
        });

        // Store reference so we can remove it when leaving whisper
        this.dropdownClickHandler = (e) => {
            if (!plusBtn.contains(e.target)) {
                dropdown.classList.remove('visible');
            }
        };
        document.addEventListener('click', this.dropdownClickHandler);

        const sendArrow = document.createElement('div');
        sendArrow.classList.add('send-arrow');
        sendArrow.id = 'sendArrow';
        sendArrow.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        `;

        inputWrapper.appendChild(glowBg);
        inputWrapper.appendChild(plusBtn);
        inputWrapper.appendChild(textarea);
        inputWrapper.appendChild(envelopeIcon);
        inputWrapper.appendChild(sendArrow);

        whisperContainer.appendChild(prompt);
        whisperContainer.appendChild(inputWrapper);

        this.createSeed();

        setTimeout(() => {
            prompt.classList.add('visible');
            inputWrapper.classList.add('visible');

            const backBtn = document.getElementById('whisperBackBtn');
            if (backBtn) {
                backBtn.style.opacity = '1';
                backBtn.style.pointerEvents = 'auto';
            }
        }, 100);

        // Intersection-based curtain blur for prompt (mobile only)
        // When the prompt enters the "danger zone" near the top (too close to back button),
        // it fades out. This is spatial - no manual height tracking needed.
        // Back button: top 20px + ~45px height = bottom edge ~65px, plus breathing room
        const CURTAIN_ZONE_TOP = 80; // px from viewport top - back button sits above this

        const curtainObserver = new IntersectionObserver((entries) => {
            // Only apply on mobile
            if (window.innerWidth > 768) {
                prompt.classList.remove('curtain-blur');
                return;
            }

            entries.forEach(entry => {
                // isIntersecting = prompt is BELOW the danger zone (safe)
                // NOT isIntersecting = prompt has entered the danger zone (blur it)
                if (entry.isIntersecting) {
                    prompt.classList.remove('curtain-blur');
                } else {
                    prompt.classList.add('curtain-blur');
                }
            });
        }, {
            // Shrink the viewport by 60px from top - when prompt exits this area
            // (moves into the top 60px), it's no longer "intersecting"
            rootMargin: `-${CURTAIN_ZONE_TOP}px 0px 0px 0px`,
            threshold: 0
        });

        curtainObserver.observe(prompt);

        // Store observer for cleanup
        whisperContainer.curtainObserver = curtainObserver;

        function autoExpandTextarea(textarea) {
            const minHeight = 52;
            const maxHeight = 234; // ~8 lines (26px per line + 26px padding)

            // Store current height before measuring
            const currentHeight = textarea.offsetHeight;

            // Temporarily disable transition and set to auto to measure
            textarea.style.transition = 'none';
            textarea.style.height = 'auto';
            const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

            // Set back to current height immediately
            textarea.style.height = currentHeight + 'px';

            // Force reflow to apply the current height
            textarea.offsetHeight;

            // Re-enable transition
            textarea.style.transition = '';

            // Now animate to the new height
            requestAnimationFrame(() => {
                textarea.style.height = newHeight + 'px';
                textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
            });
        }

        // Attach auto-expand to input with character limit enforcement
        // Mobile browsers can bypass maxLength via predictive text/paste
        const MAX_CHARS = 216;
        let lastValidValue = '';
        let valueBeforeDeletion = '';

        // Prevent line deletion bug on mobile - some keyboards delete entire lines
        // when backspace is held or predictive text glitches at maxHeight boundary
        textarea.addEventListener('beforeinput', (e) => {
            // Track any input that could potentially cause content loss
            if (e.inputType === 'deleteContentBackward' ||
                e.inputType === 'deleteByCut' ||
                e.inputType === 'deleteContent' ||
                e.inputType === 'deleteWordBackward' ||
                e.inputType === 'deleteSoftLineBackward' ||
                e.inputType === 'deleteHardLineBackward') {
                // Store value before deletion for potential recovery
                valueBeforeDeletion = textarea.value;
            }
        });

        // Also protect against composition events (predictive text completion)
        // which can sometimes replace content unexpectedly on mobile
        let valueBeforeComposition = '';
        textarea.addEventListener('compositionstart', () => {
            valueBeforeComposition = textarea.value;
        });

        textarea.addEventListener('compositionend', () => {
            // Check if composition caused unexpected content loss
            if (valueBeforeComposition.length > 50 &&
                textarea.value.length < valueBeforeComposition.length - 30) {
                console.warn('Whisper: Composition caused content loss, restoring');
                textarea.value = valueBeforeComposition;
                autoExpandTextarea(textarea);
            }
            valueBeforeComposition = '';
        });

        textarea.addEventListener('input', () => {
            // Recovery check: if a deletion removes more than expected, restore
            // This catches mobile keyboard bugs that wipe entire lines at maxHeight
            if (valueBeforeDeletion.length > 50) {
                const expectedMaxDeletion = 20; // Single word or short phrase
                const actualDeletion = valueBeforeDeletion.length - textarea.value.length;

                // If we lost way more content than a normal delete would remove,
                // and the textarea is now nearly empty, something went wrong
                if (actualDeletion > expectedMaxDeletion && textarea.value.length < 10) {
                    console.warn('Whisper: Detected suspicious content loss, restoring');
                    textarea.value = valueBeforeDeletion;
                }
            }
            valueBeforeDeletion = ''; // Reset after checking

            // Enforce character limit (mobile browsers can bypass maxLength)
            if (textarea.value.length > MAX_CHARS) {
                // Preserve cursor position relative to the truncation
                const cursorPos = textarea.selectionStart;
                textarea.value = textarea.value.substring(0, MAX_CHARS);
                // Restore cursor, clamped to new length
                textarea.selectionStart = textarea.selectionEnd = Math.min(cursorPos, MAX_CHARS);
            }
            lastValidValue = textarea.value;
            autoExpandTextarea(textarea);
        });

        textarea.addEventListener('focus', () => {
            Guardian.whisper.onTextareaFocus();

            whisperContainer.classList.add('input-focused');
            const seedContainer = document.getElementById('seedContainer');
            const backBtn = document.getElementById('whisperBackBtn');
            if (seedContainer) seedContainer.classList.add('input-focused');
            if (backBtn) backBtn.classList.add('input-focused');

            const envelopeIcon = document.getElementById('envelopeIcon');
            if (envelopeIcon) envelopeIcon.style.opacity = '0';
        });

        // Instrument textarea for raw capture
        Guardian.instrumentInput(textarea, 'whisper.textarea');

        textarea.addEventListener('blur', () => {
            whisperContainer.classList.remove('input-focused');
            const seedContainer = document.getElementById('seedContainer');
            const backBtn = document.getElementById('whisperBackBtn');
            if (seedContainer) seedContainer.classList.remove('input-focused');
            if (backBtn) backBtn.classList.remove('input-focused');

            const envelopeIcon = document.getElementById('envelopeIcon');
            if (envelopeIcon && textarea.value === '') {
                envelopeIcon.style.opacity = '0.25';
            }
        });

        this.setupTypingFireflies(textarea);
        this.handleSubmission(textarea, sendArrow);

        setTimeout(() => {
            ParticleSystem.startWhisperEmbers(whisperContainer, 0.4);
        }, 1000);

        // Store reference so we can clear it when leaving whisper
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.cleanupInterval = setInterval(() => {
            ParticleSystem.cleanupParticles();
        }, 5000);
    },

    setupTypingFireflies(textarea) {
        let lastLength = 0;

        textarea.addEventListener('input', () => {
            const currentLength = textarea.value.length;

            if (currentLength > lastLength) {
                const charPosition = Helpers.getTextareaCharacterPosition(textarea);
                if (charPosition) {
                    ParticleSystem.createTypingFirefly(charPosition.x, charPosition.y);
                }
            }

            lastLength = currentLength;
        });
    },

    createTimingDropdown() {
        const dropdown = document.createElement('div');
        dropdown.classList.add('timing-dropdown');
        dropdown.id = 'timingDropdown';

        const options = [
            { label: '2s', value: 2000 },
            { label: '4s', value: 4000 },
            { label: '6s', value: 6000 },
            { label: '8s', value: 8000 },
            { label: 'Send', value: 'manual' }
        ];

        options.forEach((option, index) => {
            const optionEl = document.createElement('div');
            optionEl.classList.add('timing-option');
            optionEl.textContent = option.label;
            if (index === 0) optionEl.classList.add('active');
            optionEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectTiming(option.value, optionEl);
            });
            dropdown.appendChild(optionEl);
        });

        return dropdown;
    },

    selectTiming(value, optionEl) {
        document.querySelectorAll('.timing-option').forEach(opt => {
            opt.classList.remove('active');
        });
        optionEl.classList.add('active');

        const previousMode = state.whisper.timingMode;

        if (value === 'manual' && state.whisper.timingMode !== 'manual') {
            state.whisper.previousTimingMode = state.whisper.timingMode;
        }

        state.whisper.timingMode = value;

        // Track timing mode change
        Guardian.whisper.onTimingChange(value, previousMode);

        const sendArrow = document.getElementById('sendArrow');
        const textarea = document.getElementById('whisperTextarea');
        const dropdown = document.getElementById('timingDropdown');

        if (dropdown) {
            dropdown.classList.remove('visible');
        }

        if (value === 'manual') {
            sendArrow.classList.add('visible');
            if (textarea) textarea.style.paddingRight = '50px';
        } else {
            sendArrow.classList.remove('visible');
            if (textarea) textarea.style.paddingRight = '50px';
        }
    },

    handleSubmission(textarea, sendArrow) {
        let typingTimer;

        textarea.addEventListener('input', () => {
            if (state.whisper.timingMode === 'manual') return;

            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const value = textarea.value.trim();
                if (value) {
                    if (state.whisper.isEditMode) {
                        this.submitEditedWhisper(value, textarea);
                    } else {
                        this.submitWhisper(value, textarea);
                    }
                }
            }, state.whisper.timingMode);
        });

        sendArrow.addEventListener('click', () => {
            const value = textarea.value.trim();
            if (value) {
                if (state.whisper.isEditMode) {
                    this.submitEditedWhisper(value, textarea);
                } else {
                    this.submitWhisper(value, textarea);
                }
            }
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && state.whisper.timingMode === 'manual') {
                e.preventDefault();
                const value = textarea.value.trim();
                if (value) {
                    if (state.whisper.isEditMode) {
                        this.submitEditedWhisper(value, textarea);
                    } else {
                        this.submitWhisper(value, textarea);
                    }
                }
            }
        });
    },

    submitEditedWhisper(whisperText, textarea) {
        // Track edited whisper submit
        Guardian.whisper.onWhisperSubmit(whisperText, true);
        Guardian.captureInteraction('typing.feedback', { type: 'bloom', field: 'whisper.textarea' });

        textarea.style.opacity = '0.3';
        textarea.style.transition = 'opacity 0.8s ease';

        // Wait for keyboard to dismiss, then fire bloom at correct position
        setTimeout(() => {
            Helpers.afterKeyboardDismiss(textarea, (rect) => {
                ParticleSystem.createBloom(rect);

                setTimeout(() => {
                    state.whisper.texts = [whisperText];
                    state.whisper.isEditMode = false;

                    textarea.value = '';
                    textarea.style.height = '52px';
                    textarea.style.opacity = '1';

                    const envelopeIcon = document.getElementById('envelopeIcon');
                    if (envelopeIcon && state.whisper.envelopeHelperCreated) {
                        envelopeIcon.style.transition = 'opacity 0.8s ease';
                        envelopeIcon.style.opacity = '0.25';
                    }

                    const seedWrapper = document.getElementById('seedWrapper');
                    const prompt = document.querySelector('.whisper-prompt');
                    const inputWrapper = document.getElementById('whisperInputWrapper');
                    const backBtn = document.getElementById('whisperBackBtn');
                    const envelopeHelper = document.getElementById('envelopeHelper');
                    const glow = document.getElementById('glow');

                    if (seedWrapper) seedWrapper.style.filter = 'blur(8px)';
                    if (prompt) prompt.style.filter = 'blur(8px)';
                    if (inputWrapper) inputWrapper.style.filter = 'blur(8px)';
                    if (backBtn) backBtn.style.filter = 'blur(8px)';
                    if (envelopeHelper) envelopeHelper.style.filter = 'blur(8px)';
                    if (glow) glow.style.filter = 'blur(8px)';

                    for (let i = 1; i <= 3; i++) {
                        const container = document.getElementById(`circleTextContainer${i}`);
                        if (container) container.style.filter = 'blur(8px)';
                    }

                    this.sendWhispers();
                }, 500);
            });
        }, 800);
    },

    submitWhisper(whisperText, textarea) {
        // Track whisper submit
        Guardian.whisper.onWhisperSubmit(whisperText, false);
        Guardian.captureInteraction('typing.feedback', { type: 'bloom', field: 'whisper.textarea' });

        textarea.style.opacity = '0.3';
        textarea.style.transition = 'opacity 0.8s ease';

        // Wait for keyboard to dismiss, then fire bloom at correct position
        setTimeout(() => {
            Helpers.afterKeyboardDismiss(textarea, (rect) => {
                ParticleSystem.createBloom(rect);

                setTimeout(() => {
                    this.addWhisper(whisperText);
                    textarea.value = '';
                    textarea.style.height = '52px';
                    textarea.style.opacity = '1';

                    const envelopeIcon = document.getElementById('envelopeIcon');
                    if (envelopeIcon && state.whisper.envelopeHelperCreated) {
                        envelopeIcon.style.transition = 'opacity 0.8s ease';
                        envelopeIcon.style.opacity = '0.25';
                    }

                    if (!state.whisper.firstWhisperSent) {
                        state.whisper.firstWhisperSent = true;
                        this.animateFirstWhisper();
                    }
                }, 500);
            });
        }, 800);
    },

    animateFirstWhisper() {
        if (state.whisper.envelopeHelperCreated) {
            const envelopeIcon = document.getElementById('envelopeIcon');
            if (envelopeIcon) {
                envelopeIcon.style.transition = 'opacity 0.8s ease';
                envelopeIcon.style.opacity = '0.25';
            }
            return;
        }

        const envelopeIcon = document.getElementById('envelopeIcon');
        const inputWrapper = document.getElementById('whisperInputWrapper');

        if (!envelopeIcon || !inputWrapper) return;

        envelopeIcon.style.opacity = '1';
        envelopeIcon.classList.add('awakening');

        setTimeout(() => {
            envelopeIcon.classList.remove('awakening');

            const startRect = envelopeIcon.getBoundingClientRect();

            const travelEnvelope = envelopeIcon.cloneNode(true);
            travelEnvelope.id = 'travelingEnvelope';
            travelEnvelope.classList.remove('awakening');
            travelEnvelope.style.cssText = `
                position: fixed;
                left: ${startRect.left}px;
                top: ${startRect.top}px;
                width: ${startRect.width}px;
                height: ${startRect.height}px;
                opacity: 0;
                z-index: 200;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;

            document.body.appendChild(travelEnvelope);

            setTimeout(() => {
                travelEnvelope.style.opacity = '1';
            }, 50);

            envelopeIcon.style.opacity = '0';

            setTimeout(() => {
                const isMobile = window.innerWidth <= 768;
                const targetRight = isMobile ? 20 : 30;
                const targetBottom = isMobile ? 20 : 30;

                const targetX = window.innerWidth - targetRight - 20;
                const targetY = window.innerHeight - targetBottom - 20;

                travelEnvelope.style.transition = 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
                travelEnvelope.style.left = targetX + 'px';
                travelEnvelope.style.top = targetY + 'px';
                travelEnvelope.style.transform = 'scale(0.95)';

                setTimeout(() => {
                    travelEnvelope.style.transition = 'all 0.3s ease-out';
                    travelEnvelope.style.transform = 'scale(0.5)';
                    travelEnvelope.style.opacity = '0';

                    setTimeout(() => {
                        for (let i = 0; i < 8; i++) {
                            setTimeout(() => {
                                const angle = (Math.PI * 2 * i) / 8;
                                const distance = 30 + Math.random() * 20;
                                const burstTargetX = window.innerWidth - targetRight - 20 + Math.cos(angle) * distance;
                                const burstTargetY = window.innerHeight - targetBottom - 20 + Math.sin(angle) * distance;

                                const firefly = document.createElement('div');
                                firefly.style.cssText = `
                                    position: fixed;
                                    left: ${window.innerWidth - targetRight - 20}px;
                                    top: ${window.innerHeight - targetBottom - 20}px;
                                    width: 3px;
                                    height: 3px;
                                    background: rgba(230, 215, 245, 0.8);
                                    border-radius: 50%;
                                    pointer-events: none;
                                    z-index: 199;
                                    box-shadow: 0 0 8px rgba(210, 190, 230, 0.6);
                                `;
                                document.body.appendChild(firefly);

                                setTimeout(() => {
                                    firefly.style.transition = 'all 0.8s ease-out';
                                    firefly.style.left = burstTargetX + 'px';
                                    firefly.style.top = burstTargetY + 'px';
                                    firefly.style.opacity = '0';

                                    setTimeout(() => firefly.remove(), 800);
                                }, 50);
                            }, i * 40);
                        }

                        travelEnvelope.remove();
                        this.createEnvelopeHelper();

                        setTimeout(() => {
                            envelopeIcon.style.transition = 'opacity 0.8s ease';
                            envelopeIcon.style.opacity = '0.25';
                        }, 200);
                    }, 150);
                }, 1400);
            }, 50);
        }, 900);
    },

    createEnvelopeHelper() {
        if (document.getElementById('envelopeHelper')) return;

        state.whisper.envelopeHelperCreated = true;

        const helper = document.createElement('div');
        helper.classList.add('envelope-helper');
        helper.id = 'envelopeHelper';

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '1.5');
        icon.setAttribute('width', '18');
        icon.setAttribute('height', '18');
        icon.innerHTML = `<path d="M4 8l8 5 8-5M4 8v8a2 2 0 002 2h12a2 2 0 002-2V8l-8 5-8-5z"/>`;

        helper.appendChild(icon);
        document.body.appendChild(helper);

        setTimeout(() => {
            helper.classList.add('visible');
            setTimeout(() => {
                helper.classList.add('blurping');
                setTimeout(() => {
                    helper.classList.remove('blurping');
                }, 800);
            }, 100);
        }, 100);

        helper.addEventListener('click', () => this.showEnvelopeHelp());
    },

    showEnvelopeHelp() {
        const backdrop = document.createElement('div');
        backdrop.classList.add('help-backdrop');
        backdrop.id = 'envelopeBackdrop';

        const modal = document.createElement('div');
        modal.classList.add('help-modal');
        modal.id = 'envelopeModal';

        const text = document.createElement('div');
        text.classList.add('help-modal-text');
        text.innerHTML = 'Your whispers gather like falling snow...<br><br>Touch the seed that bloomed to send them skyward,<br>or continue writing until your garden overflows.';

        modal.appendChild(text);
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        setTimeout(() => {
            backdrop.classList.add('visible');
            modal.classList.add('visible');
        }, 100);

        const dismissTimer = setTimeout(() => this.closeEnvelopeHelp(), 6000);

        backdrop.addEventListener('click', () => {
            clearTimeout(dismissTimer);
            this.closeEnvelopeHelp();
        });
    },

    closeEnvelopeHelp() {
        const backdrop = document.getElementById('envelopeBackdrop');
        const modal = document.getElementById('envelopeModal');

        if (backdrop) backdrop.classList.remove('visible');
        if (modal) modal.classList.remove('visible');

        setTimeout(() => {
            if (backdrop) backdrop.remove();
            if (modal) modal.remove();
        }, 1000);
    },

    showReturnConfirmation(callback) {
        const seedWrapper = document.getElementById('seedWrapper');
        const inputWrapper = document.getElementById('whisperInputWrapper');
        const prompt = document.querySelector('.whisper-prompt');
        const backBtn = document.getElementById('whisperBackBtn');
        const envelopeHelper = document.getElementById('envelopeHelper');
        const textarea = document.getElementById('whisperTextarea');
        const glow = document.getElementById('glow');

        if (seedWrapper) seedWrapper.style.filter = 'blur(8px)';
        if (inputWrapper) inputWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (envelopeHelper) envelopeHelper.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`circleTextContainer${i}`);
            if (container) container.style.filter = 'blur(8px)';
        }

        // Count whispers: those on the ring + any pending in textarea
        let totalWhispers = state.whisper.texts.filter(t => t !== SEPARATOR).length;
        if (textarea && textarea.value.trim()) {
            totalWhispers += 1;
        }

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26, 10, 10, 0.95);
            border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px;
            padding: 30px;
            z-index: 100;
            text-align: center;
            max-width: 320px;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        const text = document.createElement('div');
        text.style.cssText = `
            color: #e8d4f0;
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            letter-spacing: 1px;
            line-height: 1.6;
        `;
        text.textContent = `Silence your ${totalWhispers === 1 ? 'whisper' : 'whispers'}?`;

        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = 'display: flex; gap: 15px; justify-content: center;';

        const yesBtn = document.createElement('button');
        yesBtn.classList.add('choice-button');
        yesBtn.textContent = 'Yes';

        const noBtn = document.createElement('button');
        noBtn.classList.add('choice-button');
        noBtn.textContent = 'No';

        buttonGroup.appendChild(yesBtn);
        buttonGroup.appendChild(noBtn);
        modal.appendChild(text);
        modal.appendChild(buttonGroup);
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        setTimeout(() => modal.style.opacity = '1', 50);

        const unblurAll = () => {
            if (seedWrapper) seedWrapper.style.filter = '';
            if (inputWrapper) inputWrapper.style.filter = '';
            if (prompt) prompt.style.filter = '';
            if (backBtn) backBtn.style.filter = '';
            if (envelopeHelper) envelopeHelper.style.filter = '';
            if (glow) glow.style.filter = '';
            for (let i = 1; i <= 3; i++) {
                const container = document.getElementById(`circleTextContainer${i}`);
                if (container) container.style.filter = '';
            }
        };

        const closeModal = (confirmed) => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                if (!confirmed) unblurAll();
                callback(confirmed);
            }, 500);
            clearTimeout(autoCloseTimer);
        };

        // Auto-dismiss after 8 seconds (same as send confirmation)
        const autoCloseTimer = setTimeout(() => {
            closeModal(false);
        }, 8000);

        yesBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Helpers.createButtonFocusEffect(yesBtn, () => {
                closeModal(true);
            });
        });

        noBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Helpers.createButtonFocusEffect(noBtn, () => {
                closeModal(false);
            });
        });

        backdrop.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            closeModal(false);
        });
    },

    addWhisper(whisperText) {
        if (state.whisper.texts.length > 0) {
            state.whisper.texts.push(SEPARATOR);
        }
        state.whisper.texts.push(whisperText);

        const seedWrapper = document.getElementById('seedWrapper');
        if (seedWrapper && state.whisper.texts.filter(t => t !== SEPARATOR).length === 1) {
            this.makeSeedClickable();
        }

        this.distributeText();
    },

    makeSeedClickable() {
        const seedWrapper = document.getElementById('seedWrapper');
        if (!seedWrapper || seedWrapper.classList.contains('clickable')) return;

        seedWrapper.classList.add('clickable');

        seedWrapper.classList.remove('dormant');
        seedWrapper.classList.add('awakening');

        ParticleSystem.createEnhancedMistyPulse(seedWrapper, 'awakening');
        ParticleSystem.createSpiralEmberBurst(seedWrapper, 10);

        setTimeout(() => {
            seedWrapper.classList.remove('awakening');
            seedWrapper.classList.add('breathing');
            seedWrapper.style.setProperty('--breathe-speed', '3.5s');

            this.startSeedEmbers(seedWrapper);
        }, 2000);

        for (let i = 0; i < 4; i++) {
            setTimeout(() => ParticleSystem.createWispyFirefly(seedWrapper, 'subtle'), i * 250);
        }

        seedWrapper.addEventListener('click', () => this.showSendConfirmation());
    },

    startSeedEmbers(seedWrapper) {
        if (this.seedEmberInterval) {
            clearInterval(this.seedEmberInterval);
        }

        this.seedEmberInterval = setInterval(() => {
            if (Math.random() > 0.5) {
                ParticleSystem.createSeedEmber(seedWrapper);
            }
            if (Math.random() > 0.7) {
                ParticleSystem.createSeedFirefly(seedWrapper);
            }
        }, 800);
    },

    stopSeedEmbers() {
        if (this.seedEmberInterval) {
            clearInterval(this.seedEmberInterval);
            this.seedEmberInterval = null;
        }
    },

    distributeText() {
        const fullText = state.whisper.texts.join('');
        const ring1Path = document.getElementById('circleTextPath1');
        const ring2Path = document.getElementById('circleTextPath2');
        const ring3Path = document.getElementById('circleTextPath3');

        if (!ring1Path || !ring2Path || !ring3Path) return;

        const newText = fullText.substring(state.whisper.processedCharCount);
        if (!newText) return;

        this.addTextWithCollisionDetection(newText);
    },

    addTextWithCollisionDetection(newText) {
        let index = 0;
        const addNextLetter = () => {
            if (index >= newText.length) return;

            const nextChar = newText[index];
            const currentRing = state.whisper.currentRing;
            const currentPath = document.getElementById(`circleTextPath${currentRing}`);

            if (!currentPath) return;

            currentPath.textContent = currentPath.textContent + nextChar;
            state.whisper.processedCharCount++;

            if (this.checkCollision(currentRing)) {
                currentPath.textContent = currentPath.textContent.slice(0, -1);
                state.whisper.processedCharCount--;

                if (currentRing < 3) {
                    this.bumpToNextRing(currentRing + 1);
                    setTimeout(() => addNextLetter(), 10);
                } else {
                    this.absorbAllRings();
                    setTimeout(() => addNextLetter(), 1500);
                }
            } else {
                index++;
                setTimeout(() => addNextLetter(), 30);
            }
        };

        addNextLetter();
    },

    checkCollision(ringNum) {
        const textPath = document.getElementById(`circleTextPath${ringNum}`);
        const circlePath = document.getElementById(`circlePath${ringNum}`);

        if (!textPath || !circlePath) return false;

        try {
            const textElement = textPath.parentElement;
            const textLength = textElement.getComputedTextLength();
            const pathLength = circlePath.getTotalLength();

            return (textLength / pathLength) >= FULLNESS_THRESHOLD;
        } catch (e) {
            const CHARS_PER_RING = [40, 52, 65];
            return textPath.textContent.length >= CHARS_PER_RING[ringNum - 1];
        }
    },

    bumpToNextRing(nextRingNum) {
        Guardian.whisper.onRingFill(nextRingNum - 1);

        state.whisper.currentRing = nextRingNum;
        this.revealRing(nextRingNum);

        const seedWrapper = document.getElementById('seedWrapper');
        if (seedWrapper) {
            ParticleSystem.createEnhancedMistyPulse(seedWrapper, 'breathing');
        }
    },

    absorbAllRings() {
        Guardian.whisper.onRingFill(3);
        Guardian.whisper.onAbsorb();

        const seedWrapper = document.getElementById('seedWrapper');
        const ring1Container = document.getElementById('circleTextContainer1');
        const ring2Container = document.getElementById('circleTextContainer2');
        const ring3Container = document.getElementById('circleTextContainer3');

        if (seedWrapper) {
            seedWrapper.classList.remove('breathing');
            seedWrapper.classList.add('absorbing');
        }

        if (seedWrapper) {
            ParticleSystem.createAbsorbSpiral(seedWrapper, 12);
        }

        [ring1Container, ring2Container, ring3Container].forEach(container => {
            if (container) {
                container.style.transition = 'opacity 0.8s ease';
                container.style.opacity = '0';
            }
        });

        if (seedWrapper) {
            ParticleSystem.createEnhancedMistyPulse(seedWrapper, 'absorbing');

            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    ParticleSystem.createWispyFirefly(seedWrapper, 'campfire');
                }, i * 50);
            }
        }

        setTimeout(() => {
            const ring1Path = document.getElementById('circleTextPath1');
            const ring2Path = document.getElementById('circleTextPath2');
            const ring3Path = document.getElementById('circleTextPath3');

            if (ring1Path) ring1Path.textContent = '';
            if (ring2Path) ring2Path.textContent = '';
            if (ring3Path) ring3Path.textContent = '';

            if (ring2Container) ring2Container.style.opacity = '0';
            if (ring3Container) ring3Container.style.opacity = '0';

            if (ring1Container) {
                setTimeout(() => {
                    ring1Container.style.transition = 'opacity 0.5s ease';
                    ring1Container.style.opacity = '1';
                }, 100);
            }

            if (seedWrapper) {
                seedWrapper.classList.remove('absorbing');
                seedWrapper.classList.add('breathing');
            }

            state.whisper.currentRing = 1;
        }, 800);
    },

    revealRing(ringNum) {
        const textContainer = document.getElementById(`circleTextContainer${ringNum}`);

        if (textContainer && textContainer.style.opacity === '0') {
            textContainer.style.transition = 'opacity 0.8s ease';
            textContainer.style.opacity = '1';
        }
    },

    showSendConfirmation() {
        Guardian.whisper.onConfirmationShown();

        const existingModal = document.querySelector('[style*="position: fixed"][style*="z-index: 100"]');
        if (existingModal) existingModal.remove();

        const seedWrapper = document.getElementById('seedWrapper');
        const prompt = document.querySelector('.whisper-prompt');
        const inputWrapper = document.getElementById('whisperInputWrapper');
        const backBtn = document.getElementById('whisperBackBtn');
        const envelopeHelper = document.getElementById('envelopeHelper');
        const glow = document.getElementById('glow');

        if (seedWrapper) seedWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';
        if (inputWrapper) inputWrapper.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (envelopeHelper) envelopeHelper.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`circleTextContainer${i}`);
            if (container) container.style.filter = 'blur(8px)';
        }

        const totalWhispers = state.whisper.texts.filter(t => t !== SEPARATOR).length;

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26, 10, 10, 0.95);
            border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px;
            padding: 30px;
            z-index: 100;
            text-align: center;
            max-width: 320px;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        const text = document.createElement('div');
        text.style.cssText = `
            color: #e8d4f0;
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            letter-spacing: 1px;
            line-height: 1.6;
        `;
        text.textContent = `Send ${totalWhispers === 1 ? 'whisper' : 'whispers'} to the garden?`;

        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = 'display: flex; gap: 15px; justify-content: center;';

        const yesBtn = document.createElement('button');
        yesBtn.classList.add('choice-button');
        yesBtn.textContent = 'Yes';

        const editBtn = document.createElement('button');
        editBtn.classList.add('choice-button');
        editBtn.textContent = 'Edit';

        buttonGroup.appendChild(yesBtn);
        buttonGroup.appendChild(editBtn);
        modal.appendChild(text);
        modal.appendChild(buttonGroup);

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        setTimeout(() => modal.style.opacity = '1', 50);

        const unblurAll = () => {
            if (seedWrapper) seedWrapper.style.filter = '';
            if (prompt) prompt.style.filter = '';
            if (inputWrapper) inputWrapper.style.filter = '';
            if (backBtn) backBtn.style.filter = '';
            if (envelopeHelper) envelopeHelper.style.filter = '';
            if (glow) glow.style.filter = '';
            for (let i = 1; i <= 3; i++) {
                const container = document.getElementById(`circleTextContainer${i}`);
                if (container) container.style.filter = '';
            }
        };

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                unblurAll();
            }, 500);
            document.removeEventListener('keydown', escapeHandler);
            clearTimeout(autoCloseTimer);
        };

        const autoCloseTimer = setTimeout(() => {
            closeModal();
        }, 8000);

        yesBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            yesBtn.style.transform = 'scale(1.12)';
            setTimeout(() => yesBtn.style.transform = '', 200);

            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                this.sendWhispers();
            }, 500);
            document.removeEventListener('keydown', escapeHandler);
        });

        editBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Helpers.createButtonFocusEffect(editBtn, () => {
                modal.style.opacity = '0';
                setTimeout(() => {
                    modal.remove();
                    backdrop.remove();
                    this.showEditMode();
                }, 500);
            });
            document.removeEventListener('keydown', escapeHandler);
        });

        backdrop.addEventListener('click', () => {
            closeModal();
        });

        function escapeHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        }
        document.addEventListener('keydown', escapeHandler);
    },

    showEditMode() {
        const seedWrapper = document.getElementById('seedWrapper');
        const textarea = document.getElementById('whisperTextarea');
        const prompt = document.querySelector('.whisper-prompt');
        const inputWrapper = document.getElementById('whisperInputWrapper');

        if (!textarea || !seedWrapper) return;

        state.whisper.isEditMode = true;

        if (seedWrapper) seedWrapper.style.filter = '';
        if (prompt) prompt.style.filter = '';
        if (inputWrapper) inputWrapper.style.filter = '';

        const backBtn = document.getElementById('whisperBackBtn');
        const envelopeHelper = document.getElementById('envelopeHelper');
        if (backBtn) backBtn.style.filter = '';
        if (envelopeHelper) envelopeHelper.style.filter = '';

        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`circleTextContainer${i}`);
            if (container) container.style.filter = '';
        }

        const allWhispers = state.whisper.texts.filter(t => t !== SEPARATOR).join(' ');

        textarea.value = allWhispers;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';

        const manualOption = document.querySelector('.timing-option:last-child');
        if (manualOption) {
            this.selectTiming('manual', manualOption);
        }

        seedWrapper.classList.remove('clickable', 'breathing', 'awakening', 'full-bloom');
        seedWrapper.classList.add('dormant');
        seedWrapper.style.transform = 'scale(1)';

        this.stopSeedEmbers();

        for (let i = 1; i <= 3; i++) {
            const path = document.getElementById(`circleTextPath${i}`);
            if (path) path.textContent = '';
        }

        state.whisper.texts = [];
        state.whisper.totalCharCount = 0;
        state.whisper.processedCharCount = 0;
        state.whisper.currentRing = 1;

        textarea.focus();
    },

    sendWhispers() {
        const allWhispers = state.whisper.texts.filter(t => t !== SEPARATOR).join(' ');
        const whisperCount = state.whisper.texts.filter(t => t !== SEPARATOR).length;

        // Track successful whisper send - emits whisper_sent artifact
        Guardian.whisper.onConfirmationChoice('yes');
        Guardian.whisper.completeSent(allWhispers);
        Guardian.captureInteraction('send.sequence_start', { type: 'inward_spiral' });

        console.log('Sending whispers:', allWhispers);

        const backBtn = document.getElementById('whisperBackBtn');
        const envelopeHelper = document.getElementById('envelopeHelper');
        const inputWrapper = document.getElementById('whisperInputWrapper');
        const seedWrapper = document.getElementById('seedWrapper');
        const prompt = document.querySelector('.whisper-prompt');
        const glow = document.getElementById('glow');

        // Ensure blur is applied during send animation (defensive - should already be blurred)
        if (seedWrapper) seedWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';
        if (inputWrapper) inputWrapper.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (envelopeHelper) envelopeHelper.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';
        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`circleTextContainer${i}`);
            if (container) container.style.filter = 'blur(8px)';
        }

        if (backBtn) backBtn.style.pointerEvents = 'none';
        if (envelopeHelper) envelopeHelper.style.pointerEvents = 'none';
        if (inputWrapper) inputWrapper.style.pointerEvents = 'none';
        if (seedWrapper) seedWrapper.style.pointerEvents = 'none';

        // Hide send arrow immediately
        const sendArrow = document.getElementById('sendArrow');
        if (sendArrow) sendArrow.classList.remove('visible');

        ParticleSystem.stopWhisperEmbers();
        ParticleSystem.stopSeedParticles();
        this.stopSeedEmbers();

        if (seedWrapper) {
            seedWrapper.classList.remove('breathing', 'awakening', 'full-bloom');
            seedWrapper.classList.add('sending');
        }

        // v1 timing: inward spiral at 0ms
        ParticleSystem.createInwardSpiral(seedWrapper);

        // v1 timing: ascending trail + seed move at 1500ms
        setTimeout(() => {
            const seedContainer = document.getElementById('seedContainer');
            ParticleSystem.createAscendingTrail(seedWrapper);
            if (seedContainer) {
                seedContainer.style.transition = 'all 2.5s cubic-bezier(0.4, 0, 0.2, 1)';
                seedContainer.style.transform = 'translateX(-50%) translateY(-100vh) scale(0.5)';
                seedContainer.style.opacity = '0';
            }
        }, 1500);

        // v1 timing: celebration fireflies at 4000ms
        setTimeout(() => ParticleSystem.createCelebrationFireflies(), 4000);

        // v1 timing: show received at 4500ms
        setTimeout(() => this.showReceived(whisperCount), 4500);
    },

    showReceived(whisperCount) {
        const inputWrapper = document.getElementById('whisperInputWrapper');
        const prompt = document.querySelector('.whisper-prompt');

        if (inputWrapper) inputWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26, 10, 10, 0.95);
            border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px;
            padding: 30px 40px;
            z-index: 100;
            text-align: center;
            opacity: 0;
            transition: opacity 0.5s ease;
        `;

        const text = document.createElement('div');
        text.style.cssText = `
            color: #e8d4f0;
            font-size: 1.2rem;
            letter-spacing: 2px;
        `;
        text.textContent = `${whisperCount === 1 ? 'Whisper' : 'Whispers'} received.`;

        modal.appendChild(text);
        document.body.appendChild(modal);

        setTimeout(() => modal.style.opacity = '1', 100);

        setTimeout(() => {
            modal.style.opacity = '0';
            if (inputWrapper) {
                inputWrapper.style.filter = '';
                inputWrapper.style.pointerEvents = 'auto';
            }
            if (prompt) prompt.style.filter = '';

            const backBtn = document.getElementById('whisperBackBtn');
            const envelopeHelper = document.getElementById('envelopeHelper');
            const glow = document.getElementById('glow');
            if (backBtn) {
                backBtn.style.filter = '';
                backBtn.style.pointerEvents = 'auto';
            }
            if (envelopeHelper) {
                envelopeHelper.style.filter = '';
                envelopeHelper.style.pointerEvents = 'auto';
            }
            if (glow) glow.style.filter = '';

            setTimeout(() => {
                modal.remove();
                this.resetSeed();
            }, 500);
        }, 3000);
    },

    resetSeed() {
        const seedContainer = document.getElementById('seedContainer');
        if (seedContainer) seedContainer.remove();

        state.whisper.texts = [];
        state.whisper.totalCharCount = 0;
        state.whisper.processedCharCount = 0;
        state.whisper.currentRing = 1;
        state.whisper.firstWhisperSent = false;
        state.whisper.isEditMode = false;
        state.whisper.seedGlowState = 'dormant';
        state.whisper.timingMode = 2000;
        state.whisper.previousTimingMode = 2000;

        // Reset timing UI back to 2s
        const sendArrow = document.getElementById('sendArrow');
        const textarea = document.getElementById('whisperTextarea');
        if (sendArrow) sendArrow.classList.remove('visible');
        if (textarea) textarea.style.paddingRight = '50px';

        // Reset dropdown selection to 2s
        const timingOptions = document.querySelectorAll('.timing-option');
        timingOptions.forEach((opt, index) => {
            opt.classList.remove('active');
            if (index === 0) opt.classList.add('active');
        });

        const envelopeIcon = document.getElementById('envelopeIcon');
        if (envelopeIcon) {
            envelopeIcon.style.opacity = '';
            envelopeIcon.style.transition = '';
        }

        this.createSeed();

        const whisperContainer = document.getElementById('whisperContainer');
        if (whisperContainer) {
            setTimeout(() => {
                ParticleSystem.startWhisperEmbers(whisperContainer, 0.4);
            }, 1500);
        }
    },

    createSeed() {
        const whisperContainer = document.getElementById('whisperContainer');
        if (!whisperContainer || document.getElementById('seedContainer')) return;

        const seedContainer = document.createElement('div');
        seedContainer.classList.add('seed-container');
        seedContainer.id = 'seedContainer';

        const seedWrapper = document.createElement('div');
        seedWrapper.classList.add('seed-wrapper', 'dormant');
        seedWrapper.id = 'seedWrapper';

        const glowLayers = ['atmosphere', 'outer', 'inner', 'core'];
        glowLayers.forEach(layer => {
            const glowDiv = document.createElement('div');
            glowDiv.classList.add('seed-glow-layer', `seed-glow-${layer}`);
            glowDiv.id = `seedGlow${layer.charAt(0).toUpperCase() + layer.slice(1)}`;
            seedWrapper.appendChild(glowDiv);
        });

        const ringGlow = document.createElement('div');
        ringGlow.classList.add('ring-glow');
        ringGlow.id = 'ringGlow';
        ringGlow.style.cssText = `
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(200, 180, 220, 0.2), transparent 70%);
        `;
        seedWrapper.appendChild(ringGlow);

        const seedSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        seedSVG.classList.add('seed-svg');
        seedSVG.setAttribute('viewBox', '0 0 200 200');
        seedSVG.innerHTML = `
            <defs>
                <radialGradient id="seedGradient" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" style="stop-color:rgba(240, 230, 250, 0.9)"/>
                    <stop offset="50%" style="stop-color:rgba(200, 180, 220, 0.8)"/>
                    <stop offset="100%" style="stop-color:rgba(160, 140, 180, 0.6)"/>
                </radialGradient>
                <filter id="seedGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <path d="M 100 82 C 93 82, 89 86, 89 93 C 89 104, 96 115, 100 119 C 104 115, 111 104, 111 93 C 111 86, 107 82, 100 82 Z"
                  fill="url(#seedGradient)"
                  stroke="rgba(200, 180, 220, 0.75)"
                  stroke-width="2"
                  filter="url(#seedGlow)"/>
            <path d="M 100 93 L 100 110"
                  stroke="rgba(200, 180, 220, 0.55)"
                  stroke-width="1.5"
                  fill="none"/>
            <path d="M 96 98 L 104 98"
                  stroke="rgba(200, 180, 220, 0.4)"
                  stroke-width="1"
                  fill="none"/>
            <path d="M 97 102 L 103 102"
                  stroke="rgba(200, 180, 220, 0.4)"
                  stroke-width="1"
                  fill="none"/>
        `;

        seedWrapper.appendChild(seedSVG);

        const ringConfigs = [
            { id: 1, radius: 52, size: 120 },
            { id: 2, radius: 70, size: 160 },
            { id: 3, radius: 88, size: 200 }
        ];

        ringConfigs.forEach(config => {
            const textContainer = document.createElement('div');
            textContainer.classList.add('circle-text-container');
            textContainer.id = `circleTextContainer${config.id}`;
            textContainer.style.width = config.size + 'px';
            textContainer.style.height = config.size + 'px';
            if (config.id > 1) textContainer.style.opacity = '0';

            const textSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            textSVG.classList.add('circle-text-svg');
            textSVG.setAttribute('viewBox', `0 0 ${config.size} ${config.size}`);

            const centerX = config.size / 2;
            const centerY = config.size / 2;
            const startY = centerY - config.radius;

            textSVG.innerHTML = `
                <defs>
                    <path id="circlePath${config.id}"
                          d="M ${centerX} ${startY} A ${config.radius} ${config.radius} 0 1 1 ${centerX - 0.01} ${startY}"
                          fill="none"/>
                </defs>
                <text class="circle-text">
                    <textPath href="#circlePath${config.id}"
                              id="circleTextPath${config.id}"
                              startOffset="0%"></textPath>
                </text>
            `;

            textContainer.appendChild(textSVG);
            seedWrapper.appendChild(textContainer);
        });

        seedContainer.appendChild(seedWrapper);
        whisperContainer.appendChild(seedContainer);

        seedContainer.style.transform = 'translateX(-50%) translateY(50px) scale(0.5)';
        seedContainer.style.opacity = '0';

        setTimeout(() => {
            seedContainer.style.transition = 'all 1.2s ease';
            seedContainer.style.transform = 'translateX(-50%) translateY(0) scale(1)';
            seedContainer.style.opacity = '1';
        }, 100);
    },

    resetWhisperState() {
        state.whisper.texts = [];
        state.whisper.totalCharCount = 0;
        state.whisper.processedCharCount = 0;
        state.whisper.currentRing = 1;
        state.whisper.firstWhisperSent = false;
        state.whisper.timingMode = 2000;
        state.whisper.previousTimingMode = 2000;
        state.whisper.isEditMode = false;
        state.whisper.seedGlowState = 'dormant';

        this.stopSeedEmbers();

        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Remove document click listener
        if (this.dropdownClickHandler) {
            document.removeEventListener('click', this.dropdownClickHandler);
            this.dropdownClickHandler = null;
        }

        // Clean up curtain observer
        const whisperContainer = document.getElementById('whisperContainer');
        if (whisperContainer && whisperContainer.curtainObserver) {
            whisperContainer.curtainObserver.disconnect();
        }

        for (let i = 1; i <= 3; i++) {
            const path = document.getElementById(`circleTextPath${i}`);
            if (path) path.textContent = '';
        }

        const seedContainer = document.getElementById('seedContainer');
        if (seedContainer) seedContainer.remove();
    }
};
