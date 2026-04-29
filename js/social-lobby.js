            // ================== ДРУЗЬЯ И ЛОББИ ==================
            let friendListeners = {};

            function renderFriends() { 
                const list = document.getElementById('fr-list'); 
                list.innerHTML = ''; 
                Object.keys(friendListeners).forEach(id => db.ref('users/' + id).off('value', friendListeners[id]));
                friendListeners = {};
                
                friendsIds.forEach(id => { 
                    if (id === 'ИИ') { 
                        let d = document.createElement('div'); 
                        d.className = 'list-item'; 
                        d.innerHTML = `
                            <div class="friend-row">
                                <div style="font-size:30px;">🤖</div> 
                                <div><b>ИИ</b><br><span style="font-size:10px;color:gray;">ID: ИИ</span></div>
                            </div>`; 
                        d.onclick = () => openFriendModal(SYSTEM_BOT); 
                        list.appendChild(d); 
                        return; 
                    } 
                    let d = document.createElement('div'); 
                    d.className = 'list-item'; 
                    d.id = 'friend-row-' + id;
                    list.appendChild(d);
                    
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
                            db.ref(`users/${id}/friend_reqs/${myId}`).set(true); 
                            tg.showAlert("Заявка отправлена!"); 
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
                }
                
                if (appState.inLobby) { 
                    if (f.id === 'ИИ') {
                        a.innerHTML += `<button class="btn btn-green" onclick="inviteBotLobby()">Пригласить 🤖</button>`; 
                    } else {
                        a.innerHTML += `<button class="btn btn-green" onclick="inviteRealFriend('${f.id}')">Пригласить 🎮</button>`; 
                    }
                } else { 
                    if (f.id === 'ИИ') {
                        a.innerHTML += `<button class="btn btn-green" onclick="createLobbyWithAI()">Играть с ИИ 🤖</button>`; 
                    } else {
                        a.innerHTML += `<button class="btn btn-green" onclick="joinFriendLobby()">Присоединиться 🚀</button>`; 
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

            function removeFriend() { 
                if (confirm(`Удалить?`)) { 
                    db.ref(`users/${myId}/friends/${activeFriend.id}`).remove(); 
                    db.ref(`users/${activeFriend.id}/friends/${myId}`).remove(); 
                    closeFriendModal(); 
                } 
            }

            function kickPlayer(id) { 
                if (!isHost || id === myId) return; 
                if (confirm("Удалить игрока из лобби?")) { 
                    db.ref(`lobbies/${lobbyId}/players/${id}`).remove(); 
                } 
            }

            function renderLobbySlots() { 
                const c = document.getElementById('lobby-slots-container'); 
                c.innerHTML = ''; 
                for (let i = 0; i < 5; i++) { 
                    if (i < lobbyPlayers.length) { 
                        let p = lobbyPlayers[i]; 
                        let clickEvent = (isHost && p.id !== myId) ? `onclick="kickPlayer('${p.id}')" style="cursor:pointer;"` : '';
                        c.innerHTML += `
                            <div class="square-slot ${i === 0 ? 'active-slot' : ''}" ${clickEvent}>
                                <div class="slot-avatar">${getAvatarHTML(p.avatar)}</div>
                                <div class="slot-name">${getNameHTML(p.name, p.eqName)}</div>
                                <div class="slot-status">${i === 0 ? 'Хост' : (p.id.startsWith('ИИ') ? 'Бот' : 'Игрок')}</div>
                            </div>`; 
                    } else {
                        c.innerHTML += `
                            <div class="square-slot" style="opacity:0.5;cursor:pointer;" onclick="openInviteModal()">
                                <div class="slot-avatar">➕</div>
                                <div class="slot-name" style="color:gray;">Пригласить</div>
                            </div>`; 
                    }
                } 
            }

            function openInviteModal() { 
                if (!isHost) return tg.showAlert("Только Хост!"); 
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

            async function openLobby() { 
                const nextLobbyId = myId;
                const nextPlayers = [{id: myId, name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals}];

                try {
                    await writeDb('lobbies/' + nextLobbyId, {
                        host: myId, 
                        game: '', 
                        status: 'waiting', 
                        clickTime: 15, 
                        players: {
                            [myId]: {name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals}
                        }
                    }, 'create lobby');
                } catch (err) {
                    tg.showAlert(getFirebaseFriendlyMessage("Не удалось создать лобби."));
                    return;
                }

                appState.inLobby = true; 
                lobbyId = nextLobbyId; 
                isHost = true; 
                pendingModeId = null;
                setSelectedModeUI(null);
                lobbyPlayers = nextPlayers; 
                
                db.ref('lobbies/' + lobbyId).onDisconnect().remove();
                
                listenLobby(); 
                document.getElementById('main-buttons-view').style.display = 'none'; 
                document.getElementById('view-lobby').style.display = 'flex'; 
            }

            function closeLobby() { 
                appState.inLobby = false; 
                if (lobbyRef) lobbyRef.off(); 
                db.ref('lobbies/' + lobbyId).onDisconnect().cancel();
                db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().cancel();
                
                if (isHost) { 
                    let rem = lobbyPlayers.filter(p => p.id !== myId && !p.id.startsWith('ИИ'));
                    if (rem.length > 0) {
                        let newHost = rem[0].id; 
                        db.ref(`lobbies/${lobbyId}/host`).set(newHost); 
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).remove();
                    } else { 
                        db.ref('lobbies/' + lobbyId).remove(); 
                    }
                } else { 
                    db.ref(`lobbies/${lobbyId}/players/${myId}`).remove(); 
                } 
                document.getElementById('main-buttons-view').style.display = 'flex'; 
                document.getElementById('view-lobby').style.display = 'none'; 
                pendingModeId = null;
                setSelectedModeUI(null);
            }

            async function createLobbyWithAI() {
                closeFriendModal();
                await openLobby();
                if (appState.inLobby) setTimeout(() => inviteBotLobby(), 500);
            }

            function acceptLobbyInvite() { 
                if (pendingInvite) { 
                    lobbyId = pendingInvite.lId; 
                    isHost = false; 
                    pendingModeId = null;
                    setSelectedModeUI(null);
                    db.ref(`lobbies/${lobbyId}/players/${myId}`).set({ 
                        name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals 
                    }); 
                    db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                    appState.inLobby = true; 
                    switchTab('friends', document.querySelectorAll('.nav-item')[2]); 
                    document.getElementById('main-buttons-view').style.display = 'none'; 
                    document.getElementById('view-lobby').style.display = 'flex'; 
                    listenLobby(); 
                    document.getElementById('top-notify').style.top = '-100px'; 
                    pendingInvite = null; 
                } 
            }

            function inviteBotLobby() { 
                if (!isHost || lobbyPlayers.length >= 5) return; 
                closeFriendModal(); 
                let aiNames = ['ИИ', 'ИИ2', 'ИИ3', 'ИИ4', 'ИИ5'];
                let nextAi = aiNames.find(n => !lobbyPlayers.some(p => p.id === n));
                if (nextAi) {
                    db.ref(`lobbies/${lobbyId}/players/${nextAi}`).set({...SYSTEM_BOT, id: nextAi, name: nextAi}); 
                }
            }

            function inviteRealFriend(id) { 
                if (lobbyPlayers.length >= 5) return; 
                let rawName = myEqName ? SHOP_ITEMS.find(i => i.id === myEqName)?.name || myName : myName;
                db.ref(`users/${id}/invite`).set({lId: lobbyId, host: rawName}); 
                tg.showAlert("Отправлено!"); 
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
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).set({name: myName, avatar: myAvatar, eqName: myEqName, pMedals: myPinnedMedals}); 
                        db.ref(`lobbies/${lobbyId}/players/${myId}`).onDisconnect().remove();
                        appState.inLobby = true; 
                        switchTab('friends', document.querySelectorAll('.nav-item')[2]); 
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
                            closeLobby();
                        } 
                        return; 
                    } 
                    let d = snap.val(); 
                    if (!isHost && (!d.players || !d.players[myId])) { 
                        tg.showAlert("Вы удалены из лобби."); 
                        closeLobby(); 
                        return; 
                    }
                    if (d.host === myId && !isHost) { 
                        isHost = true; 
                        db.ref(`lobbies/${lobbyId}`).onDisconnect().remove(); 
                    }

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
                    
                    setSelectedModeUI(d.game || null);

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
                    
                    if (d.status === 'playing' && document.getElementById('game-container').style.display !== 'block') { 
                        startLocalGameUI(); 
                    } 
                    
                    if (d.status === 'playing_ai' && document.getElementById('ai-game-overlay').style.display !== 'flex') {
                        startAiGameLogic();
                    }
                }); 
            }
