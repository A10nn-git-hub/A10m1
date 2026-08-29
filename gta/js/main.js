window.exitToLobby = function(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (window.gameEngine) {
        if (typeof window.gameEngine.resetEntireMap === 'function') {
            window.gameEngine.resetEntireMap();
        }
        if (window.gameEngine.multiplayerManager && typeof window.gameEngine.multiplayerManager.disconnect === 'function') {
            window.gameEngine.multiplayerManager.disconnect();
        }
    }
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyNum = urlParams.get('lobby') || urlParams.get('room') || '1';
    window.location.href = `../index.html?lobby=${lobbyNum}`;
};

window.addEventListener('DOMContentLoaded', () => {
    // Telegram WebApp Integration
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            if (typeof tg.ready === 'function') tg.ready();
            if (typeof tg.expand === 'function') tg.expand();
            if (typeof tg.requestFullscreen === 'function' && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('8.0')) {
                try { tg.requestFullscreen(); } catch (err) {}
            }
            if (tg.BackButton && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.1')) {
                try {
                    tg.BackButton.show();
                    tg.BackButton.onClick(() => {
                        window.exitToLobby();
                    });
                } catch (err) {}
            }
        }
    } catch (e) {}

    window.gameEngine = new GTAEngine();
});

