/* ========================================
   POEM SECTION
   Request a Poem - book, pages, ink effects, send animation
   ======================================== */

const PoemSection = {
    currentPage: 1,
    letters: [],
    lastKeyTime: 0,
    pendingDisplayUpdate: null,
    bookTilt: { x: 0, y: 0 },
    activePage: 'left',
    swipeStart: null,
    isClosing: false,

    show() {
        this.resetPoemState();

        // Sync pending state from backend (persists across refresh)
        if (PoemState.isRequestPending()) {
            state.poem.isPending = true;
        }

        // Start poem artifact tracking
        Guardian.poem.start();

        const menu = document.getElementById('mainMenu');
        const helpIcon = document.getElementById('helpIcon');
        if (menu) menu.classList.remove('visible');
        if (helpIcon) {
            helpIcon.classList.remove('visible');
            helpIcon.style.pointerEvents = 'none';
        }

        const poemContainer = document.createElement('div');
        poemContainer.classList.add('poem-container');
        poemContainer.id = 'poemContainer';

        const introMsg = document.createElement('div');
        introMsg.classList.add('message');
        introMsg.textContent = 'A poem awaits your request...';
        poemContainer.appendChild(introMsg);

        document.body.appendChild(poemContainer);

        const backBtn = document.createElement('button');
        backBtn.classList.add('back-button');
        backBtn.textContent = '← Return';
        backBtn.id = 'poemBackBtn';
        backBtn.addEventListener('click', () => {
            if (state.poem.isPending) {
                Helpers.createButtonFocusEffect(backBtn, () => {
                    this.cleanupAndReturn();
                });
                return;
            }

            const hasContent = state.poem.currentText.length > 0;

            if (hasContent) {
                this.showReturnConfirmation((confirmed) => {
                    if (confirmed) {
                        Helpers.createButtonFocusEffect(backBtn, () => {
                            this.cleanupAndReturn();
                        });
                    }
                });
            } else {
                Helpers.createButtonFocusEffect(backBtn, () => {
                    this.cleanupAndReturn();
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
                this.showBook();
            }, 1500);
        }, 2500);
    },

    cleanupAndReturn() {
        const poemContainer = document.getElementById('poemContainer');
        const backBtn = document.getElementById('poemBackBtn');
        const bookHelper = document.getElementById('bookHelper');
        const textarea = document.getElementById('poemTextarea');
        const menu = document.getElementById('mainMenu');
        const helpIcon = document.getElementById('helpIcon');

        // Track abandonment if there was content
        if (state.poem.currentText.length > 0 && !state.poem.isPending) {
            Guardian.poem.abandon(state.poem.currentText);
        }

        this.resetPoemState();
        ParticleSystem.stopWhisperEmbers();

        // Clean up keyboard-active state on mobile
        if (window.innerWidth <= 768) {
            // Clean up visualViewport listeners if they exist
            if (window.visualViewport && textarea && textarea._viewportUpdateFn) {
                window.visualViewport.removeEventListener('resize', textarea._viewportUpdateFn);
                window.visualViewport.removeEventListener('scroll', textarea._viewportUpdateFn);
            }

            // Reset CSS variables
            if (poemContainer) {
                poemContainer.style.removeProperty('--keyboard-center-top');
            }
            document.body.style.removeProperty('--keyboard-book-scale');

            // Remove keyboard-active classes
            document.body.classList.remove('keyboard-active');
            document.documentElement.classList.remove('keyboard-active');
        }

        // Fade out elements before removing to prevent white flash
        if (poemContainer) {
            poemContainer.style.transition = 'opacity 0.3s ease';
            poemContainer.style.opacity = '0';
        }
        if (backBtn) {
            backBtn.style.transition = 'opacity 0.3s ease';
            backBtn.style.opacity = '0';
        }
        // Hide helper but don't remove - persists within session for faster return
        if (bookHelper) {
            bookHelper.classList.remove('visible');
            bookHelper.style.opacity = '';  // Clear any inline styles
            bookHelper.style.pointerEvents = '';
        }

        // Remove elements after fade (except helper)
        setTimeout(() => {
            if (poemContainer) poemContainer.remove();
            if (backBtn) backBtn.remove();
            if (textarea) textarea.remove();

            if (menu) menu.classList.add('visible');
            if (helpIcon) {
                helpIcon.classList.add('visible');
                helpIcon.style.pointerEvents = 'auto';
            }
        }, 300);
    },

    showBook() {
        const poemContainer = document.getElementById('poemContainer');
        if (!poemContainer) return;

        if (state.poem.isPending) {
            this.showPendingState();
            return;
        }

        // Check if helper already exists (user is returning within same session)
        const existingHelper = document.getElementById('bookHelper');
        if (state.poem.helperCreated && existingHelper) {
            // Returning user - show helper immediately and open book directly
            existingHelper.classList.add('visible');
            // Clear any inline styles that might interfere with CSS
            existingHelper.style.opacity = '';
            existingHelper.style.pointerEvents = '';

            // Show back button
            const backBtn = document.getElementById('poemBackBtn');
            if (backBtn) {
                backBtn.style.opacity = '1';
                backBtn.style.pointerEvents = 'auto';
            }

            // Open the book directly (no closed book animation)
            this.showOpenBookDirectly();
            ParticleSystem.startWhisperEmbers(poemContainer, 0.3);
            return;
        }

        const bookWrapper = document.createElement('div');
        bookWrapper.classList.add('book-wrapper', 'dormant');
        bookWrapper.id = 'bookWrapper';

        // Glow layers (exactly like seed)
        const glowLayers = ['atmosphere', 'outer', 'inner', 'core'];
        glowLayers.forEach(layer => {
            const glowDiv = document.createElement('div');
            glowDiv.classList.add('book-glow-layer', `book-glow-${layer}`);
            bookWrapper.appendChild(glowDiv);
        });

        // Ring glow
        const ringGlow = document.createElement('div');
        ringGlow.classList.add('book-ring-glow');
        bookWrapper.appendChild(ringGlow);

        // The closed book SVG
        const bookSVG = this.createClosedBookSVG();
        bookWrapper.appendChild(bookSVG);

        // Prompt positioned below book (inside wrapper)
        const prompt = document.createElement('div');
        prompt.classList.add('poem-prompt');
        prompt.textContent = 'Touch to write...';
        prompt.id = 'poemPrompt';
        bookWrapper.appendChild(prompt);

        poemContainer.appendChild(bookWrapper);

        setTimeout(() => {
            prompt.classList.add('visible');
            bookWrapper.classList.add('visible');

            const backBtn = document.getElementById('poemBackBtn');
            if (backBtn) {
                backBtn.style.opacity = '1';
                backBtn.style.pointerEvents = 'auto';
            }
        }, 100);

        // Click to open with awakening effect
        bookWrapper.addEventListener('click', () => {
            if (bookWrapper.classList.contains('dormant')) {
                this.openBook(bookWrapper);
            }
        });

        setTimeout(() => {
            ParticleSystem.startWhisperEmbers(poemContainer, 0.3);
        }, 1000);
    },

    createClosedBookSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('closed-book-svg');
        svg.setAttribute('viewBox', '0 0 120 140');

        svg.innerHTML = `
            <defs>
                <radialGradient id="coverGrad" cx="35%" cy="25%" r="80%">
                    <stop offset="0%" stop-color="rgba(240, 230, 250, 0.95)"/>
                    <stop offset="50%" stop-color="rgba(200, 180, 220, 0.9)"/>
                    <stop offset="100%" stop-color="rgba(160, 140, 180, 0.75)"/>
                </radialGradient>
                <linearGradient id="spineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(140, 120, 160, 0.9)"/>
                    <stop offset="50%" stop-color="rgba(120, 100, 140, 0.85)"/>
                    <stop offset="100%" stop-color="rgba(160, 140, 180, 0.9)"/>
                </linearGradient>
                <linearGradient id="silkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(80, 60, 100, 0.95)"/>
                    <stop offset="25%" stop-color="rgba(100, 80, 130, 0.9)"/>
                    <stop offset="50%" stop-color="rgba(120, 100, 150, 0.85)"/>
                    <stop offset="75%" stop-color="rgba(100, 80, 120, 0.9)"/>
                    <stop offset="100%" stop-color="rgba(70, 50, 90, 0.95)"/>
                </linearGradient>
                <filter id="bookShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                    <feOffset dx="2" dy="4"/>
                    <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1"/>
                    <feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0 0  0 0 0 0.4 0"/>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <filter id="ribbonGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feFlood flood-color="rgba(220, 200, 240, 0.4)" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="glow"/>
                    <feMerge>
                        <feMergeNode in="glow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <!-- Book spine -->
            <path d="M 18 20 Q 14 20 14 24 L 14 116 Q 14 120 18 120 L 26 120 L 26 20 Z"
                  fill="url(#spineGrad)" filter="url(#bookShadow)"/>

            <!-- Page edges -->
            <rect x="26" y="22" width="3" height="96" fill="rgba(250, 245, 235, 0.7)"/>

            <!-- Main cover -->
            <rect x="29" y="20" width="72" height="100" rx="2"
                  fill="url(#coverGrad)" filter="url(#bookShadow)"/>

            <!-- Decorative border -->
            <rect x="36" y="28" width="58" height="84" rx="1"
                  fill="none" stroke="rgba(160, 140, 180, 0.35)" stroke-width="0.8"/>

            <!-- Center book icon (exact whisper envelope structure, book path sized to match) -->
            <g id="bookIconGroup" class="book-icon" transform="translate(53, 58)">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="rgba(245, 240, 250, 0.7)" stroke-width="1" opacity="0.7">
                    <circle cx="12" cy="12" r="10" opacity="0.3"/>
                    <path d="M6 16.5A1.5 1.5 0 017.5 15H18M6 16.5v-9A1.5 1.5 0 017.5 6H18v12H7.5A1.5 1.5 0 016 16.5z"/>
                </svg>
            </g>

            <!-- Silk ribbon bookmark with slanted bottom -->
            <path d="M 36 120 L 44 120 L 44 140 L 36 136 Z"
                  fill="url(#silkGradient)"
                  filter="url(#ribbonGlow)"/>
            <!-- Silk highlight -->
            <path d="M 38 121 L 38 134"
                  stroke="rgba(220, 140, 150, 0.35)" stroke-width="1" stroke-linecap="round"/>
            <!-- Subtle edge shadow -->
            <path d="M 43 121 L 43 139"
                  stroke="rgba(80, 20, 30, 0.25)" stroke-width="0.5" stroke-linecap="round"/>
        `;

        return svg;
    },

    openBook(bookWrapper) {
        // Track book open
        Guardian.poem.onBookOpen();

        // First: Animate the book icon flying to helper position
        // Book opening is triggered when icon is ~50% to destination
        this.animateBookIconToHelper(bookWrapper, () => {
            // This callback fires at travel midpoint (~750ms into travel)
            // Now start the book awakening/opening sequence
            this.startBookOpeningSequence(bookWrapper);
        });
    },

    // Separated from openBook so it can be triggered by icon travel callback
    startBookOpeningSequence(bookWrapper) {
        // Transition from dormant to awakening (exactly like seed)
        bookWrapper.classList.remove('dormant');
        bookWrapper.classList.add('awakening');

        const prompt = document.getElementById('poemPrompt');
        if (prompt) {
            prompt.style.opacity = '0';
        }

        // Soft shockwave
        this.createSoftShockwave(bookWrapper);

        // Spawn background embers
        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.createBackgroundEmber(bookWrapper), i * 200);
        }

        // After awakening, transition to open book with REVERSE animation
        setTimeout(() => {
            bookWrapper.classList.remove('awakening');
            bookWrapper.classList.add('opening');

            const rect = bookWrapper.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Create radial burst effect
            this.createRadialBurst(centerX, centerY);

            // Animate opening: closed book fades while open book fades in
            this.animateBookOpening(bookWrapper, centerX, centerY);
        }, 1500);
    },

    // Reverse of animateBookClosing - closed book transitions to open book
    animateBookOpening(bookWrapper, centerX, centerY) {
        const poemContainer = document.getElementById('poemContainer');

        // Shrink closed book
        bookWrapper.style.transition = 'transform 0.6s ease, opacity 0.5s ease';
        bookWrapper.style.transform = 'scale(0.5)';
        bookWrapper.style.opacity = '0';

        // Create transitional open book (starts closed, animates to open)
        setTimeout(() => {
            bookWrapper.remove();
            this.showOpenBook(true); // Pass flag for opening animation
        }, 500);
    },

    createRadialBurst(x, y) {
        // Soft glow pulse
        const glow = document.createElement('div');
        glow.classList.add('radial-burst', 'burst-glow');
        glow.style.left = x + 'px';
        glow.style.top = y + 'px';
        document.body.appendChild(glow);

        glow.animate([
            { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 0.6, offset: 0.3 },
            { transform: 'translate(-50%, -50%) scale(2.5)', opacity: 0 }
        ], { duration: 600, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' });

        setTimeout(() => glow.remove(), 600);

        // Subtle ring
        const ring = document.createElement('div');
        ring.classList.add('radial-burst', 'burst-ring');
        ring.style.left = x + 'px';
        ring.style.top = y + 'px';
        document.body.appendChild(ring);

        ring.animate([
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0.6, borderWidth: '2px' },
            { transform: 'translate(-50%, -50%) scale(2)', opacity: 0, borderWidth: '1px' }
        ], { duration: 500, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' });

        setTimeout(() => ring.remove(), 500);

        // Gentle embers
        for (let i = 0; i < 10; i++) {
            const ember = document.createElement('div');
            const isLight = i % 4 === 0;
            ember.classList.add('burst-ember', isLight ? 'light' : 'warm');
            ember.style.left = x + 'px';
            ember.style.top = y + 'px';
            document.body.appendChild(ember);

            const angle = (i / 10) * Math.PI * 2;
            const distance = 50 + Math.random() * 30;

            ember.animate([
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.7, offset: 0.15 },
                {
                    transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0.3)`,
                    opacity: 0
                }
            ], {
                duration: 500 + Math.random() * 200,
                delay: i * 20,
                easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)'
            });

            setTimeout(() => ember.remove(), 750);
        }
    },

    createSoftShockwave(bookWrapper) {
        const rect = bookWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const wave = document.createElement('div');
        wave.classList.add('soft-shockwave');
        wave.style.left = centerX + 'px';
        wave.style.top = centerY + 'px';
        document.body.appendChild(wave);

        // Dusty embers trailing behind
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const angle = (i / 12) * Math.PI * 2;
                const ember = document.createElement('div');
                ember.classList.add(i % 3 === 0 ? 'dust-ember-white' : 'dust-ember');
                ember.style.left = centerX + 'px';
                ember.style.top = centerY + 'px';
                ember.style.zIndex = '-1';

                document.body.appendChild(ember);
                state.activeParticles.add(ember);

                const distance = 100 + Math.random() * 60;
                const duration = 1200 + Math.random() * 600;

                ember.animate([
                    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.7 },
                    {
                        transform: 'translate(-50%, -50%) scale(0.2)',
                        opacity: 0,
                        left: (centerX + Math.cos(angle) * distance) + 'px',
                        top: (centerY + Math.sin(angle) * distance) + 'px'
                    }
                ], { duration: duration, easing: 'cubic-bezier(0.2, 0, 0.3, 1)' });

                setTimeout(() => {
                    ember.remove();
                    state.activeParticles.delete(ember);
                }, duration);
            }, i * 60);
        }

        setTimeout(() => wave.remove(), 1000);
    },

    createBackgroundEmber(bookWrapper) {
        const rect = bookWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const ember = document.createElement('div');
        ember.classList.add(Math.random() > 0.5 ? 'background-ember' : 'background-ember-white');

        const angle = Math.random() * Math.PI * 2;
        const startRadius = 60 + Math.random() * 30;
        const startX = centerX + Math.cos(angle) * startRadius;
        const startY = centerY + Math.sin(angle) * startRadius;

        ember.style.left = startX + 'px';
        ember.style.top = startY + 'px';
        ember.style.zIndex = '-1';

        document.body.appendChild(ember);
        state.activeParticles.add(ember);

        const endX = startX + (Math.random() - 0.5) * 80;
        const endY = startY - 40 - Math.random() * 60;
        const duration = 1500 + Math.random() * 1000;

        ember.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.6 },
            { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0, left: endX + 'px', top: endY + 'px' }
        ], { duration: duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });

        setTimeout(() => {
            ember.remove();
            state.activeParticles.delete(ember);
        }, duration);
    },

    showOpenBook(withOpeningAnimation = false) {
        const poemContainer = document.getElementById('poemContainer');
        const oldBookWrapper = document.getElementById('bookWrapper');

        if (oldBookWrapper) oldBookWrapper.remove();

        // Force scroll to top and lock body on mobile when book opens
        if (window.innerWidth <= 768) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            // Lock body position to prevent keyboard scroll issues
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.top = '0';
        }

        // Create open book wrapper
        const openBookWrapper = document.createElement('div');
        openBookWrapper.classList.add('open-book-wrapper');
        openBookWrapper.id = 'openBookWrapper';

        // Create the open book
        const openBook = document.createElement('div');
        openBook.classList.add('open-book');
        openBook.id = 'openBook';

        // Left page (primary writing)
        const leftPage = document.createElement('div');
        leftPage.classList.add('book-page', 'page-left');
        leftPage.id = 'pageLeft';

        const leftWritingArea = document.createElement('div');
        leftWritingArea.classList.add('writing-area');

        const inkDisplay = document.createElement('div');
        inkDisplay.classList.add('ink-display');
        inkDisplay.id = 'inkDisplay';
        inkDisplay.innerHTML = '<span class="ink-cursor"></span>';

        leftWritingArea.appendChild(inkDisplay);

        // Swipe handle visual cue on left edge
        const swipeHandle = document.createElement('div');
        swipeHandle.classList.add('swipe-handle');
        swipeHandle.id = 'swipeHandle';
        swipeHandle.setAttribute('draggable', 'false');

        leftPage.appendChild(leftWritingArea);
        leftPage.appendChild(swipeHandle);

        // Spine
        const spine = document.createElement('div');
        spine.classList.add('book-spine');

        // Right page (overflow + decoration)
        const rightPage = document.createElement('div');
        rightPage.classList.add('book-page', 'page-right');
        rightPage.id = 'pageRight';

        const rightWritingArea = document.createElement('div');
        rightWritingArea.classList.add('writing-area');

        const inkDisplayRight = document.createElement('div');
        inkDisplayRight.classList.add('ink-display', 'ink-display-right');
        inkDisplayRight.id = 'inkDisplayRight';

        rightWritingArea.appendChild(inkDisplayRight);

        // Right page decoration
        const rightDecor = document.createElement('div');
        rightDecor.classList.add('right-page-decor');
        rightDecor.id = 'rightPageDecor';
        rightDecor.innerHTML = `
            <svg width="180" height="220" viewBox="0 0 180 220">
                <defs>
                    <linearGradient id="decorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="rgba(160, 140, 180, 0.3)"/>
                        <stop offset="100%" stop-color="rgba(140, 120, 160, 0.15)"/>
                    </linearGradient>
                </defs>
                <path d="M 90 20 Q 120 50 90 80 Q 60 110 90 140 Q 120 170 90 200"
                      fill="none" stroke="url(#decorGrad)" stroke-width="2"/>
                <path d="M 98 45 Q 115 40 108 55" fill="none" stroke="url(#decorGrad)" stroke-width="1"/>
                <path d="M 82 75 Q 65 70 72 85" fill="none" stroke="url(#decorGrad)" stroke-width="1"/>
                <path d="M 102 105 Q 125 95 115 115" fill="none" stroke="url(#decorGrad)" stroke-width="1"/>
                <path d="M 78 135 Q 55 130 68 148" fill="none" stroke="url(#decorGrad)" stroke-width="1"/>
                <path d="M 98 165 Q 115 160 108 178" fill="none" stroke="url(#decorGrad)" stroke-width="1"/>
            </svg>
        `;

        rightPage.appendChild(rightWritingArea);
        rightPage.appendChild(rightDecor);

        openBook.appendChild(leftPage);
        openBook.appendChild(spine);
        openBook.appendChild(rightPage);

        openBookWrapper.appendChild(openBook);

        // Hidden textarea for input
        const textarea = document.createElement('textarea');
        textarea.classList.add('hidden-poem-input');
        textarea.id = 'poemTextarea';
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('autocorrect', 'off');
        textarea.setAttribute('autocapitalize', 'off');
        textarea.setAttribute('spellcheck', 'false');
        document.body.appendChild(textarea);

        poemContainer.appendChild(openBookWrapper);

        // Opening animation: left page starts closed (rotated 180deg), animates to open
        if (withOpeningAnimation) {
            openBookWrapper.style.opacity = '0';
            openBookWrapper.style.transform = 'scale(0.7)';
            leftPage.style.transform = 'rotateY(180deg)';
            leftPage.style.transformOrigin = 'right center';

            requestAnimationFrame(() => {
                openBookWrapper.style.transition = 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                openBookWrapper.style.opacity = '1';
                openBookWrapper.style.transform = 'scale(1)';

                // Animate left page opening (reverse of closing)
                setTimeout(() => {
                    leftPage.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)';
                    leftPage.style.transform = 'rotateY(0deg)';

                    // Clear transition after animation completes
                    setTimeout(() => {
                        leftPage.style.transition = '';
                        leftPage.style.transform = '';
                        leftPage.style.transformOrigin = '';
                    }, 1000);
                }, 200);
            });
        } else {
            // Simple fade in (no opening animation)
            openBookWrapper.style.opacity = '0';
            openBookWrapper.style.transform = 'scale(0.85)';

            requestAnimationFrame(() => {
                openBookWrapper.style.transition = 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                openBookWrapper.style.opacity = '1';
                openBookWrapper.style.transform = 'scale(1)';
            });
        }

        // Helper icon is now created during animateBookIconToHelper (called from openBook)
        // No need to call createBookHelper here - it's already spawned before book opens

        // Setup input handling - NO AUTO-FOCUS, user taps to type
        setTimeout(() => {
            this.setupTyping(textarea, openBook);
            this.setupBookPhysics(openBook);
            this.setupSwipeToClose(openBook, leftPage, swipeHandle);
            // Book opens UNFOCUSED - user must tap to start typing
        }, 300);
    },

    /**
     * Show the open book directly without the closed book animation.
     * Used when user returns to poem section within the same session.
     */
    showOpenBookDirectly() {
        // Track book open (even on direct return)
        Guardian.poem.onBookOpen();
        // Show open book with simple fade (no page flip animation)
        this.showOpenBook(false);
    },

    setupTyping(textarea, openBook) {
        const inkDisplay = document.getElementById('inkDisplay');
        const inkDisplayRight = document.getElementById('inkDisplayRight');

        // Instrument textarea for raw capture
        Guardian.instrumentInput(textarea, 'poem.textarea');

        textarea.addEventListener('input', (e) => {
            const now = Date.now();
            const newText = e.target.value;
            const oldText = state.poem.currentText;
            const oldLength = oldText.length;
            const newLength = newText.length;

            // For additions, check overflow BEFORE committing to state
            if (newLength > oldLength) {
                // Check if this new text would overflow
                const wouldOverflow = this.checkTextOverflow(newText);

                if (wouldOverflow) {
                    // Revert immediately - don't commit to state
                    e.target.value = oldText;
                    // Pages are full - blur to drop keyboard
                    textarea.blur();
                    return;
                }

                // Determine weight for new characters based on typing speed
                const timeSinceLastKey = now - this.lastKeyTime;
                let weight = 'normal';
                if (timeSinceLastKey < 80) weight = 'fast';
                else if (timeSinceLastKey > 300) weight = 'slow';

                // Add metadata for new characters
                for (let i = oldLength; i < newLength; i++) {
                    this.letters[i] = { time: now, weight };
                }

                // Track typing tempo (throttled internally by Guardian)
                Guardian.poem.recordTypingTempo(weight);
            } else if (newLength < oldLength) {
                this.letters = this.letters.slice(0, newLength);
            }

            state.poem.currentText = newText;
            this.lastKeyTime = now;

            // Cancel any pending display update
            if (this.pendingDisplayUpdate) {
                cancelAnimationFrame(this.pendingDisplayUpdate);
            }

            // Debounce display update to next animation frame for smoother rendering
            this.pendingDisplayUpdate = requestAnimationFrame(() => {
                this.updateInkDisplay();
            });
        });

        // Show cursor on focus, hide on blur
        // Also handle mobile keyboard scroll-lock and centering
        textarea.addEventListener('focus', () => {
            Guardian.poem.onTextareaFocus();

            const poemContainer = document.getElementById('poemContainer');
            const backBtn = document.getElementById('poemBackBtn');
            const openBookEl = document.getElementById('openBook');

            if (poemContainer) poemContainer.classList.add('input-focused');
            if (backBtn) backBtn.classList.add('input-focused');
            if (openBookEl) openBookEl.classList.add('cursor-visible');

            // Mobile keyboard handling
            if (window.innerWidth <= 768) {
                document.body.classList.add('keyboard-active');
                document.documentElement.classList.add('keyboard-active');

                // Use visualViewport API to detect keyboard and center book
                if (window.visualViewport) {
                    const updatePosition = () => {
                        const poemEl = document.getElementById('poemContainer');
                        const openBook = document.getElementById('openBook');
                        const openBookWrapper = document.getElementById('openBookWrapper');
                        if (!poemEl || !openBook) return;

                        const visibleHeight = window.visualViewport.height;
                        const bookHeight = openBook.offsetHeight;

                        // Calculate scale if book is too tall for visible area
                        // Leave 40px padding (20px top + 20px bottom)
                        const availableHeight = visibleHeight - 40;
                        let scale = 1;
                        if (bookHeight > availableHeight) {
                            scale = Math.max(0.6, availableHeight / bookHeight); // Don't go below 60%
                        }

                        // Center the book in the visible area
                        const centerY = visibleHeight / 2;

                        poemEl.style.setProperty('--keyboard-center-top', `${centerY}px`);

                        // Apply scale via CSS variable
                        if (openBookWrapper) {
                            document.body.style.setProperty('--keyboard-book-scale', scale);
                        }
                    };

                    // Update immediately and on viewport changes
                    updatePosition();
                    window.visualViewport.addEventListener('resize', updatePosition);
                    window.visualViewport.addEventListener('scroll', updatePosition);

                    // Store reference for cleanup
                    textarea._viewportUpdateFn = updatePosition;
                } else {
                    // Fallback for browsers without visualViewport (older iOS)
                    const poemEl = document.getElementById('poemContainer');
                    if (poemEl) {
                        // Use a safe fallback - roughly center in upper portion
                        poemEl.style.setProperty('--keyboard-center-top', '35%');
                    }
                }
            }
        });

        textarea.addEventListener('blur', () => {
            const poemContainer = document.getElementById('poemContainer');
            const backBtn = document.getElementById('poemBackBtn');
            const openBookEl = document.getElementById('openBook');

            if (poemContainer) poemContainer.classList.remove('input-focused');
            if (backBtn) backBtn.classList.remove('input-focused');
            if (openBookEl) openBookEl.classList.remove('cursor-visible');

            // Remove mobile keyboard scroll-lock and reset position
            if (window.innerWidth <= 768) {
                document.body.classList.remove('keyboard-active');
                document.documentElement.classList.remove('keyboard-active');

                // Clean up visualViewport listeners
                if (window.visualViewport && textarea._viewportUpdateFn) {
                    window.visualViewport.removeEventListener('resize', textarea._viewportUpdateFn);
                    window.visualViewport.removeEventListener('scroll', textarea._viewportUpdateFn);
                    textarea._viewportUpdateFn = null;
                }

                // Reset the CSS variables
                if (poemContainer) {
                    poemContainer.style.removeProperty('--keyboard-center-top');
                }
                document.body.style.removeProperty('--keyboard-book-scale');
            }
        });

        // Start ink aging loop
        this.startAgingLoop();
    },

    updateInkDisplay() {
        const now = Date.now();
        const text = state.poem.currentText;
        const inkDisplay = document.getElementById('inkDisplay');
        const inkDisplayRight = document.getElementById('inkDisplayRight');
        const rightPageDecor = document.getElementById('rightPageDecor');

        if (!inkDisplay) return false;

        // Get writing area dimensions for overflow calculation
        const leftWritingArea = document.querySelector('#pageLeft .writing-area');
        const rightWritingArea = document.querySelector('#pageRight .writing-area');
        if (!leftWritingArea) return false;

        const areaRect = leftWritingArea.getBoundingClientRect();
        // Fallback to reasonable defaults if not yet rendered
        const maxHeight = areaRect.height > 0 ? areaRect.height - 5 : 350;
        const areaWidth = areaRect.width > 0 ? areaRect.width - 5 : 280;

        // Get right page dimensions for overflow check
        const rightAreaRect = rightWritingArea ? rightWritingArea.getBoundingClientRect() : areaRect;
        const rightMaxHeight = rightAreaRect.height > 0 ? rightAreaRect.height - 5 : maxHeight;

        // Get computed styles from the actual ink display for accurate measurement
        const computedStyle = window.getComputedStyle(inkDisplay);
        const fontSize = computedStyle.fontSize;
        const lineHeight = computedStyle.lineHeight;

        // Create temp element to measure text height
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
            position: absolute;
            visibility: hidden;
            width: ${areaWidth}px;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: ${fontSize};
            line-height: ${lineHeight};
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        document.body.appendChild(tempDiv);

        // Find split point (left page overflow)
        let splitIndex = text.length;
        let testText = '';

        for (let i = 0; i < text.length; i++) {
            testText += text[i] === '\n' ? '<br>' : this.escapeHtml(text[i]);
            tempDiv.innerHTML = testText;

            if (tempDiv.scrollHeight > maxHeight) {
                splitIndex = i;
                for (let j = i; j >= Math.max(0, i - 50); j--) {
                    if (text[j] === ' ' || text[j] === '\n') {
                        splitIndex = j + 1;
                        break;
                    }
                }
                break;
            }
        }

        // Check if right page would overflow
        let rightPageOverflowed = false;
        const MAX_LINES_PER_PAGE = 10;

        if (splitIndex < text.length) {
            // Measure right page content
            let rightTestText = '';
            let rightLineCount = 1; // Start with 1 (first line)
            for (let i = splitIndex; i < text.length; i++) {
                if (text[i] === '\n') rightLineCount++;
                rightTestText += text[i] === '\n' ? '<br>' : this.escapeHtml(text[i]);
            }
            tempDiv.innerHTML = rightTestText;

            // Check both visual overflow AND line count
            if (tempDiv.scrollHeight > rightMaxHeight || rightLineCount > MAX_LINES_PER_PAGE) {
                rightPageOverflowed = true;
            }
        }

        // Also check left page line count as fallback
        let leftLineCount = 1;
        for (let i = 0; i < splitIndex; i++) {
            if (text[i] === '\n') leftLineCount++;
        }
        if (leftLineCount > MAX_LINES_PER_PAGE) {
            // Force earlier split if left page has too many explicit line breaks
            tempDiv.remove();
            return true; // Signal overflow to prevent this state
        }

        tempDiv.remove();

        // If right page overflowed, signal to caller (don't update display)
        if (rightPageOverflowed) {
            return true;
        }

        // Build HTML with ink classes
        let leftHtml = '';
        let rightHtml = '';

        for (let i = 0; i < text.length; i++) {
            const letterData = this.letters[i] || { time: now, weight: 'normal' };
            const age = now - letterData.time;
            let inkClass = age > 3000 ? 'dry' : (age > 1000 ? 'drying' : 'wet');

            const char = text[i] === '\n' ? '<br>' : this.escapeHtml(text[i]);
            const span = `<span class="ink-letter ${inkClass} ${letterData.weight}">${char}</span>`;

            if (i < splitIndex) {
                leftHtml += span;
            } else {
                rightHtml += span;
            }
        }

        // Update displays
        if (rightHtml.length > 0) {
            // Track overflow if transitioning to right page
            if (this.activePage === 'left') {
                Guardian.poem.onOverflow();
            }

            inkDisplay.innerHTML = leftHtml;
            inkDisplayRight.innerHTML = rightHtml + '<span class="ink-cursor"></span>';
            if (rightPageDecor) rightPageDecor.style.display = 'none';
            this.activePage = 'right';
        } else {
            inkDisplay.innerHTML = leftHtml + '<span class="ink-cursor"></span>';
            inkDisplayRight.innerHTML = '';
            if (rightPageDecor) rightPageDecor.style.display = '';
            this.activePage = 'left';
        }

        // Update left page cursor state (pointer when has content)
        const leftPage = document.getElementById('pageLeft');
        if (leftPage) {
            if (text.trim().length > 0) {
                leftPage.classList.add('has-content');
            } else {
                leftPage.classList.remove('has-content');
            }
        }

        return false; // No overflow
    },

    escapeHtml(char) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return map[char] || char;
    },

    /**
     * Check if text would overflow the book pages (without updating display)
     * Returns true if text would overflow, false if it fits
     */
    checkTextOverflow(text) {
        const MAX_LINES_PER_PAGE = 10;

        // Get writing area dimensions
        const leftWritingArea = document.querySelector('#pageLeft .writing-area');
        const rightWritingArea = document.querySelector('#pageRight .writing-area');
        if (!leftWritingArea) return false; // Can't check, allow typing

        const areaRect = leftWritingArea.getBoundingClientRect();
        const maxHeight = areaRect.height > 0 ? areaRect.height - 5 : 350;
        const areaWidth = areaRect.width > 0 ? areaRect.width - 5 : 280;

        const rightAreaRect = rightWritingArea ? rightWritingArea.getBoundingClientRect() : areaRect;
        const rightMaxHeight = rightAreaRect.height > 0 ? rightAreaRect.height - 5 : maxHeight;

        // Get computed styles for accurate measurement
        const inkDisplay = document.getElementById('inkDisplay');
        if (!inkDisplay) return false;
        const computedStyle = window.getComputedStyle(inkDisplay);
        const fontSize = computedStyle.fontSize;
        const lineHeight = computedStyle.lineHeight;

        // Create temp element to measure text height
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
            position: absolute;
            visibility: hidden;
            width: ${areaWidth}px;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: ${fontSize};
            line-height: ${lineHeight};
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        document.body.appendChild(tempDiv);

        // Find split point (where left page would overflow)
        let splitIndex = text.length;
        let testText = '';

        for (let i = 0; i < text.length; i++) {
            testText += text[i] === '\n' ? '<br>' : this.escapeHtml(text[i]);
            tempDiv.innerHTML = testText;

            if (tempDiv.scrollHeight > maxHeight) {
                splitIndex = i;
                for (let j = i; j >= Math.max(0, i - 50); j--) {
                    if (text[j] === ' ' || text[j] === '\n') {
                        splitIndex = j + 1;
                        break;
                    }
                }
                break;
            }
        }

        // Check left page line count
        let leftLineCount = 1;
        for (let i = 0; i < splitIndex; i++) {
            if (text[i] === '\n') leftLineCount++;
        }
        if (leftLineCount > MAX_LINES_PER_PAGE) {
            tempDiv.remove();
            return true; // Overflow
        }

        // Check if right page would overflow
        if (splitIndex < text.length) {
            let rightTestText = '';
            let rightLineCount = 1;
            for (let i = splitIndex; i < text.length; i++) {
                if (text[i] === '\n') rightLineCount++;
                rightTestText += text[i] === '\n' ? '<br>' : this.escapeHtml(text[i]);
            }
            tempDiv.innerHTML = rightTestText;

            if (tempDiv.scrollHeight > rightMaxHeight || rightLineCount > MAX_LINES_PER_PAGE) {
                tempDiv.remove();
                return true; // Overflow
            }
        }

        tempDiv.remove();
        return false; // No overflow
    },

    startAgingLoop() {
        // Update ink aging every 2 seconds
        this.agingInterval = setInterval(() => {
            if (state.poem.currentText.length > 0) {
                this.updateInkDisplay();
            }
        }, 2000);
    },

    setupBookPhysics(openBook) {
        const self = this;
        const textarea = document.getElementById('poemTextarea');
        const leftPage = document.getElementById('pageLeft');
        const rightPage = document.getElementById('pageRight');
        const swipeHandle = document.getElementById('swipeHandle');
        const leftWritingArea = leftPage.querySelector('.writing-area');
        const isMobile = window.innerWidth <= 768;

        // ========== TILT FUNCTIONS ==========
        function applyBookTilt(clientX, clientY) {
            const rect = openBook.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const deltaX = (clientX - centerX) / (rect.width / 2);
            const deltaY = (clientY - centerY) / (rect.height / 2);

            self.bookTilt.x = Math.max(-1, Math.min(1, deltaX)) * 4;
            self.bookTilt.y = Math.max(-1, Math.min(1, deltaY)) * -3;

            openBook.style.transition = 'transform 0.1s ease-out';
            openBook.style.transform =
                `rotateY(${self.bookTilt.x}deg) rotateX(${self.bookTilt.y}deg)`;
        }

        function resetBookTilt() {
            openBook.style.transition = 'transform 0.4s ease-out';
            openBook.style.transform = 'rotateY(0deg) rotateX(0deg)';
            self.bookTilt = { x: 0, y: 0 };
        }

        // ========== DESKTOP BEHAVIOR ==========
        if (!isMobile) {
            let isDraggingToClose = false;
            let dragStartX = 0;
            let hasDraggedEnough = false;

            // Desktop: Mouse movement tilts book (unless dragging to close)
            document.addEventListener('mousemove', (e) => {
                if (!document.getElementById('openBook')) return;
                if (self.isClosing || isDraggingToClose) return;
                applyBookTilt(e.clientX, e.clientY);
            });

            // Desktop: Left page click-to-focus AND drag-to-close
            // Bind to writing-area directly - 3D transforms cause hit-test misrouting to rightPage
            leftWritingArea.addEventListener('mousedown', (e) => {
                const hasText = state.poem.currentText.trim().length > 0;

                // Reset tilt on any click
                resetBookTilt();

                // Track drag state
                isDraggingToClose = false;
                hasDraggedEnough = false;
                dragStartX = e.clientX;
                let thresholdReached = false;

                const onMouseMove = (moveE) => {
                    if (thresholdReached) return;

                    const deltaX = moveE.clientX - dragStartX;

                    // Only respond to rightward drag AND only if has content
                    if (hasText && deltaX > 10) {
                        isDraggingToClose = true;
                        hasDraggedEnough = true;
                        const progress = Math.min(deltaX / 150, 1);
                        leftPage.style.transform = `rotateY(${progress * 90}deg)`;
                        leftPage.style.transformOrigin = 'right center';

                        // When threshold reached, freeze and show confirm
                        if (deltaX > 80) {
                            thresholdReached = true;
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            isDraggingToClose = false;
                            self.showSwipeConfirmation(leftPage);
                        }
                    }
                };

                const onMouseUp = (upE) => {
                    if (thresholdReached) return;

                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    // Reset page visual if was dragging (didn't reach threshold)
                    if (isDraggingToClose && hasDraggedEnough) {
                        leftPage.style.transition = 'transform 0.3s ease';
                        leftPage.style.transform = '';
                        leftPage.style.transformOrigin = '';
                        setTimeout(() => { leftPage.style.transition = ''; }, 300);
                        isDraggingToClose = false;
                    } else {
                        // Wasn't a drag - treat as click to focus
                        textarea.focus();
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            // Desktop: Right page click focuses textarea
            rightPage.addEventListener('click', (e) => {
                textarea.focus();
            });

            // Desktop: Swipe handle drag-to-close (dedicated drag target)
            swipeHandle.addEventListener('mousedown', (e) => {
                const hasText = state.poem.currentText.trim().length > 0;
                if (!hasText) return; // Handle only visible when has content

                e.preventDefault(); // Prevent text selection
                e.stopPropagation(); // Don't trigger writing area handler

                resetBookTilt();
                isDraggingToClose = true;
                hasDraggedEnough = false;
                dragStartX = e.clientX;
                let thresholdReached = false;

                const onMouseMove = (moveE) => {
                    if (thresholdReached) return;

                    const deltaX = moveE.clientX - dragStartX;

                    // Respond to rightward drag
                    if (deltaX > 5) {
                        hasDraggedEnough = true;
                        const progress = Math.min(deltaX / 150, 1);
                        leftPage.style.transform = `rotateY(${progress * 90}deg)`;
                        leftPage.style.transformOrigin = 'right center';

                        // When threshold reached, freeze and show confirm
                        if (deltaX > 80) {
                            thresholdReached = true;
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            isDraggingToClose = false;
                            self.showSwipeConfirmation(leftPage);
                        }
                    }
                };

                const onMouseUp = (upE) => {
                    if (thresholdReached) return;

                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    isDraggingToClose = false;

                    // Reset page visual if was dragging (didn't reach threshold)
                    if (hasDraggedEnough) {
                        leftPage.style.transition = 'transform 0.3s ease';
                        leftPage.style.transform = '';
                        leftPage.style.transformOrigin = '';
                        setTimeout(() => { leftPage.style.transition = ''; }, 300);
                    }
                    // No focus on release - handle is for drag only
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        // ========== MOBILE BEHAVIOR ==========
        if (isMobile) {
            let touchStartTime = 0;
            let touchStartX = 0;
            let touchStartY = 0;
            let isTilting = false;
            let isSwipeClosing = false;
            let touchMoved = false;
            let thresholdReached = false;

            openBook.addEventListener('touchstart', (e) => {
                if (self.isClosing) return;

                const touch = e.touches[0];
                touchStartTime = Date.now();
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchMoved = false;
                isTilting = false;
                isSwipeClosing = false;
                thresholdReached = false;

                // Check if starting on left page for potential swipe-to-close
                const leftPageRect = leftPage.getBoundingClientRect();
                const isOnLeftPage = touch.clientX >= leftPageRect.left &&
                                     touch.clientX <= leftPageRect.right &&
                                     touch.clientY >= leftPageRect.top &&
                                     touch.clientY <= leftPageRect.bottom;

                const hasText = state.poem.currentText.trim().length > 0;

                // If on left page and has text, prepare for potential swipe-to-close
                if (isOnLeftPage && hasText) {
                    isSwipeClosing = true;
                }
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (self.isClosing || thresholdReached) return;
                if (!document.getElementById('openBook')) return;

                const touch = e.touches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // Detect if user is moving
                if (distance > 10) {
                    touchMoved = true;
                }

                // Swipe-to-close: horizontal swipe right on left page
                // POSITIVE rotation closes the page (folds right over the spine)
                if (isSwipeClosing && deltaX > 20 && Math.abs(deltaY) < 50) {
                    const progress = Math.min(deltaX / 150, 1);
                    leftPage.style.transform = `rotateY(${progress * 90}deg)`;
                    leftPage.style.transformOrigin = 'right center';

                    // When threshold reached, freeze and show confirm
                    if (deltaX > 80 && !thresholdReached) {
                        thresholdReached = true;
                        self.showSwipeConfirmation(leftPage);
                    }
                    return;
                }

                // Tilt mode: tap + drag (almost instant activation)
                if (touchMoved && !isSwipeClosing) {
                    isTilting = true;
                    applyBookTilt(touch.clientX, touch.clientY);
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (!document.getElementById('openBook')) return;
                if (thresholdReached) {
                    // Don't reset anything - confirmation is handling it
                    isTilting = false;
                    isSwipeClosing = false;
                    touchMoved = false;
                    return;
                }

                const touch = e.changedTouches[0];
                const deltaX = touch.clientX - touchStartX;
                const tapDuration = Date.now() - touchStartTime;

                // Didn't reach threshold - reset page
                if (isSwipeClosing) {
                    leftPage.style.transition = 'transform 0.3s ease';
                    leftPage.style.transform = '';
                    leftPage.style.transformOrigin = '';
                    setTimeout(() => { leftPage.style.transition = ''; }, 300);
                }

                // Reset tilt if was tilting
                if (isTilting) {
                    resetBookTilt();
                }

                // Simple tap (short duration, didn't move) = focus textarea
                // Only focus if not already focused to prevent keyboard bounce
                if (!touchMoved && tapDuration < 300) {
                    if (document.activeElement !== textarea) {
                        // Use setTimeout to let touch event complete before focusing
                        setTimeout(() => {
                            textarea.focus();
                        }, 10);
                    }
                }

                // Reset states
                isTilting = false;
                isSwipeClosing = false;
                touchMoved = false;
            });
        }
    },

    // Swipe-to-close is now handled within setupBookPhysics for unified interaction
    setupSwipeToClose(openBook, leftPage, swipeHandle) {
        // This is now a no-op - all interactions handled in setupBookPhysics
        // Keeping the function signature to avoid breaking the call in showOpenBook
    },

    // Exact copy of whisper's animateFirstWhisper - book icon travels to corner
    // Called from openBook() BEFORE book opens
    animateBookIconToHelper(bookWrapper, onTravelMidpoint) {
        // Check if helper already exists in DOM (persists within session)
        const existingHelper = document.getElementById('bookHelper');
        if (state.poem.helperCreated && existingHelper) {
            // Already created, just dim the icon and proceed to open book
            const bookIcon = bookWrapper.querySelector('#bookIconGroup');
            if (bookIcon) {
                bookIcon.style.transition = 'opacity 0.8s ease';
                bookIcon.style.opacity = '0.25';
            }
            // Make sure helper is visible
            existingHelper.classList.add('visible');
            // Still trigger book opening
            if (onTravelMidpoint) onTravelMidpoint();
            return;
        }
        // Reset flag if helper was removed (e.g., by cleanupAndReturn)
        if (state.poem.helperCreated && !existingHelper) {
            state.poem.helperCreated = false;
        }

        const bookIconGroup = bookWrapper.querySelector('#bookIconGroup');
        const closedBookSvg = bookWrapper.querySelector('.closed-book-svg');

        if (!bookIconGroup || !closedBookSvg) return;

        // Create a source book icon SVG positioned over the embedded icon
        // This mirrors whisper's envelope icon - a standalone SVG we can clone
        const svgRect = closedBookSvg.getBoundingClientRect();
        const iconCenterX = svgRect.left + (65 / 120) * svgRect.width;
        const iconCenterY = svgRect.top + (70 / 140) * svgRect.height;

        // Exact copy of whisper's envelope icon structure, with book path sized to match
        const bookIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        bookIcon.classList.add('book-icon');
        bookIcon.id = 'bookIconSource';
        bookIcon.setAttribute('viewBox', '0 0 24 24');
        bookIcon.setAttribute('fill', 'none');
        bookIcon.setAttribute('stroke', 'currentColor');
        bookIcon.setAttribute('stroke-width', '1');
        bookIcon.innerHTML = `
            <circle cx="12" cy="12" r="10" opacity="0.3"/>
            <path d="M6 16.5A1.5 1.5 0 017.5 15H18M6 16.5v-9A1.5 1.5 0 017.5 6H18v12H7.5A1.5 1.5 0 016 16.5z"/>
        `;
        bookIcon.style.cssText = `
            position: fixed;
            left: ${iconCenterX - 12}px;
            top: ${iconCenterY - 12}px;
            width: 24px;
            height: 24px;
            color: #e8d4f0;
            opacity: 0;
            pointer-events: none;
            z-index: 200;
        `;
        document.body.appendChild(bookIcon);

        // Hide the embedded icon in SVG
        bookIconGroup.style.opacity = '0';

        // Make source icon visible and add awakening animation
        bookIcon.style.opacity = '1';
        bookIcon.classList.add('awakening');

        setTimeout(() => {
            bookIcon.classList.remove('awakening');

            const startRect = bookIcon.getBoundingClientRect();

            const travelIcon = bookIcon.cloneNode(true);
            travelIcon.id = 'travelingBookIcon';
            travelIcon.classList.remove('awakening');
            travelIcon.style.cssText = `
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

            document.body.appendChild(travelIcon);

            setTimeout(() => {
                travelIcon.style.opacity = '1';
            }, 50);

            bookIcon.style.opacity = '0';

            setTimeout(() => {
                const isMobile = window.innerWidth <= 768;
                const targetRight = isMobile ? 20 : 30;
                const targetBottom = isMobile ? 20 : 30;

                const targetX = window.innerWidth - targetRight - 20;
                const targetY = window.innerHeight - targetBottom - 20;

                travelIcon.style.transition = 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
                travelIcon.style.left = targetX + 'px';
                travelIcon.style.top = targetY + 'px';
                travelIcon.style.transform = 'scale(0.95)';

                // Trigger book opening at ~50% travel (750ms into 1500ms travel)
                setTimeout(() => {
                    if (onTravelMidpoint) onTravelMidpoint();
                }, 750);

                setTimeout(() => {
                    travelIcon.style.transition = 'all 0.3s ease-out';
                    travelIcon.style.transform = 'scale(0.5)';
                    travelIcon.style.opacity = '0';

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

                        travelIcon.remove();
                        this.createBookHelperElement();

                        // Clean up source icon (whisper fades original to 0.25, but book disappears when opening)
                        setTimeout(() => {
                            bookIcon.remove();
                        }, 200);
                    }, 150);
                }, 1400);
            }, 50);
        }, 900);
    },

    // Exactly like whisper's createEnvelopeHelper
    createBookHelperElement() {
        if (document.getElementById('bookHelper')) return;

        state.poem.helperCreated = true;

        const helper = document.createElement('div');
        helper.classList.add('book-helper');
        helper.id = 'bookHelper';

        // Exact copy of whisper's envelope helper icon structure, with book path sized to match
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '1.1');
        icon.setAttribute('width', '25');
        icon.setAttribute('height', '23');
        icon.innerHTML = `<path d="M6 16.5A1.5 1.5 0 017.5 15H18M6 16.5v-9A1.5 1.5 0 017.5 6H18v12H7.5A1.5 1.5 0 016 16.5z"/>`;

        helper.appendChild(icon);
        document.body.appendChild(helper);

        setTimeout(() => {
            helper.classList.add('visible');
            // Add blurping animation like whisper
            setTimeout(() => {
                helper.classList.add('blurping');
                setTimeout(() => {
                    helper.classList.remove('blurping');
                }, 800);
            }, 100);
        }, 100);

        // Simple click handler - exactly like whisper
        helper.addEventListener('click', () => this.showBookHelp());
    },

    // Simple help modal - exactly like whisper's showEnvelopeHelp/closeEnvelopeHelp
    showBookHelp() {
        const backdrop = document.createElement('div');
        backdrop.classList.add('help-backdrop');
        backdrop.id = 'bookHelpBackdrop';

        const modal = document.createElement('div');
        modal.classList.add('help-modal');
        modal.id = 'bookHelpModal';

        const text = document.createElement('div');
        text.classList.add('help-modal-text');
        text.innerHTML = 'Speak softly; the garden writes<br>what the heart cannot...<br><br>Pull the left page gently to the right<br>to close the book and seed the garden.';

        modal.appendChild(text);
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        setTimeout(() => {
            backdrop.classList.add('visible');
            modal.classList.add('visible');
        }, 100);

        const dismissTimer = setTimeout(() => this.closeBookHelp(), 6000);

        backdrop.addEventListener('click', () => {
            clearTimeout(dismissTimer);
            this.closeBookHelp();
        });
    },

    closeBookHelp() {
        const backdrop = document.getElementById('bookHelpBackdrop');
        const modal = document.getElementById('bookHelpModal');

        if (backdrop) backdrop.classList.remove('visible');
        if (modal) modal.classList.remove('visible');

        setTimeout(() => {
            if (backdrop) backdrop.remove();
            if (modal) modal.remove();
        }, 1000);
    },

    showReturnConfirmation(callback) {
        Guardian.poem.onReturnConfirmShown();

        const openBookWrapper = document.getElementById('openBookWrapper');
        const prompt = document.getElementById('poemPrompt');
        const backBtn = document.getElementById('poemBackBtn');
        const bookHelper = document.getElementById('bookHelper');
        const glow = document.getElementById('glow');

        if (openBookWrapper) openBookWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (bookHelper) bookHelper.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99;`;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(26, 10, 26, 0.95); border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px; padding: 30px; z-index: 100; text-align: center;
            max-width: 320px; opacity: 0; transition: opacity 0.5s ease;
        `;

        const text = document.createElement('div');
        text.style.cssText = `color: #e8d4f0; font-size: 1.1rem; margin-bottom: 1.5rem; letter-spacing: 1px; line-height: 1.6;`;
        text.textContent = 'Close the book unfinished?';

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

        const unblur = () => {
            if (openBookWrapper) openBookWrapper.style.filter = '';
            if (prompt) prompt.style.filter = '';
            if (backBtn) backBtn.style.filter = '';
            if (bookHelper) bookHelper.style.filter = '';
            if (glow) glow.style.filter = '';
        };

        const closeModal = (confirmed) => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                if (!confirmed) unblur();
                callback(confirmed);
            }, 500);
            clearTimeout(autoCloseTimer);
        };

        // Auto-dismiss after 8 seconds
        const autoCloseTimer = setTimeout(() => {
            Guardian.poem.onReturnConfirmChoice('timeout');
            closeModal(false);
        }, 8000);

        yesBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Guardian.poem.onReturnConfirmChoice('yes');

            Helpers.createButtonFocusEffect(yesBtn, () => {
                closeModal(true);
            });
        });

        noBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Guardian.poem.onReturnConfirmChoice('no');

            Helpers.createButtonFocusEffect(noBtn, () => {
                closeModal(false);
            });
        });

        backdrop.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Guardian.poem.onReturnConfirmChoice('dismiss');

            closeModal(false);
        });
    },

    showSendConfirmation() {
        const openBookWrapper = document.getElementById('openBookWrapper');
        const prompt = document.getElementById('poemPrompt');
        const backBtn = document.getElementById('poemBackBtn');
        const bookHelper = document.getElementById('bookHelper');
        const glow = document.getElementById('glow');

        if (openBookWrapper) openBookWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (bookHelper) bookHelper.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99;`;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(26, 10, 26, 0.95); border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px; padding: 30px; z-index: 100; text-align: center;
            max-width: 320px; opacity: 0; transition: opacity 0.5s ease;
        `;

        const text = document.createElement('div');
        text.style.cssText = `color: #e8d4f0; font-size: 1.1rem; margin-bottom: 1.5rem; letter-spacing: 1px; line-height: 1.6;`;
        text.textContent = 'Send your request to the garden?';

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

        const unblur = () => {
            if (openBookWrapper) openBookWrapper.style.filter = '';
            if (prompt) prompt.style.filter = '';
            if (backBtn) backBtn.style.filter = '';
            if (bookHelper) bookHelper.style.filter = '';
            if (glow) glow.style.filter = '';
        };

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                unblur();
            }, 500);
            clearTimeout(autoCloseTimer);
        };

        // Auto-dismiss after 8 seconds
        const autoCloseTimer = setTimeout(closeModal, 8000);

        yesBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            yesBtn.style.transform = 'scale(1.12)';
            setTimeout(() => yesBtn.style.transform = '', 200);

            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                this.sendRequest();
            }, 500);
        });

        noBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            Helpers.createButtonFocusEffect(noBtn, closeModal);
        });

        backdrop.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            closeModal();
        });
    },

    // New confirmation that keeps book frozen at swipe position
    showSwipeConfirmation(leftPage) {
        Guardian.poem.onSwipeConfirmShown();

        const openBookWrapper = document.getElementById('openBookWrapper');
        const openBook = document.getElementById('openBook');
        const backBtn = document.getElementById('poemBackBtn');
        const bookHelper = document.getElementById('bookHelper');
        const textarea = document.getElementById('poemTextarea');
        const glow = document.getElementById('glow');

        // Capture the current rotation angle of the left page for seamless animation
        const currentTransform = leftPage.style.transform || '';
        const rotateMatch = currentTransform.match(/rotateY\(([\d.]+)deg\)/);
        this._currentPageRotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;

        // Hide cursor and unfocus typing
        if (openBook) openBook.classList.remove('cursor-visible');
        if (textarea) textarea.blur();

        // Don't blur the book - keep it visible at its frozen position
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (bookHelper) bookHelper.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99; background: rgba(0,0,0,0.3);`;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(26, 10, 26, 0.95); border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px; padding: 30px; z-index: 100; text-align: center;
            max-width: 320px; opacity: 0; transition: opacity 0.3s ease;
        `;

        const text = document.createElement('div');
        text.style.cssText = `color: #e8d4f0; font-size: 1.1rem; margin-bottom: 1.5rem; letter-spacing: 1px; line-height: 1.6;`;
        text.textContent = 'Send your request to the garden?';

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

        const unblur = () => {
            if (backBtn) backBtn.style.filter = '';
            if (bookHelper) bookHelper.style.filter = '';
            if (glow) glow.style.filter = '';
        };

        const resetPage = () => {
            leftPage.style.transition = 'transform 0.4s ease';
            leftPage.style.transform = '';
            leftPage.style.transformOrigin = '';
            setTimeout(() => { leftPage.style.transition = ''; }, 400);
        };

        yesBtn.addEventListener('click', () => {
            Guardian.poem.onSwipeConfirmChoice('yes');

            yesBtn.style.transform = 'scale(1.12)';
            setTimeout(() => yesBtn.style.transform = '', 200);

            modal.style.opacity = '0';
            backdrop.style.opacity = '0';
            backdrop.style.transition = 'opacity 0.3s ease';

            // Keep page at current position - animation will continue from here
            // Don't reset the transform - sendRequest will handle seamless continuation

            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                unblur();
                this.sendRequest();
            }, 300);
        });

        noBtn.addEventListener('click', () => {
            Guardian.poem.onSwipeConfirmChoice('no');

            Helpers.createButtonFocusEffect(noBtn, () => {
                modal.style.opacity = '0';
                backdrop.style.opacity = '0';
                backdrop.style.transition = 'opacity 0.3s ease';
                resetPage();
                setTimeout(() => {
                    modal.remove();
                    backdrop.remove();
                    unblur();
                }, 400);
            });
        });

        backdrop.addEventListener('click', () => {
            Guardian.poem.onSwipeConfirmChoice('dismiss');

            modal.style.opacity = '0';
            backdrop.style.opacity = '0';
            backdrop.style.transition = 'opacity 0.3s ease';
            resetPage();
            setTimeout(() => {
                modal.remove();
                backdrop.remove();
                unblur();
            }, 400);
        });
    },

    sendRequest() {
        const openBookWrapper = document.getElementById('openBookWrapper');
        const openBook = document.getElementById('openBook');
        const prompt = document.getElementById('poemPrompt');
        const backBtn = document.getElementById('poemBackBtn');
        const bookHelper = document.getElementById('bookHelper');
        const textarea = document.getElementById('poemTextarea');
        const glow = document.getElementById('glow');

        // Track successful poem send
        Guardian.poem.complete('submitted', state.poem.currentText);
        Guardian.captureInteraction('send.sequence_start', { type: 'absorbing_pulse' });

        // Store the request locally and submit to backend
        state.poem.requestText = state.poem.currentText;
        state.poem.isPending = true;

        // Submit to backend via PoemState
        PoemState.submitRequest(state.poem.currentText);

        // Disable interactions
        if (backBtn) backBtn.style.pointerEvents = 'none';
        if (bookHelper) {
            bookHelper.classList.remove('visible');
        }
        if (textarea) textarea.disabled = true;

        ParticleSystem.stopWhisperEmbers();

        // Blur everything
        if (openBookWrapper) openBookWrapper.style.filter = 'blur(8px)';
        if (prompt) prompt.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        // Get center position
        const rect = openBook.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Step 1: Absorbing pulse (0ms) - matches whisper
        ParticleSystem.createEnhancedMistyPulse(openBookWrapper, 'absorbing');

        // Step 2: Absorb spiral (0ms)
        ParticleSystem.createAbsorbSpiral(openBookWrapper, 10);

        // Step 3: Inward spiral (500ms)
        setTimeout(() => {
            ParticleSystem.createInwardSpiral(openBookWrapper);
        }, 500);

        // Step 4: Book closing animation while shrinking (500ms)
        setTimeout(() => {
            this.animateBookClosing(openBookWrapper, centerX, centerY);
        }, 500);

        // Step 5: Ascending trail (2000ms)
        setTimeout(() => {
            ParticleSystem.createAscendingTrail(openBookWrapper);
        }, 2000);

        // Step 6: Celebration fireflies (4000ms)
        setTimeout(() => ParticleSystem.createCelebrationFireflies(), 4000);

        // Step 7: Show pending state (4500ms)
        setTimeout(() => this.showPendingState(), 4500);
    },

    animateBookClosing(openBookWrapper, centerX, centerY) {
        const openBook = document.getElementById('openBook');
        const leftPage = document.getElementById('pageLeft');

        if (!openBook || !leftPage) return;

        // Get starting rotation (from swipe confirmation capture, or current transform)
        let startRotation = this._currentPageRotation || 0;
        if (!startRotation) {
            const currentTransform = leftPage.style.transform || '';
            const rotateMatch = currentTransform.match(/rotateY\(([\d.]+)deg\)/);
            startRotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
        }

        // Calculate remaining rotation and adjust duration proportionally
        const remainingRotation = 180 - startRotation;
        const baseDuration = 1000; // 1 second for full 0-180 rotation
        const adjustedDuration = Math.max(400, (remainingRotation / 180) * baseDuration);

        // Create transitional closed book at center
        const transBook = document.createElement('div');
        transBook.id = 'transitionalBook';
        transBook.classList.add('transitional-book');
        transBook.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            width: 120px;
            height: 140px;
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
            z-index: 200;
            pointer-events: none;
        `;
        transBook.innerHTML = this.createClosedBookSVG().outerHTML;
        document.body.appendChild(transBook);

        // Animate left page closing from current position to fully closed
        leftPage.style.transition = `transform ${adjustedDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        leftPage.style.transformOrigin = 'right center';
        leftPage.style.transform = 'rotateY(180deg)';

        // Clear captured rotation
        this._currentPageRotation = 0;

        // Simultaneously shrink open book
        openBookWrapper.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease';
        openBookWrapper.style.transform = 'scale(0.3)';
        openBookWrapper.style.opacity = '0';

        // Fade in transitional closed book
        setTimeout(() => {
            transBook.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
            transBook.style.opacity = '1';
            transBook.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 600);

        // Shrink transitional to pending size
        setTimeout(() => {
            transBook.style.transition = 'transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease';
            transBook.style.transform = 'translate(-50%, -50%) scale(0.5)';
            transBook.style.opacity = '0';
        }, 1800);

        // Cleanup
        setTimeout(() => {
            transBook.remove();
            openBookWrapper.remove();
            const prompt = document.getElementById('poemPrompt');
            if (prompt) prompt.remove();
            const textarea = document.getElementById('poemTextarea');
            if (textarea) textarea.remove();
        }, 3000);
    },

    showPendingState() {
        const poemContainer = document.getElementById('poemContainer');
        const backBtn = document.getElementById('poemBackBtn');
        const existingHelper = document.getElementById('bookHelper');

        // Unblur and reset - ensure back button is visible
        if (backBtn) {
            backBtn.style.filter = '';
            backBtn.style.opacity = '1';
            backBtn.style.pointerEvents = 'auto';
        }

        // Create pending container
        const pendingWrapper = document.createElement('div');
        pendingWrapper.classList.add('pending-wrapper');
        pendingWrapper.id = 'pendingWrapper';

        // Create breathing book icon (same as helper but larger, centered)
        const pendingBook = document.createElement('div');
        pendingBook.classList.add('pending-book', 'breathing');
        pendingBook.id = 'pendingBook';

        // Book icon SVG - same as helper but scaled up
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '1');
        icon.innerHTML = `<path d="M6 16.5A1.5 1.5 0 017.5 15H18M6 16.5v-9A1.5 1.5 0 017.5 6H18v12H7.5A1.5 1.5 0 016 16.5z"/>`;

        pendingBook.appendChild(icon);

        // Pending text
        const pendingText = document.createElement('div');
        pendingText.classList.add('pending-text');
        pendingText.textContent = 'Seeding your poem...';

        pendingWrapper.appendChild(pendingBook);
        pendingWrapper.appendChild(pendingText);

        if (poemContainer) {
            poemContainer.appendChild(pendingWrapper);
        }

        // Hide the corner helper during pending (the centered one takes over)
        if (existingHelper) {
            existingHelper.style.opacity = '0';
            existingHelper.style.pointerEvents = 'none';
        }

        setTimeout(() => {
            pendingWrapper.classList.add('visible');
        }, 100);

        // Make clickable
        pendingBook.addEventListener('click', () => this.showPendingMessage());
    },

    showPendingMessage() {
        const pendingWrapper = document.getElementById('pendingWrapper');
        const backBtn = document.getElementById('poemBackBtn');
        const glow = document.getElementById('glow');

        if (pendingWrapper) pendingWrapper.style.filter = 'blur(8px)';
        if (backBtn) backBtn.style.filter = 'blur(8px)';
        if (glow) glow.style.filter = 'blur(8px)';

        const backdrop = document.createElement('div');
        backdrop.classList.add('help-backdrop');
        backdrop.id = 'pendingMessageBackdrop';

        const modal = document.createElement('div');
        modal.classList.add('help-modal');
        modal.id = 'pendingMessageModal';

        const text = document.createElement('div');
        text.classList.add('help-modal-text');
        text.innerHTML = 'Your words already dance<br>within my heart...<br><br>I\'m still weaving them<br>into something just for you.';

        modal.appendChild(text);
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        setTimeout(() => {
            backdrop.classList.add('visible');
            modal.classList.add('visible');
        }, 100);

        const unblur = () => {
            if (pendingWrapper) pendingWrapper.style.filter = '';
            if (backBtn) backBtn.style.filter = '';
            if (glow) glow.style.filter = '';
        };

        const closeModal = () => {
            backdrop.classList.remove('visible');
            modal.classList.remove('visible');
            unblur();
            setTimeout(() => {
                backdrop.remove();
                modal.remove();
            }, 1000);
        };

        const dismissTimer = setTimeout(closeModal, 8000);

        backdrop.addEventListener('click', () => {
            clearTimeout(dismissTimer);
            closeModal();
        });
    },

    resetPoemState() {
        if (this.agingInterval) {
            clearInterval(this.agingInterval);
            this.agingInterval = null;
        }

        this.letters = [];
        this.lastKeyTime = 0;
        this.bookTilt = { x: 0, y: 0 };
        this.activePage = 'left';
        this.swipeStart = null;
        this.isClosing = false;

        state.poem.currentText = '';
        state.poem.lastLength = 0;
        state.poem.displayedChars = 0;
        // Note: helperCreated is intentionally NOT reset - helper persists within session
    }
};
