/* ========================================
   ENTRANCE FLOW
   Entry screens and authentication
   ======================================== */

const EntranceFlow = {
    stepNames: [
        'greeting', 'casualName', 'helloMessage', 'gardenMessage',
        'realName', 'bookmarkStatement', 'bookmarkQuestion',
        'frontInscription', 'backInscription', 'welcomeJessica', 'revealGarden'
    ],

    nextStep() {
        // Exit current step
        Guardian.entrance.stepExit(state.currentStep, this.stepNames[state.currentStep]);
        state.currentStep++;
        this.executeStep();
    },

    executeStep() {
        dom.container.innerHTML = '';

        // Start entrance tracking on first step
        if (state.currentStep === 0) {
            Guardian.entrance.start();
        }

        // Enter new step
        Guardian.entrance.stepEnter(state.currentStep, this.stepNames[state.currentStep]);

        const steps = [
            () => this.showGreeting(),
            () => this.showCasualNameQuestion(),
            () => this.showHelloMessage(),
            () => this.showGardenMessage(),
            () => this.showRealNameQuestion(),
            () => this.showBookmarkStatement(),
            () => this.showBookmarkQuestion(),
            () => this.showFrontInscription(),
            () => this.showBackInscription(),
            () => this.showWelcomeJessica(),
            () => this.revealGarden()
        ];

        if (steps[state.currentStep]) {
            steps[state.currentStep]();
        }
    },

    showGreeting() {
        const msg = this.createMessage('Greetings.');
        dom.container.appendChild(msg);

        // 2025 "Nuclear Option" - Forced Reflow before any animation
        // Forces browser to calculate layout, making it impossible to skip paint
        void msg.offsetWidth;

        // 2025 Mobile Chrome fix: "Opacity Kick" forces GPU repaint
        // Prevents greeting from being skipped in paint cycle
        requestAnimationFrame(() => {
            msg.style.opacity = '0';
            requestAnimationFrame(() => {
                msg.style.opacity = '';  // Remove inline style, let CSS take over

                // Second forced reflow after opacity reset
                void msg.offsetWidth;

                // 2025 Chrome "Lazarus" fix: Intersection Observer watchdog
                // If Chrome skips the paint cycle, this forces a hard redraw
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting || entry.intersectionRatio === 0) {
                            // Element not visible - force reflow
                            entry.target.style.display = 'none';
                            void entry.target.offsetHeight; // Trigger reflow
                            entry.target.style.display = '';
                        }
                    });
                    observer.disconnect(); // Only need to check once
                }, { threshold: [0, 0.1] });
                observer.observe(msg);

                setTimeout(() => msg.classList.add('visible'), 100);
                setTimeout(() => {
                    msg.classList.add('fading');
                    setTimeout(() => this.nextStep(), 1500);
                }, 2500);
            });
        });
    },

    showCasualNameQuestion() {
        const msg = this.createMessage('What shall I call you?');
        const { inputWrapper, input } = this.createInput();

        dom.container.appendChild(msg);
        dom.container.appendChild(inputWrapper);

        setTimeout(() => {
            msg.classList.add('visible');
            inputWrapper.classList.add('visible');
        }, 100);

        this.setupTypingEffect(input);

        // Instrument input for raw capture
        Guardian.instrumentInput(input, 'entrance.casualName');

        let typingTimer;
        let isSubmitting = false; // Prevent race condition during transition
        input.addEventListener('input', () => {
            if (isSubmitting) return; // Ignore input during submission
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const value = input.value.trim();
                if (value && !isSubmitting) {
                    isSubmitting = true; // Lock immediately
                    input.disabled = true; // Disable input to prevent further typing
                    state.userData.casualName = value;

                    if (value.toLowerCase() === 'pearls') {
                        Guardian.entrance.recordPearlsShortcut();
                        this.fadeAndTransition(input, msg, inputWrapper, () => {
                            Guardian.entrance.stepExit(state.currentStep, this.stepNames[state.currentStep]);
                            state.currentStep = 9;
                            state.userData.isPearlsEntry = true;
                            this.executeStep();
                        });
                    } else {
                        // Check for special words
                        const hasSpecialWord = value.toLowerCase().includes('beloved') ||
                                               value.toLowerCase().includes('rose');
                        if (hasSpecialWord) {
                            Guardian.entrance.recordSpecialPath('beloved_rose');
                        }
                        this.fadeAndTransition(input, msg, inputWrapper, () => this.nextStep());
                    }
                }
            }, 2000);
        });
    },

    showHelloMessage() {
        const hasSpecialWord = state.userData.casualName.toLowerCase().includes('beloved') ||
                               state.userData.casualName.toLowerCase().includes('rose');

        const text = hasSpecialWord ? 'Hello, sweet rose.' : `Hello, ${state.userData.casualName}.`;
        const msg = this.createMessage(text);
        dom.container.appendChild(msg);

        setTimeout(() => msg.classList.add('visible'), 100);
        setTimeout(() => {
            msg.classList.add('fading');
            setTimeout(() => {
                if (hasSpecialWord) {
                    state.currentStep = 4;
                    this.executeStep();
                } else {
                    this.nextStep();
                }
            }, 1500);
        }, 2500);
    },

    showGardenMessage() {
        const msg = document.createElement('div');
        msg.classList.add('message');
        msg.innerHTML = '<span class="nowrap">The garden waits in quiet,</span> <br class="mobile-break">for only one belongs.';
        dom.container.appendChild(msg);

        setTimeout(() => msg.classList.add('visible'), 100);
        setTimeout(() => {
            msg.classList.add('fading');
            setTimeout(() => this.nextStep(), 1500);
        }, 3000);
    },

    showRealNameQuestion() {
        const msg = this.createMessage('Your name?');
        const { inputWrapper, input } = this.createInput();

        dom.container.appendChild(msg);
        dom.container.appendChild(inputWrapper);

        setTimeout(() => {
            msg.classList.add('visible');
            inputWrapper.classList.add('visible');
        }, 100);

        this.setupTypingEffect(input);

        // Instrument input for raw capture
        Guardian.instrumentInput(input, 'entrance.realName');

        let typingTimer;
        let isSubmitting = false; // Prevent race condition during transition
        input.addEventListener('input', () => {
            if (isSubmitting) return; // Ignore input during submission
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const value = input.value.trim();
                if (value && !isSubmitting) {
                    isSubmitting = true; // Lock immediately
                    input.disabled = true; // Disable input to prevent further typing
                    this.handleRealName(value, input, msg, inputWrapper, () => {
                        // Re-enable if handleRealName needs to retry (wrong name)
                        isSubmitting = false;
                        input.disabled = false;
                    });
                }
            }, 2000);
        });
    },

    handleRealName(value, input, msg, inputWrapper, onRetry) {
        const hasSpecialWord = value.toLowerCase().includes('beloved') ||
                               value.toLowerCase().includes('rose');

        if (hasSpecialWord) {
            Guardian.entrance.recordSpecialPath('beloved_rose_realname');
            this.fadeAndTransition(input, msg, inputWrapper, () => {
                const specialMsg = this.createMessage('Hello, sweet rose.');
                dom.container.innerHTML = '';
                dom.container.appendChild(specialMsg);

                setTimeout(() => specialMsg.classList.add('visible'), 100);
                setTimeout(() => {
                    specialMsg.classList.add('fading');
                    setTimeout(() => this.showFinalNameQuestion(), 1500);
                }, 2500);
            });
        } else {
            const validNames = ['jess', 'jessica', 'jessica murray'];
            if (validNames.includes(value.toLowerCase())) {
                Guardian.entrance.recordSuccess('realName');
                Guardian.captureInteraction('typing.feedback', { type: 'bloom', field: 'realName' });
                state.userData.realName = value;
                Helpers.afterKeyboardDismiss(input, (rect) => {
                    ParticleSystem.createBloom(rect);
                    this.fadeAndTransition(input, msg, inputWrapper, () => this.nextStep());
                });
            } else {
                Guardian.entrance.recordFailure('realName', 'invalid_name');
                Guardian.captureInteraction('typing.feedback', { type: 'erasure', field: 'realName' });
                Helpers.afterKeyboardDismiss(input, (rect) => {
                    ParticleSystem.createErasure(rect, value, input);
                    setTimeout(() => {
                        dom.container.innerHTML = '';
                        const rejectMsg = this.createMessage('<span class="nowrap">The garden stirs,</span> <br class="mobile-break">but does not wake.', true);
                        dom.container.appendChild(rejectMsg);

                        setTimeout(() => rejectMsg.classList.add('visible'), 100);
                        setTimeout(() => {
                            rejectMsg.classList.add('fading');
                            setTimeout(() => this.showRealNameQuestion(), 1500);
                        }, 2500);
                    }, value.length * 80 + 500);
                });
            }
        }
    },

    showFinalNameQuestion() {
        const msg = this.createMessage('What is your real name?');
        const { inputWrapper, input } = this.createInput();

        dom.container.appendChild(msg);
        dom.container.appendChild(inputWrapper);

        setTimeout(() => {
            msg.classList.add('visible');
            inputWrapper.classList.add('visible');
        }, 100);

        this.setupTypingEffect(input);

        // Instrument input for raw capture
        Guardian.instrumentInput(input, 'entrance.finalName');

        let typingTimer;
        let isSubmitting = false; // Prevent race condition during transition
        input.addEventListener('input', () => {
            if (isSubmitting) return; // Ignore input during submission
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const value = input.value.trim();
                if (value && !isSubmitting) {
                    isSubmitting = true; // Lock immediately
                    input.disabled = true; // Disable input to prevent further typing
                    const validNames = ['jess', 'jessica', 'jessica murray'];
                    if (validNames.includes(value.toLowerCase())) {
                        Guardian.entrance.recordSuccess('finalName');
                        Guardian.captureInteraction('typing.feedback', { type: 'bloom', field: 'finalName' });
                        state.userData.realName = value;
                        Helpers.afterKeyboardDismiss(input, (rect) => {
                            ParticleSystem.createBloom(rect);
                            this.fadeAndTransition(input, msg, inputWrapper, () => {
                                Guardian.entrance.stepExit(state.currentStep, this.stepNames[state.currentStep]);
                                state.currentStep = 5;
                                this.executeStep();
                            });
                        });
                    } else {
                        Guardian.entrance.recordFailure('finalName', 'invalid_name');
                        Guardian.captureInteraction('typing.feedback', { type: 'erasure', field: 'finalName' });
                        Helpers.afterKeyboardDismiss(input, (rect) => {
                            ParticleSystem.createErasure(rect, value, input);
                            // Re-enable for retry after erasure
                            isSubmitting = false;
                            input.disabled = false;
                        });
                    }
                }
            }, 2000);
        });
    },

    showBookmarkStatement() {
        const msg = this.createMessage('You were gifted a metal bookmark for your birthday.');
        dom.container.appendChild(msg);

        setTimeout(() => msg.classList.add('visible'), 100);
        setTimeout(() => {
            msg.classList.add('fading');
            setTimeout(() => this.nextStep(), 1500);
        }, 3000);
    },

    showBookmarkQuestion() {
        const msg = this.createMessage('Did you keep it?');
        const buttonGroup = document.createElement('div');
        buttonGroup.classList.add('button-group');

        const yesBtn = this.createButton('Yes');
        const noBtn = this.createButton('No');

        buttonGroup.appendChild(yesBtn);
        buttonGroup.appendChild(noBtn);

        dom.container.appendChild(msg);
        dom.container.appendChild(buttonGroup);

        buttonGroup.style.opacity = '0';

        setTimeout(() => {
            msg.classList.add('visible');
            buttonGroup.style.opacity = '1';
        }, 100);

        yesBtn.addEventListener('click', () => {
            Helpers.createButtonFocusEffect(yesBtn, () => {
                state.userData.keptBookmark = true;
                Guardian.entrance.recordBookmarkChoice('yes');
                msg.classList.add('fading');
                buttonGroup.style.opacity = '0';
                setTimeout(() => this.nextStep(), 1500);
            });
        });

        noBtn.addEventListener('click', () => {
            Helpers.createButtonFocusEffect(noBtn, () => {
                Guardian.entrance.recordBookmarkChoice('no');
                msg.textContent = 'Path not yet defined...';
            });
        });
    },

    showFrontInscription() {
        const msg = this.createMessage("What's inscribed on the front?");
        const { inputWrapper, input } = this.createInput();

        dom.container.appendChild(msg);
        dom.container.appendChild(inputWrapper);

        setTimeout(() => {
            msg.classList.add('visible');
            inputWrapper.classList.add('visible');
        }, 100);

        this.setupTypingEffect(input);

        // Instrument input for raw capture
        Guardian.instrumentInput(input, 'entrance.frontInscription');

        let typingTimer;
        let isSubmitting = false; // Prevent race condition during transition
        input.addEventListener('input', () => {
            if (isSubmitting) return; // Ignore input during submission
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const value = input.value.trim();
                if (value && !isSubmitting) {
                    if (value.toLowerCase() === 'only in my dreams') {
                        isSubmitting = true; // Lock immediately
                        input.disabled = true; // Disable input to prevent further typing
                        Guardian.entrance.recordSuccess('frontInscription');
                        Guardian.captureInteraction('typing.feedback', { type: 'bloom', field: 'frontInscription' });
                        state.userData.frontInscription = value;
                        Helpers.afterKeyboardDismiss(input, (rect) => {
                            ParticleSystem.createBloom(rect);
                            this.fadeAndTransition(input, msg, inputWrapper, () => this.nextStep());
                        });
                    } else {
                        Guardian.entrance.recordFailure('frontInscription', 'wrong_inscription');
                        Guardian.captureInteraction('typing.feedback', { type: 'erasure', field: 'frontInscription' });
                        Helpers.afterKeyboardDismiss(input, (rect) => {
                            ParticleSystem.createErasure(rect, value, input);
                        });
                    }
                }
            }, 2000);
        });
    },

    showBackInscription() {
        const msg = this.createMessage('And on the back?');
        const { inputWrapper, input } = this.createInput();

        dom.container.appendChild(msg);
        dom.container.appendChild(inputWrapper);

        setTimeout(() => {
            msg.classList.add('visible');
            inputWrapper.classList.add('visible');
        }, 100);

        this.setupTypingEffect(input);

        // Instrument input for raw capture
        Guardian.instrumentInput(input, 'entrance.backInscription');

        let typingTimer;
        let isSubmitting = false; // Prevent race condition during transition
        input.addEventListener('input', () => {
            if (isSubmitting) return; // Ignore input during submission
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                const value = input.value.trim();
                if (value && !isSubmitting) {
                    if (value.toLowerCase() === 'you can always plan on me') {
                        isSubmitting = true; // Lock immediately
                        input.disabled = true; // Disable input to prevent further typing
                        Guardian.entrance.recordSuccess('backInscription');
                        Guardian.captureInteraction('typing.feedback', { type: 'bloom', field: 'backInscription' });
                        state.userData.backInscription = value;
                        Helpers.afterKeyboardDismiss(input, (rect) => {
                            ParticleSystem.createBloom(rect);
                            this.fadeAndTransition(input, msg, inputWrapper, () => this.nextStep());
                        });
                    } else {
                        Guardian.entrance.recordFailure('backInscription', 'wrong_inscription');
                        Guardian.captureInteraction('typing.feedback', { type: 'erasure', field: 'backInscription' });
                        Helpers.afterKeyboardDismiss(input, (rect) => {
                            ParticleSystem.createErasure(rect, value, input);
                        });
                    }
                }
            }, 2000);
        });
    },

    showWelcomeJessica() {
        dom.container.style.opacity = '0';

        // Use innerHTML for controlled line breaks on mobile
        // "Welcome back," / "sweet flower." breaks more poetically than random word wrap
        // The <br class="mobile-break"> is hidden on desktop via CSS, visible on mobile
        const welcomeHTML = state.userData.isPearlsEntry ?
            '<span class="nowrap">Welcome back,</span> <br class="mobile-break">sweet flower.' : 'Welcome, Jessica.';
        dom.welcomeMessage.innerHTML = welcomeHTML;

        setTimeout(() => dom.welcomeMessage.classList.add('visible'), 500);
        setTimeout(() => {
            dom.welcomeMessage.classList.remove('visible');
            // Clear the text content after fade out
            setTimeout(() => {
                dom.welcomeMessage.textContent = '';
                this.nextStep();
            }, 1500);
        }, 3500);
    },

    revealGarden() {
        setTimeout(() => {
            dom.veil.classList.add('lifting');
            dom.garden.classList.add('revealed');
            dom.glow.classList.add('visible');
        }, 1000);

        // Garden reveal - descending snowfall and emerging stars
        setTimeout(() => {
            // Gentle snowfall descending
            for (let i = 0; i < 15; i++) {
                const snowflake = document.createElement('div');
                snowflake.classList.add('effect-particle');
                snowflake.style.cssText = `
                    width: 3px;
                    height: 3px;
                    background: radial-gradient(circle, rgba(255, 255, 255, 0.7), rgba(230, 220, 240, 0.4));
                    border-radius: 50%;
                    box-shadow: 0 0 6px rgba(240, 230, 250, 0.5);
                `;

                snowflake.style.left = Math.random() * 100 + '%';
                snowflake.style.top = '-5%';

                document.body.appendChild(snowflake);
                state.activeParticles.add(snowflake);

                const duration = (Math.random() * 4 + 6) * 1000;
                const startTime = Date.now();
                const delay = Math.random() * 2000;
                const drift = (Math.random() - 0.5) * 60;

                function animateSnowflake() {
                    const elapsed = Date.now() - startTime - delay;
                    if (elapsed < 0) {
                        requestAnimationFrame(animateSnowflake);
                        return;
                    }

                    const progress = elapsed / duration;
                    if (progress < 1) {
                        const y = progress * 110;
                        const xDrift = Math.sin(progress * Math.PI * 2) * drift * 0.3;
                        const baseX = parseFloat(snowflake.style.left);
                        snowflake.style.top = y + '%';
                        snowflake.style.left = (baseX + xDrift * 0.01) + '%';
                        // Fade in then out
                        const fadeIn = Math.min(progress * 5, 1);
                        const fadeOut = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;
                        snowflake.style.opacity = fadeIn * fadeOut * 0.7;
                        requestAnimationFrame(animateSnowflake);
                    } else {
                        snowflake.remove();
                        state.activeParticles.delete(snowflake);
                    }
                }
                animateSnowflake();
            }

            // Soft stars fading in across the sky
            for (let i = 0; i < 8; i++) {
                const star = document.createElement('div');
                star.classList.add('effect-particle');
                star.style.cssText = `
                    width: 2px;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 50%;
                    box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
                    opacity: 0;
                `;

                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 60 + '%'; // Upper portion of screen

                document.body.appendChild(star);
                state.activeParticles.add(star);

                const starDelay = Math.random() * 2500 + 500;
                const fadeInDuration = 2000;

                setTimeout(() => {
                    const fadeStartTime = Date.now();
                    function animateStar() {
                        const elapsed = Date.now() - fadeStartTime;
                        const progress = Math.min(elapsed / fadeInDuration, 1);
                        // Gentle fade in with slight twinkle
                        const twinkle = 0.9 + Math.sin(progress * Math.PI * 4) * 0.1;
                        star.style.opacity = progress * twinkle * 0.8;
                        if (progress < 1) {
                            requestAnimationFrame(animateStar);
                        }
                    }
                    animateStar();
                }, starDelay);

                // Stars persist, removed after 8 seconds
                setTimeout(() => {
                    star.remove();
                    state.activeParticles.delete(star);
                }, 8000);
            }
        }, 2500);

        // Complete entrance artifact before showing menu
        setTimeout(() => {
            Guardian.entrance.stepExit(state.currentStep, this.stepNames[state.currentStep]);
            Guardian.entrance.complete(true, state.userData);
            Menu.show();
        }, 5000);
    },

    createMessage(text, useHTML = false) {
        const msg = document.createElement('div');
        msg.classList.add('message');
        if (useHTML) {
            msg.innerHTML = text;
        } else {
            msg.textContent = text;
        }
        return msg;
    },

    createInput() {
        const inputWrapper = document.createElement('div');
        inputWrapper.classList.add('input-wrapper');

        const mistGlow = document.createElement('div');
        mistGlow.classList.add('mist-glow');
        mistGlow.style.pointerEvents = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('entry-field');
        input.placeholder = '';
        input.autocomplete = 'off';
        input.spellcheck = false; /* Chrome mobile: disable word underline */
        input.setAttribute('autocorrect', 'off'); /* iOS: disable autocorrect */
        input.setAttribute('autocapitalize', 'off'); /* iOS: disable autocapitalize */
        input.style.position = 'relative';
        input.style.zIndex = '10';

        const penIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        penIcon.classList.add('pen-icon');
        penIcon.setAttribute('viewBox', '0 0 24 24');
        penIcon.setAttribute('fill', 'none');
        penIcon.setAttribute('stroke', 'currentColor');
        penIcon.setAttribute('stroke-width', '1.5');
        penIcon.style.pointerEvents = 'none';
        penIcon.innerHTML = `
            <circle cx="12" cy="12" r="10" opacity="0.3" style="pointer-events: none;"/>
            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" style="pointer-events: none;"/>
        `;

        inputWrapper.appendChild(mistGlow);
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(penIcon);

        return { inputWrapper, input };
    },

    createButton(text) {
        const btn = document.createElement('button');
        btn.classList.add('choice-button');
        btn.textContent = text;
        return btn;
    },

    setupTypingEffect(input) {
        let lastLength = 0;

        input.addEventListener('input', (e) => {
            const currentLength = e.target.value.length;

            if (currentLength > lastLength) {
                const rect = input.getBoundingClientRect();
                const charPosition = Helpers.getInputCharacterPosition(input);
                if (charPosition) {
                    ParticleSystem.createTypingFirefly(charPosition.x, charPosition.y);
                }
            }

            lastLength = currentLength;
        });
    },

    fadeAndTransition(input, msg, inputWrapper, callback) {
        input.classList.add('text-fading');
        setTimeout(() => {
            msg.classList.add('fading');
            inputWrapper.classList.add('fading');
            setTimeout(callback, 1500);
        }, 1000);
    }
};
