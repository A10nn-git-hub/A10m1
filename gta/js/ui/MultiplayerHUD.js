/**
 * Пользовательский интерфейс мультиплеера (MultiplayerHUD)
 * Управляет внутриигровым чатом, плашкой сетевого статуса, списком игроков онлайн
 * и модальным окном настройки подключения к серверу.
 */
class MultiplayerHUD {
    constructor(multiplayerManager) {
        this.mp = multiplayerManager;

        this.statusBadge = document.getElementById('mp-status-badge');
        this.chatContainer = document.getElementById('mp-chat-container');
        this.chatMessages = document.getElementById('mp-chat-messages');
        this.chatInput = document.getElementById('mp-chat-input');
        this.chatForm = document.getElementById('mp-chat-form');

        this.scoreboardModal = document.getElementById('mp-scoreboard-modal');
        this.settingsModal = document.getElementById('mp-settings-modal');

        this.isChatOpen = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStatusBadge(this.mp.status, this.mp.statusMessage);

        this.mp.onStatusChange = (status, msg) => {
            this.updateStatusBadge(status, msg);
            this.updateSettingsModalState();
        };

        this.mp.onChatMessageReceived = (msg) => {
            this.addChatMessage(msg);
        };

        this.mp.onPlayersUpdated = (players) => {
            this.updateScoreboard(players);
            this.updateStatusBadge(this.mp.status, this.mp.statusMessage);
        };
    }

