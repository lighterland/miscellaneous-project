// Game Logic & State Manager
// Operatsiya: Prosti, Zulya!

class GameController {
    constructor() {
        this.rageLevel = 99;
        this.locksCount = 3;
        this.stage = 'intro'; // 'intro', 'bribes', 'final', 'victory'
        this.usedItems = new Set();
        this.candleBlown = false;

        this.initDOMElements();
        this.initEventListeners();
        this.renderLocks();
        this.updateRageHUD();
        this.initConfetti();
    }

    initDOMElements() {
        // HUD
        this.ragePercentEl = document.getElementById('rage-percent');
        this.rageBarFillEl = document.getElementById('rage-bar-fill');
        this.btnAudio = document.getElementById('btn-audio');
        this.btnInfo = document.getElementById('btn-info');

        // Yurt & Door
        this.yurtContainer = document.getElementById('yurt-container');
        this.doorLeaf = document.getElementById('door-leaf');
        this.yurtDoor = document.getElementById('yurt-door');
        this.padlocksRack = document.getElementById('padlocks-rack');
        this.intercomUnit = document.getElementById('intercom-unit');
        this.zulyaPeeker = document.getElementById('zulya-peeker');
        this.projectile = document.getElementById('projectile');
        this.horseEasterEgg = document.getElementById('horse-easter-egg');

        // Inventory
        this.itemCake = document.getElementById('item-cake');
        this.itemTea = document.getElementById('item-tea');
        this.itemFlowers = document.getElementById('item-flowers');
        this.invHint = document.getElementById('inv-hint');

        // Modals
        this.dialogModal = document.getElementById('dialog-modal');
        this.dialogTextRu = document.getElementById('dialog-text-ru');
        this.dialogTextEn = document.getElementById('dialog-text-en');
        this.dialogOptions = document.getElementById('dialog-options');
        this.dialogFeedback = document.getElementById('dialog-feedback');
        this.feedbackTextRu = document.getElementById('feedback-text-ru');
        this.feedbackTextEn = document.getElementById('feedback-text-en');
        this.btnFeedbackContinue = document.getElementById('btn-feedback-continue');
        this.speakerAvatar = document.getElementById('speaker-avatar');

        this.infoModal = document.getElementById('info-modal');
        this.btnCloseInfo = document.getElementById('btn-close-info');

        this.finaleModal = document.getElementById('finale-modal');
        this.cakeWidget = document.getElementById('cake-widget');
        this.candleFlame = document.getElementById('candle-flame');
        this.cakeHint = document.getElementById('cake-hint');
        this.btnReConfetti = document.getElementById('btn-re-confetti');
        this.btnRestartGame = document.getElementById('btn-restart-game');

        this.confettiCanvas = document.getElementById('confetti-canvas');
    }

    initEventListeners() {
        // Audio Toggle
        this.btnAudio.addEventListener('click', () => {
            const isMuted = window.soundEngine.toggleMute();
            this.btnAudio.textContent = isMuted ? '🔇' : '🔊';
        });

        // Info Modal
        this.btnInfo.addEventListener('click', () => {
            window.soundEngine.playIntercomBeep();
            this.infoModal.classList.add('active');
        });
        this.btnCloseInfo.addEventListener('click', () => {
            this.infoModal.classList.remove('active');
        });

        // Intercom & Door Clicks
        this.intercomUnit.addEventListener('click', () => this.handleIntercomCall());
        this.yurtDoor.addEventListener('click', () => {
            if (this.stage === 'victory') return;
            window.soundEngine.playKnock();
            this.handleIntercomCall();
        });

        // Inventory Items
        this.itemCake.addEventListener('click', () => this.handleOfferItem('cake'));
        this.itemTea.addEventListener('click', () => this.handleOfferItem('tea'));
        this.itemFlowers.addEventListener('click', () => this.handleOfferItem('flowers'));

        // Dialog Feedback Continue
        this.btnFeedbackContinue.addEventListener('click', () => {
            this.dialogFeedback.classList.remove('active');
            this.dialogModal.classList.remove('active');

            if (this.stage === 'victory') {
                setTimeout(() => this.triggerVictorySequence(), 400);
            }
        });

        // Finale Cake & Candle
        this.cakeWidget.addEventListener('click', () => this.blowCandle());
        this.btnReConfetti.addEventListener('click', () => {
            window.soundEngine.init();
            if (window.soundEngine.muted) {
                window.soundEngine.muted = false;
                this.btnAudio.textContent = '🔊';
            }
            window.soundEngine.playBirthdayFanfare();
            this.spawnConfettiBurst();
        });
        this.btnRestartGame.addEventListener('click', () => location.reload());

        // Horse Easter Egg
        if (this.horseEasterEgg) {
            this.horseEasterEgg.addEventListener('click', () => {
                window.soundEngine.playChime();
                this.horseEasterEgg.style.transform = 'translateY(-14px) scale(1.3) rotate(-10deg)';
                setTimeout(() => {
                    this.horseEasterEgg.style.transform = '';
                }, 500);
            });
        }
    }

