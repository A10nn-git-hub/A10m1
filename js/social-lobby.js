            // ================== ДРУЗЬЯ И ЛОББИ ==================
            let friendListeners = {};
            let activePreviewPlayer = null;
            let activeChatFriend = null;
            let activeChatId = null;
            let chatMessagesListener = null;

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
                                </div>`; 
                            rEl.onclick = () => openFriendModal({ id: id, name: p.name || 'Игрок', avatar: p.avatar, eqName: p.eqName, pMedals: p.pMedals });
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
                    if (friendsIds.includes(id)) return tg.showAlert("Уже в списке!"); 
                    db.ref('users/' + id).once('value').then(s => { 
                        if (s.exists()) { 
                            openFriendPreview(id, s.val(), false);
                        } else {
                            tg.showAlert("Не найден!"); 
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
                tg.showAlert("Друг добавлен!"); 
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
                    a.innerHTML += `<button class="btn btn-dark" onclick="openFriendChatFromModal()">Сообщение 💬</button>`;
                }
                
                if (appState.inLobby) { 
                    if (f.id === 'ИИ') {
                        a.innerHTML += `<button class="btn btn-green" onclick="inviteBotLobby()">Пригласить 🤖</button>`; 
                    } else {
                        a.innerHTML += `<button class="btn btn-green" onclick="inviteRealFriend('${f.id}')">Пригласить 🎮</button>`; 
                    }
                } else { 
                    if (f.id !== 'ИИ') {
                        db.ref('lobbies/' + f.id).once('value').then(s => {
                            if (s.exists() && document.getElementById('friend-modal') && !document.getElementById('friend-modal').classList.contains('hidden')) {
                                document.getElementById('friend-actions').insertAdjacentHTML('beforeend', `<button class="btn btn-green" onclick="joinFriendLobby()">Присоединиться 🚀</button>`);
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
                tg.showAlert("Заявка отправлена!");
                document.getElementById('friend-preview-add').style.display = 'none';
                showFriendPreviewActions();
            }

            function openPreviewProfile() {
                if (!activePreviewPlayer) return;
                openProfileStatsModal(activePreviewPlayer.id);
            }

            function invitePreviewToLobby() {
                if (!activePreviewPlayer) return;
                if (!appState.inLobby) return tg.showAlert("Сначала зайди в лобби.");
                inviteRealFriend(activePreviewPlayer.id);
                closeFriendPreview();
            }

            function messagePreviewPlayer() {
                if (!activePreviewPlayer) return;
                if (isAiFriendId(activePreviewPlayer.id)) return tg.showAlert("ИИ не принимает сообщения.");
                closeFriendPreview();
                openFriendChat(activePreviewPlayer.id, activePreviewPlayer);
            }

            function openFriendChatFromModal() {
                if (!activeFriend || isAiFriendId(activeFriend.id)) return;
                const friend = {...activeFriend};
                closeFriendModal();
                openFriendChat(friend.id, friend);
            }

            function removeFriend() { 
                if (confirm(`Удалить?`)) { 
                    db.ref(`users/${myId}/friends/${activeFriend.id}`).remove(); 
                    db.ref(`users/${activeFriend.id}/friends/${myId}`).remove(); 
                    closeFriendModal(); 
                } 
            }

            function kickPlayer(id) { 
                if (!isHost || id === myId) return; 
                if (confirm("Вы уверены, что хотите кикнуть этого игрока из лобби?")) { 
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
                const count = Math.max(1, lobbyPlayers.length);
                lobbyPlayers.forEach((p, i) => {
                    const agent = document.createElement('div');
                    agent.className = `lobby-agent lobby-agent-${count}-${i + 1}`;
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

            function openInviteModal() { 
                if (lobbyPlayers.length >= 5) return tg.showAlert("Полно!"); 
                
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
                    const aj = Number(players[a]?.joinedAt || 0);
                    const bj = Number(players[b]?.joinedAt || 0);
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
                const isRealLobby = hasLobbyGuestsOrInvites(data);
                if (leaveBtn) leaveBtn.style.display = isRealLobby ? 'inline-flex' : 'none';
                if (stage) stage.classList.toggle('home-solo-stage', !isRealLobby);
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
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось создать лобби."));
                    return;
                }

                appState.inLobby = true; 
                appState.autoLobbyPaused = false;
                lobbyId = nextLobbyId; 
                isHost = true; 
                pendingModeId = null;
                setSelectedModeUI(null);
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
                        .sort((a, b) => (Number(a.joinedAt || 0) - Number(b.joinedAt || 0)));
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
                if (shouldReopen) setTimeout(ensureHomeLobby, 300);
            }

            async function createLobbyWithAI() {
                closeFriendModal();
                await openLobby();
                if (appState.inLobby) setTimeout(() => inviteBotLobby(), 500);
            }

            function acceptLobbyInvite() { 
                if (pendingInvite) { 
                    if (appState.inLobby && isHost && lobbyId && lobbyId !== pendingInvite.lId) {
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
                    if (pendingInvite.inviteKey) db.ref(`users/${myId}/lobby_invites/${pendingInvite.inviteKey}`).remove().catch(() => {});
                    db.ref(`lobbies/${lobbyId}/invites/${myId}`).remove().catch(() => {});
                    db.ref(`users/${myId}/invite`).remove().catch(() => {});
                    pendingInvite = null; 
                } 
            }

            function inviteBotLobby() { 
                if (lobbyPlayers.length >= 5) return; 
                closeFriendModal(); 
                let aiNames = ['ИИ', 'ИИ2', 'ИИ3', 'ИИ4', 'ИИ5'];
                const aiId = aiNames.find(id => !lobbyPlayers.some(p => p.id === id));
                if (!aiId) return;
                db.ref(`lobbies/${lobbyId}/players/${aiId}`).set({...SYSTEM_BOT, id: aiId, name: aiId}).catch(() => {});
            }

            function inviteRealFriend(id) { 
                if (lobbyPlayers.length >= 5) return; 
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
                    tg.showAlert("Отправлено!");
                }).catch(() => {
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось отправить приглашение."));
                }); 
                closeFriendModal(); 
            }

            function joinFriendLobby() { 
                lobbyId = activeFriend.id; 
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
                        tg.showAlert("Лобби нет или хост вышел!"); 
                    }
                }); 
            }

            function listenLobby() { 
                if (lobbyRef) lobbyRef.off(); 
                lobbyRef = db.ref('lobbies/' + lobbyId); 
                lobbyRef.on('value', snap => { 
                    if (!snap.exists()) { 
                        if (!isHost) {
                            tg.showAlert("Хост закрыл лобби!"); 
                            closeLobby({autoReopen:true});
                        } 
                        return; 
                    } 
                    let d = snap.val(); 
                    maybePromoteMissingHost(d);
                    if (!isHost && (!d.players || !d.players[myId])) { 
                        tg.showAlert("Вы удалены из лобби."); 
                        closeLobby({autoReopen:true});
                        return; 
                    }
                    isHost = d.host === myId;
                    if (isHost) db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();

                    currentLobbySettings = d.settings || {};
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
                    
                    if (d.status === 'playing' && d.game && document.getElementById('game-container').style.display !== 'block') {
                        setSelectedModeUI(d.game);
                        startLocalGameUI(); 
                    } 
                }); 
            }

            function getDmChatId(a, b) {
                return [String(a), String(b)].sort().join('_');
            }

            let messagesBadgeListener = null;

            function updateMessagesBadge(count) {
                const badge = document.getElementById('messages-badge');
                if (!badge) return;
                const safeCount = parseInt(count || 0);
                badge.style.display = safeCount > 0 ? 'block' : 'none';
                badge.innerText = safeCount > 99 ? '99+' : String(safeCount);
            }

            function bindMessagesUnreadBadge() {
                if (!myId || messagesBadgeListener) return;
                messagesBadgeListener = snap => {
                    const threads = snap.exists() ? snap.val() : {};
                    const total = Object.values(threads).reduce((sum, thread) => sum + (parseInt(thread?.unread || 0) || 0), 0);
                    updateMessagesBadge(total);
                };
                db.ref(`users/${myId}/message_threads`).on('value', messagesBadgeListener);
            }

            function acceptStoredLobbyInvite(key) {
                db.ref(`users/${myId}/lobby_invites/${key}`).once('value').then(s => {
                    if (!s.exists()) return tg.showAlert("Приглашение уже недоступно.");
                    pendingInvite = { ...s.val(), inviteKey: key };
                    acceptLobbyInvite();
                });
            }

            function renderMessagesTab() {
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

            function openFriendChat(friendId, profile) {
                if (isAiFriendId(friendId)) return tg.showAlert("ИИ не принимает сообщения.");
                activeChatFriend = { id: friendId, ...(profile || {}) };
                switchTab('messages', document.querySelector('[data-tab="messages"]'));
                document.getElementById('chat-empty').style.display = 'none';
                document.getElementById('chat-active').style.display = 'flex';
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
                    const button = m.to === myId
                        ? `<button class="btn btn-green lobby-invite-chat-btn" onclick="event.stopPropagation(); acceptStoredLobbyInvite('${inviteKey}')">Войти</button>`
                        : '';
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
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось отправить сообщение."));
                });
            }
