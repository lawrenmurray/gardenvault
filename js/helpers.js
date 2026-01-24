/* ========================================
   HELPERS
   Utility functions
   ======================================== */

const Helpers = {
    /**
     * Wait for mobile keyboard to dismiss and viewport to stabilize before firing effects.
     * Uses visualViewport API for real-time detection, with fallback for older browsers.
     *
     * Key insight: On mobile, inputs are typically centered in the viewport. When keyboard
     * dismisses, the element stays at the same DOM position but getBoundingClientRect()
     * returns different values as viewport height changes. We capture the element's
     * position relative to viewport center BEFORE blur, then reconstruct it AFTER.
     *
     * @param {HTMLElement} element - The element to blur (triggers keyboard dismiss)
     * @param {Function} callback - Called with stabilized element rect: callback(rect)
     */
    afterKeyboardDismiss(element, callback) {
        // Desktop: no keyboard, fire immediately
        if (window.innerWidth > 768) {
            if (element && element.blur) element.blur();
            requestAnimationFrame(() => {
                callback(element ? element.getBoundingClientRect() : null);
            });
            return;
        }

        // Mobile: capture element position BEFORE keyboard dismisses
        // Store position relative to viewport center (which is stable across keyboard changes)
        const preBlurRect = element ? element.getBoundingClientRect() : null;
        const vv = window.visualViewport;

        // Calculate element center relative to visible viewport center
        let relativeOffsetY = 0;
        if (preBlurRect && vv) {
            const viewportCenterY = vv.height / 2 + vv.offsetTop;
            const elementCenterY = preBlurRect.top + preBlurRect.height / 2;
            relativeOffsetY = elementCenterY - viewportCenterY;
        }

        if (vv) {
            // Modern approach: use visualViewport resize event
            let stableCount = 0;
            let lastHeight = vv.height;
            let checkInterval;
            let timeout;

            const cleanup = () => {
                if (checkInterval) clearInterval(checkInterval);
                if (timeout) clearTimeout(timeout);
            };

            const fireCallback = () => {
                cleanup();
                requestAnimationFrame(() => {
                    if (!element || !preBlurRect) {
                        callback(null);
                        return;
                    }

                    // Reconstruct rect at the same relative position in new viewport
                    // Element stays at same offset from viewport center
                    const newViewportCenterY = vv.height / 2 + vv.offsetTop;
                    const newCenterY = newViewportCenterY + relativeOffsetY;
                    const newTop = newCenterY - preBlurRect.height / 2;

                    // Create synthetic rect with corrected position
                    // X position doesn't change (keyboard only affects height)
                    const correctedRect = {
                        left: preBlurRect.left,
                        right: preBlurRect.right,
                        width: preBlurRect.width,
                        height: preBlurRect.height,
                        top: newTop,
                        bottom: newTop + preBlurRect.height,
                        x: preBlurRect.x,
                        y: newTop
                    };

                    callback(correctedRect);
                });
            };

            // Blur first to trigger keyboard dismiss
            if (element && element.blur) element.blur();

            // Poll for viewport stability (height stops changing)
            checkInterval = setInterval(() => {
                if (Math.abs(vv.height - lastHeight) < 2) {
                    stableCount++;
                    if (stableCount >= 3) {
                        // Viewport stable for 3 checks (~150ms)
                        fireCallback();
                    }
                } else {
                    stableCount = 0;
                    lastHeight = vv.height;
                }
            }, 50);

            // Fallback timeout - don't wait forever
            timeout = setTimeout(fireCallback, 400);

        } else {
            // Fallback for browsers without visualViewport
            if (element && element.blur) element.blur();
            setTimeout(() => {
                callback(element ? element.getBoundingClientRect() : null);
            }, 350);
        }
    },

    /**
     * Get element position after keyboard dismisses, then fire effect.
     * Convenience wrapper for common bloom/erasure pattern.
     * @param {HTMLElement} element - Input element to blur
     * @param {Function} effectFn - Effect function that takes rect: effectFn(rect)
     */
    fireEffectAfterKeyboard(element, effectFn) {
        this.afterKeyboardDismiss(element, (rect) => {
            if (rect) effectFn(rect);
        });
    },

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
