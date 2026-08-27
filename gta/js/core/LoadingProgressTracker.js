/**
         * Менеджер экрана загрузки
         */
        class LoadingProgressTracker {
            constructor() {
                this.loaderElement = document.getElementById('loader');
                this.normalContent = document.getElementById('loader-normal-content');
                this.statusElement = document.getElementById('loader-status-text');
                this.percentElement = document.getElementById('loader-percent-text');
                this.barFillElement = document.getElementById('loader-bar-fill');
                this.errorBox = document.getElementById('loader-error-box');
                this.errorMessage = document.getElementById('loader-error-message');
                this.errorCode = document.getElementById('loader-error-code');
                this.btnForceStart = document.getElementById('btn-force-start');

                if (this.btnForceStart) this.btnForceStart.addEventListener('click', () => this.hideLoader());
            }

            async setProgress(percent, msg) {
                if (this.statusElement) this.statusElement.innerText = msg;
                if (this.percentElement) this.percentElement.innerText = `${Math.round(percent)}%`;
                if (this.barFillElement) this.barFillElement.style.width = `${percent}%`;
                await new Promise(r => setTimeout(r, 20));
            }

            showError(msg, code = 'ERR_TIMED_OUT') {
                if (this.normalContent) this.normalContent.style.display = 'none';
                if (this.errorBox) this.errorBox.style.display = 'block';
                if (this.errorMessage) this.errorMessage.innerText = msg;
                if (this.errorCode) this.errorCode.innerText = code;
            }

            hideLoader() {
                if (this.loaderElement) {
                    this.loaderElement.style.opacity = '0';
                    setTimeout(() => { this.loaderElement.style.display = 'none'; }, 500);
                }
            }

            async complete() {
                await this.setProgress(100, 'Запуск симуляции Лос-Сантоса...');
                await new Promise(r => setTimeout(r, 200));
                this.hideLoader();
            }
        }

window.LoadingProgressTracker = LoadingProgressTracker;
