/* ========================================
   HELPERS
   Utility functions
   ======================================== */

const Helpers = {
    getInputCharacterPosition(input) {
        const rect = input.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const text = input.value;
        const charWidth = 12;
        const textWidth = text.length * charWidth;
        const lastCharX = centerX + (textWidth / 2) - charWidth;

        return { x: lastCharX, y: centerY };
    },

    getTextareaCharacterPosition(textarea) {
        let mirror = document.getElementById('textareaMirror');
        if (!mirror) {
            mirror = document.createElement('div');
            mirror.id = 'textareaMirror';
            mirror.className = 'measure-span-whisper';
            document.body.appendChild(mirror);
        }

        const textareaRect = textarea.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(textarea);

        mirror.style.width = textareaRect.width + 'px';
        mirror.style.fontSize = computedStyle.fontSize;
        mirror.style.fontFamily = computedStyle.fontFamily;
        mirror.style.fontWeight = computedStyle.fontWeight;
        mirror.style.lineHeight = computedStyle.lineHeight;
        mirror.style.letterSpacing = computedStyle.letterSpacing;
        mirror.style.padding = computedStyle.padding;
        mirror.style.paddingLeft = computedStyle.paddingLeft;
        mirror.style.paddingRight = computedStyle.paddingRight;
        mirror.style.paddingTop = computedStyle.paddingTop;
        mirror.style.paddingBottom = computedStyle.paddingBottom;
        mirror.style.textAlign = computedStyle.textAlign;
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        mirror.style.boxSizing = computedStyle.boxSizing;
        mirror.style.border = '0px';

        const textBeforeCursor = textarea.value.substring(0, textarea.selectionEnd || textarea.value.length);
        mirror.textContent = textBeforeCursor;

        const marker = document.createElement('span');
        marker.textContent = '|';
        marker.style.display = 'inline';
        mirror.appendChild(marker);

        const markerRect = marker.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();

        const relativeX = markerRect.left - mirrorRect.left;
        const relativeY = markerRect.top - mirrorRect.top + (markerRect.height / 2);

        const scrollTop = textarea.scrollTop || 0;

        return {
            x: textareaRect.left + relativeX,
            y: textareaRect.top + relativeY - scrollTop
        };
    },

    createButtonFocusEffect(button, callback) {
        const parent = button.parentElement;

        Array.from(parent.children).forEach(child => {
            if (child !== button) {
                child.style.filter = 'blur(8px)';
                child.style.transition = 'filter 0.4s ease';
            }
        });

        button.style.transform = 'scale(1.12)';
        button.style.transition = 'transform 0.3s ease';
        button.style.filter = 'none';

        setTimeout(() => {
            Array.from(parent.children).forEach(child => {
                if (child !== button) child.style.filter = '';
            });
            button.style.transform = '';
            // 2025 Mobile Chrome fix: Use requestAnimationFrame to defer callback
            // This prevents the "redraw race condition" where Chrome cancels navigation
            // by ensuring the browser registers the intent before hiding the module
            setTimeout(() => {
                if (callback) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            callback();
                        });
                    });
                }
            }, 200);
        }, 500);
    }
};
