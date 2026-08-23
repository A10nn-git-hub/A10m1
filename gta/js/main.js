window.addEventListener('DOMContentLoaded', () => {
    // Telegram WebApp Integration
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            tg.ready();
            tg.expand();
            if (typeof tg.requestFullscreen === 'function') {
                tg.requestFullscreen();
            }
            if (tg.BackButton) {
                tg.BackButton.show();
                tg.BackButton.onClick(() => {
                    window.location.href = '../index.html';
                });
            }
        } catch (e) {
            console.warn('Telegram WebApp init error:', e);
        }
    }

    window.gameEngine = new GTAEngine();
});
