/**
 * MissionHUD - пользовательский интерфейс заданий, таймеров, подсказок и финальных GTA-баннеров
 */
class MissionHUD {
    constructor() {
        this.initHUD();
    }

    initHUD() {
        let overlay = document.getElementById('mission-hud-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mission-hud-overlay';
            overlay.className = 'mission-hud-overlay';
            overlay.innerHTML = `
                <!-- Подсказка взаимодействия у маркера -->
                <div class="mission-start-prompt" id="mission-start-prompt" style="display: none;">
                    <div class="prompt-key"><kbd>E</kbd></div>
                    <div class="prompt-text">
                        <span class="prompt-action">НАЧАТЬ ЗАДАНИЕ:</span>
                        <span class="prompt-title" id="prompt-mission-title">Таксист Лос-Сантоса</span>
                        <span class="prompt-reward" id="prompt-mission-reward">+$10,000</span>
                    </div>
                </div>

                <!-- Панель активной миссии -->
                <div class="mission-active-panel" id="mission-active-panel" style="display: none;">
                    <div class="mission-header" id="mission-active-title">УЛИЧНАЯ ГОНКА</div>
                    <div class="mission-objective" id="mission-active-objective">Доберитесь до чекпоинта</div>
                    <div class="mission-stats-row">
                        <div class="stat-box"><span class="lbl">ВРЕМЯ:</span> <span class="val" id="mission-timer-val">01:30</span></div>
                        <div class="stat-box"><span class="lbl">ДИСТАНЦИЯ:</span> <span class="val" id="mission-dist-val">120м</span></div>
                    </div>
                </div>

                <!-- GTA-Style Финальный баннер -->
                <div class="mission-banner-container" id="mission-banner-container" style="display: none;">
                    <div class="mission-banner-title" id="mission-banner-title">МИССИЯ ВЫПОЛНЕНА</div>
                    <div class="mission-banner-subtitle" id="mission-banner-subtitle">НАГРАДА: +$25,000</div>
                </div>
            `;
            const uiLayer = document.getElementById('ui-layer') || document.body;
            uiLayer.appendChild(overlay);
        }

        this.startPrompt = document.getElementById('mission-start-prompt');
        this.promptTitle = document.getElementById('prompt-mission-title');
        this.promptReward = document.getElementById('prompt-mission-reward');

        this.activePanel = document.getElementById('mission-active-panel');
        this.activeTitle = document.getElementById('mission-active-title');
        this.activeObjective = document.getElementById('mission-active-objective');
        this.timerVal = document.getElementById('mission-timer-val');
        this.distVal = document.getElementById('mission-dist-val');

        this.bannerContainer = document.getElementById('mission-banner-container');
        this.bannerTitle = document.getElementById('mission-banner-title');
        this.bannerSubtitle = document.getElementById('mission-banner-subtitle');
    }

    showStartPrompt(title, reward) {
        if (!this.startPrompt) return;
        if (this.promptTitle) this.promptTitle.innerText = title;
        if (this.promptReward) this.promptReward.innerText = `+$${reward.toLocaleString()}`;
        this.startPrompt.style.display = 'flex';
    }

    hideStartPrompt() {
        if (this.startPrompt) this.startPrompt.style.display = 'none';
    }

    showActiveMission(title, objective, timeRemaining, distance) {
        if (!this.activePanel) return;
        this.activePanel.style.display = 'flex';
        if (this.activeTitle) this.activeTitle.innerText = title;
        if (this.activeObjective) this.activeObjective.innerText = objective;
        this.updateActiveStats(timeRemaining, distance);
    }

    updateActiveStats(timeRemaining, distance) {
        if (this.timerVal) {
            const mins = Math.floor(Math.max(0, timeRemaining) / 60);
            const secs = Math.floor(Math.max(0, timeRemaining) % 60);
            this.timerVal.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        if (this.distVal) {
            this.distVal.innerText = `${Math.round(distance || 0)}м`;
        }
    }

    hideActiveMission() {
        if (this.activePanel) this.activePanel.style.display = 'none';
    }

    showCompletionBanner(passed, reward = 0, message = '') {
        if (!this.bannerContainer) return;
        this.hideActiveMission();
        this.hideStartPrompt();

        this.bannerContainer.style.display = 'flex';
        this.bannerContainer.className = `mission-banner-container ${passed ? 'passed' : 'failed'}`;

        if (this.bannerTitle) {
            this.bannerTitle.innerText = passed ? 'МИССИЯ ВЫПОЛНЕНА' : 'МИССИЯ ПРОВАЛЕНА';
        }
        if (this.bannerSubtitle) {
            this.bannerSubtitle.innerText = passed ? `НАГРАДА: +$${reward.toLocaleString()}` : (message || 'Попробуйте снова');
        }

        // Воспроизведение триумфального джингла
        if (window.soundEngine && typeof window.soundEngine.playMissionJingle === 'function') {
            window.soundEngine.playMissionJingle(passed);
        }

        setTimeout(() => {
            if (this.bannerContainer) {
                this.bannerContainer.style.display = 'none';
            }
        }, 4500);
    }
}
window.MissionHUD = MissionHUD;