    bindEvents() {
        // Отправка сообщений в чат
        if (this.chatForm) {
            this.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitChat();
            });
        }

        // Кнопка открытия мультиплеера в главном меню
        const btnMenuMp = document.getElementById('btn-menu-multiplayer');
        if (btnMenuMp) {
            btnMenuMp.addEventListener('click', () => {
                this.openSettingsModal();
            });
        }

        // Кнопка закрытия модалки мультиплеера
        const btnCloseMp = document.getElementById('btn-close-mp-settings');
        if (btnCloseMp) {
            btnCloseMp.addEventListener('click', () => {
                this.closeSettingsModal();
            });
        }

        // Кнопка подключения/отключения
        const btnConnect = document.getElementById('btn-mp-connect');
        if (btnConnect) {
            btnConnect.addEventListener('click', () => {
                this.handleConnectButton();
            });
        }

        // Пресеты комнат (быстрый выбор)
        const presetBtns = document.querySelectorAll('.mp-preset-btn');
        presetBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const room = btn.getAttribute('data-room');
                const inpRoom = document.getElementById('mp-input-room');
                if (inpRoom && room) {
                    inpRoom.value = room;
                    presetBtns.forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });

        // Клик по сетевой плашке открывает список игроков / настройки
        if (this.statusBadge) {
            this.statusBadge.addEventListener('click', () => {
                this.toggleScoreboard();
            });
        }

        // Закрытие Scoreboard
        const btnCloseScoreboard = document.getElementById('btn-close-scoreboard');
        if (btnCloseScoreboard) {
            btnCloseScoreboard.addEventListener('click', () => {
                this.closeScoreboard();
            });
        }
    }

    isMobileDevice() {
        return document.body.classList.contains('mobile-mode') || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (window.innerWidth <= 900);
    }

    updateStatusBadge(status, msg) {
        if (!this.statusBadge) return;
        const count = (this.mp.remotePlayers ? this.mp.remotePlayers.size : 0) + 1;
        const isMobile = this.isMobileDevice();

        if (status === 'CONNECTED') {
            this.statusBadge.innerHTML = `<span class="mp-dot online"></span> <b>СЕТЬ:</b> ${count} ИГР. [${this.mp.roomId}]`;
            this.statusBadge.className = 'mp-status-badge online';
            if (this.chatContainer) {
                this.chatContainer.style.display = isMobile ? 'none' : 'flex';
            }
        } else if (status === 'CONNECTING') {
            this.statusBadge.innerHTML = `<span class="mp-dot connecting"></span> ПОДКЛЮЧЕНИЕ...`;
            this.statusBadge.className = 'mp-status-badge connecting';
            if (this.chatContainer) {
                this.chatContainer.style.display = 'none';
            }
            this.closeChat();
        } else if (status === 'ERROR') {
            this.statusBadge.innerHTML = `<span class="mp-dot error"></span> СЕТЬ: ОШИБКА`;
            this.statusBadge.className = 'mp-status-badge error';
            if (this.chatContainer) {
                this.chatContainer.style.display = 'none';
            }
            this.closeChat();
        } else {
            this.statusBadge.innerHTML = `<span class="mp-dot offline"></span> ОФФЛАЙН (ОДИН)`;
            this.statusBadge.className = 'mp-status-badge offline';
            if (this.chatContainer) {
                this.chatContainer.style.display = 'none';
            }
            this.closeChat();
        }
    }

    openChat() {
        if (this.isMobileDevice() || this.mp.status !== 'CONNECTED') return;
        if (!this.chatContainer || !this.chatInput) return;
        this.isChatOpen = true;
        this.chatContainer.style.display = 'flex';
        this.chatContainer.classList.add('active');
        this.chatInput.focus();
    }

    closeChat() {
        if (!this.chatContainer || !this.chatInput) return;
        this.isChatOpen = false;
        this.chatContainer.classList.remove('active');
        this.chatInput.value = '';
        this.chatInput.blur();
    }

    toggleChat() {
        if (this.isMobileDevice() || this.mp.status !== 'CONNECTED') return;
        if (this.isChatOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    submitChat() {
        if (!this.chatInput) return;
        const text = this.chatInput.value;
        if (text && text.trim().length > 0) {
            this.mp.sendChatMessage(text);
        }
        this.closeChat();
    }

    addChatMessage(msg) {
        if (!this.chatMessages) return;

        const row = document.createElement('div');
        row.className = 'mp-chat-row';

        const isMe = msg.senderId === this.mp.localPlayerId;
        const senderColor = isMe ? '#00e5ff' : '#ffd700';

        row.innerHTML = `<span class="mp-chat-sender" style="color:${senderColor}">${msg.senderName}:</span> <span class="mp-chat-text">${this.escapeHTML(msg.text)}</span>`;
        this.chatMessages.appendChild(row);

        // Автоматическая прокрутка вниз
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // Удаление старых строк (оставляем не более 40)
        while (this.chatMessages.children.length > 40) {
            this.chatMessages.removeChild(this.chatMessages.firstChild);
        }
    }

    addSystemMessage(text) {
        if (!this.chatMessages) return;
        const row = document.createElement('div');
        row.className = 'mp-chat-row system';
        row.innerHTML = `<span class="mp-chat-system-text">⚡ ${this.escapeHTML(text)}</span>`;
        this.chatMessages.appendChild(row);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHTML(str) {
        return (str || '').replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[m]);
    }

    openSettingsModal() {
        this.populateSettingsFields();
        if (this.settingsModal) {
            this.settingsModal.classList.add('active');
        }
    }

    closeSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.classList.remove('active');
        }
    }

    populateSettingsFields() {
        const inpNick = document.getElementById('mp-input-nickname');
        const inpRoom = document.getElementById('mp-input-room');

        if (inpNick) inpNick.value = this.mp.nickname;
        if (inpRoom) inpRoom.value = this.mp.roomId;

        const presetBtns = document.querySelectorAll('.mp-preset-btn');
        presetBtns.forEach((btn) => {
            if (btn.getAttribute('data-room') === this.mp.roomId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.updateSettingsModalState();
    }

    updateSettingsModalState() {
        const btnConnect = document.getElementById('btn-mp-connect');
        const statusText = document.getElementById('mp-modal-status-text');

        if (statusText) {
            statusText.innerText = this.mp.statusMessage;
            statusText.className = `mp-status-text ${this.mp.status.toLowerCase()}`;
        }

        if (btnConnect) {
            if (this.mp.status === 'CONNECTED') {
                btnConnect.innerText = 'ОТКЛЮЧИТЬСЯ ОТ СЕТИ';
                btnConnect.className = 'menu-btn danger';
            } else if (this.mp.status === 'CONNECTING') {
                btnConnect.innerText = 'ПОДКЛЮЧЕНИЕ...';
                btnConnect.className = 'menu-btn';
            } else {
                btnConnect.innerText = 'ПОДКЛЮЧИТЬСЯ К СЕССИИ';
                btnConnect.className = 'menu-btn primary';
            }
        }
    }

    handleConnectButton() {
        if (this.mp.status === 'CONNECTED' || this.mp.status === 'CONNECTING') {
            this.mp.disconnect();
            this.updateSettingsModalState();
            return;
        }

        const inpNick = document.getElementById('mp-input-nickname');
        const inpRoom = document.getElementById('mp-input-room');

        const nick = inpNick ? inpNick.value.trim() : this.mp.nickname;
        const room = inpRoom ? inpRoom.value.trim() : this.mp.roomId;

        if (nick) FirebaseConfig.saveNickname(nick);
        if (room) FirebaseConfig.saveRoomId(room);

        this.mp.connect(null, nick, room);
        this.closeSettingsModal();
    }

    toggleScoreboard() {
        if (this.scoreboardModal) {
            if (this.scoreboardModal.classList.contains('active')) {
                this.closeScoreboard();
            } else {
                this.openScoreboard();
            }
        }
    }

    openScoreboard() {
        if (!this.scoreboardModal) return;
        this.updateScoreboard(this.mp.getRemotePlayersArray());
        this.scoreboardModal.classList.add('active');
    }

    closeScoreboard() {
        if (this.scoreboardModal) {
            this.scoreboardModal.classList.remove('active');
        }
    }

    updateScoreboard(remotePlayers) {
        const tbody = document.getElementById('mp-scoreboard-body');
        const countSpan = document.getElementById('mp-players-count');
        if (!tbody) return;

        const totalCount = (remotePlayers ? remotePlayers.length : 0) + 1;
        if (countSpan) countSpan.innerText = `${totalCount}`;

        let html = `
            <tr class="local-player-row">
                <td><span class="player-dot me"></span> <b>${this.escapeHTML(this.mp.nickname)} (ВЫ)</b></td>
                <td><span class="badge-role">ХОСТ/ИГРОК</span></td>
                <td><div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div></td>
                <td><span class="status-online">В СЕТИ</span></td>
            </tr>
        `;

        if (remotePlayers && remotePlayers.length > 0) {
            remotePlayers.forEach((p) => {
                const hp = Math.max(0, Math.min(100, p.health || 100));
                const modeText = p.isDriving ? '🚗 ЗА РУЛЕМ' : '🏃 ПЕШКОМ';
                html += `
                    <tr>
                        <td><span class="player-dot"></span> ${this.escapeHTML(p.nickname)}</td>
                        <td><span class="badge-remote">${modeText}</span></td>
                        <td><div class="hp-bar"><div class="hp-fill" style="width:${hp}%"></div></div></td>
                        <td><span class="status-online">В СЕТИ</span></td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
    }
}

window.MultiplayerHUD = MultiplayerHUD;
