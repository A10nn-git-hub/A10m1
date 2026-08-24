/**
 * Конфигурация Firebase Realtime Database для сетевого мультиплеера GTA 3D
 */
class FirebaseConfig {
    static STORAGE_KEY = 'gta_firebase_config';
    static NICKNAME_KEY = 'gta_player_nickname';
    static ROOM_KEY = 'gta_multiplayer_room';

    /**
     * Конфигурация по умолчанию (Демонстрационная база данных для быстрого старта)
     * Пользователь может переопределить эти параметры через меню "Мультиплеер" в игре.
     */
    static DEFAULT_CONFIG = {
        apiKey: "AIzaSyDemoKeyGTA3DWorldEngine2026",
        authDomain: "gta5-open-world-3d.firebaseapp.com",
        databaseURL: "https://gta5-open-world-3d-default-rtdb.firebaseio.com",
        projectId: "gta5-open-world-3d",
        storageBucket: "gta5-open-world-3d.appspot.com",
        messagingSenderId: "100000000000",
        appId: "1:100000000000:web:gta3dwebengine2026"
    };

    /**
     * Получить активную конфигурацию Firebase (из localStorage или по умолчанию)
     */
    static getConfig() {
        try {
            const saved = localStorage.getItem(FirebaseConfig.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.databaseURL) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[FirebaseConfig] Ошибка чтения конфигурации из localStorage:', e);
        }
        return FirebaseConfig.DEFAULT_CONFIG;
    }

    /**
     * Сохранить пользовательскую конфигурацию в localStorage
     */
    static saveConfig(config) {
        try {
            if (!config || !config.databaseURL) {
                throw new Error('Параметр databaseURL обязателен для Realtime Database.');
            }
            localStorage.setItem(FirebaseConfig.STORAGE_KEY, JSON.stringify(config));
            return true;
        } catch (e) {
            console.error('[FirebaseConfig] Не удалось сохранить конфигурацию:', e);
            return false;
        }
    }

    /**
     * Сбросить конфигурацию на значения по умолчанию
     */
    static resetConfig() {
        try {
            localStorage.removeItem(FirebaseConfig.STORAGE_KEY);
        } catch (e) {
            console.warn(e);
        }
    }

    /**
     * Получить или сгенерировать никнейм игрока
     */
    static getNickname() {
        try {
            const nick = localStorage.getItem(FirebaseConfig.NICKNAME_KEY);
            if (nick && nick.trim().length > 0) return nick.trim().substring(0, 18);
        } catch (e) {
            console.warn(e);
        }
        const randomId = Math.floor(1000 + Math.random() * 9000);
        const defaultNick = `Player_${randomId}`;
        this.saveNickname(defaultNick);
        return defaultNick;
    }

    /**
     * Сохранить никнейм игрока
     */
    static saveNickname(nickname) {
        if (!nickname) return;
        const clean = nickname.trim().substring(0, 18);
        try {
            localStorage.setItem(FirebaseConfig.NICKNAME_KEY, clean);
        } catch (e) {
            console.warn(e);
        }
    }

    /**
     * Получить текущую комнату (лобби)
     */
    static getRoomId() {
        try {
            const room = localStorage.getItem(FirebaseConfig.ROOM_KEY);
            if (room && room.trim().length > 0) return room.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 24);
        } catch (e) {
            console.warn(e);
        }
        return 'los_santos_main';
    }

    /**
     * Сохранить текущую комнату
     */
    static saveRoomId(roomId) {
        if (!roomId) return;
        const clean = roomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 24);
        try {
            localStorage.setItem(FirebaseConfig.ROOM_KEY, clean || 'los_santos_main');
        } catch (e) {
            console.warn(e);
        }
    }
}

window.FirebaseConfig = FirebaseConfig;