    updateRageHUD() {
        const clampedRage = Math.max(0, Math.min(100, this.rageLevel));
        this.rageBarFillEl.style.width = `${clampedRage}%`;

        let emoji = '💥 (В ярости!)';
        if (clampedRage <= 0) {
            emoji = '🥰 0% (Простила и счастлива!)';
            this.rageBarFillEl.style.background = 'linear-gradient(90deg, #52b788, #74c69d)';
        } else if (clampedRage < 35) {
            emoji = `😊 ${clampedRage}% (Сердце тает...)`;
            this.rageBarFillEl.style.background = 'linear-gradient(90deg, #52b788, #ffd166)';
        } else if (clampedRage < 70) {
            emoji = `🤨 ${clampedRage}% (Ещё сомневается)`;
            this.rageBarFillEl.style.background = 'linear-gradient(90deg, #ffd166, #f77f00)';
        } else {
            emoji = `💥 ${clampedRage}% (В ярости!)`;
            this.rageBarFillEl.style.background = 'linear-gradient(90deg, #f77f00, #d90429)';
        }

        this.ragePercentEl.textContent = emoji;
    }

    renderLocks() {
        this.padlocksRack.innerHTML = '';
        for (let i = 0; i < this.locksCount; i++) {
            const lock = document.createElement('span');
            lock.className = 'padlock';
            lock.textContent = '🔒';
            this.padlocksRack.appendChild(lock);
        }
    }

    removeOneLock() {
        if (this.locksCount > 0) {
            this.locksCount--;
            window.soundEngine.playSuccessDing();
            const locks = this.padlocksRack.querySelectorAll('.padlock');
            if (locks.length > 0) {
                const last = locks[locks.length - 1];
                last.classList.add('unlocking');
                setTimeout(() => this.renderLocks(), 300);
            }
        }
    }

    addOneLock() {
        if (this.locksCount < 6) {
            this.locksCount++;
            window.soundEngine.playPadlockClank();
            this.renderLocks();
        }
    }

    triggerSlipperThrow(type = 'tapok') {
        const itemEmoji = type === 'gutal' ? '👢' : '🩴';
        this.projectile.textContent = itemEmoji;

        // Show Zulya peeker
        this.zulyaPeeker.classList.add('visible');

        // Play SFX & fly
        window.soundEngine.playSlipperWhack();
        this.projectile.classList.remove('flying');
        void this.projectile.offsetWidth; // Force reflow
        this.projectile.classList.add('flying');

        // Shake effects
        setTimeout(() => {
            document.body.classList.add('screen-shake');
            this.yurtContainer.classList.add('yurt-shake');
            setTimeout(() => {
                document.body.classList.remove('screen-shake');
                this.yurtContainer.classList.remove('yurt-shake');
                this.zulyaPeeker.classList.remove('visible');
            }, 500);
        }, 220);
    }

    handleIntercomCall() {
        window.soundEngine.playIntercomBeep();

        if (this.stage === 'intro') {
            this.showDialogue(window.GAME_DIALOGUES.intro);
        } else if (this.stage === 'bribes') {
            if (this.usedItems.size === 3 || this.locksCount <= 1) {
                this.stage = 'final';
                this.showDialogue(window.GAME_DIALOGUES.stage_final_question);
            } else {
                this.showDialogue(window.GAME_DIALOGUES.stage_bribe);
            }
        } else if (this.stage === 'final') {
            this.showDialogue(window.GAME_DIALOGUES.stage_final_question);
        }
    }

