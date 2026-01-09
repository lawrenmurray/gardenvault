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
            { text: 'Private Poems', handler: () => this.showPrivatePoems() },
            { text: 'Request a Poem', handler: () => PoemSection.show() },
            { text: 'Plant a Whisper', handler: () => WhisperSection.show() }
        ];

        options.forEach(opt => {
            const option = document.createElement('div');
            option.classList.add('menu-option');
            option.textContent = opt.text;
            option.addEventListener('click', () => {
                Guardian.menu.onIntentSelected(opt.text);
                Helpers.createButtonFocusEffect(option, opt.handler);
            });
            menu.appendChild(option);
        });

        document.body.appendChild(menu);
        setTimeout(() => menu.classList.add('visible'), 100);

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
    },

    showPlaceholder(sectionName) {
        const menu = document.getElementById('mainMenu');
        const helpIcon = document.getElementById('helpIcon');
        if (menu) menu.classList.remove('visible');
        if (helpIcon) helpIcon.classList.remove('visible');

        const placeholder = document.createElement('div');
        placeholder.classList.add('placeholder-screen');
        placeholder.id = 'placeholderScreen';

        const text = document.createElement('div');
        text.classList.add('placeholder-text');
        text.textContent = `${sectionName}\nComing soon...`;

        const backBtn = document.createElement('button');
        backBtn.classList.add('back-button');
        backBtn.textContent = '← Return';
        backBtn.addEventListener('click', () => {
            Helpers.createButtonFocusEffect(backBtn, () => {
                placeholder.classList.remove('visible');
                setTimeout(() => {
                    placeholder.remove();
                    if (menu) menu.classList.add('visible');
                    if (helpIcon) helpIcon.classList.add('visible');
                }, 500);
            });
        });

        placeholder.appendChild(backBtn);
        placeholder.appendChild(text);
        document.body.appendChild(placeholder);

        setTimeout(() => placeholder.classList.add('visible'), 100);
    },

    showPrivatePoems() {
        const menu = document.getElementById('mainMenu');
        const helpIcon = document.getElementById('helpIcon');
        if (menu) menu.classList.remove('visible');
        if (helpIcon) helpIcon.classList.remove('visible');

        const placeholder = document.createElement('div');
        placeholder.classList.add('placeholder-screen');
        placeholder.id = 'privatePoemsScreen';

        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 320px;
            background: rgba(26, 10, 10, 0.95);
            border: 1px solid rgba(200, 180, 220, 0.3);
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 0 40px rgba(200, 180, 220, 0.2);
            text-align: center;
        `;

        const text = document.createElement('div');
        text.style.cssText = `
            color: #e8d4f0;
            font-size: 1rem;
            line-height: 1.6;
            letter-spacing: 1px;
        `;
        text.innerHTML = 'Your private garden.<br><br>Request a poem and watch it bloom here.';

        emptyState.appendChild(text);
        placeholder.appendChild(emptyState);

        const backBtn = document.createElement('button');
        backBtn.classList.add('back-button');
        backBtn.textContent = '← Return';
        backBtn.addEventListener('click', () => {
            Helpers.createButtonFocusEffect(backBtn, () => {
                placeholder.classList.remove('visible');
                setTimeout(() => {
                    placeholder.remove();
                    if (menu) menu.classList.add('visible');
                    if (helpIcon) helpIcon.classList.add('visible');
                }, 500);
            });
        });

        placeholder.appendChild(backBtn);
        document.body.appendChild(placeholder);

        setTimeout(() => placeholder.classList.add('visible'), 100);
    }
};
