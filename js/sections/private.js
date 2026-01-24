/* ========================================
   PRIVATE POEMS
   Private Poems screen UI
   ======================================== */

const PrivatePoems = {

    show() {
        const menu = document.getElementById('mainMenu');
        const helpIcon = document.getElementById('helpIcon');
        if (menu) menu.classList.remove('visible');
        if (helpIcon) helpIcon.classList.remove('visible');

        const screen = document.createElement('div');
        screen.classList.add('placeholder-screen');
        screen.id = 'privatePoemsScreen';

        const contentContainer = document.createElement('div');
        contentContainer.id = 'privatePoemsContent';
        contentContainer.style.cssText = `
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

        // Empty state text (visible by default, hidden only when poems exist)
        const text = document.createElement('div');
        text.id = 'privatePoemsEmptyText';
        text.style.cssText = `
            color: #e8d4f0;
            font-size: 1rem;
            line-height: 1.6;
            letter-spacing: 1px;
        `;
        text.innerHTML = 'Your private garden.<br><br>Request a poem and watch it bloom here.';

        contentContainer.appendChild(text);
        screen.appendChild(contentContainer);

        const backBtn = document.createElement('button');
        backBtn.classList.add('back-button');
        backBtn.textContent = '← Return';
        backBtn.addEventListener('click', () => {
            Helpers.createButtonFocusEffect(backBtn, () => {
                screen.classList.remove('visible');
                setTimeout(() => {
                    screen.remove();
                    if (menu) menu.classList.add('visible');
                    if (helpIcon) helpIcon.classList.add('visible');
                }, 500);
            });
        });

        screen.appendChild(backBtn);
        document.body.appendChild(screen);

        setTimeout(() => screen.classList.add('visible'), 100);

        // Check for cached poems first - render immediately if available
        const cachedPoems = PoemState.getPoems();
        if (cachedPoems.length > 0) {
            this.render(contentContainer);
        }

        // Fetch fresh data and re-render (handles new poems and shows empty state if needed)
        PoemState.fetchState((err) => {
            this.render(contentContainer);
        });
    },

    render(containerEl) {
        if (!containerEl) return;

        const poems = PoemState.getPoems();
        const emptyText = document.getElementById('privatePoemsEmptyText');

        // If no poems, keep empty state visible
        if (poems.length === 0) {
            if (emptyText) emptyText.style.display = '';
            return;
        }

        // Hide empty state text when poems exist
        if (emptyText) emptyText.style.display = 'none';

        // Remove any existing tiles wrapper
        const existingWrapper = containerEl.querySelector('.poem-tiles-wrapper');
        if (existingWrapper) existingWrapper.remove();

        const tilesWrapper = document.createElement('div');
        tilesWrapper.className = 'poem-tiles-wrapper';
        tilesWrapper.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'gap: 12px',
            'width: 100%',
            'max-width: 320px',
            'margin: 0 auto'
        ].join(';');

        poems.forEach((poem, index) => {
            const tile = this.createPoemTile(poem, index);
            tilesWrapper.appendChild(tile);
        });

        containerEl.appendChild(tilesWrapper);
    },

    createPoemTile(poem, index) {
        const tile = document.createElement('div');
        tile.className = 'poem-tile';
        tile.dataset.poemIndex = index;
        tile.style.cssText = [
            'background: rgba(26, 10, 26, 0.85)',
            'border: 1px solid rgba(200, 180, 220, 0.3)',
            'border-radius: 8px',
            'padding: 16px 20px',
            'cursor: pointer',
            'transition: all 0.3s ease',
            'text-align: left'
        ].join(';');

        const title = document.createElement('div');
        title.className = 'poem-tile-title';
        title.textContent = poem.title || 'Untitled';
        title.style.cssText = [
            'color: #e8d4f0',
            'font-size: 1.1rem',
            'letter-spacing: 1px',
            'font-weight: 400'
        ].join(';');

        tile.appendChild(title);

        // Hover effects
        tile.addEventListener('mouseenter', function() {
            tile.style.background = 'rgba(40, 20, 40, 0.9)';
            tile.style.borderColor = 'rgba(200, 180, 220, 0.5)';
            tile.style.boxShadow = '0 0 20px rgba(200, 180, 220, 0.15)';
        });

        tile.addEventListener('mouseleave', function() {
            tile.style.background = 'rgba(26, 10, 26, 0.85)';
            tile.style.borderColor = 'rgba(200, 180, 220, 0.3)';
            tile.style.boxShadow = 'none';
        });

        // Click to open poem
        tile.addEventListener('click', () => {
            this.showPoemDetail(poem);
        });

        return tile;
    },

    showPoemDetail(poem) {
        // Blur background
        const screen = document.getElementById('privatePoemsScreen');
        if (screen) screen.style.filter = 'blur(8px)';

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'poem-detail-backdrop';
        backdrop.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'width: 100%',
            'height: 100%',
            'z-index: 99',
            'background: rgba(0, 0, 0, 0.4)',
            'opacity: 0',
            'transition: opacity 0.3s ease'
        ].join(';');

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'poem-detail-modal';
        modal.style.cssText = [
            'position: fixed',
            'top: 50%',
            'left: 50%',
            'transform: translate(-50%, -50%)',
            'background: rgba(26, 10, 26, 0.98)',
            'border: 1px solid rgba(200, 180, 220, 0.4)',
            'border-radius: 12px',
            'padding: 30px',
            'max-width: 90%',
            'max-height: 80vh',
            'width: 400px',
            'overflow-y: auto',
            'z-index: 100',
            'opacity: 0',
            'transition: opacity 0.3s ease',
            'box-shadow: 0 0 60px rgba(200, 180, 220, 0.25)'
        ].join(';');

        // Title
        const titleEl = document.createElement('div');
        titleEl.className = 'poem-detail-title';
        titleEl.textContent = poem.title || 'Untitled';
        titleEl.style.cssText = [
            'color: #e8d4f0',
            'font-size: 1.3rem',
            'letter-spacing: 2px',
            'margin-bottom: 20px',
            'text-align: center',
            'font-weight: 400'
        ].join(';');

        // Body
        const bodyEl = document.createElement('div');
        bodyEl.className = 'poem-detail-body';
        bodyEl.style.cssText = [
            'color: #d4c4e0',
            'font-size: 1rem',
            'line-height: 1.8',
            'white-space: pre-wrap',
            'font-family: "Cormorant Garamond", Georgia, serif',
            'font-style: italic'
        ].join(';');
        bodyEl.innerHTML = poem.html || poem.body || '';

        modal.appendChild(titleEl);
        modal.appendChild(bodyEl);

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        // Fade in
        requestAnimationFrame(function() {
            backdrop.style.opacity = '1';
            modal.style.opacity = '1';
        });

        // Close handlers
        function closeModal() {
            backdrop.style.opacity = '0';
            modal.style.opacity = '0';
            if (screen) screen.style.filter = '';
            setTimeout(function() {
                backdrop.remove();
                modal.remove();
            }, 300);
        }

        backdrop.addEventListener('click', function() {
            clearTimeout(dismissTimer);
            closeModal();
        });

        // Auto-dismiss after 30s
        const dismissTimer = setTimeout(closeModal, 30000);
    }
};

window.PrivatePoems = PrivatePoems;
