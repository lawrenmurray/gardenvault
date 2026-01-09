/* ========================================
   PARTICLE SYSTEM
   All particle effects (embers, fireflies, etc.)
   ======================================== */

const ParticleSystem = {
    // === AMBIENT SYSTEMS (winter twilight theme) ===
    createAmbient() {
        // Create initial stars (static twinkling)
        for (let i = 0; i < 40; i++) {
            const star = document.createElement('div');
            star.classList.add('ambient-particle', 'star');
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            // Vary star brightness
            const brightness = 0.4 + Math.random() * 0.5;
            star.style.opacity = brightness;
            document.body.appendChild(star);
            state.activeParticles.add(star);
        }

        // Continuous gentle snowfall
        setInterval(() => {
            const snowflake = document.createElement('div');
            snowflake.classList.add('ambient-particle', 'snowflake');
            const drift = (Math.random() - 0.5) * 80; // Gentle horizontal drift
            snowflake.style.setProperty('--drift', drift + 'px');
            snowflake.style.left = Math.random() * 100 + '%';
            snowflake.style.top = '-2%';
            snowflake.style.animationDuration = (Math.random() * 4 + 8) + 's'; // 8-12s fall time
            // Subtle size and opacity variation
            const size = 2 + Math.random() * 2; // 2-4px
            snowflake.style.width = size + 'px';
            snowflake.style.height = size + 'px';
            snowflake.style.opacity = 0.3 + Math.random() * 0.4; // 0.3-0.7 soft glow
            document.body.appendChild(snowflake);
            state.activeParticles.add(snowflake);
            setTimeout(() => {
                snowflake.remove();
                state.activeParticles.delete(snowflake);
            }, 14000);
        }, 1000); // One snowflake per second - hushed, not blizzard
    },

    createFirefly(config) {
        const particle = document.createElement('div');
        particle.classList.add('effect-particle');

        particle.style.cssText = `
            left: ${config.x}px;
            top: ${config.y}px;
            width: ${config.size}px;
            height: ${config.size}px;
            background: ${config.color};
            box-shadow: ${config.glow};
        `;

        document.body.appendChild(particle);
        state.activeParticles.add(particle);

        const duration = config.duration || 1800;
        const startTime = Date.now();
        const delay = config.delay || 0;

        function animate() {
            const elapsed = Date.now() - startTime - delay;

            if (elapsed < 0) {
                requestAnimationFrame(animate);
                return;
            }

            const progress = elapsed / duration;

            if (progress < 1) {
                const currentX = config.x + (config.targetX - config.x) * progress;
                const currentY = config.y + (config.targetY - config.y) * progress;

                const pulse = Math.sin(progress * Math.PI * 5);
                const pulseIntensity = 0.6 + pulse * 0.4;

                const baseFade = 1 - progress;
                const opacity = baseFade * pulseIntensity * (config.opacity || 0.5);

                const scale = 0.8 + pulseIntensity * 0.4;

                particle.style.left = currentX + 'px';
                particle.style.top = currentY + 'px';
                particle.style.opacity = opacity;
                particle.style.transform = `translate(-50%, -50%) scale(${scale})`;

                requestAnimationFrame(animate);
            } else {
                particle.remove();
                state.activeParticles.delete(particle);
            }
        }

        requestAnimationFrame(animate);
    },

    createTypingBurst(centerX, centerY) {
        const count = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const distance = 25 + Math.random() * 15;

            this.createFirefly({
                x: centerX,
                y: centerY,
                targetX: centerX + Math.cos(angle) * distance,
                targetY: centerY + Math.sin(angle) * distance,
                size: 3 + Math.random() * 1.5,
                color: 'radial-gradient(circle, rgba(255, 250, 255, 0.7), rgba(220, 200, 240, 0.5))',
                glow: '0 0 10px rgba(230, 215, 245, 0.6)',
                delay: Math.random() * 60
            });
        }
    },

    createTypingFirefly(x, y) {
        const firefly = document.createElement('div');
        firefly.classList.add('typing-firefly');
        firefly.style.left = x + 'px';
        firefly.style.top = y + 'px';

        document.body.appendChild(firefly);
        state.activeParticles.add(firefly);

        const duration = 1500;
        const startTime = Date.now();
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 15;

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const currentX = x + Math.cos(angle) * distance * progress;
                const currentY = y + Math.sin(angle) * distance * progress - (progress * 30);
                const opacity = 1 - progress;

                firefly.style.left = currentX + 'px';
                firefly.style.top = currentY + 'px';
                firefly.style.opacity = opacity;

                requestAnimationFrame(animate);
            } else {
                firefly.remove();
                state.activeParticles.delete(firefly);
            }
        }

        requestAnimationFrame(animate);
    },

    createBloom(rect) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const textWidth = rect.width * 0.7;
        const count = 14 + Math.floor(Math.random() * 4);

        for (let i = 0; i < count; i++) {
            const spreadX = (i / count - 0.5) * textWidth;
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 15;

            this.createFirefly({
                x: centerX + spreadX,
                y: centerY,
                targetX: centerX + spreadX + Math.cos(angle) * distance,
                targetY: centerY + Math.sin(angle) * distance,
                size: 3 + Math.random() * 1.5,
                color: 'radial-gradient(circle, rgba(255, 250, 255, 0.7), rgba(220, 200, 240, 0.5))',
                glow: '0 0 10px rgba(230, 215, 245, 0.6)',
                delay: Math.random() * 60
            });
        }
    },

    createErasure(rect, text, input) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const charCount = text.length;
        const charSpacing = (rect.width * 0.6) / charCount;
        const startX = centerX - (charSpacing * charCount) / 2;

        for (let i = charCount - 1; i >= 0; i--) {
            setTimeout(() => {
                const charX = startX + (i * charSpacing);
                this.createAshBurst(charX, centerY);
                if (input) input.value = input.value.slice(0, -1);
            }, (charCount - 1 - i) * 80);
        }
    },

    createAshBurst(x, y) {
        // Frost dissipation - soft blue-gray motes
        const count = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const distance = 25 + Math.random() * 15;

            this.createFirefly({
                x: x,
                y: y,
                targetX: x + Math.cos(angle) * distance,
                targetY: y + Math.sin(angle) * distance,
                size: 3 + Math.random() * 1.5,
                color: 'radial-gradient(circle, rgba(140, 130, 160, 0.8), rgba(100, 95, 120, 0.6))',
                glow: '0 0 10px rgba(130, 120, 150, 0.7)',
                opacity: 0.6,
                delay: Math.random() * 60
            });
        }
    },

    createMistyPulse(seedWrapper, type) {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const pulse = document.createElement('div');
        pulse.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle,
                ${type === 'initial' ? 'rgba(200, 180, 220, 0.25)' : 'rgba(200, 180, 220, 0.35)'},
                transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 100;
            filter: blur(${type === 'initial' ? '20px' : '25px'});
        `;

        document.body.appendChild(pulse);
        state.activeParticles.add(pulse);

        const duration = type === 'initial' ? 1800 : 2000;
        const maxSize = type === 'initial' ? 140 : 180;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const size = 20 + (progress * maxSize);
                const opacity = 1 - (progress * progress);

                pulse.style.width = size + 'px';
                pulse.style.height = size + 'px';
                pulse.style.left = (centerX - size / 2) + 'px';
                pulse.style.top = (centerY - size / 2) + 'px';
                pulse.style.opacity = opacity;

                requestAnimationFrame(animate);
            } else {
                pulse.remove();
                state.activeParticles.delete(pulse);
            }
        }

        requestAnimationFrame(animate);
    },

    createWispyFirefly(seedWrapper, style) {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const particle = document.createElement('div');
        particle.classList.add('effect-particle');

        const size = style === 'subtle' ? 2 : 3;
        const angleVariation = (Math.random() - 0.5) * Math.PI * 0.6;
        const distance = style === 'subtle' ? 30 : 50;

        particle.style.cssText = `
            left: ${centerX}px;
            top: ${centerY}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle,
                rgba(230, 215, 245, ${style === 'subtle' ? 0.6 : 0.8}),
                rgba(200, 180, 220, ${style === 'subtle' ? 0.3 : 0.5}));
            box-shadow: 0 0 ${style === 'subtle' ? 6 : 10}px rgba(210, 190, 230, 0.6);
            border-radius: 50%;
            filter: blur(1px);
        `;

        document.body.appendChild(particle);
        state.activeParticles.add(particle);

        const duration = style === 'subtle' ? 2200 : 2800;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const drift = Math.sin(progress * Math.PI * 3) * 15;
                const currentX = centerX + drift + (Math.cos(angleVariation) * distance * progress * 0.3);
                const currentY = centerY - (progress * distance * 1.5);

                const pulse = Math.sin(progress * Math.PI * 6) * 0.3 + 0.7;
                const opacity = (1 - progress) * pulse;

                particle.style.left = currentX + 'px';
                particle.style.top = currentY + 'px';
                particle.style.opacity = opacity;

                requestAnimationFrame(animate);
            } else {
                particle.remove();
                state.activeParticles.delete(particle);
            }
        }

        requestAnimationFrame(animate);
    },

    createWhisperEmber(containerRect, intensity = 1) {
        // Twilight frost mote - rising gently like breath in cold air
        const ember = document.createElement('div');
        ember.classList.add('whisper-ember');

        const startX = containerRect.left + Math.random() * containerRect.width;
        const startY = containerRect.bottom + 20;

        ember.style.left = startX + 'px';
        ember.style.top = startY + 'px';

        const opacity = (0.3 + Math.random() * 0.4) * intensity;
        const size = (1.5 + Math.random() * 1) * intensity;
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';

        document.body.appendChild(ember);
        state.activeParticles.add(ember);

        const duration = 4000 + Math.random() * 2000;
        const startTime = Date.now();
        const delay = Math.random() * 500;
        const drift = (Math.random() - 0.5) * 40;

        function animate() {
            const elapsed = Date.now() - startTime - delay;

            if (elapsed < 0) {
                requestAnimationFrame(animate);
                return;
            }

            const progress = elapsed / duration;

            if (progress < 1) {
                const currentY = startY - (progress * 160);
                const currentX = startX + Math.sin(progress * Math.PI * 2) * drift;
                const currentOpacity = opacity * (1 - progress);

                ember.style.top = currentY + 'px';
                ember.style.left = currentX + 'px';
                ember.style.opacity = currentOpacity;

                requestAnimationFrame(animate);
            } else {
                ember.remove();
                state.activeParticles.delete(ember);
            }
        }

        requestAnimationFrame(animate);
    },

    startWhisperEmbers(container, intensity = 1) {
        const rect = container.getBoundingClientRect();
        const baseInterval = 700;
        const interval = baseInterval / intensity;

        if (state.whisper.emberInterval) {
            clearInterval(state.whisper.emberInterval);
        }

        state.whisper.emberInterval = setInterval(() => {
            this.createWhisperEmber(rect, intensity);
        }, interval);
    },

    stopWhisperEmbers() {
        if (state.whisper.emberInterval) {
            clearInterval(state.whisper.emberInterval);
            state.whisper.emberInterval = null;
        }
    },

    stopSeedParticles() {
        if (state.whisper.seedEmberInterval) {
            clearInterval(state.whisper.seedEmberInterval);
            state.whisper.seedEmberInterval = null;
        }
        if (state.whisper.seedFireflyInterval) {
            clearInterval(state.whisper.seedFireflyInterval);
            state.whisper.seedFireflyInterval = null;
        }
    },

    cleanupParticles() {
        if (state.activeParticles.size > 100) {
            const toRemove = Array.from(state.activeParticles).slice(0, 20);
            toRemove.forEach(particle => {
                particle.remove();
                state.activeParticles.delete(particle);
            });
        }
    },

    // === ENHANCED PARTICLE FUNCTIONS ===

    createSeedEmber(seedWrapper, config = {}) {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const ember = document.createElement('div');
        ember.classList.add('seed-ember');

        const size = config.size || (2 + Math.random() * 2);
        const startAngle = config.angle || (Math.random() * Math.PI * 2);
        const startRadius = config.startRadius || (20 + Math.random() * 15);

        const startX = centerX + Math.cos(startAngle) * startRadius;
        const startY = centerY + Math.sin(startAngle) * startRadius;

        // Twilight palette: soft lavender-white with mauve undertones
        ember.style.cssText = `
            left: ${startX}px;
            top: ${startY}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle,
                rgba(${240 + Math.random() * 15}, ${220 + Math.random() * 20}, ${250}, 0.9),
                rgba(${200 + Math.random() * 30}, ${180 + Math.random() * 30}, ${220 + Math.random() * 20}, 0.5));
            box-shadow: 0 0 ${size * 3}px rgba(210, 190, 230, 0.6);
        `;

        document.body.appendChild(ember);
        state.activeParticles.add(ember);

        const duration = config.duration || (2500 + Math.random() * 1500);
        const startTime = Date.now();
        const riseSpeed = config.riseSpeed || (40 + Math.random() * 30);
        const driftAmount = config.drift || ((Math.random() - 0.5) * 60);
        const spiralSpeed = config.spiral || (2 + Math.random() * 2);

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const spiralAngle = startAngle + progress * Math.PI * spiralSpeed;
                const spiralRadius = startRadius * (1 - progress * 0.5);

                const currentX = centerX + Math.cos(spiralAngle) * spiralRadius + driftAmount * progress;
                const currentY = startY - (progress * riseSpeed) + Math.sin(progress * Math.PI * 4) * 5;

                const pulse = Math.sin(progress * Math.PI * 8) * 0.2 + 0.8;
                const fadeOut = 1 - Math.pow(progress, 1.5);
                const opacity = pulse * fadeOut;

                const currentSize = size * (1 + Math.sin(progress * Math.PI * 6) * 0.2);

                ember.style.left = currentX + 'px';
                ember.style.top = currentY + 'px';
                ember.style.opacity = opacity;
                ember.style.width = currentSize + 'px';
                ember.style.height = currentSize + 'px';

                requestAnimationFrame(animate);
            } else {
                ember.remove();
                state.activeParticles.delete(ember);
            }
        }

        requestAnimationFrame(animate);
    },

    createSeedFirefly(seedWrapper, config = {}) {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const firefly = document.createElement('div');
        firefly.classList.add('seed-firefly');

        const size = config.size || (3 + Math.random() * 2);
        const startAngle = config.angle || (Math.random() * Math.PI * 2);
        const orbitRadius = config.radius || (30 + Math.random() * 20);

        // Twilight sparkle: soft white with lavender glow
        firefly.style.cssText = `
            left: ${centerX}px;
            top: ${centerY}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle,
                rgba(255, 255, 255, 0.95),
                rgba(230, 215, 245, 0.6));
            box-shadow:
                0 0 ${size * 2}px rgba(240, 230, 250, 0.8),
                0 0 ${size * 4}px rgba(210, 190, 230, 0.4);
        `;

        document.body.appendChild(firefly);
        state.activeParticles.add(firefly);

        const duration = config.duration || (3000 + Math.random() * 2000);
        const startTime = Date.now();
        const orbitSpeed = config.orbitSpeed || (1 + Math.random());
        const riseSpeed = config.riseSpeed || (50 + Math.random() * 40);

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const currentAngle = startAngle + progress * Math.PI * orbitSpeed * 2;
                const currentRadius = orbitRadius * (1 - progress * 0.3);

                const currentX = centerX + Math.cos(currentAngle) * currentRadius;
                const currentY = centerY - (progress * riseSpeed) + Math.sin(currentAngle) * 10;

                const flicker = Math.random() * 0.3 + 0.7;
                const fadeOut = 1 - Math.pow(progress, 2);
                const opacity = flicker * fadeOut;

                firefly.style.left = currentX + 'px';
                firefly.style.top = currentY + 'px';
                firefly.style.opacity = opacity;

                requestAnimationFrame(animate);
            } else {
                firefly.remove();
                state.activeParticles.delete(firefly);
            }
        }

        requestAnimationFrame(animate);
    },

    createEnhancedMistyPulse(seedWrapper, type = 'standard') {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Twilight palette: soft lavender, mauve, silver tones
        const configs = {
            awakening: { waves: 3, baseSize: 30, maxSize: 180, duration: 2500, color: '200, 180, 220' },
            breathing: { waves: 2, baseSize: 40, maxSize: 150, duration: 2000, color: '210, 190, 230' },
            fullBloom: { waves: 4, baseSize: 50, maxSize: 220, duration: 3000, color: '220, 200, 240' },
            absorbing: { waves: 5, baseSize: 60, maxSize: 250, duration: 1500, color: '230, 215, 245' },
            standard: { waves: 2, baseSize: 30, maxSize: 160, duration: 2000, color: '200, 180, 220' }
        };

        const config = configs[type] || configs.standard;

        for (let wave = 0; wave < config.waves; wave++) {
            setTimeout(() => {
                const pulse = document.createElement('div');
                pulse.style.cssText = `
                    position: fixed;
                    left: ${centerX}px;
                    top: ${centerY}px;
                    width: ${config.baseSize}px;
                    height: ${config.baseSize}px;
                    background: radial-gradient(circle,
                        rgba(${config.color}, ${0.3 - wave * 0.05}),
                        transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: ${100 - wave};
                    filter: blur(${15 + wave * 5}px);
                `;

                document.body.appendChild(pulse);
                state.activeParticles.add(pulse);

                const startTime = Date.now();
                const waveDuration = config.duration * (1 + wave * 0.2);

                function animate() {
                    const elapsed = Date.now() - startTime;
                    const progress = elapsed / waveDuration;

                    if (progress < 1) {
                        const easeProgress = 1 - Math.pow(1 - progress, 3);
                        const size = config.baseSize + (config.maxSize - config.baseSize) * easeProgress;
                        const opacity = (1 - progress) * (1 - wave * 0.15);

                        pulse.style.width = size + 'px';
                        pulse.style.height = size + 'px';
                        pulse.style.left = (centerX - size / 2) + 'px';
                        pulse.style.top = (centerY - size / 2) + 'px';
                        pulse.style.opacity = opacity;

                        requestAnimationFrame(animate);
                    } else {
                        pulse.remove();
                        state.activeParticles.delete(pulse);
                    }
                }

                requestAnimationFrame(animate);
            }, wave * 200);
        }
    },

    createSpiralEmberBurst(seedWrapper, count = 12) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                this.createSeedEmber(seedWrapper, {
                    angle: (i / count) * Math.PI * 2,
                    startRadius: 25 + Math.random() * 10,
                    duration: 2000 + Math.random() * 1000,
                    spiral: 3 + Math.random() * 2,
                    size: 2 + Math.random() * 2
                });
            }, i * 50);
        }
    },

    // V2 absorb spiral (for absorbing text into seed)
    createAbsorbSpiral(seedWrapper, count = 8) {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const angle = (i / count) * Math.PI * 2;
                const startRadius = 80 + Math.random() * 30;

                const particle = document.createElement('div');
                particle.classList.add('effect-particle');

                const startX = centerX + Math.cos(angle) * startRadius;
                const startY = centerY + Math.sin(angle) * startRadius;

                // Twilight absorb: soft white with lavender trail
                particle.style.cssText = `
                    left: ${startX}px;
                    top: ${startY}px;
                    width: 4px;
                    height: 4px;
                    background: radial-gradient(circle, rgba(255, 250, 255, 0.9), rgba(220, 200, 240, 0.5));
                    box-shadow: 0 0 10px rgba(230, 215, 245, 0.7);
                `;

                document.body.appendChild(particle);
                state.activeParticles.add(particle);

                const duration = 800 + Math.random() * 400;
                const startTime = Date.now();

                function animate() {
                    const elapsed = Date.now() - startTime;
                    const progress = elapsed / duration;

                    if (progress < 1) {
                        const easeProgress = progress * progress;
                        const currentRadius = startRadius * (1 - easeProgress);
                        const spiralAngle = angle + easeProgress * Math.PI * 2;

                        const currentX = centerX + Math.cos(spiralAngle) * currentRadius;
                        const currentY = centerY + Math.sin(spiralAngle) * currentRadius;

                        const scale = 1 - easeProgress * 0.5;
                        const opacity = 1 - easeProgress;

                        particle.style.left = currentX + 'px';
                        particle.style.top = currentY + 'px';
                        particle.style.transform = `translate(-50%, -50%) scale(${scale})`;
                        particle.style.opacity = opacity;

                        requestAnimationFrame(animate);
                    } else {
                        particle.remove();
                        state.activeParticles.delete(particle);
                    }
                }

                requestAnimationFrame(animate);
            }, i * 80);
        }
    },

    // V1 send spiral (for sending whispers)
    createInwardSpiral(seedWrapper, callback) {
        const rect = seedWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const angle = (i / 20) * Math.PI * 2;
                const startRadius = 200;
                const startX = centerX + Math.cos(angle) * startRadius;
                const startY = centerY + Math.sin(angle) * startRadius;

                const particle = document.createElement('div');
                particle.className = 'seed-firefly';
                particle.style.left = startX + 'px';
                particle.style.top = startY + 'px';
                document.body.appendChild(particle);
                state.activeParticles.add(particle);

                particle.animate([
                    { left: startX + 'px', top: startY + 'px', opacity: 1 },
                    { left: centerX + 'px', top: centerY + 'px', opacity: 0 }
                ], { duration: 1000, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });

                setTimeout(() => {
                    particle.remove();
                    state.activeParticles.delete(particle);
                }, 1000);
            }, i * 50);
        }
        if (callback) setTimeout(callback, 1000);
    },

    createAscendingTrail(seedWrapper) {
        const self = this;
        let trailCount = 0;
        const trailInterval = setInterval(() => {
            self.createSeedEmber(seedWrapper);
            self.createSeedFirefly(seedWrapper, 20);
            trailCount++;
            if (trailCount > 15) clearInterval(trailInterval);
        }, 100);
    },

    createCelebrationFireflies() {
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const firefly = document.createElement('div');
                firefly.className = 'seed-firefly';
                firefly.style.left = Math.random() * window.innerWidth + 'px';
                firefly.style.top = Math.random() * window.innerHeight + 'px';
                document.body.appendChild(firefly);
                state.activeParticles.add(firefly);

                const duration = 2000 + Math.random() * 2000;
                firefly.animate([
                    { opacity: 0, transform: 'scale(0)' },
                    { opacity: 0.8, transform: 'scale(1)', offset: 0.3 },
                    { opacity: 0, transform: 'scale(0.5) translateY(-30px)' }
                ], { duration, easing: 'ease-out' });

                setTimeout(() => {
                    firefly.remove();
                    state.activeParticles.delete(firefly);
                }, duration);
            }, i * 100);
        }
    }
};
