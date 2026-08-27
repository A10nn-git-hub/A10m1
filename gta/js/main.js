window.addEventListener('DOMContentLoaded', () => {
    // Telegram WebApp Integration
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        try {
            if (typeof tg.ready === 'function') tg.ready();
            if (typeof tg.expand === 'function') tg.expand();
            if (typeof tg.requestFullscreen === 'function' && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('8.0')) {
                try {
                    tg.requestFullscreen();
                } catch (err) {}
            }
            if (tg.BackButton) {
                tg.BackButton.show();
                tg.BackButton.onClick(() => {
                    window.location.href = '../index.html';
                });
            }
        } catch (e) {}
    }

    window.gameEngine = new GTAEngine();
});

