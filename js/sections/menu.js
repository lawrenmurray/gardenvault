/* ========================================
   MENU
   Main menu and navigation
   ======================================== */

const Menu = {
    show() {
        // Track menu open
        Guardian.menu.onShow();

        const menu = document.createElement('div');
        menu.classList.add('menu');
        menu.id = 'mainMenu';

        const options = [
            { text: 'Private Poems', handler: () => PrivatePoems.show() },
            { text: 'Request a Poem', id: 'requestPoemCta', handler: () => PoemSection.show() },
            { text: 'Plant a Whisper', handler: () => WhisperSection.show() }
        ];

        options.forEach(opt => {
            const option = document.createElement('div');
            option.classList.add('menu-option');
            option.textContent = opt.text;
            if (opt.id) option.id = opt.id;
            option.addEventListener('click', () => {
                // Allow navigation even when pending - poem section shows pending state
                Guardian.menu.onIntentSelected(opt.text);
                Helpers.createButtonFocusEffect(option, opt.handler);
            });
            menu.appendChild(option);
        });

        document.body.appendChild(menu);
        setTimeout(() => menu.classList.add('visible'), 100);

        // Fetch state and update request CTA
        // Also sync any unsent local requests to backend
        PoemState.fetchState(() => {
            // If local state has a pending request that backend doesn't know about, submit it
            // Guard: only submit once per session to prevent resubmission loops
            if (state.poem.isPending && state.poem.requestText && !PoemState.isRequestPending()) {
                if (!sessionStorage.getItem('gv_poem_request_submitted')) {
                    sessionStorage.setItem('gv_poem_request_submitted', '1');
                    PoemState.submitRequest(state.poem.requestText);
                }
            }
            const requestCta = document.getElementById('requestPoemCta');
            PoemState.updateRequestCta(requestCta);
        });

        this.showHelpIcon();
    },

    showHelpIcon() {
        const helpIcon = document.createElement('div');
        helpIcon.classList.add('help-icon');
        helpIcon.id = 'helpIcon';
        helpIcon.textContent = '?';
        helpIcon.addEventListener('click', () => this.showHelpModal());

        document.body.appendChild(helpIcon);
        setTimeout(() => helpIcon.classList.add('visible'), 500);
    },

    showHelpModal() {
        Guardian.menu.onHelpOpen();

        const backdrop = document.createElement('div');
        backdrop.classList.add('help-backdrop');
        backdrop.id = 'helpBackdrop';

        const modal = document.createElement('div');
        modal.classList.add('help-modal');
        modal.id = 'helpModal';

        const text = document.createElement('div');
        text.classList.add('help-modal-text');
        text.innerHTML = 'Now that you know the way...<br><br>If you\'d like to skip ahead next time, just answer <em>pearls</em> when asked what to call you. The garden will remember.';

        modal.appendChild(text);
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        setTimeout(() => {
            backdrop.classList.add('visible');
            modal.classList.add('visible');
        }, 100);

        const dismissTimer = setTimeout(() => this.closeHelpModal(), 8000);

        backdrop.addEventListener('click', () => {
            clearTimeout(dismissTimer);
            this.closeHelpModal();
        });

        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                clearTimeout(dismissTimer);
                Menu.closeHelpModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    },

    closeHelpModal() {
        Guardian.menu.onHelpClose();

        const backdrop = document.getElementById('helpBackdrop');
        const modal = document.getElementById('helpModal');

        if (backdrop) backdrop.classList.remove('visible');
        if (modal) modal.classList.remove('visible');

        setTimeout(() => {
            if (backdrop) backdrop.remove();
            if (modal) modal.remove();
        }, 1000);
    }
};