    handleOfferItem(itemKey) {
        if (this.usedItems.has(itemKey)) return;

        window.soundEngine.playChime();
        this.usedItems.add(itemKey);

        const card = document.getElementById(`item-${itemKey}`);
        if (card) card.classList.add('used');

        const itemData = window.GAME_DIALOGUES.items[itemKey];
        if (!itemData) return;

        // Apply item effect
        this.rageLevel = Math.max(10, this.rageLevel + itemData.rageDelta);
        this.updateRageHUD();
        this.removeOneLock();

        // Show dialogue reaction
        this.showItemReaction(itemData);

        // Advance stage if needed
        if (this.stage === 'intro') {
            this.stage = 'bribes';
        }

        if (this.usedItems.size >= 2 && this.locksCount <= 1) {
            this.stage = 'final';
            this.invHint.textContent = "⚡ Зуля готова слушать! Нажми на домофон!";
            this.intercomUnit.style.animation = 'pulseBorder 1.2s infinite';
        }
    }

    showDialogue(dialogueObj) {
        this.dialogFeedback.classList.remove('active');
        this.dialogOptions.style.display = 'flex';
        this.dialogOptions.innerHTML = '';

        this.dialogTextRu.textContent = dialogueObj.textRu;
        this.dialogTextEn.textContent = dialogueObj.textEn;

        // Avatar expression
        if (dialogueObj.mood === 'furious') this.speakerAvatar.textContent = '😠';
        else if (dialogueObj.mood === 'suspicious') this.speakerAvatar.textContent = '🧐';
        else if (dialogueObj.mood === 'soft') this.speakerAvatar.textContent = '🥺';
        else this.speakerAvatar.textContent = '🥰';

        if (dialogueObj.options && dialogueObj.options.length > 0) {
            dialogueObj.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerHTML = `
                    <span class="option-text-ru">${opt.textRu}</span>
                    <span class="option-text-en">${opt.textEn}</span>
                `;
                btn.addEventListener('click', () => this.handleOptionSelected(opt));
                this.dialogOptions.appendChild(btn);
            });
        } else {
            // Hint button or close
            const btn = document.createElement('button');
            btn.className = 'btn-continue';
            btn.textContent = 'Выбрать мирное подношение внизу 👇';
            btn.addEventListener('click', () => {
                this.dialogModal.classList.remove('active');
            });
            this.dialogOptions.appendChild(btn);
        }

        this.dialogModal.classList.add('active');
    }

    showItemReaction(itemData) {
        this.dialogFeedback.classList.remove('active');
        this.dialogOptions.style.display = 'flex';
        this.dialogOptions.innerHTML = '';

        this.speakerAvatar.textContent = '😋';
        this.dialogTextRu.textContent = `Подношение принято: ${itemData.nameRu}`;
        this.dialogTextEn.textContent = itemData.descEn;

        const reactionBox = document.createElement('div');
        reactionBox.className = 'dialog-feedback-box active';
        reactionBox.style.background = '#e7f5ff';
        reactionBox.style.borderColor = '#a5d8ff';
        reactionBox.innerHTML = `
            <p class="feedback-text-ru" style="color: #1971c2;">${itemData.reactionRu}</p>
            <p class="feedback-text-en" style="color: #4dabf7;">${itemData.reactionEn}</p>
        `;
        this.dialogOptions.appendChild(reactionBox);

        const btn = document.createElement('button');
        btn.className = 'btn-continue';
        btn.textContent = 'Отлично! Продолжаем ➔';
        btn.addEventListener('click', () => {
            this.dialogModal.classList.remove('active');
        });
        this.dialogOptions.appendChild(btn);

        this.dialogModal.classList.add('active');
    }

    handleOptionSelected(option) {
        this.dialogOptions.style.display = 'none';

        if (option.type === 'fail') {
            window.soundEngine.playBuzzer();
            this.triggerSlipperThrow(option.throwItem || 'tapok');
            this.rageLevel = Math.min(100, this.rageLevel + (option.rageDelta || 15));
            this.addOneLock();
            this.speakerAvatar.textContent = '🤬';
        } else if (option.type === 'victory') {
            this.rageLevel = 0;
            this.locksCount = 0;
            this.renderLocks();
            this.stage = 'victory';
            this.speakerAvatar.textContent = '🥳';
            window.soundEngine.playSuccessDing();
        } else {
            // Success step
            window.soundEngine.playSuccessDing();
            this.rageLevel = Math.max(10, this.rageLevel + (option.rageDelta || -20));
            this.removeOneLock();
            this.speakerAvatar.textContent = '😏';
            if (this.stage === 'intro') {
                this.stage = 'bribes';
            }
        }

        this.updateRageHUD();

        this.feedbackTextRu.textContent = option.responseRu;
        this.feedbackTextEn.textContent = option.responseEn;
        this.dialogFeedback.classList.add('active');
    }

    triggerVictorySequence() {
        this.dialogModal.classList.remove('active');
        this.doorLeaf.classList.add('open');
        this.zulyaPeeker.classList.remove('visible');

        // Zulya's grumpy face inside the door
        const insideFace = document.getElementById('zulya-inside-face');
        if (insideFace) {
            insideFace.textContent = '😒';
            insideFace.onclick = () => {
                insideFace.textContent = insideFace.textContent === '😒' ? '😏' : '😒';
                window.soundEngine.playChime();
                this.spawnConfettiBurst();
            };
        }

        // Audio
        window.soundEngine.playBirthdayFanfare();

        // Confetti burst
        this.spawnConfettiBurst();

        // Open Finale modal
        setTimeout(() => {
            this.finaleModal.classList.add('active');
        }, 1000);
    }

    blowCandle() {
        if (!this.candleBlown) {
            this.candleBlown = true;
            this.candleFlame.textContent = '💨';
            this.cakeHint.textContent = '🎉 Желание загадано! Пусть все мечты сбудутся!';
            this.cakeHint.style.color = '#2b8a3e';
            window.soundEngine.playSuccessDing();
            this.spawnConfettiBurst();
        } else {
            // Relight
            this.candleBlown = false;
            this.candleFlame.textContent = '🔥';
            this.cakeHint.textContent = '✨ Свеча снова горит! Загадай ещё одно желание!';
            this.cakeHint.style.color = '#e67700';
            window.soundEngine.playChime();
        }
    }

    // Canvas Confetti System
    initConfetti() {
        this.confettiCtx = this.confettiCanvas.getContext('2d');
        this.confettiParticles = [];
        this.isConfettiActive = false;

        const resize = () => {
            this.confettiCanvas.width = window.innerWidth;
            this.confettiCanvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();
    }

    spawnConfettiBurst() {
        const colors = ['#c1121f', '#f77f00', '#fcbf49', '#0077b6', '#52b788', '#e63946', '#9b5de5'];
        const shapes = ['circle', 'rect', 'star'];

        for (let i = 0; i < 160; i++) {
            this.confettiParticles.push({
                x: window.innerWidth * (0.15 + Math.random() * 0.7),
                y: window.innerHeight * (0.15 + Math.random() * 0.3),
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.85) * 22,
                gravity: 0.32,
                rotation: Math.random() * 360,
                rSpeed: (Math.random() - 0.5) * 12,
                size: Math.random() * 9 + 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                life: 1.0,
                decay: Math.random() * 0.007 + 0.003
            });
        }

        if (!this.isConfettiActive) {
            this.isConfettiActive = true;
            this.animateConfetti();
        }
    }

    animateConfetti() {
        if (!this.isConfettiActive) return;

        this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);

        for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
            const p = this.confettiParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rSpeed;
            p.life -= p.decay;

            if (p.life <= 0 || p.y > this.confettiCanvas.height + 20) {
                this.confettiParticles.splice(i, 1);
                continue;
            }

            this.confettiCtx.save();
            this.confettiCtx.translate(p.x, p.y);
            this.confettiCtx.rotate((p.rotation * Math.PI) / 180);
            this.confettiCtx.fillStyle = p.color;
            this.confettiCtx.globalAlpha = p.life;

            if (p.shape === 'circle') {
                this.confettiCtx.beginPath();
                this.confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                this.confettiCtx.fill();
            } else if (p.shape === 'star') {
                this.drawStar(this.confettiCtx, 0, 0, 5, p.size, p.size / 2);
            } else {
                this.confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            }

            this.confettiCtx.restore();
        }

        if (this.confettiParticles.length > 0) {
            requestAnimationFrame(() => this.animateConfetti());
        } else {
            this.isConfettiActive = false;
        }
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.gameApp = new GameController();
});
