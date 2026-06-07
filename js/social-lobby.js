            // ================== ДРУЗЬЯ И ЛОББИ ==================
            let friendListeners = {};
            let activePreviewPlayer = null;
            let activeChatFriend = null;
            let activeChatId = null;
            let chatMessagesListener = null;
            let lobbyAgentSlots = {};

            function getMaxPlayersForMode(mode) {
                if (mode === 'duel_1v1') return 2;
                if (mode === 'duel_2v2') return 4;
                return 10; // 'tdm_5v5' is default
            }

            function formatPresenceDays(days) {
                const n = Math.abs(parseInt(days) || 0);
                const mod10 = n % 10;
                const mod100 = n % 100;
                if (mod10 === 1 && mod100 !== 11) return `${n} день назад`;
                if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня назад`;
                return `${n} дней назад`;
            }

            function getFriendPresenceHTML(profile = {}) {
                const presence = profile.presence || {};
                const currentLobby = profile.currentLobby || {};
                const lastSeenAt = Number(presence.lastSeenAt || profile.lastSeenAt || 0);
                const awayExpired = presence.state === 'away' && lastSeenAt && Date.now() - lastSeenAt >= 60000;
                const isOffline = presence.state === 'offline' || awayExpired;
                const days = lastSeenAt ? Math.floor((Date.now() - lastSeenAt) / 86400000) : 0;
                if (days >= 1) return `<span class="friend-status friend-status-offline">${formatPresenceDays(days)}</span>`;
                if (!isOffline && currentLobby.status === 'playing' && currentLobby.game) {
                    return `<span class="friend-status friend-status-playing"><span class="friend-status-dot"></span>ИГРАЕТ В ${formatPresenceGameName(currentLobby.game)}</span>`;
                }
                if (!isOffline && currentLobby.status !== 'playing' && currentLobby.isRealLobby) {
                    return `<span class="friend-status friend-status-lobby"><span class="friend-status-dot"></span>В ЛОББИ</span>`;
                }
                if (presence.state === 'online') return `<span class="friend-status friend-status-online"><span class="friend-status-dot"></span>В СЕТИ</span>`;
                if (presence.state === 'away' && !awayExpired) return `<span class="friend-status friend-status-away"><span class="friend-status-dot"></span>ОТОШЕЛ</span>`;
                return `<span class="friend-status friend-status-offline"><span class="friend-status-dot"></span>НЕ В СЕТИ</span>`;
            }

            function formatPresenceGameName(gameId) {
                if (gameId === 'br_2d') return 'ВЫЖИВАНИЕ';
                if (gameId === 'br_tdm_5v5') return 'КОМАНДНЫЙ БОЙ';
                return (GAME_NAMES && GAME_NAMES[gameId] ? GAME_NAMES[gameId] : gameId).replace(/^[^\p{L}\p{N}]+/u, '').trim();
            }

            function closeLobbyForAway() {
                if (!appState.inLobby || !lobbyId) return;
                if (!appState.currentLobby?.isRealLobby) return;
                closeLobby({autoReopen:true});
            }

            function pushSystemNotification(userId, payload) {
                if (!userId || isAiFriendId(userId)) return Promise.resolve();
                const ref = db.ref(`users/${userId}/system_notifications`).push();
                return ref.set({
                    ...payload,
                    id: ref.key,
                    unread: true,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
            }

            function canJoinPlayingBrLobby(data = {}) {
                const players = data.players || {};
                const mode = data.currentMode || 'tdm_5v5';
                const maxPlayers = getMaxPlayersForMode(mode);
                return data.status === 'playing'
                    && data.game === 'br_2d'
                    && !players[myId]
                    && Object.keys(players).filter(id => !isAiFriendId(id)).length < maxPlayers;
            }

            function getFriendKnownLobbyId(friend = {}) {
                return friend.currentLobby?.lobbyId || friend.currentLobby?.id || friend.id;
            }

            function renderFriends() { 
                const list = document.getElementById('fr-list'); 
                list.innerHTML = ''; 
                Object.keys(friendListeners).forEach(id => db.ref('users/' + id).off('value', friendListeners[id]));
                friendListeners = {};
                
                friendsIds.forEach(id => { 
                    let d = document.createElement('div'); 
                    d.className = 'list-item'; 
                    d.id = 'friend-row-' + id;
                    list.appendChild(d);

                    if (id === SYSTEM_BOT.id) {
                        d.innerHTML = `
                            <div class="friend-row">
                                <div style="font-size:30px;">${getAvatarHTML(SYSTEM_BOT.avatar)}</div>
                                <div>${getNameHTML(SYSTEM_BOT.name, SYSTEM_BOT.eqName)}<br><span style="font-size:10px;color:gray;">ID: ${SYSTEM_BOT.id}</span></div>
                            </div>`;
                        d.onclick = () => openFriendModal({...SYSTEM_BOT});
                        return;
                    }
                    
                    friendListeners[id] = db.ref('users/' + id).on('value', s => { 
                        let rEl = document.getElementById('friend-row-' + id);
                        if (!rEl) return;
                        if (s.exists()) { 
                            let p = s.val(); 
                            rEl.innerHTML = `
                                <div class="friend-row">
                                    <div style="font-size:30px;">${getAvatarHTML(p.avatar)}</div> 
                                    <div>${getNameHTML(p.name, p.eqName)}<br><span style="font-size:10px;color:gray;">ID: ${id}</span></div>
                                </div>
                                ${getFriendPresenceHTML(p)}`;
                            rEl.onclick = () => openFriendModal({ id: id, name: p.name || 'Игрок', avatar: p.avatar, eqName: p.eqName, pMedals: p.pMedals, presence: p.presence, currentLobby: p.currentLobby });
                            rEl.style.display = 'flex';
                        } else { 
                            rEl.style.display = 'none'; 
                        }
                    }); 
                }); 
            }

            function addFriendBtn() { 
                let id = prompt("ID друга:"); 
                if (id && id !== myId) { 
                    if (friendsIds.includes(id)) return showNegativeAlert("Уже в списке!"); 
                    db.ref('users/' + id).once('value').then(s => { 
                        if (s.exists()) { 
                            openFriendPreview(id, s.val(), false);
                        } else {
                            showNegativeAlert("Некорректный ID"); 
                        }
                    }); 
                } 
            }

            function renderFrReqs(reqs) { 
                const l = document.getElementById('fr-reqs'); 
                l.innerHTML = ''; 
                if (!reqs) return l.innerHTML = '<p style="color:gray;text-align:center;">Нет заявок</p>'; 
                
                Object.keys(reqs).forEach(id => { 
                    db.ref('users/' + id).once('value').then(s => { 
                        if (s.exists()) { 
                            let p = s.val(); 
                            let d = document.createElement('div'); 
                            d.className = 'list-item'; 
                            d.innerHTML = `
                                <div class="friend-row">
                                    <div style="font-size:30px;">${getAvatarHTML(p.avatar)}</div> 
                                    <div>${getNameHTML(p.name, p.eqName)}</div>
                                </div>
                                <div>
                                    <button class="btn btn-green" style="padding:5px;" onclick="acceptReq('${id}')">➕</button> 
                                    <button class="btn btn-red" style="padding:5px;" onclick="db.ref('users/${myId}/friend_reqs/${id}').remove()">➖</button>
                                </div>`; 
                            l.appendChild(d); 
                        } 
                    }); 
                }); 
            }

            function acceptReq(id) { 
                db.ref(`users/${myId}/friend_reqs/${id}`).remove(); 
                db.ref(`users/${myId}/friends/${id}`).set(true); 
                db.ref(`users/${id}/friends/${myId}`).set(true); 
                pushSystemNotification(id, {
                    type: 'friend_accepted',
                    title: 'НОВЫЙ ДРУГ!',
                    text: 'Этот игрок принял вашу заявку',
                    playerId: myId,
                    playerName: myName,
                    playerAvatar: myAvatar,
                    playerEqName: myEqName
                }).catch(() => {});
                db.ref(`users/${id}`).once('value').then(s => {
                    const p = s.exists() ? (s.val() || {}) : {};
                    pushSystemNotification(myId, {
                        type: 'friend_accepted',
                        title: 'НОВЫЙ ДРУГ!',
                        text: 'Теперь вы друзья',
                        playerId: id,
                        playerName: p.name || 'Игрок',
                        playerAvatar: p.avatar || '👤',
                        playerEqName: p.eqName || ''
                    }).catch(() => {});
                });
                setIsland("Друг добавлен", "#34c759"); 
            }

            function openFriendModal(f) { 
                activeFriend = f; 
                document.getElementById('fm-avatar').innerHTML = getAvatarHTML(f.avatar); 
                document.getElementById('fm-name-cont').innerHTML = getNameHTML(f.name, f.eqName); 
                document.getElementById('fm-medals-cont').innerHTML = getMedalsHTML(f.pMedals); 
                document.getElementById('fm-id').innerText = `ID: ${f.id}`; 
                
                let a = document.getElementById('friend-actions'); 
                a.innerHTML = ''; 
                if(f.id !== 'ИИ') {
                    a.innerHTML += `<button class="btn btn-dark" onclick="openProfileStatsModal('${f.id}')">Профиль</button>`;
                    a.innerHTML += `<div id="friend-join-lobby-slot"></div>`;
                    a.innerHTML += `<button class="btn btn-dark" onclick="openFriendChatFromModal()">Сообщение 💬</button>`;
                }
                maybeRenderFriendLobbyJoin(f);
                
                if (appState.inLobby) { 
                    if (f.id === 'ИИ') {
                        a.innerHTML += `<button class="btn btn-green" onclick="inviteBotLobby()">Пригласить 🤖</button>`; 
                    } else {
                        a.innerHTML += `<button class="btn btn-green" onclick="inviteRealFriend('${f.id}')">Пригласить 🎮</button>`; 
                    }
                    if (f.id !== 'ИИ') {
                        db.ref('lobbies/' + getFriendKnownLobbyId(f)).once('value').then(s => {
                            if (s.exists() && document.getElementById('friend-modal') && !document.getElementById('friend-modal').classList.contains('hidden') && canJoinPlayingBrLobby(s.val())) {
                                document.getElementById('friend-actions').insertAdjacentHTML('afterbegin', `<button class="btn btn-purple" onclick="joinFriendPlayingBrLobby()">ПРИСОЕДИНИТЬСЯ</button>`);
                            }
                        });
                    }
                } else { 
                    if (f.id !== 'ИИ') {
                        db.ref('lobbies/' + getFriendKnownLobbyId(f)).once('value').then(s => {
                            if (s.exists() && document.getElementById('friend-modal') && !document.getElementById('friend-modal').classList.contains('hidden') && canJoinPlayingBrLobby(s.val())) {
                                document.getElementById('friend-actions').insertAdjacentHTML('beforeend', `<button class="btn btn-purple" onclick="joinFriendPlayingBrLobby()">ПРИСОЕДИНИТЬСЯ</button>`);
                            }
                        });
                    }
                } 
                
                if (f.id !== 'ИИ') { 
                    a.innerHTML += `
                        <button class="btn btn-red" onclick="removeFriend()">Удалить 🗑️</button>
                        <button class="btn" onclick="closeFriendModal()" style="background: #444; color: white;">Отмена</button>`; 
                } else { 
                    a.innerHTML += `<button class="btn" onclick="closeFriendModal()" style="background: #444; color: white;">Закрыть</button>`; 
                } 
                document.getElementById('friend-modal').classList.remove('hidden'); 
            }

            function friendHasWaitingLobby(friend = {}, data = null) {
                if (!friend || isAiFriendId(friend.id)) return false;
                const known = friend.currentLobby || {};
                if (known.status === 'playing') return false;
                if (known.isRealLobby && known.status !== 'playing') return true;
                if (!data || data.status === 'playing') return false;
                const players = data.players || {};
                return !!players[friend.id] && (Object.keys(players).length > 1 || Object.keys(data.invites || {}).length > 0);
            }

            function maybeRenderFriendLobbyJoin(friend) {
                const slot = document.getElementById('friend-join-lobby-slot');
                if (!slot || !friend || isAiFriendId(friend.id)) return;
                const render = () => {
                    slot.innerHTML = `<button class="btn btn-gold friend-join-lobby-btn" onclick="joinFriendLobby()">ПРИСОЕДИНИТЬСЯ</button>`;
                };
                if (friendHasWaitingLobby(friend)) {
                    render();
                    return;
                }
                db.ref('lobbies/' + getFriendKnownLobbyId(friend)).once('value').then(s => {
                    if (!s.exists()) return;
                    if (document.getElementById('friend-modal')?.classList.contains('hidden')) return;
                    if (friendHasWaitingLobby(friend, s.val())) render();
                });
            }

            function closeFriendModal() { document.getElementById('friend-modal').classList.add('hidden'); }

            function openFriendPreview(id, profile, isFriend = false) {
                activePreviewPlayer = { id, ...(profile || {}) };
                document.getElementById('friend-preview-avatar').innerHTML = getAvatarHTML(profile.avatar);
                document.getElementById('friend-preview-name').innerHTML = getNameHTML(profile.name || 'Игрок', profile.eqName);
                document.getElementById('friend-preview-id').innerText = `ID: ${id}`;
                const addBtn = document.getElementById('friend-preview-add');
                addBtn.style.display = isFriend ? 'none' : 'inline-flex';
                const actions = document.getElementById('friend-preview-actions');
                if (actions) actions.style.display = isFriend ? 'flex' : 'none';
                const stats = document.getElementById('friend-preview-stats');
                stats.style.display = 'none';
                stats.innerHTML = '';
                document.getElementById('friend-preview-modal').classList.remove('hidden');
            }

            function closeFriendPreview(e) {
                if (e) e.stopPropagation();
                document.getElementById('friend-preview-modal').classList.add('hidden');
            }

            function showFriendPreviewActions() {
                const actions = document.getElementById('friend-preview-actions');
                if (actions) actions.style.display = 'flex';
            }

            function sendFriendRequestFromPreview() {
                if (!activePreviewPlayer || activePreviewPlayer.id === myId) return;
                db.ref(`users/${activePreviewPlayer.id}/friend_reqs/${myId}`).set(true);
                setIsland("Заявка отправлена", "#34c759");
                document.getElementById('friend-preview-add').style.display = 'none';
                showFriendPreviewActions();
            }

            function openPreviewProfile() {
                if (!activePreviewPlayer) return;
                openProfileStatsModal(activePreviewPlayer.id);
            }

            function invitePreviewToLobby() {
                if (!activePreviewPlayer) return;
                if (!appState.inLobby) return showNegativeAlert("Сначала зайди в лобби.");
                inviteRealFriend(activePreviewPlayer.id);
                closeFriendPreview();
            }

            function messagePreviewPlayer() {
                if (!activePreviewPlayer) return;
                if (isAiFriendId(activePreviewPlayer.id)) return showNegativeAlert("ИИ не принимает сообщения.");
                closeFriendPreview();
                openFriendChat(activePreviewPlayer.id, activePreviewPlayer);
            }

            function openFriendChatFromModal() {
                if (!activeFriend || isAiFriendId(activeFriend.id)) return;
                const friend = {...activeFriend};
                closeFriendModal();
                openFriendChat(friend.id, friend);
            }

            async function removeFriend() { 
                if (await showCustomConfirm(`Удалить?`)) { 
                    db.ref(`users/${myId}/friends/${activeFriend.id}`).remove(); 
                    db.ref(`users/${activeFriend.id}/friends/${myId}`).remove(); 
                    closeFriendModal(); 
                } 
            }

            async function kickPlayer(id) { 
                if (!isHost || id === myId) return; 
                if (await showCustomConfirm("Вы уверены, что хотите кикнуть этого игрока из лобби?")) { 
                    db.ref(`lobbies/${lobbyId}/players/${id}`).remove(); 
                } 
            }

            function renderLobbySlots() { 
                const c = document.getElementById('lobby-slots-container'); 
                c.innerHTML = ''; 
                renderLobbyAgents();
            }

            function renderLobbyAgents() {
                const stage = document.getElementById('lobby-agents-stage');
                if (!stage) return;
                stage.innerHTML = '';
                lobbyPlayers.forEach((p, i) => {
                    const agent = document.createElement('div');
                    agent.className = `lobby-agent lobby-agent-slot-${getLobbyAgentSlot(p.id)}`;
                    if (isHost && p.id !== myId) {
                        agent.title = 'Кикнуть из лобби';
                        agent.onclick = () => kickPlayer(p.id);
                    }
                    agent.innerHTML = `
                        <div class="agent-head">${getAvatarHTML(p.avatar)}</div>
                        <div class="agent-body"><div class="agent-arm left"></div><div class="agent-chest"></div><div class="agent-arm right"></div></div>
                        <div class="agent-legs"><div></div><div></div></div>
                        <div class="agent-label">${getNameHTML(p.name, p.eqName)}</div>`;
                    stage.appendChild(agent);
                });
            }

            function getLobbyAgentSlot(playerId) {
                const activeIds = new Set(lobbyPlayers.map(p => p.id));
                Object.keys(lobbyAgentSlots).forEach(id => {
                    if (!activeIds.has(id)) delete lobbyAgentSlots[id];
                });
                if (lobbyAgentSlots[playerId]) return lobbyAgentSlots[playerId];
                const used = new Set(Object.values(lobbyAgentSlots));
                for (let i = 1; i <= 5; i++) {
                    if (!used.has(i)) {
                        lobbyAgentSlots[playerId] = i;
                        return i;
                    }
                }
                return 5;
            }

            function openInviteModal() { 
                const maxPlayers = getMaxPlayersForMode(typeof currentMode !== 'undefined' ? currentMode : 'tdm_5v5');
                if (lobbyPlayers.length >= maxPlayers) return showNegativeAlert("Игра заполнена"); 
                
                let l = document.getElementById('invite-friends-list'); 
                l.innerHTML = ''; 
                let a = friendsIds.filter(id => !lobbyPlayers.some(p => p.id === id) && !id.startsWith('ИИ'));
                
                let aiDiv = document.createElement('div'); 
                aiDiv.className = 'list-item'; 
                aiDiv.innerHTML = `<b>🤖 ИИ</b><button class="btn btn-green" onclick="inviteBotLobby();closeInviteModal()">Выбрать</button>`; 
                l.appendChild(aiDiv);
                
                if (a.length === 0) {
                    l.innerHTML += '<p style="color:gray;text-align:center;">Нет доступных игроков</p>'; 
                } else {
                    a.forEach(id => { 
                        db.ref('users/' + id).once('value').then(s => { 
                            if (s.exists()) { 
                                let p = s.val(); 
                                let d = document.createElement('div'); 
                                d.className = 'list-item'; 
                                d.innerHTML = `
                                    <div class="friend-row">
                                        <div style="font-size:30px;">${getAvatarHTML(p.avatar)}</div> 
                                        <div>${getNameHTML(p.name, p.eqName)}</div>
                                    </div>
                                    <button class="btn btn-green" onclick="inviteRealFriend('${id}');closeInviteModal()">Выбрать</button>`; 
                                l.appendChild(d); 
                            } 
                        }); 
                    }); 
                }
                document.getElementById('invite-modal').classList.remove('hidden'); 
            }

            function closeInviteModal() { document.getElementById('invite-modal').classList.add('hidden'); }

            function getLobbyPlayerPayload() {
                return {
                    name: myName,
                    avatar: myAvatar,
                    eqName: myEqName,
                    pMedals: myPinnedMedals,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP
                };
            }

            function sortedLobbyPlayerEntries(players) {
                return Object.keys(players || {}).sort((a, b) => {
                    const aj = safeGetJoinedAt(players[a]);
                    const bj = safeGetJoinedAt(players[b]);
                    if (aj !== bj) return aj - bj;
                    return String(a).localeCompare(String(b));
                });
            }

            function hasLobbyGuestsOrInvites(data = {}) {
                const players = data.players || {};
                const guests = Object.keys(players).filter(id => id !== myId && !isAiFriendId(id));
                const aiGuests = Object.keys(players).filter(id => id !== myId && isAiFriendId(id));
                const invites = data.invites || {};
                return guests.length > 0 || aiGuests.length > 0 || Object.keys(invites).length > 0;
            }

            function updateLobbyChrome(data = {}) {
                const leaveBtn = document.getElementById('lobby-leave-btn');
                const stage = document.getElementById('lobby-agents-stage');
                const playBtn = document.getElementById('lobby-play-btn');
                const guestMode = document.getElementById('lobby-guest-mode');
                const modeText = document.getElementById('selected-mode-text');
                const isRealLobby = hasLobbyGuestsOrInvites(data);
                if (leaveBtn) leaveBtn.style.display = isRealLobby ? 'inline-flex' : 'none';
                if (stage) stage.classList.toggle('home-solo-stage', !isRealLobby);
                if (playBtn) playBtn.style.display = isHost ? 'inline-flex' : 'none';
                if (modeText) modeText.style.display = isHost ? 'block' : 'none';
                if (guestMode) {
                    guestMode.style.display = isHost ? 'none' : 'flex';
                    guestMode.innerText = data.game && GAME_NAMES[data.game] ? GAME_NAMES[data.game] : 'РЕЖИМ НЕ ВЫБРАН';
                    guestMode.style.color = data.game && GAME_NAMES[data.game] ? '#34c759' : '#9ca3af';
                }
            }

            function maybePromoteMissingHost(data) {
                if (!data || !data.players || !lobbyId) return;
                if (data.host && data.players[data.host]) return;
                const nextHost = sortedLobbyPlayerEntries(data.players).find(id => !isAiFriendId(id)) || sortedLobbyPlayerEntries(data.players)[0];
                if (nextHost) db.ref(`lobbies/${lobbyId}/host`).set(nextHost).catch(() => {});
            }

            async function openLobby() { 
                if (appState.inLobby && lobbyId) {
                    appState.autoLobbyPaused = false;
                    document.getElementById('main-buttons-view').style.display = 'none';
                    document.getElementById('view-lobby').style.display = 'flex';
                    renderLobbySlots();
                    return;
                }

                const nextLobbyId = myId;
                const nextPlayers = [{id: myId, name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals, joinedAt: Date.now()}];

                try {
                    await writeDb('lobbies/' + nextLobbyId, {
                        host: myId, 
                        game: '', 
                        status: 'waiting', 
                        clickTime: 15, 
                        players: {
                            [myId]: getLobbyPlayerPayload()
                        }
                    }, 'create lobby');
                } catch (err) {
                    showNegativeAlert(getFirebaseFriendlyMessage("Не удалось создать лобби."));
                    return;
                }

                appState.inLobby = true; 
                appState.autoLobbyPaused = false;
                lobbyId = nextLobbyId; 
                isHost = true; 
                pendingModeId = null;
                setSelectedModeUI(null);
                lobbyAgentSlots = {};
                lobbyPlayers = nextPlayers; 
                
                db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                
                listenLobby(); 
                renderLobbySlots();
                document.getElementById('main-buttons-view').style.display = 'none';
                document.getElementById('view-lobby').style.display = 'flex'; 
                updateLobbyChrome({ players: { [myId]: nextPlayers[0] } });
            }

            function ensureHomeLobby() {
                if (appState.inLobby || pendingInvite || appState.autoLobbyPaused) return;
                openLobby();
            }

            function closeLobby(options = {}) {
                const shouldReopen = !!options.autoReopen;
                appState.autoLobbyPaused = !shouldReopen;
                appState.inLobby = false; 
                appState.suppressedGameStart = null;
                appState.currentContest = null;
                const closingLobbyId = lobbyId;
                const wasHost = isHost;
                if (lobbyRef) lobbyRef.off(); 
                if (closingLobbyId) {
                    db.ref('lobbies/' + closingLobbyId).onDisconnect().cancel();
                    db.ref(`lobbies/${closingLobbyId}/players/${myId}`).onDisconnect().cancel();
                }
                
                if (closingLobbyId && wasHost) { 
                    let rem = lobbyPlayers
                        .filter(p => p.id !== myId && !p.id.startsWith('ИИ'))
                        .sort((a, b) => safeGetJoinedAt(a) - safeGetJoinedAt(b));
                    if (rem.length > 0) {
                        let newHost = rem[0].id; 
                        db.ref(`lobbies/${closingLobbyId}/host`).set(newHost); 
                        db.ref(`lobbies/${closingLobbyId}/players/${myId}`).remove();
                    } else { 
                        db.ref('lobbies/' + closingLobbyId).remove(); 
                    }
                } else if (closingLobbyId) { 
                    db.ref(`lobbies/${closingLobbyId}/players/${myId}`).remove(); 
                } 
                document.getElementById('main-buttons-view').style.display = 'none';
                document.getElementById('view-lobby').style.display = 'none'; 
                updateLobbyChrome({});
                pendingModeId = null;
                setSelectedModeUI(null);
                lobbyId = null;
                isHost = false;
                lobbyPlayers = [];
                lobbyAgentSlots = {};
                db.ref(`users/${myId}/currentLobby`).remove().catch(() => {});
                if (shouldReopen) setTimeout(ensureHomeLobby, 300);
            }

            async function createLobbyWithAI() {
                closeFriendModal();
                await openLobby();
                if (appState.inLobby) setTimeout(() => inviteBotLobby(), 500);
            }

            function acceptLobbyInvite() { 
                if (pendingInvite) { 
                    const acceptedInvite = { ...pendingInvite };
                    if (appState.inLobby && lobbyId && lobbyId !== pendingInvite.lId) {
                        if (lobbyRef) lobbyRef.off();
                        closeLobby({autoReopen:false});
                    }
                    lobbyId = pendingInvite.lId; 
                    isHost = false; 
                    pendingModeId = null;
                    setSelectedModeUI(null);
                    db.ref(`lobbies/${lobbyId}/players/${myId}`).set(getLobbyPlayerPayload()); 
                    db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                    appState.inLobby = true; 
                    appState.autoLobbyPaused = false;
                    switchTab('friends', document.querySelector('[data-tab="friends"]'));
                    document.getElementById('main-buttons-view').style.display = 'none'; 
                    document.getElementById('view-lobby').style.display = 'flex'; 
                    listenLobby(); 
                    document.getElementById('top-notify').style.top = '-100px'; 
                    if (acceptedInvite.inviteKey) {
                        const chatId = getDmChatId(myId, acceptedInvite.hostId || acceptedInvite.host);
                        updateDbPaths({
                            [`dm_messages/${chatId}/${acceptedInvite.inviteKey}/accepted`]: true,
                            [`dm_messages/${chatId}/${acceptedInvite.inviteKey}/acceptedAt`]: firebase.database.ServerValue.TIMESTAMP,
                            [`dm_messages/${chatId}/${acceptedInvite.inviteKey}/acceptedBy`]: myId
                        }, 'mark lobby invite accepted').catch(() => {});
                        db.ref(`users/${myId}/lobby_invites/${acceptedInvite.inviteKey}`).remove().catch(() => {});
                    }
                    db.ref(`lobbies/${lobbyId}/invites/${myId}`).remove().catch(() => {});
                    db.ref(`users/${myId}/invite`).remove().catch(() => {});
                    pendingInvite = null; 
                } 
            }

            function inviteBotLobby() { 
                const maxPlayers = getMaxPlayersForMode(typeof currentMode !== 'undefined' ? currentMode : 'tdm_5v5');
                if (lobbyPlayers.length >= maxPlayers) return; 
                closeFriendModal(); 
                let aiNames = ['ИИ', 'ИИ2', 'ИИ3', 'ИИ4', 'ИИ5'];
                const aiId = aiNames.find(id => !lobbyPlayers.some(p => p.id === id));
                if (!aiId) return;
                db.ref(`lobbies/${lobbyId}/players/${aiId}`).set({...SYSTEM_BOT, id: aiId, name: aiId}).catch(() => {});
            }

            function inviteRealFriend(id) { 
                const maxPlayers = getMaxPlayersForMode(typeof currentMode !== 'undefined' ? currentMode : 'tdm_5v5');
                if (lobbyPlayers.length >= maxPlayers) return; 
                let rawName = myEqName ? SHOP_ITEMS.find(i => i.id === myEqName)?.name || myName : myName;
                const inviteRef = db.ref(`users/${id}/lobby_invites`).push();
                const chatId = getDmChatId(myId, id);
                const createdAt = firebase.database.ServerValue.TIMESTAMP;
                const invite = {
                    lId: lobbyId,
                    host: rawName,
                    hostId: myId,
                    createdAt
                };
                const inviteMsg = {
                    from: myId,
                    to: id,
                    text: `${rawName} зовет в лобби`,
                    type: 'lobby_invite',
                    inviteKey: inviteRef.key,
                    invite,
                    createdAt
                };
                const preview = { chatId, lastText: 'Приглашение в лобби', lastFrom: myId, updatedAt: createdAt };
                updateDbPaths({
                    [`users/${id}/invite`]: { ...invite, inviteKey: inviteRef.key },
                    [`users/${id}/lobby_invites/${inviteRef.key}`]: invite,
                    [`lobbies/${lobbyId}/invites/${id}`]: { from: myId, createdAt },
                    [`dm_threads/${chatId}/members/${myId}`]: true,
                    [`dm_threads/${chatId}/members/${id}`]: true,
                    [`dm_threads/${chatId}/updatedAt`]: createdAt,
                    [`dm_threads/${chatId}/lastMessage`]: { id: inviteRef.key, from: myId, text: 'Приглашение в лобби', createdAt },
                    [`dm_messages/${chatId}/${inviteRef.key}`]: inviteMsg,
                    [`users/${myId}/message_threads/${id}`]: { ...preview, friendId: id, unread: 0 },
                    [`users/${id}/message_threads/${myId}/chatId`]: chatId,
                    [`users/${id}/message_threads/${myId}/lastText`]: 'Приглашение в лобби',
                    [`users/${id}/message_threads/${myId}/lastFrom`]: myId,
                    [`users/${id}/message_threads/${myId}/updatedAt`]: createdAt,
                    [`users/${id}/message_threads/${myId}/friendId`]: myId
                }, 'send lobby invite').then(() => {
                    db.ref(`users/${id}/message_threads/${myId}/unread`).transaction(v => (parseInt(v) || 0) + 1);
                    setIsland("Приглашение отправлено", "#34c759");
                }).catch(() => {
                    showNegativeAlert(getFirebaseFriendlyMessage("Не удалось отправить приглашение."));
                }); 
                closeFriendModal(); 
            }

            function joinFriendLobby() { 
                const targetLobbyId = getFriendKnownLobbyId(activeFriend);
                if (appState.inLobby && lobbyId && lobbyId !== targetLobbyId) {
                    closeLobby({autoReopen:false});
                }
                lobbyId = targetLobbyId;
                isHost = false; 
                pendingModeId = null;
                setSelectedModeUI(null);
                closeFriendModal(); 
                db.ref('lobbies/' + lobbyId).once('value').then(s => { 
                    if (s.exists()) { 
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).set(getLobbyPlayerPayload()); 
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                        appState.inLobby = true; 
                        appState.autoLobbyPaused = false;
                        switchTab('friends', document.querySelector('[data-tab="friends"]'));
                        document.getElementById('main-buttons-view').style.display = 'none'; 
                        document.getElementById('view-lobby').style.display = 'flex'; 
                        listenLobby(); 
                    } else {
                        showNegativeAlert("Лобби нет или хост вышел!"); 
                    }
                }); 
            }

            function joinFriendPlayingBrLobby() {
                if (!activeFriend || activeFriend.id === 'ИИ') return;
                const targetLobbyId = getFriendKnownLobbyId(activeFriend);
                closeFriendModal();
                db.ref('lobbies/' + targetLobbyId).once('value').then(s => {
                    if (!s.exists()) return showNegativeAlert("Игра уже недоступна.");
                    const data = s.val();
                    if (!canJoinPlayingBrLobby(data)) return showNegativeAlert("Игра заполнена");

                    if (appState.inLobby && lobbyId && lobbyId !== targetLobbyId) {
                        closeLobby({autoReopen:false});
                    }

                    lobbyId = targetLobbyId;
                    isHost = false;
                    pendingModeId = null;
                    setSelectedModeUI('br_2d');
                    const payload = getLobbyPlayerPayload();
                    
                    let team1Count = 0;
                    let team2Count = 0;
                    if (data.br && data.br.players) {
                        Object.values(data.br.players).forEach(p => {
                            if (p.team === '1' || p.team === 'Counter-Terrorists') team1Count++;
                            else if (p.team === '2' || p.team === 'Terrorists') team2Count++;
                        });
                    }
                    const assignedTeam = team1Count <= team2Count ? 'Counter-Terrorists' : 'Terrorists';
                    const spawn = typeof brSpawnForId === 'function' ? brSpawnForId(myId, assignedTeam) : {x: 1000, y: 1000};
                    const now = Date.now();
                    updateDbPaths({
                        [`lobbies/${lobbyId}/players/${myId}`]: payload,
                        [`lobbies/${lobbyId}/br/players/${myId}`]: {
                            id: myId,
                            name: myName,
                            avatar: myAvatar,
                            eqName: myEqName,
                            x: Math.round(spawn.x),
                            y: Math.round(spawn.y),
                            vx: 0,
                            vy: 0,
                            hp: 200,
                            maxHp: 200,
                            team: assignedTeam,
                            speed: 3,
                            damageTaken: 0,
                            a: 0,
                            kills: 0,
                            shotSeq: 0,
                            alive: true,
                            invulnUntil: now + 5000,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        },
                        [`lobbies/${lobbyId}/br/damage/${myId}`]: 0
                    }, 'join playing br lobby').then(() => {
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                        db.ref(`lobbies/${lobbyId}/br/players/${myId}`).onDisconnect().update({alive: false, hp: 0});
                        appState.inLobby = true;
                        appState.autoLobbyPaused = false;
                        switchTab('friends', document.querySelector('[data-tab="friends"]'));
                        document.getElementById('main-buttons-view').style.display = 'none';
                        document.getElementById('view-lobby').style.display = 'flex';
                        listenLobby();
                    }).catch(() => {
                        showNegativeAlert(getFirebaseFriendlyMessage("Не удалось присоединиться к игре."));
                    });
                });
            }

            function listenLobby() { 
                if (lobbyRef) lobbyRef.off(); 
                lobbyRef = db.ref('lobbies/' + lobbyId); 
                lobbyRef.on('value', snap => { 
                    if (!snap.exists()) { 
                        if (!isHost) {
                            showNegativeAlert("Хост закрыл лобби!"); 
                            closeLobby({autoReopen:true});
                        } 
                        return; 
                    } 
                    let d = snap.val(); 
                    appState.lastLobbyStatus = d.status || 'waiting';
                    clearSuppressedGameStartIfStale(d);
                    maybePromoteMissingHost(d);
                    if (!isHost && (!d.players || !d.players[myId])) { 
                        showNegativeAlert("Вы удалены из лобби."); 
                        closeLobby({autoReopen:true});
                        return; 
                    }
                    isHost = d.host === myId;
                    if (d.currentMode) {
                        currentMode = d.currentMode;
                    } else {
                        currentMode = 'tdm_5v5';
                    }
                    if (isHost) db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                    if (d.game && !GAME_NAMES[d.game]) {
                        if (isHost) db.ref(`lobbies/${lobbyId}/game`).set(d.status === 'playing' ? 'br_2d' : '').catch(() => {});
                        return;
                    }
                    const isRealLobby = hasLobbyGuestsOrInvites(d);
                    const clientStatus = isGameStartSuppressed(d) ? 'waiting' : (d.status || 'waiting');
                    db.ref(`users/${myId}/currentLobby`).set({
                        lobbyId,
                        game: d.game || '',
                        status: clientStatus,
                        isRealLobby,
                        playersCount: Object.keys(d.players || {}).length,
                        inviteCount: Object.keys(d.invites || {}).length,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP
                    }).catch(() => {});

                    currentLobbySettings = d.settings || {};
                    appState.currentContest = d.contest || null;
                    lobbyPlayers = []; 
                    if (d.players && d.players[d.host]) { 
                        lobbyPlayers.push({id: d.host, ...d.players[d.host]}); 
                    } 
                    if (d.players) { 
                        Object.keys(d.players).forEach(k => {
                            if (k !== d.host) lobbyPlayers.push({id: k, ...d.players[k]});
                        }); 
                    } 
                    renderLobbySlots(); 
                    updateLobbyChrome(d);
                    
                    setSelectedModeUI(d.game || null);
                    if (!document.getElementById('game-settings-modal')?.classList.contains('hidden') && !isEditingGameSettingsModal()) {
                        renderGameSettingsModal(d.game || appState.selectedGameId || pendingModeId);
                    }

                    if (d.game === 'clicker') { 
                        if (d.clickTime && !clickActive) { 
                            clickTimeSetting = d.clickTime; 
                            document.getElementById('click-time-val').innerText = clickTimeSetting + ' сек'; 
                        } 
                        if (d.clickState === 'playing' && !clickActive) { 
                            startClickerGame(); 
                        } 
                        if (d.clickScores && Object.keys(d.clickScores).length === lobbyPlayers.filter(p => !p.id.startsWith('ИИ')).length && d.clickState === 'playing') { 
                            let t = "", mx = -1, w = []; 
                            Object.keys(d.clickScores).forEach(k => { 
                                let pf = lobbyPlayers.find(p => p.id === k); 
                                let nm = getNameHTML(pf?.name, pf?.eqName); 
                                t += `${nm}: <b>${d.clickScores[k]}</b>\n`; 
                                if (d.clickScores[k] > mx) {
                                    mx = d.clickScores[k];
                                    w = [k];
                                } else if (d.clickScores[k] === mx) {
                                    w.push(k);
                                } 
                            }); 
                            
                            if (w.length > 1) { 
                                showResult("НИЧЬЯ!", '#ff9f0a', '🤝', t); 
                                lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'clk', 'draw'); }); 
                            } else { 
                                let isMyWin = w.includes(myId); 
                                showResult(isMyWin ? "ПОБЕДА!" : "ПОРАЖЕНИЕ! -10 🪙", isMyWin ? '#34c759' : '#ff453a', '⏱️', t); 
                                if (!isMyWin) addCoins(-10); 
                                lobbyPlayers.forEach(p => { if (p.id !== myId) updatePvpStat(p.id, 'clk', isMyWin ? 'win' : 'loss'); }); 
                            } 
                            if (isHost) db.ref(`lobbies/${lobbyId}/clickState`).set('ended'); 
                        } 
                    } 
                    
                    if (d.status === 'playing' && d.game && !isGameStartSuppressed(d) && document.getElementById('game-container').style.display !== 'block') {
                        setSelectedModeUI(d.game);
                        startLocalGameUI(); 
                    } 
                    if (d.status === 'playing' && document.getElementById('game-container').style.display === 'block') {
                        const hostPaused = !!d.hostPaused;
                        if (hostPaused !== appState.hostPaused || (hostPaused && !appState.isPaused)) {
                            setPauseUI(hostPaused, hostPaused);
                        }
                    }
                    if (d.status === 'waiting' && document.getElementById('game-container').style.display === 'block') {
                        exitToLobby();
                    }
                }); 
            }

            function getDmChatId(a, b) {
                return [String(a), String(b)].sort().join('_');
            }

            let activeMessagesSubTab = 'friends';
            let messagesThreadsBadgeListener = null;
            let systemNotificationsBadgeListener = null;
            let messagesUnreadTotal = 0;
            let systemUnreadTotal = 0;

            function updateMessagesBadge(count = messagesUnreadTotal + systemUnreadTotal) {
                const badge = document.getElementById('messages-badge');
                if (!badge) return;
                const safeCount = parseInt(count || 0);
                badge.style.display = safeCount > 0 ? 'block' : 'none';
                badge.innerText = safeCount > 99 ? '99+' : String(safeCount);
            }

            function bindMessagesUnreadBadge() {
                if (!myId || messagesThreadsBadgeListener) return;
                messagesThreadsBadgeListener = snap => {
                    const threads = snap.exists() ? snap.val() : {};
                    messagesUnreadTotal = Object.values(threads).reduce((sum, thread) => sum + (parseInt(thread?.unread || 0) || 0), 0);
                    updateMessagesBadge();
                };
                systemNotificationsBadgeListener = snap => {
                    const notifications = snap.exists() ? snap.val() : {};
                    systemUnreadTotal = Object.values(notifications).reduce((sum, item) => sum + (item?.unread ? 1 : 0), 0);
                    updateMessagesBadge();
                    if (activeMessagesSubTab === 'system') renderSystemMessagesTab();
                };
                db.ref(`users/${myId}/message_threads`).on('value', messagesThreadsBadgeListener);
                db.ref(`users/${myId}/system_notifications`).on('value', systemNotificationsBadgeListener);
            }

            function acceptStoredLobbyInvite(key) {
                db.ref(`users/${myId}/lobby_invites/${key}`).once('value').then(s => {
                    if (!s.exists()) return showNegativeAlert("Приглашение уже недоступно.");
                    pendingInvite = { ...s.val(), inviteKey: key };
                    acceptLobbyInvite();
                });
            }

            function switchMessagesSubTab(tab, el) {
                activeMessagesSubTab = tab === 'system' ? 'system' : 'friends';
                const friendsBtn = document.getElementById('messages-tab-friends');
                const systemBtn = document.getElementById('messages-tab-system');
                const friendsList = document.getElementById('messages-friends-list');
                const systemList = document.getElementById('messages-system-list');
                if (friendsBtn) friendsBtn.classList.toggle('active', activeMessagesSubTab === 'friends');
                if (systemBtn) systemBtn.classList.toggle('active', activeMessagesSubTab === 'system');
                if (el) el.classList.add('active');
                if (friendsList) friendsList.style.display = activeMessagesSubTab === 'friends' ? 'flex' : 'none';
                if (systemList) systemList.style.display = activeMessagesSubTab === 'system' ? 'flex' : 'none';
                if (activeMessagesSubTab === 'system') {
                    document.getElementById('chat-active').style.display = 'none';
                    document.getElementById('system-active').style.display = 'none';
                    document.getElementById('chat-empty').style.display = 'flex';
                    document.getElementById('chat-empty').innerText = 'Выбери уведомление';
                } else {
                    document.getElementById('system-active').style.display = 'none';
                    document.getElementById('chat-empty').innerText = 'Выбери друга';
                    if (activeChatFriend && activeChatId) {
                        document.getElementById('chat-empty').style.display = 'none';
                        document.getElementById('chat-active').style.display = 'flex';
                    } else {
                        document.getElementById('chat-active').style.display = 'none';
                        document.getElementById('chat-empty').style.display = 'flex';
                    }
                }
                renderMessagesTab();
            }

            function renderMessagesTab() {
                if (activeMessagesSubTab === 'system') {
                    renderSystemMessagesTab();
                    return;
                }
                const list = document.getElementById('messages-friends-list');
                if (!list) return;
                const realFriends = friendsIds.filter(id => !isAiFriendId(id));

                db.ref(`users/${myId}/message_threads`).once('value').then(threadSnap => {
                    const threads = threadSnap.exists() ? threadSnap.val() : {};
                    const ids = Array.from(new Set([...realFriends, ...Object.keys(threads).filter(id => !isAiFriendId(id))]));
                    const sorted = ids.sort((a, b) => {
                        const af = realFriends.includes(a) ? 1 : 0;
                        const bf = realFriends.includes(b) ? 1 : 0;
                        if (af !== bf) return bf - af;
                        return (threads[b]?.updatedAt || 0) - (threads[a]?.updatedAt || 0);
                    });
                    list.innerHTML = '';
                    if (sorted.length === 0) list.innerHTML = '<div class="chat-empty">Нет сообщений</div>';
                    sorted.forEach(id => {
                        db.ref('users/' + id).once('value').then(s => {
                            const p = s.exists() ? s.val() : { name: `Игрок ${id}`, avatar: '👤', eqName: '' };
                            const row = document.createElement('div');
                            row.className = 'message-friend-row';
                            const lastText = threads[id]?.lastText ? escapeHTML(threads[id].lastText) : 'Нет сообщений';
                            const unread = parseInt(threads[id]?.unread || 0);
                            row.innerHTML = `
                                <div class="friend-row">
                                    <div style="font-size:30px;">${getAvatarHTML(p.avatar)}</div>
                                    <div class="message-friend-meta">
                                        <div>${getNameHTML(p.name || 'Игрок', p.eqName)}</div>
                                        <span>${lastText}</span>
                                    </div>
                                </div>
                                ${unread > 0 ? `<b class="message-unread">${unread}</b>` : ''}`;
                            row.onclick = () => openFriendChat(id, {id, ...p});
                            list.appendChild(row);
                        });
                    });
                });
            }

            function renderSystemMessagesTab() {
                const list = document.getElementById('messages-system-list');
                if (!list) return;
                db.ref(`users/${myId}/system_notifications`).once('value').then(snap => {
                    const notifications = snap.exists() ? snap.val() : {};
                    const rows = Object.keys(notifications)
                        .map(key => ({ id: key, ...notifications[key] }))
                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    list.innerHTML = '';
                    if (rows.length === 0) {
                        list.innerHTML = '<div class="chat-empty">Нет системных уведомлений</div>';
                        return;
                    }
                    rows.forEach(item => {
                        const row = document.createElement('div');
                        row.className = 'message-friend-row system-row';
                        row.innerHTML = `
                            <div class="friend-row">
                                <div class="system-row-icon">${getSystemNotificationIcon(item)}</div>
                                <div class="message-friend-meta">
                                    <div>${escapeHTML(item.title || 'СИСТЕМА')}</div>
                                    <span>${escapeHTML(getSystemNotificationPreview(item))}</span>
                                </div>
                            </div>
                            ${item.unread ? '<b class="message-unread">1</b>' : ''}`;
                        row.onclick = () => openSystemNotification(item.id, item);
                        list.appendChild(row);
                    });
                });
            }

            function getSystemNotificationIcon(item = {}) {
                if (item.type === 'gift') return '🎁';
                if (item.type === 'friend_accepted') return '👥';
                return '!';
            }

            function getSystemNotificationPreview(item = {}) {
                if (item.type === 'gift') {
                    return item.anonymous ? 'Анонимный подарок' : `Подарок от ${item.fromName || 'игрока'}`;
                }
                if (item.type === 'friend_accepted') return item.text || 'Этот игрок принял вашу заявку';
                return item.text || 'Новое уведомление';
            }

            function openSystemNotification(id, item) {
                activeMessagesSubTab = 'system';
                switchTab('messages', document.querySelector('[data-tab="messages"]'));
                switchMessagesSubTab('system', document.getElementById('messages-tab-system'));
                document.getElementById('chat-empty').style.display = 'none';
                document.getElementById('chat-active').style.display = 'none';
                document.getElementById('system-active').style.display = 'flex';
                document.getElementById('system-detail-title').innerText = item.title || 'Система';
                document.getElementById('system-detail-body').innerHTML = renderSystemNotificationDetail(item);
                db.ref(`users/${myId}/system_notifications/${id}/unread`).set(false).catch(() => {});
            }

            function renderSystemNotificationDetail(item = {}) {
                if (item.type === 'friend_accepted') {
                    return `
                        <div class="system-detail-text">${escapeHTML(item.text || 'Этот игрок принял вашу заявку')}</div>
                        <div class="system-player-line">
                            <div class="chat-peer-avatar">${getAvatarHTML(item.playerAvatar || '👤')}</div>
                            <div>
                                <div class="chat-peer-name">${getNameHTML(item.playerName || 'Игрок', item.playerEqName || '')}</div>
                                <div class="chat-peer-id">ID: ${escapeHTML(item.playerId || '...')}</div>
                            </div>
                        </div>`;
                }
                if (item.type === 'gift') {
                    const fromText = item.anonymous ? 'Подарок отправлен анонимно' : `Подарок от игрока ${escapeHTML(item.fromName || 'Игрок')}`;
                    const coins = parseInt(item.coins || 0);
                    const giftRows = [];
                    if (coins > 0) giftRows.push(`<div class="gift-item-row"><div class="gift-item-icon">🪙</div><div><b>${coins} монет</b></div></div>`);
                    (item.items || []).forEach(gift => giftRows.push(renderGiftItemLine(gift)));
                    return `
                        <div class="system-detail-text">${fromText}</div>
                        <div class="gift-items-list">${giftRows.join('') || '<span style="color:#888;">Подарок пуст</span>'}</div>`;
                }
                return `<div class="system-detail-text">${escapeHTML(item.text || 'Новое системное уведомление')}</div>`;
            }

            function renderGiftItemLine(gift = {}) {
                const item = SHOP_ITEMS.find(i => i.id === gift.id);
                const visual = item ? (item.type === 'name' ? item.plainIcon : getItemVisualHTML(item)) : '🎁';
                const name = gift.name || item?.name || gift.id || 'Предмет';
                const qty = Math.max(1, parseInt(gift.qty || 1));
                return `<div class="gift-item-row"><div class="gift-item-icon">${visual}</div><div><b>${escapeHTML(name)}</b><span>x${qty}</span></div></div>`;
            }

            function openFriendChat(friendId, profile) {
                if (isAiFriendId(friendId)) return showNegativeAlert("ИИ не принимает сообщения.");
                activeMessagesSubTab = 'friends';
                activeChatFriend = { id: friendId, ...(profile || {}) };
                switchTab('messages', document.querySelector('[data-tab="messages"]'));
                switchMessagesSubTab('friends', document.getElementById('messages-tab-friends'));
                document.getElementById('chat-empty').style.display = 'none';
                document.getElementById('chat-active').style.display = 'flex';
                document.getElementById('system-active').style.display = 'none';
                document.getElementById('chat-peer-avatar').innerHTML = getAvatarHTML(activeChatFriend.avatar);
                document.getElementById('chat-peer-name').innerHTML = getNameHTML(activeChatFriend.name || 'Игрок', activeChatFriend.eqName);
                document.getElementById('chat-peer-id').innerText = `ID: ${friendId}`;
                const chatId = getDmChatId(myId, friendId);
                bindChatMessages(chatId);
                db.ref(`users/${myId}/message_threads/${friendId}/unread`).set(0).catch(() => {});
                renderMessagesTab();
            }

            function bindChatMessages(chatId) {
                if (chatMessagesListener && activeChatId) {
                    db.ref(`dm_messages/${activeChatId}`).off('value', chatMessagesListener);
                }
                activeChatId = chatId;
                const box = document.getElementById('chat-messages');
                box.innerHTML = '';
                chatMessagesListener = snap => {
                    const messages = snap.exists() ? snap.val() : {};
                    const rows = Object.keys(messages)
                        .map(key => ({id: key, ...messages[key]}))
                        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                    box.innerHTML = rows.map(renderChatMessage).join('');
                    box.scrollTop = box.scrollHeight;
                };
                db.ref(`dm_messages/${chatId}`).on('value', chatMessagesListener);
            }

            function renderChatMessage(m) {
                const side = m.from === myId ? 'own' : 'friend';
                if (m.type === 'lobby_invite') {
                    const inviteKey = m.inviteKey || m.id;
                    const inviteText = escapeHTML(m.text || 'Приглашение в лобби');
                    const button = m.accepted
                        ? `<button class="btn btn-disabled lobby-invite-chat-btn lobby-invite-accepted" disabled>ПРИНЯТО</button>`
                        : (m.to === myId
                        ? `<button class="btn btn-green lobby-invite-chat-btn" onclick="event.stopPropagation(); acceptStoredLobbyInvite('${inviteKey}')">Войти</button>`
                        : '');
                    return `
                        <div class="message-bubble ${side} lobby-invite-chat">
                            <div class="lobby-invite-chat-title">Приглашение в лобби</div>
                            <div>${inviteText}</div>
                            ${button}
                        </div>`;
                }
                return `
                    <div class="message-bubble ${side}">
                        <div>${escapeHTML(m.text)}</div>
                    </div>`;
            }

            function sendChatMessage() {
                if (!activeChatFriend || isAiFriendId(activeChatFriend.id)) return;
                const input = document.getElementById('chat-input');
                const text = input.value.trim();
                if (!text) return;
                const friendId = activeChatFriend.id;
                const chatId = getDmChatId(myId, friendId);
                const msgRef = db.ref(`dm_messages/${chatId}`).push();
                const createdAt = firebase.database.ServerValue.TIMESTAMP;
                const msg = { from: myId, to: friendId, text, createdAt };
                const preview = { chatId, lastText: text, lastFrom: myId, updatedAt: createdAt };

                input.value = '';
                updateDbPaths({
                    [`dm_threads/${chatId}/members/${myId}`]: true,
                    [`dm_threads/${chatId}/members/${friendId}`]: true,
                    [`dm_threads/${chatId}/updatedAt`]: createdAt,
                    [`dm_threads/${chatId}/lastMessage`]: { id: msgRef.key, from: myId, text, createdAt },
                    [`dm_messages/${chatId}/${msgRef.key}`]: msg,
                    [`users/${myId}/message_threads/${friendId}`]: { ...preview, friendId, unread: 0 },
                    [`users/${friendId}/message_threads/${myId}/chatId`]: chatId,
                    [`users/${friendId}/message_threads/${myId}/lastText`]: text,
                    [`users/${friendId}/message_threads/${myId}/lastFrom`]: myId,
                    [`users/${friendId}/message_threads/${myId}/updatedAt`]: createdAt,
                    [`users/${friendId}/message_threads/${myId}/friendId`]: myId
                }, 'send direct message').then(() => {
                    db.ref(`users/${friendId}/message_threads/${myId}/unread`).transaction(v => (parseInt(v) || 0) + 1);
                    renderMessagesTab();
                }).catch(() => {
                    showNegativeAlert(getFirebaseFriendlyMessage("Не удалось отправить сообщение."));
                });
            }
