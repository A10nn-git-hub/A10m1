class MainMenuManager {
            constructor(inputController) {
                this.inputController = inputController;

                this.mainMenu = document.getElementById('main-menu-overlay');
                this.settingsModal = document.getElementById('settings-modal');
                this.aboutModal = document.getElementById('about-modal');
                this.fullMapRenderer = new FullMapRenderer();
                this.auroraRenderer = new MenuAuroraRenderer();

                this.menuBadge = document.getElementById('menu-badge');
                this.menuTitle = document.getElementById('menu-title');
                this.menuSub = document.getElementById('menu-sub');
                this.btnPlay = document.getElementById('btn-menu-play');
                this.btnPlayText = document.getElementById('btn-play-text');
                this.btnSettings = document.getElementById('btn-menu-settings');
                this.btnAbout = document.getElementById('btn-menu-about');
                this.btnExit = document.getElementById('btn-menu-exit');

                this.btnCloseSettings = document.getElementById('btn-close-settings');
                this.btnSaveSettings = document.getElementById('btn-save-settings');
                this.btnResetKeybinds = document.getElementById('btn-reset-keybinds');
                this.keybindErrorBanner = document.getElementById('keybind-error-banner');

                this.btnCloseAbout = document.getElementById('btn-close-about');
                this.btnCloseAboutFooter = document.getElementById('btn-close-about-footer');

                this.minimapBtn = document.getElementById('minimap-radar-btn');
                this.toggleEcoMenu = document.getElementById('toggle-power-saving-menu');
                this.toggleEcoSettings = document.getElementById('toggle-power-saving-settings');

                this.activeRebindAction = null;
                this.isMenuOpen = true;
                this.isGameStarted = false;
                this.isPowerSavingMode = localStorage.getItem('gta_power_saving') === 'true';

                this.tempBindings = JSON.parse(JSON.stringify(this.inputController.bindings));

                this.initUI();
                this.initEcoToggle();
                if (this.auroraRenderer) {
                    this.auroraRenderer.start();
                }
            }

            isAnyModalOpen() {
                const isSettings = this.settingsModal && this.settingsModal.classList.contains('active');
                const isAbout = this.aboutModal && this.aboutModal.classList.contains('active');
                const isMap = this.fullMapRenderer && this.fullMapRenderer.isOpen;
                const isMpSettings = document.getElementById('mp-settings-modal')?.classList.contains('active');
                const isScoreboard = document.getElementById('mp-scoreboard-modal')?.classList.contains('active');
                return isSettings || isAbout || isMap || isMpSettings || isScoreboard;
            }

            setMenuMode(mode) {
                if (mode === 'PAUSE') {
                    if (this.menuBadge) this.menuBadge.innerHTML = '<span class="badge-dot" style="background:#f59e0b;box-shadow:0 0 10px #f59e0b;"></span> ИГРА ПРИОСТАНОВЛЕНА';
                    if (this.menuTitle) this.menuTitle.innerHTML = 'ПАУЗА';
                    if (this.menuSub) this.menuSub.innerText = 'LOS SANTOS 3D';
                    if (this.btnPlayText) this.btnPlayText.innerText = 'ПРОДОЛЖИТЬ';
                    if (this.btnExit) this.btnExit.style.display = 'flex';
                } else {
                    if (this.menuBadge) this.menuBadge.innerHTML = '<span class="badge-dot"></span> OPEN WORLD SIMULATION';
                    if (this.menuTitle) this.menuTitle.innerHTML = 'LOS SANTOS <span>3D</span>';
                    if (this.menuSub) this.menuSub.innerText = 'HTML5 NEXT-GEN WEBGL ENGINE';
                    if (this.btnPlayText) this.btnPlayText.innerText = 'НАЧАТЬ ИГРУ';
                    if (this.btnExit) this.btnExit.style.display = 'none';
                }
            }

            initUI() {
                const addBtnAction = (btn, action) => {
                    if (!btn) return;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        action();
                    });
                    btn.addEventListener('touchend', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        action();
                    }, { passive: false });
                };

                addBtnAction(this.btnPlay, () => this.startGame());
                addBtnAction(this.btnSettings, () => this.openSettings());
                addBtnAction(this.btnCloseSettings, () => this.closeSettings());
                addBtnAction(this.btnSaveSettings, () => this.saveSettingsWithValidation());
                addBtnAction(this.btnResetKeybinds, () => this.resetKeybinds());
                addBtnAction(this.btnAbout, () => this.openAbout());
                addBtnAction(this.btnCloseAbout, () => this.closeAbout());
                addBtnAction(this.btnCloseAboutFooter, () => this.closeAbout());
                addBtnAction(this.btnExit, () => this.exitToMainMenu());
                addBtnAction(this.minimapBtn, () => this.fullMapRenderer.toggle());

                this.initKeybindButtons();

                if (this.inputController) {
                    this.inputController.onToggleMenu = () => this.toggleMenuFromGame();
                    this.inputController.onToggleMap = () => this.fullMapRenderer.toggle();
                }
            }

            initEcoToggle() {
                if (this.toggleEcoMenu) {
                    this.toggleEcoMenu.checked = this.isPowerSavingMode;
                    this.toggleEcoMenu.addEventListener('change', (e) => {
                        e.stopPropagation();
                        this.handleEcoChange(e.target.checked);
                    });
                }
                if (this.toggleEcoSettings) {
                    this.toggleEcoSettings.checked = this.isPowerSavingMode;
                    this.toggleEcoSettings.addEventListener('change', (e) => {
                        e.stopPropagation();
                        this.handleEcoChange(e.target.checked);
                    });
                }
            }

            handleEcoChange(enabled) {
                this.isPowerSavingMode = enabled;
                localStorage.setItem('gta_power_saving', enabled ? 'true' : 'false');
                if (this.toggleEcoMenu) this.toggleEcoMenu.checked = enabled;
                if (this.toggleEcoSettings) this.toggleEcoSettings.checked = enabled;

                if (window.gameEngine && typeof window.gameEngine.setPowerSavingMode === 'function') {
                    window.gameEngine.setPowerSavingMode(enabled, true);
                }
            }

            startGame() {
                this.isMenuOpen = false;
                this.isGameStarted = true;
                if (this.mainMenu) {
                    this.mainMenu.classList.add('menu-hidden');
                }
                if (this.auroraRenderer) {
                    this.auroraRenderer.stop();
                }
                if (window.gameEngine && window.gameEngine.clock) {
                    window.gameEngine.clock.getDelta(); // сброс delta времени
                }
                if (window.soundEngine && window.soundEngine.ctx && window.soundEngine.ctx.state === 'suspended') {
                    window.soundEngine.ctx.resume();
                }
                const container = document.getElementById('game-container') || document.body;
                try { container.requestPointerLock(); } catch (e) {}
            }

            exitToMainMenu() {
                this.isGameStarted = false;
                this.setMenuMode('MAIN');
                this.isMenuOpen = true;
                if (this.mainMenu) {
                    this.mainMenu.classList.remove('menu-hidden');
                }
                if (this.auroraRenderer) {
                    this.auroraRenderer.start();
                }
                try { document.exitPointerLock(); } catch (e) {}
            }

            toggleMenuFromGame() {
                if (this.fullMapRenderer && this.fullMapRenderer.isOpen) {
                    this.fullMapRenderer.toggle(false);
                    return;
                }
                if (this.settingsModal && this.settingsModal.classList.contains('active')) {
                    this.closeSettings();
                    return;
                }
                if (this.aboutModal && this.aboutModal.classList.contains('active')) {
                    this.closeAbout();
                    return;
                }

                this.isMenuOpen = !this.isMenuOpen;
                if (this.mainMenu) {
                    if (this.isMenuOpen) {
                        this.setMenuMode(this.isGameStarted ? 'PAUSE' : 'MAIN');
                        this.mainMenu.classList.remove('menu-hidden');
                        if (this.auroraRenderer) this.auroraRenderer.start();
                        try { document.exitPointerLock(); } catch (e) {}
                    } else {
                        this.mainMenu.classList.add('menu-hidden');
                        if (this.auroraRenderer) this.auroraRenderer.stop();
                        if (window.gameEngine && window.gameEngine.clock) window.gameEngine.clock.getDelta();
                        const container = document.getElementById('game-container') || document.body;
                        try { container.requestPointerLock(); } catch (e) {}
                    }
                }
            }

            openSettings() {
                this.tempBindings = JSON.parse(JSON.stringify(this.inputController.bindings));
                this.clearKeybindConflicts();
                this.updateKeybindButtonsUI();
                if (this.auroraRenderer) this.auroraRenderer.start();
                if (this.settingsModal) this.settingsModal.classList.add('active');
            }

            closeSettings() {
                if (this.activeRebindAction) {
                    this.cancelRebind();
                }
                this.clearKeybindConflicts();
                if (this.settingsModal) this.settingsModal.classList.remove('active');
                if (!this.isMenuOpen && !this.aboutModal.classList.contains('active')) {
                    if (this.auroraRenderer) this.auroraRenderer.stop();
                }
            }

            saveSettingsWithValidation() {
                // Валидация: Внутри каждой категории (foot, car, sys) клавиши НЕ должны повторяться!
                const categories = { foot: {}, car: {}, sys: {} };
                const duplicateActions = new Set();

                for (const [action, data] of Object.entries(this.tempBindings)) {
                    const cat = data.category || 'foot';
                    const code = data.code;

                    if (categories[cat][code]) {
                        duplicateActions.add(action);
                        duplicateActions.add(categories[cat][code]);
                    } else {
                        categories[cat][code] = action;
                    }
                }

                if (duplicateActions.size > 0) {
                    // Подсвечиваем конфликтующие кнопки красным и показываем предупреждение
                    this.clearKeybindConflicts();
                    const buttons = document.querySelectorAll('.keybind-btn');
                    buttons.forEach(btn => {
                        const act = btn.getAttribute('data-action');
                        if (duplicateActions.has(act)) {
                            btn.classList.add('keybind-conflict');
                        }
                    });

                    if (this.keybindErrorBanner) {
                        this.keybindErrorBanner.classList.add('visible');
                    }
                    return;
                }

                // Конфликтов нет: сохраняем настройки
                this.inputController.bindings = JSON.parse(JSON.stringify(this.tempBindings));
                this.closeSettings();
            }

            clearKeybindConflicts() {
                const buttons = document.querySelectorAll('.keybind-btn');
                buttons.forEach(btn => btn.classList.remove('keybind-conflict'));
                if (this.keybindErrorBanner) {
                    this.keybindErrorBanner.classList.remove('visible');
                }
            }

            openAbout() {
                if (this.auroraRenderer) this.auroraRenderer.start();
                if (this.aboutModal) this.aboutModal.classList.add('active');
            }

            closeAbout() {
                if (this.aboutModal) this.aboutModal.classList.remove('active');
                if (!this.isMenuOpen && !this.settingsModal.classList.contains('active')) {
                    if (this.auroraRenderer) this.auroraRenderer.stop();
                }
            }

            initKeybindButtons() {
                const buttons = document.querySelectorAll('.keybind-btn');
                buttons.forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const action = btn.getAttribute('data-action');
                        this.startRebind(action, btn);
                    };
                });

                window.addEventListener('keydown', (e) => {
                    if (!this.activeRebindAction) return;
                    e.preventDefault();
                    e.stopPropagation();

                    if (e.code === 'Escape') {
                        this.cancelRebind();
                        return;
                    }

                    const newCode = e.code;
                    let display = e.key.toUpperCase();
                    if (newCode.startsWith('Key')) display = newCode.replace('Key', '');
                    if (newCode.startsWith('Digit')) display = newCode.replace('Digit', '');
                    if (newCode === 'Space') display = 'Space';
                    if (newCode === 'ShiftLeft' || newCode === 'ShiftRight') display = 'Shift';

                    const cat = (this.tempBindings[this.activeRebindAction] && this.tempBindings[this.activeRebindAction].category) || 'foot';
                    this.tempBindings[this.activeRebindAction] = {
                        code: newCode,
                        display: display,
                        category: cat
                    };

                    this.cancelRebind();
                    this.clearKeybindConflicts();
                    this.updateKeybindButtonsUI();
                }, true);
            }

            startRebind(action, btn) {
                if (this.activeRebindAction) this.cancelRebind();
                this.activeRebindAction = action;
                this.activeRebindButton = btn;
                btn.classList.add('waiting');
                btn.innerText = '...';
            }

            cancelRebind() {
                if (this.activeRebindButton) {
                    this.activeRebindButton.classList.remove('waiting');
                }
                this.activeRebindAction = null;
                this.activeRebindButton = null;
                this.updateKeybindButtonsUI();
            }

            resetKeybinds() {
                this.inputController.resetBindings();
                this.tempBindings = JSON.parse(JSON.stringify(this.inputController.bindings));
                this.clearKeybindConflicts();
                this.updateKeybindButtonsUI();
            }

            updateKeybindButtonsUI() {
                const buttons = document.querySelectorAll('.keybind-btn');
                buttons.forEach(btn => {
                    const action = btn.getAttribute('data-action');
                    const b = this.tempBindings[action];
                    if (b) {
                        btn.innerText = b.display || b.code;
                        btn.classList.remove('waiting');
                    }
                });
            }
        }
