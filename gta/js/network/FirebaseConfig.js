/**
 * Конфигурация Firebase Realtime Database для сетевого мультиплеера GTA 3D
 */
class FirebaseConfig {
    static STORAGE_KEY = 'gta_firebase_config';
    static NICKNAME_KEY = 'gta_player_nickname';
    static ROOM_KEY = 'gta_multiplayer_room';

    /**
     * Конфигурация по умолчанию (Realtime Database проекта)
     */
    static DEFAULT_CONFIG = {
        apiKey: "AIzaSyBc2Q4dAM5fo4SD0sbqwDIy_B9Z5xiM4tg",
        authDomain: "mini-games-b9400.firebaseapp.com",
        databaseURL: "https://mini-games-b9400-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "mini-games-b9400",
        storageBucket: "mini-games-b9400.firebasestorage.app",
        messagingSenderId: "523964322575",
        appId: "1:523964322575:web:a5502d0bf28f17b10f247a"
    };

    /**
     * Получить активную конфигурацию
     */
    static getConfig() {
        return FirebaseConfig.DEFAULT_CONFIG;
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
     * Очистка и валидация имени комнаты
     */
    static sanitizeRoomId(roomId) {
        if (!roomId || typeof roomId !== 'string') return 'los_santos_main';
        // Разрешаем русские и английские буквы, цифры, дефис и подчеркивание, заменяя спецсимволы Firebase
        const clean = roomId.trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, '_').substring(0, 32);
        return clean || 'los_santos_main';
    }

    /**
     * Получить текущую комнату (лобби)
     */
    static getRoomId() {
        try {
            const room = localStorage.getItem(FirebaseConfig.ROOM_KEY);
            if (room && room.trim().length > 0) return FirebaseConfig.sanitizeRoomId(room);
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
        const clean = FirebaseConfig.sanitizeRoomId(roomId);
        try {
            localStorage.setItem(FirebaseConfig.ROOM_KEY, clean || 'los_santos_main');
        } catch (e) {
            console.warn(e);
        }
    }
}

window.FirebaseConfig = FirebaseConfig;

